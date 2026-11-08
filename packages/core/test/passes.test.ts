import { describe, expect, it } from "vitest";
import {
  canReleasePass,
  checkPassAvailable,
  getTier,
  hasGrantForPeriod,
  monthEconomics,
  passBalance,
  planRenewal,
  splitPassValue,
  TIERS,
  validatePassEntry,
  type PassLedgerEntry,
} from "../src";

const TZ = "America/New_York";
const periodStart = "2026-11-01T14:00:00.000Z";
const prevStart = "2026-10-01T14:00:00.000Z";

describe("tier config", () => {
  it("has the three tiers with passes and max values", () => {
    expect(TIERS.map((t) => [t.id, t.name, t.priceCents, t.passesPerMonth, t.maxPassValueCents])).toEqual([
      ["casual", "Casual Brew", 3000, 5, 600],
      ["routine", "Routine", 6000, 8, 750],
      ["daily_ritual", "Daily Ritual", 10000, 12, 833],
    ]);
  });
});

describe("one pass per day per member, across all shops", () => {
  const now = new Date("2026-11-04T15:00:00Z"); // 10am Nov 4 New York

  it("allows the first pass of the day", () => {
    expect(checkPassAvailable({ passesLeft: 5, passDaysUsed: ["2026-11-02"], now, timeZone: TZ })).toEqual({ ok: true, passDay: "2026-11-04", passesLeftAfter: 4 });
  });

  it("blocks a second pass the same day, whichever shop it was used at", () => {
    // passDaysUsed is per member, built from orders at every shop.
    const r = checkPassAvailable({ passesLeft: 4, passDaysUsed: ["2026-11-04"], now, timeZone: TZ });
    expect(r).toMatchObject({ ok: false, code: "PASS_USED_TODAY" });
  });

  it("uses the local calendar day: 11:30pm and 12:30am are different days", () => {
    const lateNight = new Date("2026-11-05T04:30:00Z"); // 11:30pm Nov 4
    const afterMidnight = new Date("2026-11-05T05:30:00Z"); // 12:30am Nov 5
    expect(checkPassAvailable({ passesLeft: 3, passDaysUsed: ["2026-11-04"], now: lateNight, timeZone: TZ }).ok).toBe(false);
    expect(checkPassAvailable({ passesLeft: 3, passDaysUsed: ["2026-11-04"], now: afterMidnight, timeZone: TZ }).ok).toBe(true);
  });
});

describe("pass count can't exceed the tier's monthly allowance", () => {
  it("blocks when no passes are left", () => {
    const now = new Date("2026-11-20T15:00:00Z");
    expect(checkPassAvailable({ passesLeft: 0, passDaysUsed: [], now, timeZone: TZ })).toMatchObject({ ok: false, code: "NO_PASSES_LEFT" });
  });

  it("a Casual Brew member gets exactly 5 passes, then is blocked", () => {
    const tier = getTier("casual");
    const entries: PassLedgerEntry[] = [{ type: "grant", passes: tier.passesPerMonth, periodStart }];
    const days: string[] = [];
    let used = 0;
    for (let d = 2; d <= 12; d++) {
      const now = new Date(`2026-11-${String(d).padStart(2, "0")}T15:00:00Z`);
      const r = checkPassAvailable({ passesLeft: passBalance(entries, periodStart), passDaysUsed: days, now, timeZone: TZ });
      if (!r.ok) {
        expect(r.code).toBe("NO_PASSES_LEFT");
        continue;
      }
      entries.push({ type: "use", passes: -1, periodStart });
      days.push(r.passDay);
      used++;
    }
    expect(used).toBe(5);
    expect(passBalance(entries, periodStart)).toBe(0);
  });

  it("monthEconomics rejects more uses than the tier includes", () => {
    expect(() => monthEconomics(getTier("casual"), [600, 600, 600, 600, 600, 600])).toThrow();
  });

  it("a cancelled order releases its pass", () => {
    const entries: PassLedgerEntry[] = [
      { type: "grant", passes: 8, periodStart },
      { type: "use", passes: -1, periodStart },
      { type: "release", passes: 1, periodStart },
    ];
    expect(passBalance(entries, periodStart)).toBe(8);
  });

  it("enforces ledger sign conventions", () => {
    expect(() => validatePassEntry({ type: "use", passes: 1, periodStart })).toThrow();
    expect(() => validatePassEntry({ type: "grant", passes: -5, periodStart })).toThrow();
    expect(() => validatePassEntry({ type: "use", passes: -1, periodStart })).not.toThrow();
  });
});

