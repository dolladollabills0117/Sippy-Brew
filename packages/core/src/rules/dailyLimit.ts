import { RULES } from "../config";
import { assertCents } from "../money";
import { dayBounds, isWithin } from "../time";

/** An order that counts toward spending. Cancelled orders are refunded and do not count. */
export interface SpendRecord {
  totalCents: number;
  createdAt: Date | string;
  status: string;
}

/** Sum of credit spent on the local calendar day containing `now`. */
export function spentToday(
  orders: readonly SpendRecord[],
  now: Date,
  timeZone: string = RULES.timeZone,
): number {
  const today = dayBounds(now, timeZone);
  let total = 0;
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    if (isWithin(new Date(o.createdAt), today)) total += o.totalCents;
  }
  return total;
}

export function remainingToday(spentTodayCents: number, limitCents: number = RULES.dailyLimitCents): number {
  assertCents(spentTodayCents, "spentTodayCents");
  return Math.max(0, limitCents - spentTodayCents);
}

export type DailyLimitResult =
  | { ok: true; remainingAfterCents: number }
  | { ok: false; code: "DAILY_LIMIT"; remainingCents: number; message: string };

/** A member can't spend more than the daily limit ($8 by default) in one calendar day. */
export function checkDailyLimit(
  spentTodayCents: number,
  orderTotalCents: number,
  limitCents: number = RULES.dailyLimitCents,
): DailyLimitResult {
  assertCents(orderTotalCents, "orderTotalCents");
  const remaining = remainingToday(spentTodayCents, limitCents);
  if (orderTotalCents > remaining) {
    return {
      ok: false,
      code: "DAILY_LIMIT",
      remainingCents: remaining,
      message: `This order is over today's limit. You have $${(remaining / 100).toFixed(2)} left today.`,
    };
  }
  return { ok: true, remainingAfterCents: remaining - orderTotalCents };
}
