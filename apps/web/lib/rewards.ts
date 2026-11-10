import "server-only";
import {
  bonusBalance,
  bonusExpiresSoonest,
  bonusExpiry,
  getTier,
  passportStatus,
  referralCounts,
  referralStatus,
  RULES,
  type BonusGrant,
  type MemberRewards,
} from "@sippy/core";
import { env } from "./env";
import { sendEmail, sendPush } from "./notify";
import { supabaseAdmin } from "./supabase/server";

/*
 * Rewards (rules in packages/core/src/rules/rewards.ts):
 * - Neighborhood Passport: pick up at 5 different shops → 1 bonus pass.
 * - Grand Tour (on once more than 50 shops are live): every shop live 30+ days → 2 months free.
 * - Referrals: every 2 friends who join and pay their first month → 3 bonus passes.
 * Bonus passes roll over for a year. Every award is idempotent (unique keys), so calling these
 * again (webhook retries, double scans) never pays twice.
 */

export async function getBonusGrants(memberId: string): Promise<BonusGrant[]> {
  const { data } = await supabaseAdmin().from("bonus_passes").select("id, source, passes, used, granted_at, expires_at").eq("member_id", memberId);
  return (data ?? []).map((r) => ({ id: r.id, source: r.source, passes: r.passes, used: r.used, grantedAt: r.granted_at, expiresAt: r.expires_at }));
}

export async function getBonusLeft(memberId: string, now = new Date()): Promise<{ left: number; expiresSoonest: string | null }> {
  const grants = await getBonusGrants(memberId);
  return { left: bonusBalance(grants, now), expiresSoonest: bonusExpiresSoonest(grants, now)?.toISOString() ?? null };
}

async function visitData(memberId: string) {
  const db = supabaseAdmin();
  const [{ data: visits }, { data: live }, { data: passport }, { data: tour }] = await Promise.all([
    db.from("orders").select("shop_id").eq("member_id", memberId).eq("status", "picked_up"),
    db.from("shops").select("id, live_since, created_at").eq("status", "active"),
    db.from("bonus_passes").select("id").eq("member_id", memberId).eq("source_key", "passport").maybeSingle(),
    db.from("grand_tour_rewards").select("member_id").eq("member_id", memberId).maybeSingle(),
  ]);
  return passportStatus({
    visitedShopIds: (visits ?? []).map((v) => v.shop_id as string),
    liveShops: (live ?? []).map((s) => ({ id: s.id, liveSince: s.live_since ?? s.created_at })),
    passportEarned: Boolean(passport),
    grandTourEarned: Boolean(tour),
    now: new Date(),
  });
}

export async function getMemberRewards(memberId: string, referralCode: string | null): Promise<MemberRewards> {
  const db = supabaseAdmin();
  const [passport, { count: friends }, { count: granted }] = await Promise.all([
    visitData(memberId),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("referred_by", memberId).not("first_paid_at", "is", null),
    db.from("bonus_passes").select("id", { count: "exact", head: true }).eq("member_id", memberId).eq("source", "referral"),
  ]);
  return {
    passport,
    referral: { ...referralStatus(friends ?? 0, granted ?? 0), code: referralCode, link: referralCode ? `${env.siteUrl()}/signup?ref=${referralCode}` : null },
  };
}

async function grantBonus(memberId: string, source: "passport" | "referral", key: string, passes: number, note: string): Promise<boolean> {
  const now = new Date();
  const { error } = await supabaseAdmin()
    .from("bonus_passes")
    .insert({ member_id: memberId, source, source_key: key, passes, granted_at: now.toISOString(), expires_at: bonusExpiry(now).toISOString(), note });
  if (error && error.code === "23505") return false; // already given
  if (error) throw error;
  return true;
}

