import { describe, expect, it } from "vitest";
import {
  checkCanPost,
  colors,
  contrastRatio,
  dayKey,
  distanceMiles,
  formatCents,
  getTier,
  meetsAA,
  previousWeekBounds,
  shopStats,
  shopsNear,
  TIERS,
} from "../src";

describe("tier config", () => {
  it("loads the three tiers with credit equal to price", () => {
    expect(TIERS.map((t) => [t.id, t.priceCents, t.creditCents])).toEqual([
      ["sip", 3000, 3000],
      ["regular", 6000, 6000],
      ["daily", 10000, 10000],
    ]);
    expect(() => getTier("nope")).toThrow();
  });
});

describe("one post per shop per day", () => {
  const now = new Date("2026-11-04T13:00:00Z");
  it("allows the first post and blocks the second on the same local day", () => {
    const first = checkCanPost("Pumpkin cold foam today!", [], now);
    expect(first).toEqual({ ok: true, postDay: "2026-11-04" });
    expect(checkCanPost("Another one", ["2026-11-04"], now)).toMatchObject({ ok: false, code: "POST_LIMIT" });
    expect(checkCanPost("Next day", ["2026-11-04"], new Date("2026-11-05T05:00:00Z"))).toMatchObject({ ok: true });
  });
  it("uses local days", () => {
    expect(dayKey(new Date("2026-11-05T03:00:00Z"), "America/New_York")).toBe("2026-11-04");
  });
});

describe("weekly payout period", () => {
  it("is the previous Monday 00:00 to Monday 00:00 local", () => {
    const { start, end } = previousWeekBounds(new Date("2026-11-04T13:00:00Z"), "America/New_York"); // Wed Nov 4
    expect(start.toISOString()).toBe("2026-10-26T04:00:00.000Z"); // Mon Oct 26 00:00 EDT
    expect(end.toISOString()).toBe("2026-11-02T05:00:00.000Z"); // Mon Nov 2 00:00 EST
  });
});

describe("geo", () => {
  it("measures distance and filters by saved area", () => {
    const hoboken = { lat: 40.7439, lng: -74.0324 };
    const jc = { lat: 40.7178, lng: -74.0431 };
    expect(distanceMiles(hoboken, jc)).toBeGreaterThan(1.7);
    expect(distanceMiles(hoboken, jc)).toBeLessThan(2.1);
    const near = shopsNear([{ id: "a", ...jc }, { id: "b", lat: 40.9, lng: -74.5 }], { ...hoboken, radiusMiles: 3 });
    expect(near.map((s) => s.id)).toEqual(["a"]);
  });
});

describe("dashboard stats", () => {
  it("counts redemptions, top items, new vs returning and the weekly estimate", () => {
    const now = new Date("2026-11-04T16:00:00Z");
    const o = (id: string, member: string, at: string, total: number, status = "picked_up") => ({
      id, memberId: member, totalCents: total, status, createdAt: at, redeemedAt: at, items: [{ name: total > 400 ? "Latte" : "Drip", quantity: 1 }],
    });
    const stats = shopStats(
      [
        o("1", "m1", "2026-10-20T13:00:00Z", 500), // m1 visited last month → returning
        o("2", "m1", "2026-11-04T13:00:00Z", 500),
        o("3", "m2", "2026-11-04T14:10:00Z", 300),
        o("4", "m3", "2026-11-02T13:00:00Z", 500),
        o("5", "m3", "2026-11-04T15:00:00Z", 500, "ready"), // not redeemed yet
      ],
      now,
    );
    expect(stats.redemptions).toEqual({ today: 2, week: 3, month: 3 });
    expect(stats.members).toEqual({ new: 2, returning: 1 });
    expect(stats.topItems[0]).toEqual({ name: "Latte", quantity: 2 });
    expect(stats.estimatedWeeklyPayoutCents).toBe(440 + 264 + 440);
    expect(stats.busiestHours[0]).toEqual({ hour: 8, count: 2 });
  });
});

describe("brand accessibility (WCAG AA)", () => {
  it("Sky Blue on Espresso passes AA for text", () => {
    expect(meetsAA(colors.skyBlue, colors.espresso, "text")).toBe(true);
  });
  it("Burnt Sugar on Cream Swirl only passes for large text, so small text uses Burnt Sugar Ink", () => {
    expect(contrastRatio(colors.burntSugar, colors.creamSwirl)).toBeCloseTo(4.3, 1);
    expect(meetsAA(colors.burntSugar, colors.creamSwirl, "text")).toBe(false);
    expect(meetsAA(colors.creamSwirl, colors.burntSugar, "large")).toBe(true);
    expect(meetsAA(colors.burntSugarInk, colors.creamSwirl, "text")).toBe(true);
    expect(meetsAA(colors.burntSugarInk, colors.vanillaBean, "text")).toBe(true);
    expect(meetsAA(colors.creamSwirl, colors.burntSugarInk, "text")).toBe(true);
  });
  it("body text colors pass on both page and card backgrounds", () => {
    for (const bg of [colors.creamSwirl, colors.vanillaBean]) {
      expect(meetsAA(colors.espresso, bg)).toBe(true);
      expect(meetsAA(colors.pecan, bg)).toBe(true);
    }
  });
  it("Caramel hover pairs with Espresso text", () => {
    expect(meetsAA(colors.espresso, colors.caramel)).toBe(true);
  });
  it("Sky Blue alone is too light for focus rings on light surfaces (hence the Espresso outline)", () => {
    expect(meetsAA(colors.skyBlue, colors.creamSwirl, "ui")).toBe(false);
    expect(meetsAA(colors.espresso, colors.creamSwirl, "ui")).toBe(true);
  });
});

describe("money formatting", () => {
  it("formats cents", () => {
    expect(formatCents(800)).toBe("$8");
    expect(formatCents(525)).toBe("$5.25");
    expect(formatCents(123456)).toBe("$1,234.56");
    expect(formatCents(-60)).toBe("-$0.60");
  });
});
