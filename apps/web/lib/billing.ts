import "server-only";
import { getTier, isTierId, planRenewal, type LedgerEntry, type TierId } from "@sippy/core";
import Stripe from "stripe";
import type { Session } from "./auth";
import { env } from "./env";
import { badRequest } from "./http";
import { notifyMemberRenewal } from "./notify";
import { supabaseAdmin } from "./supabase/server";

let stripeClient: Stripe | null = null;
export function stripe(): Stripe {
  stripeClient ??= new Stripe(env.stripeSecret());
  return stripeClient;
}

function priceIdFor(tier: TierId): string {
  const name = getTier(tier).stripePriceEnv;
  const id = process.env[name];
  if (!id) throw new Error(`Set ${name} to the Stripe Price ID for the ${tier} tier.`);
  return id;
}

function tierForPrice(priceId: string | undefined): TierId | null {
  for (const id of ["sip", "regular", "daily"] as const) if (process.env[getTier(id).stripePriceEnv] === priceId) return id;
  return null;
}

async function customerFor(s: Session): Promise<string> {
  const db = supabaseAdmin();
  const { data } = await db.from("profiles").select("stripe_customer_id").eq("id", s.userId).single();
  if (data?.stripe_customer_id) return data.stripe_customer_id;
  const customer = await stripe().customers.create({ email: s.email, name: s.profile.name, metadata: { member_id: s.userId } });
  await db.from("profiles").update({ stripe_customer_id: customer.id }).eq("id", s.userId);
  return customer.id;
}

/** Only redirect back to our own site or the mobile apps' deep-link scheme. */
function safeReturn(url: string | undefined, fallback: string): string {
  if (!url) return fallback;
  if (url.startsWith(env.siteUrl()) || url.startsWith("sippybrew://")) return url;
  return fallback;
}

/** Stripe Checkout for a subscription. Card details are entered on Stripe's page, never ours. */
export async function createCheckout(s: Session, tier: unknown, returnUrl?: string) {
  if (!isTierId(tier)) throw badRequest("BAD_TIER", "Pick a plan.");
  const db = supabaseAdmin();
  const { data: live } = await db.from("subscriptions").select("id").eq("member_id", s.userId).in("status", ["active", "trialing", "past_due"]).limit(1);
  if (live?.length) throw badRequest("ALREADY_SUBSCRIBED", "You already have a plan. Change it from your account page.");
  const base = safeReturn(returnUrl, `${env.siteUrl()}/account`);
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: await customerFor(s),
    line_items: [{ price: priceIdFor(tier), quantity: 1 }],
    success_url: `${base}${base.includes("?") ? "&" : "?"}checkout=success`,
    cancel_url: `${base}${base.includes("?") ? "&" : "?"}checkout=cancelled`,
    subscription_data: { metadata: { member_id: s.userId, tier } },
    metadata: { member_id: s.userId, tier },
  });
  return { url: session.url! };
}

/** Stripe's customer portal handles plan changes and cancellation. */
export async function createPortal(s: Session, returnUrl?: string) {
  const session = await stripe().billingPortal.sessions.create({
    customer: await customerFor(s),
    return_url: safeReturn(returnUrl, `${env.siteUrl()}/account`),
  });
  return { url: session.url };
}

function periodOf(sub: Stripe.Subscription): { start: string; end: string } {
  // Newer Stripe API versions put the period on the subscription item.
  const item = sub.items.data[0] as unknown as { current_period_start?: number; current_period_end?: number } | undefined;
  const raw = sub as unknown as { current_period_start?: number; current_period_end?: number };
  const start = item?.current_period_start ?? raw.current_period_start ?? sub.start_date;
  const end = item?.current_period_end ?? raw.current_period_end ?? start + 30 * 86400;
  return { start: new Date(start * 1000).toISOString(), end: new Date(end * 1000).toISOString() };
}

/**
 * Mirror a Stripe subscription into our table. When the paid period changes, unused credit
 * from the old period expires and the new period's credit is granted (packages/core planRenewal).
 */
export async function syncSubscription(sub: Stripe.Subscription, opts: { grant: boolean }) {
  const db = supabaseAdmin();
  const memberId = sub.metadata.member_id;
  if (!memberId) {
    console.warn("subscription without member_id metadata", sub.id);
    return;
  }
  const tier = tierForPrice(sub.items.data[0]?.price.id) ?? (isTierId(sub.metadata.tier) ? sub.metadata.tier : null);
  if (!tier) throw new Error(`Unknown price on subscription ${sub.id}`);
  const period = periodOf(sub);

  const { data: existing } = await db.from("subscriptions").select("*").eq("stripe_subscription_id", sub.id).maybeSingle();
  const row = {
    member_id: memberId,
    tier,
    status: sub.status as string,
    current_period_start: period.start,
    current_period_end: period.end,
    cancel_at_period_end: sub.cancel_at_period_end,
    stripe_subscription_id: sub.id,
  };
  const { data: saved, error } = existing
    ? await db.from("subscriptions").update(row).eq("id", existing.id).select("*").single()
    : await db.from("subscriptions").insert(row).select("*").single();
  if (error) throw error;

  if (!opts.grant || !["active", "trialing"].includes(sub.status)) return;

  const { data: grant } = await db.from("credit_ledger").select("id").eq("subscription_id", saved.id).eq("period_start", period.start).eq("type", "grant").maybeSingle();
  if (grant) return; // webhook retry: already granted

  const prevStart: string | null = existing && existing.current_period_start !== period.start ? existing.current_period_start : null;
  let previousEntries: LedgerEntry[] = [];
  if (prevStart) {
    const { data } = await db.from("credit_ledger").select("amount, type, period_start").eq("subscription_id", saved.id).eq("period_start", prevStart);
    previousEntries = (data ?? []).map((e) => ({ amountCents: e.amount, type: e.type, periodStart: e.period_start }));
  }
  const tierCfg = getTier(tier);
  const entries = planRenewal({ previousEntries, previousPeriodStart: prevStart, newPeriodStart: period.start, tier: tierCfg });
  const { error: ledgerErr } = await db.from("credit_ledger").insert(
    entries.map((e) => ({ member_id: memberId, subscription_id: saved.id, period_start: e.periodStart, amount: e.amountCents, type: e.type, note: e.note })),
  );
  if (ledgerErr && ledgerErr.code !== "23505") throw ledgerErr;
  if (!ledgerErr) void notifyMemberRenewal(memberId, tierCfg.name, tierCfg.creditCents).catch(() => {});
}
