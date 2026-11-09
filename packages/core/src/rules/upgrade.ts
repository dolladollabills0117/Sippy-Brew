import { RULES, SUB_TIERS, TIER_GROUPS, type Tier } from "../config";

/**
 * Sub-tier upgrades. Both sub-tiers can order anything; the lower one just covers less per day.
 * A member on the lower sub-tier who keeps paying overages (lattes and other pricier drinks) is
 * encouraged to move up to the higher sub-tier of the same tier.
 *
 * "Pay the difference": upgrading now costs the full monthly price difference (e.g. $20 from
 * Affogato · Decaf at $20 to Affogato · Double Shot at $40). The passes left this period cover
 * the higher max right away, and from the next renewal the member is billed the higher price.
 */

/** The next sub-tier up in the same tier (higher daily max), or null if already at the top. */
export function upgradeTarget(plan: Tier): Tier | null {
  const group = TIER_GROUPS.find((g) => g.id === plan.group);
  if (!group) return null;
  const higher = SUB_TIERS.filter((s) => s.maxPassValueCents > plan.maxPassValueCents).sort((a, b) => a.maxPassValueCents - b.maxPassValueCents)[0];
  return higher ? group.plans[higher.id] : null;
}

/**
 * The upgrade to offer right now, or null. Hidden when only a few passes are left this period
 * (fewer than `upgradeMinPassesLeft`), since the member would pay the full monthly difference
 * for very little.
 */
export function upgradeOffer(plan: Tier, passesLeft: number, minPassesLeft: number = RULES.upgradeMinPassesLeft): Tier | null {
  if (passesLeft < minPassesLeft) return null;
  return upgradeTarget(plan);
}

/** What upgrading costs right now: the full monthly price difference between the two plans. */
export function upgradeNowCost(from: Tier, to: Tier): number {
  if (to.group !== from.group) throw new Error("upgrades stay within the same tier");
  if (to.maxPassValueCents <= from.maxPassValueCents) throw new Error("not an upgrade");
  return to.priceCents - from.priceCents;
}

export interface UpgradeSuggestion {
  from: Tier;
  to: Tier;
  /** Orders this period that went over the current daily max. */
  overageOrders: number;
  /** Total overage those orders cost the member this period. */
  overagePaidCents: number;
  passesLeft: number;
  /** Charged now if they upgrade: the full monthly price difference. */
  upgradeNowCents: number;
  /** Price from the next renewal. */
  newMonthlyPriceCents: number;
  monthlyDifferenceCents: number;
}

export interface PeriodOrder {
  overageCents: number;
  status: string;
}

/**
 * Should we nudge this member to the higher sub-tier? Yes when they're on a lower sub-tier and
 * at least `upgradeNudgeAfterOverages` orders this period went over their daily max.
 */
export function suggestUpgrade(params: {
  plan: Tier;
  periodOrders: readonly PeriodOrder[];
  passesLeft: number;
  minOverageOrders?: number;
}): UpgradeSuggestion | null {
  const to = upgradeOffer(params.plan, params.passesLeft);
  if (!to) return null;
  const over = params.periodOrders.filter((o) => o.status !== "cancelled" && o.overageCents > 0);
  if (over.length < (params.minOverageOrders ?? RULES.upgradeNudgeAfterOverages)) return null;
  return {
    from: params.plan,
    to,
    overageOrders: over.length,
    overagePaidCents: over.reduce((s, o) => s + o.overageCents, 0),
    passesLeft: params.passesLeft,
    upgradeNowCents: upgradeNowCost(params.plan, to),
    newMonthlyPriceCents: to.priceCents,
    monthlyDifferenceCents: to.priceCents - params.plan.priceCents,
  };
}

/**
 * At checkout: would this order's overage disappear on the higher sub-tier? Returns how much
 * of the overage the higher max would cover, or 0.
 */
export function overageCoveredByUpgrade(plan: Tier, orderTotalCents: number): number {
  const to = upgradeTarget(plan);
  if (!to) return 0;
  const nowOver = Math.max(0, orderTotalCents - plan.maxPassValueCents);
  const thenOver = Math.max(0, orderTotalCents - to.maxPassValueCents);
  return nowOver - thenOver;
}
