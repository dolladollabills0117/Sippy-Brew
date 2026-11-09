import { describe, expect, it } from "vitest";
import { describeOptions, getTier, resolveOptions, splitPassValue, starterModifierGroups, validateMenuItem, validateModifierGroups, validateOrder, type ModifierGroup, type OrderContext } from "../src";

const groups = starterModifierGroups();
const required: ModifierGroup = { id: "temp", name: "Temperature", required: true, maxSelect: 1, options: [{ id: "hot", name: "Hot", priceCents: 0 }, { id: "iced", name: "Iced", priceCents: 0 }] };

describe("shop customizations", () => {
  it("accepts milk, shots and syrups with the shop's prices", () => {
    expect(validateModifierGroups(groups)).toEqual({ ok: true });
    expect(validateMenuItem({ name: "Latte", size: "12 oz", priceCents: 525, category: "espresso", modifierGroups: groups })).toEqual({ ok: true });
  });
  it("refuses food add-ons, bad prices and broken groups", () => {
    const food: ModifierGroup = { id: "add", name: "Add-ons", required: false, maxSelect: 1, options: [{ id: "c", name: "Chocolate chip cookie", priceCents: 300 }] };
    expect(validateModifierGroups([food])).toMatchObject({ ok: false, message: expect.stringContaining("looks like food") });
    expect(validateModifierGroups([{ ...required, options: [{ id: "x", name: "Gold flakes", priceCents: 900 }] }])).toMatchObject({ ok: false });
    expect(validateModifierGroups([{ ...required, maxSelect: 5 }])).toMatchObject({ ok: false });
    expect(validateModifierGroups([{ ...required, options: [] }])).toMatchObject({ ok: false });
    expect(validateMenuItem({ name: "Latte", size: "12 oz", priceCents: 525, category: "espresso", modifierGroups: [food] })).toMatchObject({ ok: false, field: "modifierGroups" });
  });
});

describe("picking customizations", () => {
  it("prices the picks and keeps the shop's order", () => {
    const r = resolveOptions("Latte", groups, ["vanilla", "oat", "extra-shot"]);
    expect(r).toMatchObject({ ok: true, extraCents: 225 });
    if (r.ok) expect(describeOptions(r.chosen)).toBe("Oat milk, Extra shot, Vanilla");
  });
  it("enforces pick-one, pick-up-to and required groups", () => {
    expect(resolveOptions("Latte", groups, ["oat", "almond"])).toMatchObject({ ok: false });
    expect(resolveOptions("Latte", groups, ["vanilla", "caramel", "hazelnut"])).toMatchObject({ ok: false });
    expect(resolveOptions("Cold Brew", [required], [])).toMatchObject({ ok: false, message: "Choose a temperature for Cold Brew." });
    expect(resolveOptions("Cold Brew", [required], ["iced"])).toMatchObject({ ok: true, extraCents: 0 });
    expect(resolveOptions("Latte", groups, ["nope"])).toMatchObject({ ok: false });
  });
});

describe("customizations in an order", () => {
  const now = new Date("2026-11-04T13:00:00Z");
  const hours = { wed: { open: "06:00", close: "18:00" } };
  const menu = [{ id: "latte", shopId: "s1", name: "Latte", priceCents: 525, category: "espresso", available: true, soldOutToday: false, modifierGroups: groups }];
  const ctx = (over: Partial<OrderContext> = {}): OrderContext => ({
    shop: { id: "s1", status: "active", hours },
    subscription: { status: "active", currentPeriodEnd: "2026-12-01T00:00:00Z" },
    menu, passesLeft: 5, passDaysUsed: [], maxPassValueCents: 800,
    pickupAt: new Date(now.getTime() + 15 * 60_000), now, timeZone: "America/New_York", ...over,
  });

  it("adds customizations to the drink price; the pass covers the first $8 and the rest is overage", () => {
    const lines = [{ menuItemId: "latte", quantity: 1, optionIds: ["oat", "extra-shot", "vanilla"] }]; // 5.25 + 0.75 + 1.00 + 0.50 = 7.50
    expect(validateOrder(lines, ctx())).toMatchObject({ ok: true, totalCents: 750, passCoveredCents: 750, overageCents: 0 });
    const two = [...lines, { menuItemId: "latte", quantity: 1, optionIds: ["oat"] }]; // + 6.00 = 13.50
    expect(validateOrder(two, ctx())).toMatchObject({ ok: false, code: "OVERAGE_CONFIRMATION_REQUIRED", overageCents: 550 });
    const r = validateOrder(two, ctx({ confirmedOverageCents: 550 }));
    expect(r).toMatchObject({ ok: true, totalCents: 1350, passCoveredCents: 800, overageCents: 550 });
    if (r.ok) expect(r.lines.map((l) => [l.unitPriceCents, describeOptions(l.options)])).toEqual([[750, "Oat milk, Extra shot, Vanilla"], [600, "Oat milk"]]);
  });

  it("on House, an oat-milk latte is mostly covered and the rest is overage", () => {
    expect(splitPassValue(600, getTier("affogato_decaf").maxPassValueCents)).toEqual({ totalCents: 600, passCoveredCents: 400, overageCents: 200 });
  });

  it("merges identical drinks and keeps different customizations apart", () => {
    const r = validateOrder([{ menuItemId: "latte", quantity: 1, optionIds: ["oat"] }, { menuItemId: "latte", quantity: 1, optionIds: ["oat"] }], ctx({ confirmedOverageCents: 400 }));
    expect(r).toMatchObject({ ok: true, totalCents: 1200 });
    if (r.ok) expect(r.lines).toHaveLength(1);
  });

  it("rejects options that don't belong to the drink", () => {
    expect(validateOrder([{ menuItemId: "latte", quantity: 1, optionIds: ["gold"] }], ctx())).toMatchObject({ ok: false, code: "INVALID_OPTIONS" });
  });
});
