import { RULES } from "../config";
import { assertCents } from "../money";

export interface Split {
  grossCents: number;
  commissionCents: number;
  netCents: number;
}

/**
 * Platform commission on the pass-covered part of an order: 12% (1200 bps), rounded to the
 * nearest cent per order. The shop receives the rest, so commission + net always equals gross.
 * Overages are never passed through this function: they carry no commission.
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

/** Overages under the minimum card charge can't be charged and are waived. */
export function overageIsCharged(overageCents: number, minChargeCents: number = RULES.minOverageChargeCents): boolean {
  return overageCents >= minChargeCents;
}

/**
 * Estimated card processing on an overage charge, paid by the shop (2.9% + 30¢ by default).
 * Payouts use the actual Stripe fee when it's known; this is the fallback and the estimate
 * shown on the dashboard. Waived overages have no charge and no fee. Never exceeds the overage.
 */
export function overageProcessingFee(overageCents: number, rules: Pick<typeof RULES, "overageProcessingFeeBps" | "overageProcessingFeeFixedCents" | "minOverageChargeCents"> = RULES): number {
  assertCents(overageCents, "overageCents");
  if (!overageIsCharged(overageCents, rules.minOverageChargeCents)) return 0;
  const fee = Math.floor((overageCents * rules.overageProcessingFeeBps + 5_000) / 10_000) + rules.overageProcessingFeeFixedCents;
  return Math.min(overageCents, fee);
}

export interface OrderMoney {
  passCoveredCents: number;
  overageCents: number;
  /** Actual processing fee on the overage, if known. Defaults to the estimate. */
  overageFeeCents?: number;
}

export interface OrderPayout {
  passCoveredCents: number;
  commissionCents: number;
  /** 88% of the pass-covered value. */
  passNetCents: number;
  overageCents: number;
  processingFeeCents: number;
  /** What the shop receives for this order: pass net + overage − processing fee. */
  shopCents: number;
}

/** Shop payout for one order: 88% of pass-covered value, plus 100% of overage less processing. */
export function orderPayout(o: OrderMoney, commissionBps: number = RULES.commissionBps): OrderPayout {
  const split = splitOrder(o.passCoveredCents, commissionBps);
  assertCents(o.overageCents, "overageCents");
  const fee = o.overageFeeCents ?? overageProcessingFee(o.overageCents);
  assertCents(fee, "overageFeeCents");
  if (fee < 0 || fee > o.overageCents) throw new Error("processing fee must be between 0 and the overage");
  return {
    passCoveredCents: o.passCoveredCents,
    commissionCents: split.commissionCents,
    passNetCents: split.netCents,
    overageCents: o.overageCents,
    processingFeeCents: fee,
    shopCents: split.netCents + o.overageCents - fee,
  };
}

export interface PayoutSummary extends Split {
  /** Sum of overages (100% to the shop). */
  overageTotalCents: number;
  /** Card processing on overages, deducted from the shop's payout. */
  processingFeesCents: number;
  /** Amount transferred to the shop: net + overage total − processing fees. */
  transferCents: number;
  orderCount: number;
}

/**
 * A payout period: the sum of per-order splits. Rounding is per order, so the payout always
 * matches the itemized orders a shop sees. grossCents/commission/net cover pass value only.
 */
export function summarizePayout(orders: readonly OrderMoney[], commissionBps: number = RULES.commissionBps): PayoutSummary {
  let gross = 0;
  let commission = 0;
  let overage = 0;
  let fees = 0;
  for (const o of orders) {
    const p = orderPayout(o, commissionBps);
    gross += p.passCoveredCents;
    commission += p.commissionCents;
    overage += p.overageCents;
    fees += p.processingFeeCents;
  }
  const net = gross - commission;
  return {
    grossCents: gross,
    commissionCents: commission,
    netCents: net,
    overageTotalCents: overage,
    processingFeesCents: fees,
    transferCents: net + overage - fees,
    orderCount: orders.length,
  };
}
