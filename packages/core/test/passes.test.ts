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
  DEFAULT_TIER,
  orderPayout,
  overageIsCharged,
  overageProcessingFee,
  RULES,
  TIERS,
  validatePassEntry,
  type PassLedgerEntry,
} from "../src";

const TZ = "America/New_York";
const periodStart = "2026-11-01T14:00:00.000Z";
const prevStart = "2026-10-01T14:00:00.000Z";

describe("tier config", () => {
  it("has the three tiers, each with an $8.00 max per pass", () => {
    expect(TIERS.map((t) => [t.id, t.name, t.priceCents, t.passesPerMonth, t.maxPassValueCents])).toEqual([
      ["affogato", "Affogato", 4000, 5, 800],
      ["macchiato", "Macchiato", 9600, 12, 800],
      ["double_espresso", "Double Espresso", 16000, 20, 800],
    ]);
    expect(DEFAULT_TIER).toBe("macchiato");
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

  it("an Affogato member gets exactly 5 passes, then is blocked", () => {
    const tier = getTier("affogato");
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
    expect(() => monthEconomics(getTier("affogato"), [800, 800, 800, 800, 800, 800])).toThrow();
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

describe("the pass covers the first $8.00; the rest is overage", () => {
  it("$8.00 order: the pass covers it, no overage", () => {
    expect(splitPassValue(800, 800)).toEqual({ totalCents: 800, passCoveredCents: 800, overageCents: 0 });
  });
  it("$9.50 order: the pass covers $8.00 and the member owes $1.50", () => {
    expect(splitPassValue(950, 800)).toEqual({ totalCents: 950, passCoveredCents: 800, overageCents: 150 });
  });
  it("an order under $8.00 is covered in full", () => {
    expect(splitPassValue(475, 800)).toEqual({ totalCents: 475, passCoveredCents: 475, overageCents: 0 });
  });
  it("applies the $8.00 to the whole day's order, not per drink", () => {
    // Two drinks on one pass: $4.25 + $5.25 = $9.50.
    expect(splitPassValue(425 + 525, 800)).toMatchObject({ passCoveredCents: 800, overageCents: 150 });
  });
});

describe("overage money: 100% to the shop, no commission, shop pays processing", () => {
  it("excludes overage from commission", () => {
    const withOverage = orderPayout({ passCoveredCents: 800, overageCents: 150, overageFeeCents: 0 });
    const withoutOverage = orderPayout({ passCoveredCents: 800, overageCents: 0 });
    expect(withOverage.commissionCents).toBe(96); // 12% of $8.00 only
    expect(withOverage.commissionCents).toBe(withoutOverage.commissionCents);
  });
  it("pays the shop the overage minus processing fees", () => {
    // $1.50 overage, estimated card processing 2.9% + 30¢ = 4¢ + 30¢ = 34¢.
    expect(overageProcessingFee(150)).toBe(34);
    const p = orderPayout({ passCoveredCents: 800, overageCents: 150 });
    expect(p).toEqual({ passCoveredCents: 800, commissionCents: 96, passNetCents: 704, overageCents: 150, processingFeeCents: 34, shopCents: 704 + 150 - 34 });
  });
  it("uses the actual Stripe fee when it's known", () => {
    expect(orderPayout({ passCoveredCents: 800, overageCents: 300, overageFeeCents: 39 }).shopCents).toBe(704 + 300 - 39);
  });
  it("overage never changes the platform's take", () => {
    const tier = getTier("macchiato");
    const plain = monthEconomics(tier, Array(12).fill(800));
    const over = monthEconomics(tier, Array(12).fill(950));
    expect(over.platformCents).toBe(plain.platformCents);
    expect(over.shopCents).toBe(plain.shopCents + 12 * (150 - 34));
  });
  it("overages under the minimum card charge can't be charged, so they're waived with no fee", () => {
    expect(RULES.minOverageChargeCents).toBe(50);
    expect(overageIsCharged(49)).toBe(false);
    expect(overageIsCharged(50)).toBe(true);
    expect(overageProcessingFee(25)).toBe(0);
  });
});

describe("commission: 12% of pass-covered value; shop gets 88%", () => {
  const cases: [string, number, number, number][] = [
    // tier, passes used (each an $8.00 order), shop, platform
    ["affogato", 5, 3520, 480],
    ["macchiato", 12, 8448, 1152],
    ["double_espresso", 20, 14080, 1920],
  ];
  for (const [tierId, used, shop, platform] of cases) {
    it(`${getTier(tierId).name}: ${used} passes used → shop $${(shop / 100).toFixed(2)}, platform $${(platform / 100).toFixed(2)}`, () => {
      const tier = getTier(tierId);
      const e = monthEconomics(tier, Array(used).fill(tier.maxPassValueCents));
      expect(e.shopCents).toBe(shop);
      expect(e.platformCents).toBe(platform);
      expect(e.shopCents + e.platformCents).toBe(tier.priceCents);
    });
  }
  it("the platform keeps the value of unused passes", () => {
    const e = monthEconomics(getTier("affogato"), [800, 800, 800]); // 2 of 5 unused
    expect(e).toMatchObject({ passesUnused: 2, shopCents: 3 * 704, platformCents: 4000 - 3 * 704 });
  });
});

describe("unused passes expire on renewal and never carry over", () => {
  const prev: PassLedgerEntry[] = [
    { type: "grant", passes: 12, periodStart: prevStart },
    { type: "use", passes: -1, periodStart: prevStart },
    { type: "use", passes: -1, periodStart: prevStart },
    { type: "use", passes: -1, periodStart: prevStart },
  ];

  it("expires the 9 unused passes and grants a fresh 12", () => {
    expect(planRenewal({ previousEntries: prev, previousPeriodStart: prevStart, newPeriodStart: periodStart, tier: getTier("macchiato") })).toEqual([
      { type: "expire", passes: -9, periodStart: prevStart, note: expect.any(String) },
      { type: "grant", passes: 12, periodStart, note: expect.any(String) },
    ]);
  });

  it("the new balance is exactly the tier allowance however many were left", () => {
    for (const usedLast of [0, 3, 12]) {
      const previous: PassLedgerEntry[] = [{ type: "grant", passes: 12, periodStart: prevStart }];
      for (let i = 0; i < usedLast; i++) previous.push({ type: "use", passes: -1, periodStart: prevStart });
      const all = [...previous, ...planRenewal({ previousEntries: previous, previousPeriodStart: prevStart, newPeriodStart: periodStart, tier: getTier("macchiato") })];
      expect(passBalance(all, periodStart)).toBe(12);
      expect(passBalance(all, prevStart)).toBe(0);
      expect(all.reduce((s, e) => s + e.passes, 0)).toBe(12);
    }
  });

  it("ignores old-period passes even if an expire entry was never written", () => {
    expect(passBalance([...prev, { type: "grant", passes: 12, periodStart }], periodStart)).toBe(12);
  });

  it("first period only grants; downgrade grants the new tier's allowance", () => {
    expect(planRenewal({ previousEntries: [], previousPeriodStart: null, newPeriodStart: periodStart, tier: getTier("double_espresso") })).toEqual([
      { type: "grant", passes: 20, periodStart, note: expect.any(String) },
    ]);
    expect(planRenewal({ previousEntries: prev, previousPeriodStart: prevStart, newPeriodStart: periodStart, tier: getTier("affogato") }).at(-1)).toMatchObject({ type: "grant", passes: 5 });
  });

  it("detects duplicate grants and won't release a pass from an expired period", () => {
    expect(hasGrantForPeriod([...prev, { type: "grant", passes: 12, periodStart }], periodStart)).toBe(true);
    expect(hasGrantForPeriod(prev, periodStart)).toBe(false);
    expect(canReleasePass(prevStart, periodStart)).toBe(false);
    expect(canReleasePass(periodStart, periodStart)).toBe(true);
  });
});
