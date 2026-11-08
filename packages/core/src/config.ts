import tiersJson from "../config/tiers.json";
import rulesJson from "../config/rules.json";

export type TierId = "sip" | "regular" | "daily";

export interface Tier {
  id: TierId;
  name: string;
  /** Monthly price, in cents. */
  priceCents: number;
  /** Monthly coffee credit, in cents. */
  creditCents: number;
  blurb: string;
  /** Name of the env var that holds this tier's Stripe Price ID (server only). */
  stripePriceEnv: string;
}

export interface Rules {
  dailyLimitCents: number;
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

export function getTier(id: string): Tier {
  const tier = TIERS.find((t) => t.id === id);
  if (!tier) throw new Error(`Unknown tier: ${id}`);
  return tier;
}

export function isTierId(id: unknown): id is TierId {
  return typeof id === "string" && TIERS.some((t) => t.id === id);
}
