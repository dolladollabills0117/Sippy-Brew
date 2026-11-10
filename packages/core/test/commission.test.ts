import { describe, expect, it } from "vitest";
import { commissionBpsFor, overageCommission, platformTake, RULES, splitOrder, subscriptionProcessingFee, summarizePayout } from "../src";

const F = RULES.foundingCommissionBps;

describe("commission rates", () => {
  it("founding shops 12%, everyone else 15%, 5% on overages for all", () => {
    expect(RULES.foundingCommissionBps).toBe(1200);
    expect(RULES.standardCommissionBps).toBe(1500);
    expect(RULES.overageCommissionBps).toBe(500);
    expect(commissionBpsFor({ founding: true })).toBe(1200);
    expect(commissionBpsFor({ founding: false })).toBe(1500);
    expect(commissionBpsFor(null)).toBe(1500);
  });
  it("standard shops: $5.00 → $0.75 commission, $4.25 to the shop", () => {
    expect(splitOrder(500)).toEqual({ grossCents: 500, commissionCents: 75, netCents: 425 });
  });
  it("5% of charged overages, nothing on waived ones", () => {
    expect(overageCommission(300)).toBe(15);
    expect(overageCommission(150)).toBe(8); // 7.5 rounds up
    expect(overageCommission(25)).toBe(0); // under the $0.50 minimum: waived
  });
});

describe("commission math on pass-covered value (founding: 12% platform, 88% shop)", () => {

  it("splits a $5.00 order into $0.60 commission and $4.40 to the shop", () => {
    expect(splitOrder(500, F)).toEqual({ grossCents: 500, commissionCents: 60, netCents: 440 });
  });

  it("rounds half up per order", () => {
    // 12% of $4.75 = 57 cents exactly; 12% of $4.80 = 57.6 → 58; 12% of $4.20 = 50.4 → 50
    expect(splitOrder(475, F).commissionCents).toBe(57);
    expect(splitOrder(480, F).commissionCents).toBe(58);
    expect(splitOrder(420, F).commissionCents).toBe(50);
    // 12% of $0.25 = 3.0; 12% of $0.21 = 2.52 → 3; 12% of $1.04 = 12.48 → 12
    expect(splitOrder(21, F).commissionCents).toBe(3);
    expect(splitOrder(104, F).commissionCents).toBe(12);
  });

  it("commission + net always equals gross", () => {
    for (let gross = 0; gross <= 2000; gross++) {
      const s = splitOrder(gross, F);
      expect(s.commissionCents + s.netCents).toBe(gross);
      expect(s.commissionCents).toBeGreaterThanOrEqual(0);
    }
  });

  it("summarizes a payout as the sum of per-order splits", () => {
    const orders = [480, 480, 480].map((c) => ({ passCoveredCents: c, overageCents: 0 })); // each 57.6 → 58
    expect(summarizePayout(orders, F)).toEqual({
      grossCents: 1440, commissionCents: 174, netCents: 1266, overageTotalCents: 0, processingFeesCents: 0, overageCommissionCents: 0, transferCents: 1266, orderCount: 3,
    });
  });

  it("adds overages to the transfer, less processing and 5%", () => {
    const s = summarizePayout([
      { passCoveredCents: 800, overageCents: 150 }, // estimated fee 34¢
      { passCoveredCents: 800, overageCents: 0 },
      { passCoveredCents: 800, overageCents: 300, overageFeeCents: 39 }, // actual Stripe fee
    ], F);
    expect(s).toEqual({
      grossCents: 2400, commissionCents: 288, netCents: 2112, overageTotalCents: 450, processingFeesCents: 73, overageCommissionCents: 23, transferCents: 2112 + 450 - 73 - 23, orderCount: 3,
    });
  });

  it("an empty week pays nothing", () => {
    expect(summarizePayout([])).toMatchObject({ grossCents: 0, commissionCents: 0, netCents: 0, transferCents: 0, orderCount: 0 });
  });

  it("rejects bad input", () => {
    expect(() => splitOrder(-1)).toThrow();
    expect(() => splitOrder(4.5)).toThrow();
    expect(() => splitOrder(500, 12.5)).toThrow();
  });
});


describe("What Sippy Brew keeps", () => {
  it("revenue minus shop payouts minus card fees", () => {
    expect(subscriptionProcessingFee(9600)).toBe(308);
    // One Regular · Specialty member who used all 12 passes at $8: shops got 88% of $96.
    expect(platformTake({ planPricesCents: [9600], shopNetCents: 8448 })).toEqual({ revenueCents: 9600, shopPayoutCents: 8448, cardFeesCents: 308, overageCommissionCents: 0, keepCents: 844 });
    expect(platformTake({ planPricesCents: [9600], shopNetCents: 8448, overageCommissionCents: 40 }).keepCents).toBe(884);
    // Same member, 9 passes at $6.50.
    expect(platformTake({ planPricesCents: [9600], shopNetCents: 5148 }).keepCents).toBe(4144);
  });
});

import { payoutLines, recentWeeks } from "../src";

describe("payout breakdown order", () => {
  it("pass sales, overages (+), deductions (−), then net", () => {
    const s = summarizePayout([{ passCoveredCents: 800, overageCents: 300, overageFeeCents: 39 }], 1500);
    const lines = payoutLines(s, 1500);
    expect(lines.map((l) => l.kind)).toEqual(["base", "plus", "minus", "minus", "minus", "total"]);
    expect(lines.map((l) => l.label)).toEqual(["Pass sales (1 order)", "Overages", "15% commission on pass sales", "5% fee on overages", "Card processing on overages", "Net payout"]);
    expect(lines[5]!.cents).toBe(800 - 120 + 300 - 15 - 39);
  });
  it("lists recent Monday-start weeks, newest first", () => {
    const w = recentWeeks(new Date("2026-11-11T15:00:00Z"), 3);
    expect(w).toHaveLength(3);
    expect(w[0]!.start.getTime()).toBeGreaterThan(w[1]!.start.getTime());
    expect(w[1]!.end.getTime()).toBe(w[0]!.start.getTime());
  });
});

import { effectiveBps, settledShopCents, summarizeSettled } from "../src/rules/commission";
import type { SettledOrder } from "../src/types";

describe("settled orders", () => {
  const o = (pass: number, over: number, bps: number): SettledOrder => {
    const commission = Math.round((pass * bps) / 10000);
    const fee = over ? Math.round(over * 0.029) + 30 : 0;
    return { id: String(pass + over), shopId: "s", payoutId: null, status: "picked_up", redeemedAt: "2026-11-10T15:00:00Z", totalCents: pass + over, passCoveredCents: pass, overageCents: over, commissionCents: commission, netCents: pass - commission, overageFeeCents: fee, overageCommissionCents: Math.round(over * 0.05), items: [] };
  };
  it("matches the scan math: $8 pass + $3.25 overage at 15% pays $9.50", () => {
    expect(settledShopCents(o(800, 325, 1500))).toBe(950);
  });
  it("sums like the weekly payout and recovers the rate charged", () => {
    const s = summarizeSettled([o(800, 325, 1200), o(400, 0, 1200)]);
    expect(s.grossCents).toBe(1200);
    expect(s.commissionCents).toBe(144);
    expect(s.transferCents).toBe(settledShopCents(o(800, 325, 1200)) + 352);
    expect(effectiveBps(s, 1500)).toBe(1200);
    expect(effectiveBps(summarizeSettled([]), 1500)).toBe(1500);
  });
});
