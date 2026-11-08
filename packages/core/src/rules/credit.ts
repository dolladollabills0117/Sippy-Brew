import type { Tier } from "../config";
import { assertCents } from "../money";

export type LedgerType = "grant" | "spend" | "refund" | "expire";

/**
 * Credit ledger entries. Sign convention: grant and refund are positive, spend and expire are
 * negative. Every entry is tagged with the subscription period it belongs to (`periodStart`),
 * and the balance is the sum of entries for the current period only. An expire entry written
 * at renewal belongs to the period it closes, not the new one.
 */
export interface LedgerEntry {
  amountCents: number;
  type: LedgerType;
  periodStart: Date | string;
  createdAt?: Date | string;
}

const SIGN: Record<LedgerType, 1 | -1> = { grant: 1, refund: 1, spend: -1, expire: -1 };

export function validateLedgerEntry(e: LedgerEntry): void {
  assertCents(e.amountCents, "ledger amount");
  if (e.amountCents === 0) throw new Error("ledger amount cannot be zero");
  if (Math.sign(e.amountCents) !== SIGN[e.type]) {
    throw new Error(`${e.type} entries must be ${SIGN[e.type] > 0 ? "positive" : "negative"}`);
  }
}

/**
 * Remaining credit in a period. Only entries tagged with that period count, so credit from an
 * earlier period can never roll over, even if an expire entry were missing.
 */
export function creditBalance(entries: readonly LedgerEntry[], periodStart: Date | string): number {
  const start = new Date(periodStart).getTime();
  let balance = 0;
  for (const e of entries) {
    if (new Date(e.periodStart).getTime() !== start) continue;
    balance += e.amountCents;
  }
  return Math.max(0, balance);
}

export type CreditCapResult =
  | { ok: true; remainingAfterCents: number }
  | { ok: false; code: "CREDIT_CAP"; remainingCents: number; message: string };

/** A member can't spend more than their remaining monthly credit. */
export function checkCreditCap(balanceCents: number, orderTotalCents: number): CreditCapResult {
  assertCents(orderTotalCents, "orderTotalCents");
  if (orderTotalCents > balanceCents) {
    return {
      ok: false,
      code: "CREDIT_CAP",
      remainingCents: balanceCents,
      message: `Not enough credit left this month. You have $${(balanceCents / 100).toFixed(2)} remaining.`,
    };
  }
  return { ok: true, remainingAfterCents: balanceCents - orderTotalCents };
}

export interface NewLedgerEntry {
  amountCents: number;
  type: LedgerType;
  periodStart: Date | string;
  note: string;
}

/**
 * Renewal: unused credit expires, then the full tier credit is granted. No rollover.
 * Returns the entries to write, in order. The new balance is always exactly tier.creditCents.
 */
export function planRenewal(params: {
  previousEntries: readonly LedgerEntry[];
  previousPeriodStart: Date | string | null;
  newPeriodStart: Date | string;
  tier: Pick<Tier, "creditCents" | "name">;
}): NewLedgerEntry[] {
  const out: NewLedgerEntry[] = [];
  const prev = params.previousPeriodStart;
  if (prev && new Date(prev).getTime() !== new Date(params.newPeriodStart).getTime()) {
    const leftover = creditBalance(params.previousEntries, prev);
    if (leftover > 0) out.push({ amountCents: -leftover, type: "expire", periodStart: prev, note: "Unused credit expired at renewal" });
  }
  out.push({ amountCents: params.tier.creditCents, type: "grant", periodStart: params.newPeriodStart, note: `${params.tier.name} monthly credit` });
  return out;
}

/** True if a grant already exists for this period (Stripe webhooks can be delivered twice). */
export function hasGrantForPeriod(entries: readonly LedgerEntry[], periodStart: Date | string): boolean {
  const t = new Date(periodStart).getTime();
  return entries.some((e) => e.type === "grant" && new Date(e.periodStart).getTime() === t);
}

/**
 * A cancelled order is refunded only if it was placed in the current period. Credit from an
 * earlier period already expired, so refunding it would be a rollover.
 */
export function canRefund(orderPeriodStart: Date | string, currentPeriodStart: Date | string): boolean {
  return new Date(orderPeriodStart).getTime() === new Date(currentPeriodStart).getTime();
}
