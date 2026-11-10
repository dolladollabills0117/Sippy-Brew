import { describe, expect, it } from "vitest";
import {
  bonusBalance,
  bonusExpiry,
  makeReferralCode,
  nextBonusToUse,
  passportStatus,
  passSourceForOrder,
  referralCounts,
  referralStatus,
  RULES,
  type BonusGrant,
} from "../src";

const now = new Date("2026-11-10T15:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 864e5);
const shops = (n: number, liveDaysAgo = 60) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, liveSince: daysAgo(liveDaysAgo) }));

describe("Neighborhood passport", () => {
  it("5 different shops earns one free bonus pass, once", () => {
    const live = shops(8);
    expect(passportStatus({ visitedShopIds: ["s0", "s1", "s2", "s3"], liveShops: live, passportEarned: false, grandTourEarned: false, now }).passportDue).toBe(false);
    const five = passportStatus({ visitedShopIds: ["s0", "s1", "s2", "s3", "s4"], liveShops: live, passportEarned: false, grandTourEarned: false, now });
    expect(five).toMatchObject({ visited: 5, goal: 5, passportDue: true });
    expect(RULES.passportFreePasses).toBe(1);
    expect(passportStatus({ visitedShopIds: ["s0", "s1", "s2", "s3", "s4", "s5"], liveShops: live, passportEarned: true, grandTourEarned: false, now }).passportDue).toBe(false);
  });

  it("repeat visits to the same shop count once", () => {
    const st = passportStatus({ visitedShopIds: ["s0", "s0", "s0", "s1"], liveShops: shops(5), passportEarned: false, grandTourEarned: false, now });
    expect(st.visited).toBe(2);
  });
});

describe("Grand Tour", () => {
  it("is off until more than 50 shops are live", () => {
    const fifty = shops(50);
    const all50 = fifty.map((s) => s.id);
    expect(passportStatus({ visitedShopIds: all50, liveShops: fifty, passportEarned: true, grandTourEarned: false, now }).grandTour).toMatchObject({ unlocked: false, due: false });
    const fiftyOne = shops(51);
    const st = passportStatus({ visitedShopIds: fiftyOne.map((s) => s.id), liveShops: fiftyOne, passportEarned: true, grandTourEarned: false, now });
    expect(st.grandTour).toMatchObject({ unlocked: true, due: true, remaining: 0 });
    expect(RULES.grandTourFreeMonths).toBe(2);
  });

  it("brand-new shops don't count until they've been live 30 days", () => {
    const live = [...shops(51), { id: "new", liveSince: daysAgo(3) }];
    const st = passportStatus({ visitedShopIds: shops(51).map((s) => s.id), liveShops: live, passportEarned: true, grandTourEarned: false, now });
    expect(st.grandTour).toMatchObject({ countingShops: 51, remaining: 0, due: true });
  });

  it("needs every counting shop, and pays out once", () => {
    const live = shops(52);
    const most = live.slice(0, 51).map((s) => s.id);
    expect(passportStatus({ visitedShopIds: most, liveShops: live, passportEarned: true, grandTourEarned: false, now }).grandTour).toMatchObject({ remaining: 1, due: false });
    const all = live.map((s) => s.id);
    expect(passportStatus({ visitedShopIds: all, liveShops: live, passportEarned: true, grandTourEarned: true, now }).grandTour.due).toBe(false);
  });
});

describe("Referrals", () => {
  it("every 2 friends who join earns 3 bonus passes", () => {
    expect(referralStatus(1, 0)).toMatchObject({ friendsToNext: 1, rewardsDue: 0 });
    expect(referralStatus(2, 0)).toMatchObject({ rewardsEarned: 1, rewardsDue: 1, passesPerReward: 3, friendsToNext: 2 });
    expect(referralStatus(5, 1)).toMatchObject({ rewardsEarned: 2, rewardsDue: 1, friendsToNext: 1 });
  });

  it("only counts other people whose first month is paid", () => {
    expect(referralCounts({ referrerId: "a", friendId: "a", friendFirstPaymentAt: now })).toBe(false);
    expect(referralCounts({ referrerId: "a", friendId: "b", friendFirstPaymentAt: null })).toBe(false);
    expect(referralCounts({ referrerId: "a", friendId: "b", friendFirstPaymentAt: now })).toBe(true);
  });

  it("makes readable codes", () => {
    expect(makeReferralCode()).toMatch(/^SB-[A-HJ-NP-Z2-9]{6}$/);
  });
});

describe("Bonus passes roll over for a year", () => {
  const grants: BonusGrant[] = [
    { id: "ref", source: "referral", passes: 3, used: 1, grantedAt: daysAgo(10), expiresAt: bonusExpiry(daysAgo(10)) },
    { id: "pp", source: "passport", passes: 1, used: 0, grantedAt: daysAgo(200), expiresAt: bonusExpiry(daysAgo(200)) },
    { id: "old", source: "referral", passes: 3, used: 0, grantedAt: daysAgo(400), expiresAt: bonusExpiry(daysAgo(400)) },
  ];

  it("expire 365 days after they're earned, not at renewal", () => {
    expect(bonusExpiry(now).getTime() - now.getTime()).toBe(365 * 864e5);
    expect(bonusBalance(grants, now)).toBe(3); // 2 referral + 1 passport; the 400-day-old grant expired
  });

  it("orders use this month's passes first, then the bonus that expires soonest", () => {
    expect(passSourceForOrder(2, 3)).toBe("period");
    expect(passSourceForOrder(0, 3)).toBe("bonus");
    expect(passSourceForOrder(0, 0)).toBeNull();
    expect(nextBonusToUse(grants, now)?.id).toBe("pp");
  });
});
