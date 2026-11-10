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
