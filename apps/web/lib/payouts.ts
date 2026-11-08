import "server-only";
import { formatCents, previousWeekBounds, RULES, summarizePayout } from "@sippy/core";
import { stripe } from "./billing";
import { notifyShopPayout } from "./notify";
import { supabaseAdmin } from "./supabase/server";

/**
 * Weekly payouts. For each active shop, sum last week's redeemed orders (Monday to Monday,
 * local time): 88% of the pass-covered value, plus overages less their card processing, sent to
 * the shop's Stripe Connect account. The platform keeps 12% of pass-covered value only.
 * Safe to run more than once: a (shop, week) pair is only ever paid once.
 */
export async function runWeeklyPayouts(now = new Date()) {
  const db = supabaseAdmin();
  const { start, end } = previousWeekBounds(now, RULES.timeZone);
  const label = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: RULES.timeZone })}–${new Date(end.getTime() - 1).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: RULES.timeZone })}`;
  const { data: shops } = await db.from("shops").select("id, name, stripe_account_id, payouts_enabled").neq("status", "pending");
  const results: { shopId: string; netCents: number; status: string }[] = [];

  for (const shop of shops ?? []) {
    const { data: orders } = await db
      .from("orders")
      .select("id, pass_covered_amount, overage_amount, overage_fee")
      .eq("shop_id", shop.id)
      .eq("status", "picked_up")
      .is("payout_id", null)
      .gte("redeemed_at", start.toISOString())
      .lt("redeemed_at", end.toISOString());
    if (!orders?.length) continue;

    // 12% commission on pass-covered value only; overage passes through, less processing.
    const sum = summarizePayout(
      orders.map((o) => ({ passCoveredCents: o.pass_covered_amount, overageCents: o.overage_amount, overageFeeCents: o.overage_fee })),
    );

    const { data: payoutId, error } = await db.rpc("create_payout", {
      p_shop: shop.id,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
      p_order_ids: orders.map((o) => o.id),
      p_gross: sum.grossCents,
      p_commission: sum.commissionCents,
      p_net: sum.netCents,
      p_overage_total: sum.overageTotalCents,
      p_processing_fees: sum.processingFeesCents,
    });
    if (error) {
      if (error.code === "23505") continue; // already created for this week
      throw error;
    }

    const net = sum.transferCents;
    if (!shop.stripe_account_id || !shop.payouts_enabled) {
      await db.from("payouts").update({ status: "failed", failure_reason: "Stripe payouts not set up" }).eq("id", payoutId);
      results.push({ shopId: shop.id, netCents: net, status: "failed" });
      continue;
    }
    try {
      const transfer = await stripe().transfers.create(
        { amount: net, currency: "usd", destination: shop.stripe_account_id, metadata: { payout_id: String(payoutId), shop_id: shop.id } },
        { idempotencyKey: `payout-${payoutId}` },
      );
      await db.from("payouts").update({ status: "paid", stripe_transfer_id: transfer.id, paid_at: new Date().toISOString() }).eq("id", payoutId);
      void notifyShopPayout(shop.id, net, label).catch(() => {});
      results.push({ shopId: shop.id, netCents: net, status: "paid" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.from("payouts").update({ status: "failed", failure_reason: msg.slice(0, 300) }).eq("id", payoutId);
      results.push({ shopId: shop.id, netCents: net, status: "failed" });
    }
  }
  console.info(`[payouts] ${label}: ${results.map((r) => `${r.shopId}=${formatCents(r.netCents)} ${r.status}`).join(", ") || "nothing to pay"}`);
  return { period: { start: start.toISOString(), end: end.toISOString() }, results };
}
