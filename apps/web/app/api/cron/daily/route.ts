import { dayKey, getTier, RULES } from "@sippy/core";
import { env } from "@/lib/env";
import { notifyMemberRenewalReminder } from "@/lib/notify";
import { cancelOrderRow, flagNoShowRow } from "@/lib/shop";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Run once a day, early morning local time.
 * 1. Orders from earlier days that were never picked up:
 *    - the shop had started them (preparing or ready): a no-show. Not refunded; the shop is paid
 *      and the member and Sippy Brew are told, as when the shop flags it.
 *    - the shop never started them (received): cancelled. The pass returns (if still in the
 *      period) and any overage hold is released.
 * 2. Renewal reminders for plans renewing in about 3 days.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret()}`) return new Response("Unauthorized", { status: 401 });
  const db = supabaseAdmin();
  const today = dayKey(new Date(), RULES.timeZone);

  const { data: stale } = await db
    .from("orders")
    .select("id, status, shop_id, member_id, subscription_id, period_start, pass_covered_amount, overage_amount, overage_payment_intent, overage_status")
    .in("status", ["received", "preparing", "ready"])
    .lt("pass_day", today)
    .limit(1000);
  let closed = 0;
  for (const row of stale ?? []) {
    try {
      if (row.status === "received") await cancelOrderRow(row);
      else await flagNoShowRow(row, null);
      closed++;
    } catch (e) {
      console.error("no-show cleanup failed", row.id, e);
    }
  }

  const from = new Date(Date.now() + 2.5 * 864e5).toISOString();
  const to = new Date(Date.now() + 3.5 * 864e5).toISOString();
  const { data: renewing } = await db
    .from("subscriptions")
    .select("member_id, tier, current_period_end")
    .eq("status", "active")
    .eq("cancel_at_period_end", false)
    .gte("current_period_end", from)
    .lt("current_period_end", to);
  for (const s of renewing ?? []) {
    const on = new Date(s.current_period_end).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: RULES.timeZone });
    await notifyMemberRenewalReminder(s.member_id, getTier(s.tier).name, on);
  }
  return Response.json({ noShowsClosed: closed, reminded: renewing?.length ?? 0 });
}
