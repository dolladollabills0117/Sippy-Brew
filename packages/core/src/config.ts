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
  /** Full plan name for emails, receipts and the account page, e.g. "Regular · Specialty". */
  name: string;
  /** Tier name alone (how often), e.g. "Regular". */
  tierName: string;
  /** Sub-tier name alone (what you drink), e.g. "Specialty". */
  subTierName: string;
  /** Monthly price, in cents. */
  priceCents: number;
  /** Daily Passes included per subscription period. One pass covers one calendar day. */
  passesPerMonth: number;
  /** Most a pass covers on its day, in cents. Anything above is an overage the member pays. */
  maxPassValueCents: number;
  blurb: string;
  /** How often this tier fits, in plain words, e.g. "A few times a week". */
  frequency: string;
  /** Quiz result: an emoji and a cheeky one-liner. */
  emoji: string;
  resultLine: string;
  /** Name of the env var that holds this plan's Stripe Price ID (server only). */
  stripePriceEnv: string;
}

export interface SubTier {
  id: SubTierId;
  name: string;
  maxPassValueCents: number;
  /** Example drinks, e.g. "Lattes, cappuccinos, seasonal". */
  examples: string;
  blurb: string;
}

/** A tier with its sub-tier plans, for plan pickers. */
export interface TierGroup {
  id: TierGroupId;
  name: string;
  passesPerMonth: number;
  frequency: string;
  blurb: string;
  plans: Record<SubTierId, Tier>;
}

export interface Rules {
  passesPerDay: number;
  /** Suggest the higher sub-tier after this many orders with an overage in one period. */
  upgradeNudgeAfterOverages: number;
  /** Only offer the sub-tier upgrade while at least this many passes are left in the period. */
  upgradeMinPassesLeft: number;
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
  /** Shop search radius, in miles. Capped to keep it local. */
  defaultRadiusMiles: number;
  maxRadiusMiles: number;
  /** Neighborhood passport: visit this many different shops for a free bonus pass. */
  passportShopsForFreePass: number;
  passportFreePasses: number;
  /** Grand Tour: visit every live shop for free months. Only on once this many shops are live. */
  grandTourMinShops: number;
  /** Shops count toward the Grand Tour once they've been live this many days. */
  grandTourShopMinLiveDays: number;
  grandTourFreeMonths: number;
  /** Referrals: every N friends who join and pay earns M bonus passes. */
  referralFriendsNeeded: number;
  referralBonusPasses: number;
  /** Bonus passes (passport, referral) roll over and expire this many days after they're earned. */
  bonusPassLifetimeDays: number;
  /** A shop can flag an order as not picked up this long after its pickup time. */
  noShowGraceMinutes: number;
  /** Shops are told to start a Sippy Brew order this many minutes before pickup. */
  prepLeadMinutes: number;
  orderNoteMaxChars: number;
  /** Members see "price updated" on a menu item for this many days after the shop changes it. */
  priceUpdatedBadgeDays: number;
  /** Most items accepted from one menu photo. */
  maxScannedMenuItems: number;
}

export const SUB_TIERS: readonly SubTier[] = tiersJson.subTiers as SubTier[];

type RawTier = {
  id: TierGroupId;
  name: string;
  passesPerMonth: number;
  frequency: string;
  blurb: string;
  plans: Record<SubTierId, { priceCents: number; stripePriceEnv: string; blurb?: string; emoji: string; resultLine: string }>;
};

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
      frequency: g.frequency,
      emoji: raw.emoji,
      resultLine: raw.resultLine,
      stripePriceEnv: raw.stripePriceEnv,
    };
  }
  return { id: g.id, name: g.name, passesPerMonth: g.passesPerMonth, frequency: g.frequency, blurb: g.blurb, plans };
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

export const SITE: Readonly<{ launchCity: string; launchCenter: { lat: number; lng: number; label: string } }> = Object.freeze({
  launchCity: siteJson.launchCity,
  launchCenter: siteJson.launchCenter,
});

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

export interface QuizAnswer {
  id: string;
  label: string;
  hint: string;
}
export interface QuizQuestion<A extends QuizAnswer = QuizAnswer> {
  question: string;
  answers: readonly A[];
}
/** "Get matched" quiz: one question per card. Copy lives in config/tiers.json. */
export const QUIZ: {
  drink: QuizQuestion<QuizAnswer & { subTier: SubTierId }>;
  often: QuizQuestion<QuizAnswer & { tier: TierGroupId }>;
} = tiersJson.quiz as never;
