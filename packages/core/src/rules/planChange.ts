import { getTier, type Tier } from "../config";

/**
 * Plan changes. Members can switch to any plan at any time; the switch takes effect at the next
 * renewal, so this month's passes and daily max stay as they are. The one exception is the
 * in-month sub-tier upgrade (rules/upgrade.ts), where the member pays the monthly difference now.
 */
export interface PlanChange {
  from: Tier;
  to: Tier;
  /** When the new plan starts: the end of the current billing period. */
  effectiveAt: Date;
}

export function schedulePlanChange(fromId: string, toId: string, currentPeriodEnd: Date): PlanChange | null {
  if (fromId === toId) return null;
  return { from: getTier(fromId), to: getTier(toId), effectiveAt: currentPeriodEnd };
}

/** Which plan applies at `now`: the pending plan once its start date is reached. */
export function planInEffect(current: string, pending: string | null | undefined, effectiveAt: Date | null, now: Date): string {
  return pending && effectiveAt && now.getTime() >= effectiveAt.getTime() ? pending : current;
}
