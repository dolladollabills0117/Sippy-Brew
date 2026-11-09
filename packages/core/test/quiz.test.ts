import { describe, expect, it } from "vitest";
import { clampRadius, planInEffect, QUIZ, quizResult, recommendPlan, RULES, schedulePlanChange, splitByRadius } from "../src";

describe("Get matched quiz", () => {
  it("drink picks House or Specialty, frequency picks Visitor, Regular or Local", () => {
    expect(recommendPlan({ drink: "house", often: "weekly" }).id).toBe("affogato_decaf");
    expect(recommendPlan({ drink: "specialty", often: "few" }).id).toBe("macchiato_double_shot");
    expect(recommendPlan({ drink: "house", often: "daily" }).id).toBe("double_espresso_decaf");
  });

  it("'a bit of both' goes Specialty so they aren't paying overage every other day", () => {
    expect(recommendPlan({ drink: "both", often: "daily" }).id).toBe("double_espresso_double_shot");
  });

  it("falls back to the most popular plan on unknown answers", () => {
    expect(recommendPlan({ drink: "???", often: null }).id).toBe("macchiato_double_shot");
  });

  it("every answer maps to a real plan with a cheeky result", () => {
    for (const d of QUIZ.drink.answers) {
      for (const o of QUIZ.often.answers) {
        const r = quizResult(recommendPlan({ drink: d.id, often: o.id }));
        expect(r.headline).toMatch(/^You're a (Visitor|Regular|Local)!$/);
        expect(r.emoji.length).toBeGreaterThan(0);
        expect(r.line.length).toBeGreaterThan(10);
      }
    }
    expect(quizResult("double_espresso_double_shot")).toMatchObject({ headline: "You're a Local!", summary: "20 coffees a month, up to $8 each" });
  });
});

describe("Keep it local: 15-mile radius", () => {
  it("caps the radius at 15 miles and defaults bad input", () => {
    expect(RULES.maxRadiusMiles).toBe(15);
    expect(clampRadius(40)).toBe(15);
    expect(clampRadius(0.1)).toBe(0.5);
    expect(clampRadius("nope")).toBe(RULES.defaultRadiusMiles);
  });

  it("splits shops into nearby and other participating shops", () => {
    const home = { lat: 40.7987, lng: -74.2391 }; // West Orange
    const shops = [
      { id: "near", lat: 40.7995, lng: -74.2401 },
      { id: "nyc", lat: 40.7128, lng: -74.006 }, // ~13.5 mi
      { id: "philly", lat: 39.9526, lng: -75.1652 }, // ~75 mi
    ];
    const r5 = splitByRadius(shops, home, 5);
    expect(r5.nearby.map((s) => s.id)).toEqual(["near"]);
    expect(r5.beyond.map((s) => s.id)).toEqual(["nyc", "philly"]);
    const r100 = splitByRadius(shops, home, 100); // clamped to 15
    expect(r100.nearby.map((s) => s.id)).toEqual(["near", "nyc"]);
    expect(r100.beyond.map((s) => s.id)).toEqual(["philly"]);
  });
});

describe("Plan changes take effect next month", () => {
  it("schedules the new plan for the end of the current period", () => {
    const end = new Date("2026-12-09T05:00:00Z");
    const c = schedulePlanChange("affogato_decaf", "double_espresso_double_shot", end)!;
    expect(c.to.name).toBe("Local · Specialty");
    expect(c.effectiveAt).toEqual(end);
    expect(schedulePlanChange("affogato_decaf", "affogato_decaf", end)).toBeNull();
  });

  it("keeps the current plan until the new period starts", () => {
    const end = new Date("2026-12-09T05:00:00Z");
    expect(planInEffect("affogato_decaf", "macchiato_decaf", end, new Date("2026-12-01T00:00:00Z"))).toBe("affogato_decaf");
    expect(planInEffect("affogato_decaf", "macchiato_decaf", end, end)).toBe("macchiato_decaf");
  });
});
