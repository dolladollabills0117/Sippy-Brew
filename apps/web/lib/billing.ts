import "server-only";
import { getTier, isTierId, planRenewal, RULES, TIERS, upgradeNowCost, upgradeTarget, type PassLedgerEntry, type Subscription, type TierId } from "@sippy/core";
import Stripe from "stripe";
import type { Session } from "./auth";
import { env } from "./env";
import { AppError, badRequest } from "./http";
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
  for (const t of TIERS) if (process.env[t.stripePriceEnv] === priceId) return t.id;
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
 * Mirror a Stripe subscription into our table. When the paid period changes, unused passes
 * from the old period expire and the new period's passes are granted (packages/core planRenewal).
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

  const { data: grant } = await db.from("pass_ledger").select("id").eq("subscription_id", saved.id).eq("period_start", period.start).eq("type", "grant").maybeSingle();
  if (grant) return; // webhook retry: already granted

  const prevStart: string | null = existing && existing.current_period_start !== period.start ? existing.current_period_start : null;
  let previousEntries: PassLedgerEntry[] = [];
  if (prevStart) {
    const { data } = await db.from("pass_ledger").select("passes, type, period_start").eq("subscription_id", saved.id).eq("period_start", prevStart);
    previousEntries = (data ?? []).map((e) => ({ passes: e.passes, type: e.type, periodStart: e.period_start }));
  }
  const tierCfg = getTier(tier);
  const entries = planRenewal({ previousEntries, previousPeriodStart: prevStart, newPeriodStart: period.start, tier: tierCfg });
  const { error: ledgerErr } = await db.from("pass_ledger").insert(
    entries.map((e) => ({ member_id: memberId, subscription_id: saved.id, period_start: e.periodStart, passes: e.passes, type: e.type, note: e.note })),
  );
  if (ledgerErr && ledgerErr.code !== "23505") throw ledgerErr;
  // Snapshot this period's allowance so later edits to tiers.json apply from the next renewal.
  await db.from("subscriptions").update({ period_passes: tierCfg.passesPerMonth, period_max_pass_value: tierCfg.maxPassValueCents }).eq("id", saved.id);
  if (!ledgerErr) void notifyMemberRenewal(memberId, tierCfg.name, tierCfg.passesPerMonth).catch(() => {});
}

// ---------------------------------------------------------------------------
// Overages: the part of a day's order above the $8.00 the pass covers.
// Only after the member confirms the exact amount at checkout, it's authorized on their card
// on file; it's captured when the shop scans the QR and voided if the order is cancelled.
// Overage goes 100% to the shop, which pays the card processing on it. Card details stay
// with Stripe.
// ---------------------------------------------------------------------------

async function defaultPaymentMethod(memberId: string, sub: Subscription): Promise<{ customer: string; paymentMethod: string } | null> {
  const db = supabaseAdmin();
  const [{ data: profile }, { data: row }] = await Promise.all([
    db.from("profiles").select("stripe_customer_id").eq("id", memberId).single(),
    db.from("subscriptions").select("stripe_subscription_id").eq("id", sub.id).single(),
  ]);
  const customer = profile?.stripe_customer_id as string | undefined;
  if (!customer) return null;
  if (row?.stripe_subscription_id) {
    const stripeSub = await stripe().subscriptions.retrieve(row.stripe_subscription_id);
    const pm = stripeSub.default_payment_method;
    if (pm) return { customer, paymentMethod: typeof pm === "string" ? pm : pm.id };
  }
  const c = await stripe().customers.retrieve(customer);
  const pm = "deleted" in c ? null : c.invoice_settings?.default_payment_method;
  return pm ? { customer, paymentMethod: typeof pm === "string" ? pm : pm.id } : null;
}

export async function authorizeOverage(memberId: string, sub: Subscription, amountCents: number, metadata: Record<string, string>): Promise<string> {
  if (!process.env.STRIPE_SECRET_KEY) throw new AppError(503, "OVERAGE_UNAVAILABLE", "Overages need payments set up. Pick drinks that total $8.00 or less.");
  const pm = await defaultPaymentMethod(memberId, sub);
  if (!pm) throw new AppError(402, "NO_PAYMENT_METHOD", "Add a card in your account to pay overages.");
  try {
    const pi = await stripe().paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: pm.customer,
      payment_method: pm.paymentMethod,
      off_session: true,
      confirm: true,
      capture_method: "manual",
      description: "Sippy Brew order overage",
      metadata: { member_id: memberId, kind: "overage", ...metadata },
    });
    return pi.id;
  } catch {
    throw new AppError(402, "OVERAGE_DECLINED", "Your card was declined for the overage. Update it in your account, or pick drinks that total $8.00 or less.");
  }
}

