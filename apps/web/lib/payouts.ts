import "server-only";
import { formatCents, previousWeekBounds, RULES, splitOrder, summarizePayout } from "@sippy/core";
import { stripe } from "./billing";
import { notifyShopPayout } from "./notify";
import { supabaseAdmin } from "./supabase/server";

/**
 * Weekly payouts. For each active shop, sum last week's redeemed orders (Monday to Monday,
 * local time), keep 12% commission, and transfer the rest to the shop's Stripe Connect account.
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
      .select("id, total, commission, net")
      .eq("shop_id", shop.id)
      .eq("status", "picked_up")
      .is("payout_id", null)
      .gte("redeemed_at", start.toISOString())
      .lt("redeemed_at", end.toISOString());
    if (!orders?.length) continue;

    // Use each order's locked-in split; fall back to the current rate if it's missing.
    const splits = orders.map((o) => (o.commission != null ? { grossCents: o.total, commissionCents: o.commission, netCents: o.net } : splitOrder(o.total)));
    const sum = splits.reduce((a, s) => ({ g: a.g + s.grossCents, c: a.c + s.commissionCents }), { g: 0, c: 0 });
    const check = summarizePayout(orders.map((o) => o.total));
    if (check.grossCents !== sum.g) throw new Error("payout gross mismatch");

    const { data: payoutId, error } = await db.rpc("create_payout", {
      p_shop: shop.id,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
      p_order_ids: orders.map((o) => o.id),
      p_gross: sum.g,
      p_commission: sum.c,
      p_net: sum.g - sum.c,
    });
    if (error) {
      if (error.code === "23505") continue; // already created for this week
      throw error;
    }

    const net = sum.g - sum.c;
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
