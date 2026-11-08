import { describe, expect, it } from "vitest";
import { RULES, splitOrder, summarizePayout } from "../src";

describe("commission math on pass-covered value (12% platform, 88% shop)", () => {
  it("uses 12% from config", () => {
    expect(RULES.commissionBps).toBe(1200);
  });

  it("splits a $5.00 order into $0.60 commission and $4.40 to the shop", () => {
    expect(splitOrder(500)).toEqual({ grossCents: 500, commissionCents: 60, netCents: 440 });
  });

  it("rounds half up per order", () => {
    // 12% of $4.75 = 57 cents exactly; 12% of $4.80 = 57.6 → 58; 12% of $4.20 = 50.4 → 50
    expect(splitOrder(475).commissionCents).toBe(57);
    expect(splitOrder(480).commissionCents).toBe(58);
    expect(splitOrder(420).commissionCents).toBe(50);
    // 12% of $0.25 = 3.0; 12% of $0.21 = 2.52 → 3; 12% of $1.04 = 12.48 → 12
    expect(splitOrder(21).commissionCents).toBe(3);
    expect(splitOrder(104).commissionCents).toBe(12);
  });

  it("commission + net always equals gross", () => {
    for (let gross = 0; gross <= 2000; gross++) {
      const s = splitOrder(gross);
      expect(s.commissionCents + s.netCents).toBe(gross);
      expect(s.commissionCents).toBeGreaterThanOrEqual(0);
    }
  });

  it("summarizes a payout as the sum of per-order splits", () => {
    const orders = [480, 480, 480].map((c) => ({ passCoveredCents: c, overageCents: 0 })); // each 57.6 → 58
    expect(summarizePayout(orders)).toEqual({
      grossCents: 1440, commissionCents: 174, netCents: 1266, overageTotalCents: 0, processingFeesCents: 0, transferCents: 1266, orderCount: 3,
    });
  });

  it("adds overages to the transfer, less processing, with no commission on them", () => {
    const s = summarizePayout([
      { passCoveredCents: 800, overageCents: 150 }, // estimated fee 34¢
      { passCoveredCents: 800, overageCents: 0 },
      { passCoveredCents: 800, overageCents: 300, overageFeeCents: 39 }, // actual Stripe fee
    ]);
    expect(s).toEqual({
      grossCents: 2400, commissionCents: 288, netCents: 2112, overageTotalCents: 450, processingFeesCents: 73, transferCents: 2112 + 450 - 73, orderCount: 3,
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
