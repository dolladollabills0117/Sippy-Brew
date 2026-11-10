import { describe, expect, it } from "vitest";
import { allergyNotice, canFlagNoShow, cleanOrderNote, cleanScannedMenu, priceRecentlyUpdated, startMakingAt } from "../src";

const pickup = new Date("2026-11-10T13:15:00Z");
const mins = (m: number) => new Date(pickup.getTime() + m * 60_000);

describe("No-shows", () => {
  it("can be flagged 30 minutes after the pickup time", () => {
    expect(canFlagNoShow({ status: "ready", pickupAt: pickup }, mins(10))).toMatchObject({ ok: false });
    expect(canFlagNoShow({ status: "ready", pickupAt: pickup }, mins(30))).toEqual({ ok: true });
    expect(canFlagNoShow({ status: "received", pickupAt: pickup }, mins(45))).toEqual({ ok: true });
  });
  it("not for orders picked up, cancelled or already flagged", () => {
    for (const status of ["picked_up", "cancelled", "no_show"]) expect(canFlagNoShow({ status, pickupAt: pickup }, mins(60)).ok).toBe(false);
  });
  it("tells shops to start making it 5 minutes before pickup", () => {
    expect(startMakingAt(pickup).toISOString()).toBe("2026-11-10T13:10:00.000Z");
  });
});

describe("Order notes and allergies", () => {
  it("trims, caps and flags allergies", () => {
    expect(cleanOrderNote({ note: "  extra hot\n please ", allergy: " tree nuts " })).toEqual({ ok: true, note: "extra hot please", allergy: "tree nuts" });
    expect(cleanOrderNote({ note: "", allergy: "  " })).toEqual({ ok: true, note: null, allergy: null });
    expect(cleanOrderNote({ allergy: "x".repeat(201) }).ok).toBe(false);
    expect(allergyNotice("dairy")).toBe("ALLERGY NOTICE: dairy");
    expect(allergyNotice(null)).toBeNull();
  });
});

describe("Menu prices", () => {
  it("shows 'price updated' for 14 days after a change", () => {
    expect(priceRecentlyUpdated(new Date("2026-11-01T00:00:00Z"), new Date("2026-11-10T00:00:00Z"))).toBe(true);
    expect(priceRecentlyUpdated(new Date("2026-10-01T00:00:00Z"), new Date("2026-11-10T00:00:00Z"))).toBe(false);
    expect(priceRecentlyUpdated(null, new Date())).toBe(false);
  });
});

describe("Menu from a photo", () => {
  it("keeps coffee, skips food and unpriced items, parses prices and guesses categories", () => {
    const r = cleanScannedMenu([
      { name: "Oat Latte", size: "12 oz", price: 5.5 },
      { name: "Iced Coffee", price: "$3.75" },
      { name: "Blueberry Muffin", price: 3.5 },
      { name: "House Drip", size: "16 oz", price: 300 },
      { name: "Seasonal Special", price: null },
      { name: "Oat Latte", size: "12 oz", price: 5.5 },
      { name: "Pumpkin Spice Latte", size: "16 oz", price: 6.25, category: "specialty" },
      { name: "Avocado Toast", price: 9, category: "food" },
      { name: "Logo Mug", price: 14, category: "other" },
    ]);
    expect(r.items).toEqual([
      { name: "Oat Latte", size: "12 oz", priceCents: 550, category: "espresso" },
      { name: "Iced Coffee", size: "Regular", priceCents: 375, category: "cold" },
      { name: "House Drip", size: "16 oz", priceCents: 300, category: "brewed" },
      { name: "Pumpkin Spice Latte", size: "16 oz", priceCents: 625, category: "specialty" },
    ]);
    expect(r.skipped.map((s) => s.reason)).toEqual(["Food can't be sold through Sippy Brew", "No price found", "Listed twice", "Food can't be sold through Sippy Brew", "Not a coffee drink"]);
  });
});
