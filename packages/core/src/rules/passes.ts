import { RULES, type Tier } from "../config";
import { assertCents } from "../money";
import { dayKey } from "../time";
import { splitOrder } from "./commission";

/**
 * Daily Passes.
 *
 * - Each tier includes `passesPerMonth` passes per subscription period.
 * - One pass covers one calendar day (platform time zone) at one shop, up to the tier's
 *   `maxPassValueCents`. Anything above that is an upgrade the member pays through the app.
 * - At most one pass per member per calendar day, across all shops.
 * - Passes reset on the renewal date. Unused passes expire; nothing rolls over.
 */

// ---------------------------------------------------------------------------
// Pass ledger (units are passes, not money)
// ---------------------------------------------------------------------------

export type PassLedgerType = "grant" | "use" | "release" | "expire";

/** grant/release are positive, use/expire negative. Each entry belongs to one period. */
export interface PassLedgerEntry {
  passes: number;
  type: PassLedgerType;
  periodStart: Date | string;
  createdAt?: Date | string;
}

const SIGN: Record<PassLedgerType, 1 | -1> = { grant: 1, release: 1, use: -1, expire: -1 };

export function validatePassEntry(e: PassLedgerEntry): void {
  if (!Number.isInteger(e.passes) || e.passes === 0) throw new Error("passes must be a non-zero integer");
  if (Math.sign(e.passes) !== SIGN[e.type]) throw new Error(`${e.type} entries must be ${SIGN[e.type] > 0 ? "positive" : "negative"}`);
}

/**
 * Passes left in a period. Only entries tagged with that period count, so passes from an
 * earlier period can never roll over, even if an expire entry were missing.
 */
export function passBalance(entries: readonly PassLedgerEntry[], periodStart: Date | string): number {
  const start = new Date(periodStart).getTime();
  let n = 0;
  for (const e of entries) if (new Date(e.periodStart).getTime() === start) n += e.passes;
  return Math.max(0, n);
}

export interface NewPassEntry {
  passes: number;
  type: PassLedgerType;
  periodStart: Date | string;
  note: string;
}

/**
 * Renewal: unused passes from the closing period expire, then the tier's full allowance is
 * granted for the new period. The new balance is always exactly tier.passesPerMonth.
 */
export function planRenewal(params: {
  previousEntries: readonly PassLedgerEntry[];
  previousPeriodStart: Date | string | null;
  newPeriodStart: Date | string;
  tier: Pick<Tier, "passesPerMonth" | "name">;
}): NewPassEntry[] {
  const out: NewPassEntry[] = [];
  const prev = params.previousPeriodStart;
  if (prev && new Date(prev).getTime() !== new Date(params.newPeriodStart).getTime()) {
    const left = passBalance(params.previousEntries, prev);
    if (left > 0) out.push({ passes: -left, type: "expire", periodStart: prev, note: `${left} unused pass${left === 1 ? "" : "es"} expired at renewal` });
  }
  out.push({ passes: params.tier.passesPerMonth, type: "grant", periodStart: params.newPeriodStart, note: `${params.tier.name}: ${params.tier.passesPerMonth} Daily Passes` });
  return out;
}

/** True if this period already has a grant (Stripe webhooks can be delivered twice). */
export function hasGrantForPeriod(entries: readonly PassLedgerEntry[], periodStart: Date | string): boolean {
  const t = new Date(periodStart).getTime();
  return entries.some((e) => e.type === "grant" && new Date(e.periodStart).getTime() === t);
}

/**
 * A cancelled order gives its pass back only if it belongs to the current period. A pass from
 * an earlier period already expired, so returning it would be a rollover.
 */
export function canReleasePass(orderPeriodStart: Date | string, currentPeriodStart: Date | string): boolean {
  return new Date(orderPeriodStart).getTime() === new Date(currentPeriodStart).getTime();
}

// ---------------------------------------------------------------------------
// Using a pass
// ---------------------------------------------------------------------------