describe("drinks above the max are split between pass value and upgrade", () => {
  it("covers a drink under the max in full", () => {
    expect(splitPassValue(475, 600)).toEqual({ totalCents: 475, passValueCents: 475, upgradeCents: 0 });
  });
  it("covers a drink at exactly the max in full", () => {
    expect(splitPassValue(750, 750)).toEqual({ totalCents: 750, passValueCents: 750, upgradeCents: 0 });
  });
  it("charges the difference above the max as an upgrade", () => {
    expect(splitPassValue(675, 600)).toEqual({ totalCents: 675, passValueCents: 600, upgradeCents: 75 });
    expect(splitPassValue(925, 833)).toEqual({ totalCents: 925, passValueCents: 833, upgradeCents: 92 });
  });
  it("applies the max to the whole day's order, not per drink", () => {
    // Two drinks on one pass: $3.25 + $4.25 = $7.50 against a $6.00 max.
    expect(splitPassValue(325 + 425, 600)).toEqual({ totalCents: 750, passValueCents: 600, upgradeCents: 150 });
  });
  it("includes upgrades in the shop total and the 12% commission", () => {
    const e = monthEconomics(getTier("casual"), [675]);
    expect(e).toMatchObject({ coveredCents: 600, upgradeCents: 75, shopCents: 594 }); // 88% of $6.75 = $5.94
    expect(e.platformCents).toBe(3000 + 75 - 594);
  });
});

describe("commission and shop payout per member-month", () => {
  const cases: [string, number, number, number][] = [
    // tier, passes used (each at or above the max), shop $, platform $
    ["casual", 5, 2640, 360],
    ["casual", 3, 1584, 1416],
    ["routine", 8, 5280, 720],
    ["routine", 6, 3960, 2040],
    ["daily_ritual", 12, 8796, 1204],
    ["daily_ritual", 9, 6597, 3403],
  ];
  for (const [tierId, used, shop, platform] of cases) {
    it(`${getTier(tierId).name}: ${used} passes used → shop $${(shop / 100).toFixed(2)}, platform $${(platform / 100).toFixed(2)}`, () => {
      const tier = getTier(tierId);
      const e = monthEconomics(tier, Array(used).fill(tier.maxPassValueCents));
      expect(e.shopCents).toBe(shop);
      expect(e.platformCents).toBe(platform);
      expect(e.shopCents + e.platformCents).toBe(tier.priceCents);
      expect(e.passesUnused).toBe(tier.passesPerMonth - used);
    });
  }
});

describe("unused passes expire on renewal and never carry over", () => {
  const prev: PassLedgerEntry[] = [
    { type: "grant", passes: 8, periodStart: prevStart },
    { type: "use", passes: -1, periodStart: prevStart },
    { type: "use", passes: -1, periodStart: prevStart },
    { type: "use", passes: -1, periodStart: prevStart },
  ];

  it("expires the 5 unused passes and grants a fresh 8", () => {
    expect(planRenewal({ previousEntries: prev, previousPeriodStart: prevStart, newPeriodStart: periodStart, tier: getTier("routine") })).toEqual([
      { type: "expire", passes: -5, periodStart: prevStart, note: expect.any(String) },
      { type: "grant", passes: 8, periodStart, note: expect.any(String) },
    ]);
  });

  it("the new balance is exactly the tier allowance however many were left", () => {
    for (const usedLast of [0, 3, 8]) {
      const previous: PassLedgerEntry[] = [{ type: "grant", passes: 8, periodStart: prevStart }];
      for (let i = 0; i < usedLast; i++) previous.push({ type: "use", passes: -1, periodStart: prevStart });
      const all = [...previous, ...planRenewal({ previousEntries: previous, previousPeriodStart: prevStart, newPeriodStart: periodStart, tier: getTier("routine") })];
      expect(passBalance(all, periodStart)).toBe(8);
      expect(passBalance(all, prevStart)).toBe(0);
      expect(all.reduce((s, e) => s + e.passes, 0)).toBe(8);
    }
  });

  it("ignores old-period passes even if an expire entry was never written", () => {
    expect(passBalance([...prev, { type: "grant", passes: 8, periodStart }], periodStart)).toBe(8);
  });

  it("first period only grants; downgrade grants the new tier's allowance", () => {
    expect(planRenewal({ previousEntries: [], previousPeriodStart: null, newPeriodStart: periodStart, tier: getTier("daily_ritual") })).toEqual([
      { type: "grant", passes: 12, periodStart, note: expect.any(String) },
    ]);
    expect(planRenewal({ previousEntries: prev, previousPeriodStart: prevStart, newPeriodStart: periodStart, tier: getTier("casual") }).at(-1)).toMatchObject({ type: "grant", passes: 5 });
  });

  it("detects duplicate grants and won't release a pass from an expired period", () => {
    expect(hasGrantForPeriod([...prev, { type: "grant", passes: 8, periodStart }], periodStart)).toBe(true);
    expect(hasGrantForPeriod(prev, periodStart)).toBe(false);
    expect(canReleasePass(prevStart, periodStart)).toBe(false);
    expect(canReleasePass(periodStart, periodStart)).toBe(true);
  });
});
