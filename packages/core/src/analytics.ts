import { RULES } from "./config";
import { splitOrder } from "./rules/commission";
import { dayBounds, isWithin, monthBounds, weekBounds, zonedParts } from "./time";

export interface StatsOrder {
  id: string;
  memberId: string;
  totalCents: number;
  status: string;
  createdAt: Date | string;
  redeemedAt?: Date | string | null;
  items: { name: string; quantity: number }[];
}

export interface ShopStats {
  redemptions: { today: number; week: number; month: number };
  grossCents: { today: number; week: number; month: number };
  topItems: { name: string; quantity: number }[];
  /** Redemptions by local hour 0–23 this month. */
  busiestHours: { hour: number; count: number }[];
  members: { new: number; returning: number };
  estimatedWeeklyPayoutCents: number;
}

/**
 * Daily dashboard numbers for a shop. Only picked-up (redeemed) orders count, since those are
 * what the shop is paid for. `allTimeOrders` should include earlier months so "new vs.
 * returning" can tell first visits apart.
 */
export function shopStats(allTimeOrders: readonly StatsOrder[], now: Date, timeZone: string = RULES.timeZone): ShopStats {
  const day = dayBounds(now, timeZone);
  const week = weekBounds(now, timeZone);
  const month = monthBounds(now, timeZone);
  const redeemed = allTimeOrders
    .filter((o) => o.status === "picked_up")
    .map((o) => ({ ...o, at: new Date(o.redeemedAt ?? o.createdAt) }))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const redemptions = { today: 0, week: 0, month: 0 };
  const grossCents = { today: 0, week: 0, month: 0 };
  const items = new Map<string, number>();
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  const firstVisit = new Map<string, number>();
  const monthMembers = new Set<string>();
  let weekNet = 0;

  for (const o of redeemed) {
    if (!firstVisit.has(o.memberId)) firstVisit.set(o.memberId, o.at.getTime());
    if (isWithin(o.at, day)) {
      redemptions.today++;
      grossCents.today += o.totalCents;
    }
    if (isWithin(o.at, week)) {
      redemptions.week++;
      grossCents.week += o.totalCents;
      weekNet += splitOrder(o.totalCents).netCents;
    }
    if (isWithin(o.at, month)) {
      redemptions.month++;
      grossCents.month += o.totalCents;
      monthMembers.add(o.memberId);
      const slot = hours[zonedParts(o.at, timeZone).hour];
      if (slot) slot.count++;
      for (const it of o.items) items.set(it.name, (items.get(it.name) ?? 0) + it.quantity);
    }
  }

  let newMembers = 0;
  for (const m of monthMembers) if ((firstVisit.get(m) ?? 0) >= month.start.getTime()) newMembers++;

  return {
    redemptions,
    grossCents,
    topItems: [...items].map(([name, quantity]) => ({ name, quantity })).sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    busiestHours: hours.filter((h) => h.count > 0).sort((a, b) => b.count - a.count || a.hour - b.hour),
    members: { new: newMembers, returning: monthMembers.size - newMembers },
    estimatedWeeklyPayoutCents: weekNet,
  };
}

export function firstName(fullName: string | null | undefined): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0];
  return first || "Member";
}

export function formatHour(hour: number): string {
  const suffix = hour >= 12 ? "pm" : "am";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${suffix}`;
}
