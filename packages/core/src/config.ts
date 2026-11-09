import tiersJson from "../config/tiers.json";
import rulesJson from "../config/rules.json";
import siteJson from "../config/site.json";

export type TierGroupId = "affogato" | "macchiato" | "double_espresso";
export type SubTierId = "decaf" | "double_shot";
/** A purchasable plan: a tier (pass count) in a sub-tier (daily max), e.g. "macchiato_double_shot". */
export type TierId = `${TierGroupId}_${SubTierId}`;

/** One purchasable plan. */
export interface Tier {
  id: TierId;
  /** The tier, e.g. "macchiato". */
  group: TierGroupId;
  /** The sub-tier, e.g. "double_shot". */
  subTier: SubTierId;
  /** Full plan name for emails, receipts and the account page, e.g. "Macchiato · Double Shot". */
  name: string;
  /** Tier name alone, e.g. "Macchiato". */
  tierName: string;
  /** Sub-tier name alone, e.g. "Double Shot". */
  subTierName: string;
  /** Monthly price, in cents. */
  priceCents: number;
  /** Daily Passes included per subscription period. One pass covers one calendar day. */
  passesPerMonth: number;
  /** Most a pass covers on its day, in cents. Anything above is an overage the member pays. */
  maxPassValueCents: number;
  blurb: string;
  /** Name of the env var that holds this plan's Stripe Price ID (server only). */
  stripePriceEnv: string;
}

export interface SubTier {
  id: SubTierId;
  name: string;
  maxPassValueCents: number;
  blurb: string;
}

/** A tier with its sub-tier plans, for plan pickers. */
export interface TierGroup {
  id: TierGroupId;
  name: string;
  passesPerMonth: number;
  blurb: string;
  plans: Record<SubTierId, Tier>;
}

export interface Rules {
  passesPerDay: number;
  /** Suggest the higher sub-tier after this many orders with an overage in one period. */
  upgradeNudgeAfterOverages: number;
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

export const SUB_TIERS: readonly SubTier[] = tiersJson.subTiers as SubTier[];

type RawTier = { id: TierGroupId; name: string; passesPerMonth: number; blurb: string; plans: Record<SubTierId, { priceCents: number; stripePriceEnv: string; blurb?: string }> };

export const TIER_GROUPS: readonly TierGroup[] = (tiersJson.tiers as RawTier[]).map((g) => {
  const plans = {} as Record<SubTierId, Tier>;
  for (const sub of SUB_TIERS) {
    const raw = g.plans[sub.id];
    if (!raw) throw new Error(`tiers.json: ${g.id} is missing the ${sub.id} plan`);
    plans[sub.id] = {
      id: `${g.id}_${sub.id}` as TierId,
      group: g.id,
      subTier: sub.id,
      name: `${g.name} · ${sub.name}`,
      tierName: g.name,
      subTierName: sub.name,
      priceCents: raw.priceCents,
      passesPerMonth: g.passesPerMonth,
      maxPassValueCents: sub.maxPassValueCents,
      blurb: raw.blurb ?? g.blurb,
      stripePriceEnv: raw.stripePriceEnv,
    };
  }
  return { id: g.id, name: g.name, passesPerMonth: g.passesPerMonth, blurb: g.blurb, plans };
});

/** Every purchasable plan (tier × sub-tier). */
export const TIERS: readonly Tier[] = TIER_GROUPS.flatMap((g) => SUB_TIERS.map((s) => g.plans[s.id]));
/** The highlighted ("most popular") tier and the sub-tier pickers start on. */
export const DEFAULT_TIER_GROUP: TierGroupId = tiersJson.defaultTier as TierGroupId;
export const DEFAULT_SUB_TIER: SubTierId = tiersJson.defaultSubTier as SubTierId;
export const DEFAULT_TIER: TierId = `${DEFAULT_TIER_GROUP}_${DEFAULT_SUB_TIER}`;
export const CURRENCY: string = tiersJson.currency;

const { $comment: _ignored, ...rules } = rulesJson;
export const RULES: Readonly<Rules> = Object.freeze(rules as Rules);

export const SITE: Readonly<{ launchCity: string }> = Object.freeze({ launchCity: siteJson.launchCity });

export function getTier(id: string): Tier {
  const tier = TIERS.find((t) => t.id === id);
  if (!tier) throw new Error(`Unknown plan: ${id}`);
  return tier;
}

export function isTierId(id: unknown): id is TierId {
  return typeof id === "string" && TIERS.some((t) => t.id === id);
}

export function planFor(group: TierGroupId, subTier: SubTierId): Tier {
  const g = TIER_GROUPS.find((x) => x.id === group);
  if (!g) throw new Error(`Unknown tier: ${group}`);
  return g.plans[subTier];
}
