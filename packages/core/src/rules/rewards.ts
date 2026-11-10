import { RULES } from "../config";

/**
 * Rewards: the Neighborhood Passport, the Grand Tour and referrals.
 *
 * - Passport: pick up orders at `passportShopsForFreePass` (5) different shops and earn
 *   `passportFreePasses` (1) bonus pass. Once per member.
 * - Grand Tour: pick up at every shop that's been live for 30+ days and earn
 *   `grandTourFreeMonths` (2) months of your plan free. Only switched on once more than 50
 *   shops are live (`grandTourMinShops` = 51). Once per member.
 * - Referrals: every `referralFriendsNeeded` (2) friends who join and pay their first month earn
 *   the member `referralBonusPasses` (3) bonus passes.
 *
 * Bonus passes work like Daily Passes (one per day, cover up to the member's daily max, which
 * is $4 on House and $8 on Specialty) but roll over: each expires `bonusPassLifetimeDays` (365)
 * after it was earned instead of at renewal. Orders use this month's passes first, then the
 * bonus pass that expires soonest. Shops are paid for a bonus pass exactly like a Daily Pass.
 */

export type BonusSource = "passport" | "referral";

export interface BonusGrant {
  id?: string;
  source: BonusSource;
  passes: number;
  used: number;
  grantedAt: Date | string;
  expiresAt: Date | string;
}

export function bonusExpiry(grantedAt: Date): Date {
  return new Date(grantedAt.getTime() + RULES.bonusPassLifetimeDays * 864e5);
}

/** Bonus passes still usable at `now`. */
export function bonusBalance(grants: readonly BonusGrant[], now: Date): number {
  return grants.reduce((n, g) => (new Date(g.expiresAt).getTime() > now.getTime() ? n + Math.max(0, g.passes - g.used) : n), 0);
}

/** Which bonus grant an order should use: the one that expires soonest. */
export function nextBonusToUse<T extends BonusGrant>(grants: readonly T[], now: Date): T | null {
  const usable = grants.filter((g) => g.passes - g.used > 0 && new Date(g.expiresAt).getTime() > now.getTime());
  usable.sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
  return usable[0] ?? null;
}

/** Soonest expiry among usable bonus passes, for "rolls over until …". */
export function bonusExpiresSoonest(grants: readonly BonusGrant[], now: Date): Date | null {
  const g = nextBonusToUse(grants, now);
  return g ? new Date(g.expiresAt) : null;
}

/** Which pass an order uses: this month's first (they expire sooner), then a bonus pass. */
export function passSourceForOrder(periodPassesLeft: number, bonusLeft: number): "period" | "bonus" | null {
  if (periodPassesLeft > 0) return "period";
  if (bonusLeft > 0) return "bonus";
  return null;
}

// ---------------------------------------------------------------------------
// Neighborhood passport and Grand Tour
// ---------------------------------------------------------------------------

export interface PassportShop {
  id: string;
  /** When the shop went live (approved). */
  liveSince: Date | string;
}

export interface PassportStatus {
  /** Different shops the member has picked up from. */
  visited: number;
  goal: number;
  /** Passport reward already given. */
  passportEarned: boolean;
  /** Passport reward should be given now. */
  passportDue: boolean;
  grandTour: {
    /** Over 50 shops live, so the Grand Tour is on. */
    unlocked: boolean;
    liveShops: number;
    minShops: number;
    /** Shops that count (live 30+ days). */
    countingShops: number;
    /** Of those, how many the member has visited. */
    visitedCounting: number;
    remaining: number;
    earned: boolean;
    due: boolean;
  };
}

export function passportStatus(params: {
  visitedShopIds: Iterable<string>;
  liveShops: readonly PassportShop[];
  passportEarned: boolean;
  grandTourEarned: boolean;
  now: Date;
}): PassportStatus {
  const visited = new Set(params.visitedShopIds);
  const goal = RULES.passportShopsForFreePass;
  const cutoff = params.now.getTime() - RULES.grandTourShopMinLiveDays * 864e5;
  const counting = params.liveShops.filter((s) => new Date(s.liveSince).getTime() <= cutoff);
  const visitedCounting = counting.filter((s) => visited.has(s.id)).length;
  const unlocked = params.liveShops.length >= RULES.grandTourMinShops;
  const complete = counting.length > 0 && visitedCounting === counting.length;
  return {
    visited: visited.size,
    goal,
    passportEarned: params.passportEarned,
    passportDue: !params.passportEarned && visited.size >= goal,
    grandTour: {
      unlocked,
      liveShops: params.liveShops.length,
      minShops: RULES.grandTourMinShops,
      countingShops: counting.length,
      visitedCounting,
      remaining: counting.length - visitedCounting,
      earned: params.grandTourEarned,
      due: unlocked && complete && !params.grandTourEarned,
    },
  };
}

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------

export interface ReferralStatus {
  /** Friends who joined and paid their first month. */
  friendsJoined: number;
  /** Friends still needed for the next reward. */
  friendsToNext: number;
  /** Rewards (batches of bonus passes) earned so far, and how many should be given now. */
  rewardsEarned: number;
  rewardsDue: number;
  passesPerReward: number;
}

export function referralStatus(friendsJoined: number, rewardsGranted: number): ReferralStatus {
  const need = RULES.referralFriendsNeeded;
  const earned = Math.floor(friendsJoined / need);
  return {
    friendsJoined,
    friendsToNext: need - (friendsJoined % need),
    rewardsEarned: earned,
    rewardsDue: Math.max(0, earned - rewardsGranted),
    passesPerReward: RULES.referralBonusPasses,
  };
}

/** A friend's referral counts when they're a different, new member and their first month is paid. */
export function referralCounts(params: { referrerId: string; friendId: string; friendFirstPaymentAt: Date | string | null }): boolean {
  return params.referrerId !== params.friendId && Boolean(params.friendFirstPaymentAt);
}

/** Short shareable code, e.g. "SB-7K2QF9". No 0/O/1/I so it's easy to read aloud. */
export function makeReferralCode(random: () => number = Math.random): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(random() * chars.length)];
  return `SB-${out}`;
}
