import { RULES } from "../config";
import { assertCents } from "../money";
import { checkPickupTime, type ShopHours } from "./hours";
import { isCoffeeCategory } from "./menu";
import { resolveOptions, type ChosenOption, type ModifierGroup } from "./modifiers";
import { checkPassAvailable, splitPassValue } from "./passes";

export type OrderErrorCode =
  | "NO_ACTIVE_SUBSCRIPTION"
  | "SHOP_NOT_ACTIVE"
  | "EMPTY_ORDER"
  | "INVALID_QUANTITY"
  | "ITEM_NOT_FOUND"
  | "ITEM_UNAVAILABLE"
  | "NOT_COFFEE"
  | "PASS_USED_TODAY"
  | "NO_PASSES_LEFT"
  | "OVERAGE_CONFIRMATION_REQUIRED"
  | "INVALID_PICKUP"
  | "INVALID_OPTIONS";

export interface OrderError {
  ok: false;
  code: OrderErrorCode;
  message: string;
}

export interface OrderLineInput {
  menuItemId: string;
  quantity: number;
  /** Customization option ids the member picked for this drink. */
  optionIds?: string[];
}

export interface MenuItemForOrder {
  id: string;
  shopId: string;
  name: string;
  priceCents: number;
  category: string;
  available: boolean;
  soldOutToday: boolean;
  modifierGroups?: ModifierGroup[];
}

export interface OrderContext {
  shop: { id: string; status: string; hours: ShopHours };
  subscription: { status: string; currentPeriodEnd: Date | string } | null;
  menu: readonly MenuItemForOrder[];
  /** Passes left in the current period. */
  passesLeft: number;
  /** Calendar days with a live pass order, at any shop. */
  passDaysUsed: readonly string[];
  /** The member's tier max per day, in cents. */
  maxPassValueCents: number;
  /**
   * The overage the member confirmed at checkout, in cents. Required, and must match exactly,
   * whenever the order is over the max. An overage is never charged without it.
   */
  confirmedOverageCents?: number | null;
  pickupAt: Date;
  now: Date;
  timeZone?: string;
}

export interface PricedLine {
  menuItemId: string;
  name: string;
  quantity: number;
  /** Drink price plus its customizations. */
  unitPriceCents: number;
  lineTotalCents: number;
  options: ChosenOption[];
}

export type OrderValidation =
  | {
      ok: true;
      totalCents: number;
      lines: PricedLine[];
      /** Covered by today's pass. */
      passCoveredCents: number;
      /** Confirmed by and charged to the member. Goes 100% to the shop. */
      overageCents: number;
      passDay: string;
      passesLeftAfter: number;
    }
  | OrderError;

export const MAX_QUANTITY_PER_LINE = 4;

/**
 * Price an order from server-side menu data. Client-sent prices are never trusted. Each line's
 * unit price is the drink plus the customizations picked; identical drinks with identical
 * customizations are merged.
 */
export function priceOrder(lines: readonly OrderLineInput[], menu: readonly MenuItemForOrder[], shopId: string): { ok: true; lines: PricedLine[]; totalCents: number } | OrderError {
  if (lines.length === 0) return { ok: false, code: "EMPTY_ORDER", message: "Add at least one coffee." };
  const merged = new Map<string, { menuItemId: string; quantity: number; optionIds: string[] }>();
  for (const l of lines) {
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > MAX_QUANTITY_PER_LINE)
      return { ok: false, code: "INVALID_QUANTITY", message: `Quantity must be 1 to ${MAX_QUANTITY_PER_LINE}.` };
    const optionIds = [...(l.optionIds ?? [])].sort();
    const key = `${l.menuItemId}|${optionIds.join(",")}`;
    const prev = merged.get(key);
    merged.set(key, { menuItemId: l.menuItemId, quantity: (prev?.quantity ?? 0) + l.quantity, optionIds });
  }
  const priced: PricedLine[] = [];
  let total = 0;
  for (const { menuItemId: id, quantity, optionIds } of merged.values()) {
    const item = menu.find((m) => m.id === id && m.shopId === shopId);
    if (!item) return { ok: false, code: "ITEM_NOT_FOUND", message: "One of those items isn't on this shop's menu." };
    if (!isCoffeeCategory(item.category)) return { ok: false, code: "NOT_COFFEE", message: "Only coffee can be ordered." };
    if (!item.available || item.soldOutToday)
      return { ok: false, code: "ITEM_UNAVAILABLE", message: `${item.name} is sold out right now.` };
    if (quantity > MAX_QUANTITY_PER_LINE)
      return { ok: false, code: "INVALID_QUANTITY", message: `Quantity must be 1 to ${MAX_QUANTITY_PER_LINE}.` };
    assertCents(item.priceCents);
    const opts = resolveOptions(item.name, item.modifierGroups, optionIds);
    if (!opts.ok) return { ok: false, code: "INVALID_OPTIONS", message: opts.message };
    const unit = item.priceCents + opts.extraCents;
    const lineTotal = unit * quantity;
    total += lineTotal;
    priced.push({ menuItemId: id, name: item.name, quantity, unitPriceCents: unit, lineTotalCents: lineTotal, options: opts.chosen });
  }
  return { ok: true, lines: priced, totalCents: total };
}

