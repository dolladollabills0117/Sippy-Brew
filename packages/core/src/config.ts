import tiersJson from "../config/tiers.json";
import rulesJson from "../config/rules.json";
import siteJson from "../config/site.json";

export type TierId = "affogato" | "macchiato" | "double_espresso";

export interface Tier {
  id: TierId;
  name: string;
  /** Monthly price, in cents. */
  priceCents: number;
  /** Daily Passes included per subscription period. One pass covers one calendar day. */
  passesPerMonth: number;
  /** Most a pass covers on its day, in cents. Anything above is an overage the member pays. */
  maxPassValueCents: number;
  blurb: string;
  /** Name of the env var that holds this tier's Stripe Price ID (server only). */
  stripePriceEnv: string;
}

export interface Rules {
  passesPerDay: number;
  /** Overages below this can't be charged (Stripe's minimum card charge) and are waived. */
  minOverageChargeCents: number;
  /** Card processing on overage charges, paid by the shop: bps of the amount plus a fixed fee. */
  overageProcessingFeeBps: number;
  overageProcessingFeeFixedCents: number;
  commissionBps: number;
  qrTtlSeconds: number;
  timeZone: string;
  shopStoryMaxChars: number;
  postMaxChars: number;
  postsPerShopPerDay: number;
  minPickupLeadMinutes: number;
  maxPickupLeadMinutes: number;
}

export const TIERS: readonly Tier[] = tiersJson.tiers as Tier[];
export const DEFAULT_TIER: TierId = tiersJson.defaultTier as TierId;
export const CURRENCY: string = tiersJson.currency;

const { $comment: _ignored, ...rules } = rulesJson;
export const RULES: Readonly<Rules> = Object.freeze(rules as Rules);

export const SITE: Readonly<{ launchCity: string }> = Object.freeze({ launchCity: siteJson.launchCity });

export function getTier(id: string): Tier {
  const tier = TIERS.find((t) => t.id === id);
  if (!tier) throw new Error(`Unknown tier: ${id}`);
  return tier;
}

export function isTierId(id: unknown): id is TierId {
  return typeof id === "string" && TIERS.some((t) => t.id === id);
}