/** After a pickup: award the Neighborhood Passport and the Grand Tour when they're earned. */
export async function awardVisitRewards(memberId: string): Promise<void> {
  const st = await visitData(memberId);
  if (st.passportDue) {
    const n = RULES.passportFreePasses;
    if (await grantBonus(memberId, "passport", "passport", n, `Neighborhood Passport: ${st.goal} shops visited`)) {
      await sendPush([memberId], "consumer", "Passport complete! 🎉", `${st.goal} local shops visited. Here's ${n === 1 ? "a free day pass" : `${n} free day passes`}, good for a year.`, { screen: "account" }).catch(() => {});
    }
  }
  if (st.grandTour.due) await awardGrandTour(memberId);
}

/** Grand Tour: two months of the member's plan free, as a one-time Stripe coupon on their subscription. */
async function awardGrandTour(memberId: string): Promise<void> {
  const db = supabaseAdmin();
  const months = RULES.grandTourFreeMonths;
  const { error } = await db.from("grand_tour_rewards").insert({ member_id: memberId, free_months: months });
  if (error?.code === "23505") return; // already given
  if (error) throw error;

  const { data: sub } = await db
    .from("subscriptions")
    .select("stripe_subscription_id, tier")
    .eq("member_id", memberId)
    .in("status", ["active", "trialing", "past_due"])
    .maybeSingle();
  if (process.env.STRIPE_SECRET_KEY && sub?.stripe_subscription_id) {
    const { stripe } = await import("./billing");
    const coupon = await stripe().coupons.create({
      percent_off: 100,
      duration: "repeating",
      duration_in_months: months,
      max_redemptions: 1,
      name: `Grand Tour: ${months} months free`,
      metadata: { member_id: memberId, kind: "grand_tour" },
    });
    await stripe().subscriptions.update(sub.stripe_subscription_id, { discounts: [{ coupon: coupon.id }] });
    await db.from("grand_tour_rewards").update({ stripe_coupon: coupon.id }).eq("member_id", memberId);
  }
  const plan = sub ? getTier(sub.tier).name : "your plan";
  await sendPush([memberId], "consumer", "You did the Grand Tour! 🏆", `Every shop, visited. Your next ${months} months of ${plan} are on us.`, { screen: "account" }).catch(() => {});
}

/**
 * A member's first month is paid: mark it, and if a friend referred them, award the friend
 * their bonus passes for every 2 friends who've joined.
 */
export async function qualifyReferral(memberId: string): Promise<void> {
  const db = supabaseAdmin();
  const { data: me } = await db.from("profiles").select("id, referred_by, first_paid_at").eq("id", memberId).single();
  if (!me || me.first_paid_at) return;
  const paidAt = new Date().toISOString();
  await db.from("profiles").update({ first_paid_at: paidAt }).eq("id", memberId).is("first_paid_at", null);
  const referrer = me.referred_by as string | null;
  if (!referrer || !referralCounts({ referrerId: referrer, friendId: memberId, friendFirstPaymentAt: paidAt })) return;

  const [{ count: friends }, { count: granted }] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }).eq("referred_by", referrer).not("first_paid_at", "is", null),
    db.from("bonus_passes").select("id", { count: "exact", head: true }).eq("member_id", referrer).eq("source", "referral"),
  ]);
  const st = referralStatus(friends ?? 0, granted ?? 0);
  for (let i = 0; i < st.rewardsDue; i++) {
    const n = (granted ?? 0) + i + 1;
    if (await grantBonus(referrer, "referral", `referral-${n}`, st.passesPerReward, `Referral reward #${n}`)) {
      await sendPush([referrer], "consumer", "Your friends joined! ☕", `${st.passesPerReward} bonus passes are yours, good for a year.`, { screen: "account" }).catch(() => {});
      await sendEmail(
        (await db.from("profiles").select("email").eq("id", referrer).single()).data?.email ?? "",
        "You earned bonus passes",
        `Two friends joined Sippy Brew with your link, so ${st.passesPerReward} bonus passes are in your account. They roll over for a year.\n\n${env.siteUrl()}/account`,
      ).catch(() => {});
    }
  }
}