/**
 * Capture a confirmed overage. Returns the actual Stripe processing fee (charged to the shop),
 * or null if Stripe didn't report one, in which case the caller uses the configured estimate.
 */
export async function captureOverage(paymentIntentId: string): Promise<{ ok: boolean; feeCents: number | null }> {
  try {
    const pi = await stripe().paymentIntents.capture(paymentIntentId, { expand: ["latest_charge.balance_transaction"] });
    const charge = pi.latest_charge;
    const bt = charge && typeof charge !== "string" ? charge.balance_transaction : null;
    const fee = bt && typeof bt !== "string" ? bt.fee : null;
    return { ok: true, feeCents: typeof fee === "number" ? fee : null };
  } catch (e) {
    console.error("overage capture failed", paymentIntentId, e);
    return { ok: false, feeCents: null };
  }
}

export async function voidOverage(paymentIntentId: string): Promise<void> {
  await stripe().paymentIntents.cancel(paymentIntentId);
}

// ---------------------------------------------------------------------------
// Sub-tier upgrades (e.g. Affogato · Decaf → Affogato · Double Shot). The member confirms the
// exact amount first. They pay the per-pass difference for the passes left this period (card on
// file), those passes cover the higher max right away, and Stripe bills the higher plan from the
// next renewal (no proration).
// ---------------------------------------------------------------------------

export async function upgradeSubTier(memberId: string, sub: Subscription, toPlan: unknown, confirmedCents: unknown, passesLeft: number) {
  const from = getTier(sub.tier);
  const to = upgradeTarget(from);
  if (!to || toPlan !== to.id) throw badRequest("BAD_UPGRADE", "That plan isn't an upgrade from your current one.");
  const cost = upgradeNowCost(from, to, passesLeft);
  if (confirmedCents !== cost) {
    throw new AppError(409, "UPGRADE_CONFIRMATION_REQUIRED", `Upgrading now costs ${(cost / 100).toFixed(2)}. Please confirm that amount to continue.`);
  }
  if (!process.env.STRIPE_SECRET_KEY) throw new AppError(503, "UPGRADE_UNAVAILABLE", "Upgrades need payments set up.");
  const db = supabaseAdmin();
  const { data: row } = await db.from("subscriptions").select("stripe_subscription_id").eq("id", sub.id).single();
  if (!row?.stripe_subscription_id) throw new AppError(409, "NO_STRIPE_SUBSCRIPTION", "We couldn't find your billing details. Contact support.");

  let paymentIntent: string | null = null;
  if (cost >= RULES.minOverageChargeCents) {
    const pm = await defaultPaymentMethod(memberId, sub);
    if (!pm) throw new AppError(402, "NO_PAYMENT_METHOD", "Add a card in your account to upgrade.");
    try {
      const pi = await stripe().paymentIntents.create({
        amount: cost,
        currency: "usd",
        customer: pm.customer,
        payment_method: pm.paymentMethod,
        off_session: true,
        confirm: true,
        description: `Sippy Brew upgrade to ${to.name} for ${passesLeft} remaining passes`,
        metadata: { member_id: memberId, kind: "sub_tier_upgrade", from: from.id, to: to.id },
      });
      paymentIntent = pi.id;
    } catch {
      throw new AppError(402, "UPGRADE_DECLINED", "Your card was declined. Update it in your account and try again.");
    }
  }

  // Bill the higher plan from the next renewal.
  const stripeSub = await stripe().subscriptions.retrieve(row.stripe_subscription_id);
  const itemId = stripeSub.items.data[0]?.id;
  if (itemId) {
    await stripe().subscriptions.update(row.stripe_subscription_id, {
      items: [{ id: itemId, price: priceIdFor(to.id) }],
      proration_behavior: "none",
      metadata: { ...stripeSub.metadata, tier: to.id },
    });
  }

  // The passes left this period now cover the higher max.
  await db.from("subscriptions").update({ tier: to.id, period_max_pass_value: to.maxPassValueCents }).eq("id", sub.id);
  await db.from("sub_tier_upgrades").insert({
    member_id: memberId, subscription_id: sub.id, period_start: sub.currentPeriodStart, from_plan: from.id, to_plan: to.id,
    passes_left: passesLeft, amount: cost, stripe_payment_intent: paymentIntent,
  });
  return { plan: to.id, chargedCents: paymentIntent ? cost : 0 };
}
