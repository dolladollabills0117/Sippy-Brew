import { describe, expect, it } from "vitest";
import { canTransition, validateMenuItem, validateOrder, type OrderContext, type ShopHours } from "../src";

const hours: ShopHours = {
  mon: { open: "06:30", close: "18:00" },
  tue: { open: "06:30", close: "18:00" },
  wed: { open: "06:30", close: "18:00" },
  thu: { open: "06:30", close: "18:00" },
  fri: { open: "06:30", close: "18:00" },
  sat: { open: "08:00", close: "16:00" },
  sun: null,
};
const now = new Date("2026-11-04T13:00:00Z"); // Wed 8:00am New York
const pickupAt = new Date(now.getTime() + 15 * 60_000);

const menu = [
  { id: "latte", shopId: "s1", name: "Latte", priceCents: 525, category: "espresso", available: true, soldOutToday: false },
  { id: "drip", shopId: "s1", name: "Drip", priceCents: 275, category: "brewed", available: true, soldOutToday: false },
  { id: "cortado", shopId: "s1", name: "Cortado", priceCents: 425, category: "espresso", available: true, soldOutToday: false },
  { id: "cold", shopId: "s1", name: "Cold brew", priceCents: 500, category: "cold", available: true, soldOutToday: true },
  { id: "other", shopId: "s2", name: "Cortado", priceCents: 400, category: "espresso", available: true, soldOutToday: false },
];

const ctx = (over: Partial<OrderContext> = {}): OrderContext => ({
  shop: { id: "s1", status: "active", hours },
  subscription: { status: "active", currentPeriodEnd: "2026-12-01T00:00:00Z" },
  menu,
  passesLeft: 8,
  passDaysUsed: [],
  maxPassValueCents: 800,
  pickupAt,
  now,
  timeZone: "America/New_York",
  ...over,
});

