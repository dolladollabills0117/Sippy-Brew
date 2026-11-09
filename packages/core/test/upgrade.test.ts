import { describe, expect, it } from "vitest";
import { getTier, overageCoveredByUpgrade, RULES, suggestUpgrade, upgradeNowCost, upgradeTarget } from "../src";

describe("sub-tier upgrades", () => {
  it("moves Decaf up to Double Shot in the same tier, and Double Shot has nowhere higher", () => {
    expect(upgradeTarget(getTier("affogato_decaf"))?.id).toBe("affogato_double_shot");
    expect(upgradeTarget(getTier("double_espresso_decaf"))?.id).toBe("double_espresso_double_shot");
    expect(upgradeTarget(getTier("macchiato_double_shot"))).toBeNull();
  });

  it("charges the per-pass difference for each pass left: $4 × 3 = $12", () => {
    expect(upgradeNowCost(getTier("affogato_decaf"), getTier("affogato_double_shot"), 3)).toBe(1200);
    expect(upgradeNowCost(getTier("macchiato_decaf"), getTier("macchiato_double_shot"), 12)).toBe(4800); // a full period = the monthly difference
    expect(upgradeNowCost(getTier("affogato_decaf"), getTier("affogato_double_shot"), 0)).toBe(0);
    expect(() => upgradeNowCost(getTier("affogato_decaf"), getTier("macchiato_double_shot"), 3)).toThrow();
  });

  it(`nudges after ${RULES.upgradeNudgeAfterOverages} orders with an overage, not before`, () => {
    const plan = getTier("affogato_decaf");
    const one = [{ overageCents: 125, status: "picked_up" }, { overageCents: 0, status: "picked_up" }];
    expect(suggestUpgrade({ plan, periodOrders: one, passesLeft: 3 })).toBeNull();
    const two = [...one, { overageCents: 175, status: "picked_up" }];
    expect(suggestUpgrade({ plan, periodOrders: two, passesLeft: 2 })).toMatchObject({
      to: { id: "affogato_double_shot" },
      overageOrders: 2,
      overagePaidCents: 300,
      upgradeNowCents: 800,
      newMonthlyPriceCents: 4000,
      monthlyDifferenceCents: 2000,
    });
  });

  it("ignores cancelled orders and never nudges Double Shot members", () => {
    const orders = [{ overageCents: 200, status: "cancelled" }, { overageCents: 200, status: "picked_up" }];
    expect(suggestUpgrade({ plan: getTier("affogato_decaf"), periodOrders: orders, passesLeft: 3 })).toBeNull();
    const many = Array(5).fill({ overageCents: 300, status: "picked_up" });
    expect(suggestUpgrade({ plan: getTier("affogato_double_shot"), periodOrders: many, passesLeft: 3 })).toBeNull();
  });

  it("at checkout, tells how much of this order's overage Double Shot would cover", () => {
    expect(overageCoveredByUpgrade(getTier("macchiato_decaf"), 525)).toBe(125); // $5.25 latte: all of the $1.25 overage
    expect(overageCoveredByUpgrade(getTier("macchiato_decaf"), 950)).toBe(400); // $9.50: covers $4 of the $5.50 overage
    expect(overageCoveredByUpgrade(getTier("macchiato_decaf"), 300)).toBe(0);
    expect(overageCoveredByUpgrade(getTier("macchiato_double_shot"), 950)).toBe(0);
  });
});