export type PassCheck =
  | { ok: true; passDay: string; passesLeftAfter: number }
  | { ok: false; code: "PASS_USED_TODAY" | "NO_PASSES_LEFT"; message: string };

/**
 * Can the member use a pass now? `passDaysUsed` lists the calendar days ("YYYY-MM-DD") on
 * which the member already has a live (not cancelled) pass order, at any shop.
 */
export function checkPassAvailable(params: {
  passesLeft: number;
  passDaysUsed: readonly string[];
  now: Date;
  timeZone?: string;
}): PassCheck {
  const today = dayKey(params.now, params.timeZone ?? RULES.timeZone);
  if (params.passDaysUsed.filter((d) => d === today).length >= RULES.passesPerDay) {
    return { ok: false, code: "PASS_USED_TODAY", message: "You've already used today's pass. See you tomorrow!" };
  }
  if (params.passesLeft < 1) {
    return { ok: false, code: "NO_PASSES_LEFT", message: "You've used all your Daily Passes this month. They reset on your renewal date." };
  }
  return { ok: true, passDay: today, passesLeftAfter: params.passesLeft - 1 };
}

export interface PassSplit {
  /** Full order value at the shop's menu prices. */
  totalCents: number;
  /** Covered by the pass: min(total, tier max). */
  passValueCents: number;
  /** Paid by the member through the app (upgrades: lattes, extra shots, bigger sizes). */
  upgradeCents: number;
}

/** Split an order between what the pass covers and the upgrade the member pays. */
export function splitPassValue(totalCents: number, maxPassValueCents: number): PassSplit {
  assertCents(totalCents, "totalCents");
  assertCents(maxPassValueCents, "maxPassValueCents");
  if (totalCents < 0 || maxPassValueCents < 0) throw new Error("amounts cannot be negative");
  const passValueCents = Math.min(totalCents, maxPassValueCents);
  return { totalCents, passValueCents, upgradeCents: totalCents - passValueCents };
}

/**
 * Upgrades under the minimum card charge (Stripe: $0.50) are waived for the member. The shop is
 * still paid on the full order value; the platform absorbs the difference.
 */
export function upgradeIsCharged(upgradeCents: number, minChargeCents: number = RULES.minUpgradeChargeCents): boolean {
  return upgradeCents >= minChargeCents;
}

// ---------------------------------------------------------------------------
// Economics for one member-month
// ---------------------------------------------------------------------------

export interface MonthEconomics {
  passesUsed: number;
  passesUnused: number;
  coveredCents: number;
  upgradeCents: number;
  /** Paid to shops: 88% of covered value plus upgrades (per-order rounding). */
  shopCents: number;
  /** Platform keeps: subscription price + upgrades − shop payouts. Includes unused passes. */
  platformCents: number;
}

/**
 * Where one member's money goes in a period. `orderTotalsCents` is the full value of each
 * redeemed pass order. Platform revenue = subscription + upgrades − shop share.
 */
export function monthEconomics(tier: Pick<Tier, "priceCents" | "passesPerMonth" | "maxPassValueCents">, orderTotalsCents: readonly number[], commissionBps = RULES.commissionBps): MonthEconomics {
  if (orderTotalsCents.length > tier.passesPerMonth) throw new Error("more passes used than the tier includes");
  let covered = 0;
  let upgrades = 0;
  let shop = 0;
  for (const total of orderTotalsCents) {
    const s = splitPassValue(total, tier.maxPassValueCents);
    covered += s.passValueCents;
    upgrades += s.upgradeCents;
    shop += splitOrder(total, commissionBps).netCents;
  }
  return {
    passesUsed: orderTotalsCents.length,
    passesUnused: tier.passesPerMonth - orderTotalsCents.length,
    coveredCents: covered,
    upgradeCents: upgrades,
    shopCents: shop,
    platformCents: tier.priceCents + upgrades - shop,
  };
}