/**
 * The single source of truth for whether an order may be placed. Runs on the server
 * (apps/web API) and in the apps for instant feedback. The database re-checks one pass per
 * day and the pass balance atomically when it writes the order.
 */
export function validateOrder(lines: readonly OrderLineInput[], ctx: OrderContext): OrderValidation {
  const now = ctx.now;
  const sub = ctx.subscription;
  if (!sub || !["active", "trialing"].includes(sub.status) || new Date(sub.currentPeriodEnd).getTime() <= now.getTime())
    return { ok: false, code: "NO_ACTIVE_SUBSCRIPTION", message: "Choose a plan to start ordering." };
  if (ctx.shop.status !== "active") return { ok: false, code: "SHOP_NOT_ACTIVE", message: "This shop isn't taking orders right now." };

  const priced = priceOrder(lines, ctx.menu, ctx.shop.id);
  if (!priced.ok) return priced;

  const tz = ctx.timeZone ?? RULES.timeZone;
  const pass = checkPassAvailable({ passesLeft: ctx.passesLeft, passDaysUsed: ctx.passDaysUsed, now, timeZone: tz });
  if (!pass.ok) return pass;

  const pickup = checkPickupTime(ctx.pickupAt, now, ctx.shop.hours, tz);
  if (!pickup.ok) return pickup;

  const split = splitPassValue(priced.totalCents, ctx.maxPassValueCents);
  const confirm = checkOverageConfirmed(split.overageCents, ctx.confirmedOverageCents);
  if (!confirm.ok) return confirm;
  return {
    ok: true,
    totalCents: priced.totalCents,
    lines: priced.lines,
    passCoveredCents: split.passCoveredCents,
    overageCents: split.overageCents,
    passDay: pass.passDay,
    passesLeftAfter: pass.passesLeftAfter,
  };
}

/**
 * An order over the pass max needs the member's explicit confirmation of the exact overage,
 * after seeing the pass amount, overage and total. A stale confirmation (the cart changed)
 * doesn't count.
 */
export function checkOverageConfirmed(
  overageCents: number,
  confirmedOverageCents: number | null | undefined,
): { ok: true } | (OrderError & { overageCents: number }) {
  if (overageCents === 0) return { ok: true };
  if (confirmedOverageCents === overageCents) return { ok: true };
  return {
    ok: false,
    code: "OVERAGE_CONFIRMATION_REQUIRED",
    overageCents,
    message: `This order is $${(overageCents / 100).toFixed(2)} over your pass. Please confirm the overage to continue.`,
  };
}

/** Order statuses the shop moves through. "cancelled" returns the pass and releases any overage hold. */
export const ORDER_STATUSES = ["received", "preparing", "ready", "picked_up", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Received",
  preparing: "Preparing",
  ready: "Ready",
  picked_up: "Picked up",
  cancelled: "Cancelled",
};

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  received: ["preparing", "ready", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["picked_up", "cancelled"],
  picked_up: [],
  cancelled: [],
};

/**
 * Which status changes a shop may make. "picked_up" via the status buttons is allowed only for
 * "ready" orders; scanning the QR also marks an order picked up.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatus(from: OrderStatus): OrderStatus | null {
  const next = TRANSITIONS[from].find((s) => s !== "cancelled");
  return next ?? null;
}
