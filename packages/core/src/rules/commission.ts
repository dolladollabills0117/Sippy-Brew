import { RULES } from "../config";
import { assertCents } from "../money";

export interface Split {
  grossCents: number;
  commissionCents: number;
  netCents: number;
}

/**
 * Platform commission on one order (pass-covered value plus any upgrade): 12% (1200 bps), rounded to the
 * nearest cent per order. The shop receives the rest, so commission + net always equals gross.
 */
export function splitOrder(grossCents: number, commissionBps: number = RULES.commissionBps): Split {
  assertCents(grossCents, "grossCents");
  if (grossCents < 0) throw new Error("grossCents cannot be negative");
  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 10_000) {
    throw new Error(`invalid commissionBps: ${commissionBps}`);
  }
  // Integer math: round half up.
  const commissionCents = Math.floor((grossCents * commissionBps + 5_000) / 10_000);
  return { grossCents, commissionCents, netCents: grossCents - commissionCents };
}

/**
 * Payout for a period: the sum of per-order splits. Rounding is per order, so the payout always
 * matches the itemized orders a shop sees.
 */
export function summarizePayout(orderTotalsCents: readonly number[], commissionBps: number = RULES.commissionBps): Split & { orderCount: number } {
  let grossCents = 0;
  let commissionCents = 0;
  for (const total of orderTotalsCents) {
    const s = splitOrder(total, commissionBps);
    grossCents += s.grossCents;
    commissionCents += s.commissionCents;
  }
  return { grossCents, commissionCents, netCents: grossCents - commissionCents, orderCount: orderTotalsCents.length };
}
