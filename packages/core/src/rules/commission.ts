import { RULES } from "../config";
import { assertCents } from "../money";

export interface Split {
  grossCents: number;
  commissionCents: number;
  netCents: number;
}

/**
 * Commission rates. Pass value: founding shops 12% (locked in for as long as they're on the
 * platform), everyone else 15%. Overages: 5% for every shop. All in rules.json.
 */
export function commissionBpsFor(shop: { founding?: boolean | null } | null | undefined): number {
  return shop?.founding ? RULES.foundingCommissionBps : RULES.standardCommissionBps;
}

/** Percent for display, e.g. 1200 → "12%". */
export function pct(bps: number): string {
  return `${bps / 100}%`;
}

/**
 * Platform commission on the pass-covered part of an order, rounded to the nearest cent per
 * order. The shop receives the rest, so commission + net always equals gross.
 */
export function splitOrder(grossCents: number, commissionBps: number = RULES.standardCommissionBps): Split {
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

/** Sippy Brew's 5% on a charged overage (none on waived overages). */
export function overageCommission(overageCents: number, rules: Pick<typeof RULES, "overageCommissionBps" | "minOverageChargeCents"> = RULES): number {
  assertCents(overageCents, "overageCents");
  if (!overageIsCharged(overageCents, rules.minOverageChargeCents)) return 0;
  return Math.floor((overageCents * rules.overageCommissionBps + 5_000) / 10_000);
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
  /** The shop's share of the pass-covered value (88% founding, 85% standard). */
  passNetCents: number;
  overageCents: number;
  processingFeeCents: number;
  /** Sippy Brew's 5% of the overage. */
  overageCommissionCents: number;
  /** What the shop receives for this order: pass net + overage − processing fee − 5% of the overage. */
  shopCents: number;
}

/** Shop payout for one order: its share of the pass value, plus the overage less card processing and 5%. */
export function orderPayout(o: OrderMoney, commissionBps: number = RULES.standardCommissionBps): OrderPayout {
  const split = splitOrder(o.passCoveredCents, commissionBps);
  assertCents(o.overageCents, "overageCents");
  const fee = o.overageFeeCents ?? overageProcessingFee(o.overageCents);
  assertCents(fee, "overageFeeCents");
  const cut = overageCommission(o.overageCents);
  if (fee < 0 || fee + cut > o.overageCents) throw new Error("processing fee and commission must fit within the overage");
  return {
    passCoveredCents: o.passCoveredCents,
    commissionCents: split.commissionCents,
    passNetCents: split.netCents,
    overageCents: o.overageCents,
    processingFeeCents: fee,
    overageCommissionCents: cut,
    shopCents: split.netCents + o.overageCents - fee - cut,
  };
}

export interface PayoutSummary extends Split {
  /** Sum of overages. */
  overageTotalCents: number;
  /** Card processing on overages, deducted from the shop's payout. */
  processingFeesCents: number;
  /** Sippy Brew's 5% of overages, deducted from the shop's payout. */
  overageCommissionCents: number;
  /** Amount transferred to the shop: net + overage total − processing fees − overage commission. */
  transferCents: number;
  orderCount: number;
}

/**
 * A payout period: the sum of per-order splits. Rounding is per order, so the payout always
 * matches the itemized orders a shop sees. grossCents/commission/net cover pass value only.
 */
export function summarizePayout(orders: readonly OrderMoney[], commissionBps: number = RULES.standardCommissionBps): PayoutSummary {
  let gross = 0;
  let commission = 0;
  let overage = 0;
  let fees = 0;
  let overageCut = 0;
  for (const o of orders) {
    const p = orderPayout(o, commissionBps);
    gross += p.passCoveredCents;
    commission += p.commissionCents;
    overage += p.overageCents;
    fees += p.processingFeeCents;
    overageCut += p.overageCommissionCents;
  }
  const net = gross - commission;
  return {
    grossCents: gross,
    commissionCents: commission,
    netCents: net,
    overageTotalCents: overage,
    processingFeesCents: fees,
    overageCommissionCents: overageCut,
    transferCents: net + overage - fees - overageCut,
    orderCount: orders.length,
  };
}

/** Card processing on a member's monthly payment (Stripe's standard 2.9% + 30¢, from rules.json). */
export function subscriptionProcessingFee(priceCents: number, rules: Pick<typeof RULES, "overageProcessingFeeBps" | "overageProcessingFeeFixedCents"> = RULES): number {
  assertCents(priceCents, "priceCents");
  if (priceCents <= 0) return 0;
  return Math.floor((priceCents * rules.overageProcessingFeeBps + 5_000) / 10_000) + rules.overageProcessingFeeFixedCents;
}

export interface PlatformTake {
  /** What members paid for their passes. */
  revenueCents: number;
  /** Paid (or owed) to shops for passes redeemed so far (their share of pass value). */
  shopPayoutCents: number;
  /** Card processing on members' monthly payments. */
  cardFeesCents: number;
  /** Sippy Brew's 5% of overages. */
  overageCommissionCents: number;
  /** What Sippy Brew keeps: revenue − shop payouts − card fees + overage commission. Commission plus unused passes. */
  keepCents: number;
}

/**
 * What the platform actually keeps in a month. Overages pass through to shops except our 5%. Mid-month this is "so far": it shrinks as members use passes and settles at renewal.
 */
export function platformTake(params: { planPricesCents: readonly number[]; shopNetCents: number; overageCommissionCents?: number }): PlatformTake {
  const revenueCents = params.planPricesCents.reduce((a, c) => a + c, 0);
  const cardFeesCents = params.planPricesCents.reduce((a, c) => a + subscriptionProcessingFee(c), 0);
  const cut = params.overageCommissionCents ?? 0;
  return { revenueCents, shopPayoutCents: params.shopNetCents, cardFeesCents, overageCommissionCents: cut, keepCents: revenueCents - params.shopNetCents - cardFeesCents + cut };
}