describe("validateOrder", () => {
  it("prices from server menu data and covers a drink under the max", () => {
    const r = validateOrder([{ menuItemId: "latte", quantity: 1 }], ctx());
    expect(r).toMatchObject({ ok: true, totalCents: 525, passCoveredCents: 525, overageCents: 0, passDay: "2026-11-04", passesLeftAfter: 7 });
  });

  it("$8.00 order: no overage and no confirmation needed", () => {
    const r = validateOrder([{ menuItemId: "latte", quantity: 1 }, { menuItemId: "drip", quantity: 1 }], ctx());
    expect(r).toMatchObject({ ok: true, totalCents: 800, passCoveredCents: 800, overageCents: 0 });
  });

  it("$9.50 order: refuses until the member confirms the exact $1.50 overage", () => {
    const items = [{ menuItemId: "latte", quantity: 1 }, { menuItemId: "cortado", quantity: 1 }]; // 5.25 + 4.25
    expect(validateOrder(items, ctx())).toMatchObject({ ok: false, code: "OVERAGE_CONFIRMATION_REQUIRED", overageCents: 150 });
    expect(validateOrder(items, ctx({ confirmedOverageCents: 100 }))).toMatchObject({ ok: false, code: "OVERAGE_CONFIRMATION_REQUIRED" });
    expect(validateOrder(items, ctx({ confirmedOverageCents: 150 }))).toMatchObject({ ok: true, totalCents: 950, passCoveredCents: 800, overageCents: 150 });
  });

  it("enforces one pass per day", () => {
    const r = validateOrder([{ menuItemId: "drip", quantity: 1 }], ctx({ passDaysUsed: ["2026-11-04"] }));
    expect(r).toMatchObject({ ok: false, code: "PASS_USED_TODAY" });
  });

  it("enforces the monthly pass allowance", () => {
    const r = validateOrder([{ menuItemId: "drip", quantity: 1 }], ctx({ passesLeft: 0 }));
    expect(r).toMatchObject({ ok: false, code: "NO_PASSES_LEFT" });
  });

  it("requires an active subscription in its current period", () => {
    expect(validateOrder([{ menuItemId: "drip", quantity: 1 }], ctx({ subscription: null }))).toMatchObject({ code: "NO_ACTIVE_SUBSCRIPTION" });
    expect(validateOrder([{ menuItemId: "drip", quantity: 1 }], ctx({ subscription: { status: "past_due", currentPeriodEnd: "2026-12-01T00:00:00Z" } }))).toMatchObject({ code: "NO_ACTIVE_SUBSCRIPTION" });
    expect(validateOrder([{ menuItemId: "drip", quantity: 1 }], ctx({ subscription: { status: "active", currentPeriodEnd: "2026-11-01T00:00:00Z" } }))).toMatchObject({ code: "NO_ACTIVE_SUBSCRIPTION" });
  });

  it("rejects sold-out items, other shops' items, and paused shops", () => {
    expect(validateOrder([{ menuItemId: "cold", quantity: 1 }], ctx())).toMatchObject({ code: "ITEM_UNAVAILABLE" });
    expect(validateOrder([{ menuItemId: "other", quantity: 1 }], ctx())).toMatchObject({ code: "ITEM_NOT_FOUND" });
    expect(validateOrder([{ menuItemId: "drip", quantity: 1 }], ctx({ shop: { id: "s1", status: "paused", hours } }))).toMatchObject({ code: "SHOP_NOT_ACTIVE" });
  });

  it("rejects bad quantities and empty orders, merging duplicate lines", () => {
    expect(validateOrder([], ctx())).toMatchObject({ code: "EMPTY_ORDER" });
    expect(validateOrder([{ menuItemId: "drip", quantity: 0 }], ctx())).toMatchObject({ code: "INVALID_QUANTITY" });
    const r = validateOrder([{ menuItemId: "drip", quantity: 1 }, { menuItemId: "drip", quantity: 1 }], ctx());
    expect(r).toMatchObject({ ok: true, totalCents: 550 });
  });

  it("requires a pickup time while the shop is open", () => {
    expect(validateOrder([{ menuItemId: "drip", quantity: 1 }], ctx({ pickupAt: new Date(now.getTime() + 60_000) }))).toMatchObject({ code: "INVALID_PICKUP" });
    const sunday = new Date("2026-11-08T15:00:00Z");
    expect(validateOrder([{ menuItemId: "drip", quantity: 1 }], ctx({ now: sunday, pickupAt: new Date(sunday.getTime() + 15 * 60_000) }))).toMatchObject({ code: "INVALID_PICKUP" });
  });
});

describe("menu rules: coffee only", () => {
  it("accepts coffee", () => {
    expect(validateMenuItem({ name: "Oat Latte", size: "12 oz", priceCents: 575, category: "espresso" })).toEqual({ ok: true });
  });
  it("blocks food categories and food names", () => {
    expect(validateMenuItem({ name: "Blueberry Muffin", size: "1", priceCents: 400, category: "pastry" })).toMatchObject({ ok: false, field: "category" });
    expect(validateMenuItem({ name: "Breakfast Sandwich", size: "1", priceCents: 700, category: "specialty" })).toMatchObject({ ok: false, field: "name" });
    expect(validateMenuItem({ name: "Croissants", size: "1", priceCents: 400, category: "brewed" })).toMatchObject({ ok: false });
  });
  it("does not trip on coffee names that contain food-like substrings", () => {
    expect(validateMenuItem({ name: "Cortado", size: "single", priceCents: 400, category: "espresso" })).toEqual({ ok: true });
    expect(validateMenuItem({ name: "Toasted Hazelnut Latte", size: "12 oz", priceCents: 600, category: "specialty" })).toEqual({ ok: true });
  });
});

describe("order status transitions", () => {
  it("moves forward only", () => {
    expect(canTransition("received", "preparing")).toBe(true);
    expect(canTransition("ready", "picked_up")).toBe(true);
    expect(canTransition("picked_up", "received")).toBe(false);
    expect(canTransition("cancelled", "ready")).toBe(false);
    expect(canTransition("received", "picked_up")).toBe(false);
  });
});
