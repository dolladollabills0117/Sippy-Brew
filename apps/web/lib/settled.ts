import { RULES, recentWeeks, isWithin, settledShopCents, summarizeSettled, type SettledOrder } from "@sippy/core";

export type { SettledOrder };

export const SETTLED_SELECT =
  "id, shop_id, payout_id, status, redeemed_at, total, pass_covered_amount, overage_amount, overage_fee, overage_commission, commission, net, order_items(name, quantity)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapSettled(r: any): SettledOrder {
  return {
    id: r.id,
    shopId: r.shop_id,
    payoutId: r.payout_id ?? null,
    status: r.status,
    redeemedAt: r.redeemed_at,
    totalCents: r.total ?? 0,
    passCoveredCents: r.pass_covered_amount ?? 0,
    overageCents: r.overage_amount ?? 0,
    commissionCents: r.commission ?? 0,
    netCents: r.net ?? 0,
    overageFeeCents: r.overage_fee ?? 0,
    overageCommissionCents: r.overage_commission ?? 0,
    items: (r.order_items ?? []).map((i: { name: string; quantity: number }) => ({ name: i.name, quantity: i.quantity })),
  };
}

export const shopCents = settledShopCents;
export const summarize = summarizeSettled;

/** The last `count` weeks (newest first), each with the orders redeemed in it. */
export function byWeek(list: SettledOrder[], count: number, now = new Date()) {
  return recentWeeks(now, count, RULES.timeZone).map((w) => ({ ...w, orders: list.filter((o) => isWithin(new Date(o.redeemedAt), w)) }));
}

const d = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: RULES.timeZone });
export function weekLabel(w: { start: Date; end: Date }, i: number) {
  if (i === 0) return "This week";
  if (i === 1) return "Last week";
  return `${d.format(w.start)} – ${d.format(new Date(w.end.getTime() - 1))}`;
}
