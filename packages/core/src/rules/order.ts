import { RULES } from "../config";
import { assertCents } from "../money";
import { checkCreditCap } from "./credit";
import { checkDailyLimit } from "./dailyLimit";
import { checkPickupTime, type ShopHours } from "./hours";
import { isCoffeeCategory } from "./menu";

export type OrderErrorCode =
  | "NO_ACTIVE_SUBSCRIPTION"
  | "SHOP_NOT_ACTIVE"
  | "EMPTY_ORDER"
  | "INVALID_QUANTITY"
  | "ITEM_NOT_FOUND"
  | "ITEM_UNAVAILABLE"
  | "NOT_COFFEE"
  | "DAILY_LIMIT"
  | "CREDIT_CAP"
  | "INVALID_PICKUP";

export interface OrderError {
  ok: false;
  code: OrderErrorCode;
  message: string;
}

export interface OrderLineInput {
  menuItemId: string;
  quantity: number;
}

export interface MenuItemForOrder {
  id: string;
  shopId: string;
  name: string;
  priceCents: number;
  category: string;
  available: boolean;
  soldOutToday: boolean;
}

export interface OrderContext {
  shop: { id: string; status: string; hours: ShopHours };
  subscription: { status: string; currentPeriodEnd: Date | string } | null;
  menu: readonly MenuItemForOrder[];
  creditBalanceCents: number;
  spentTodayCents: number;
  pickupAt: Date;
  now: Date;
  timeZone?: string;
  dailyLimitCents?: number;
}

export interface PricedLine {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export type OrderValidation =
  | {
      ok: true;
      totalCents: number;
      lines: PricedLine[];
      creditAfterCents: number;
      dailyRemainingAfterCents: number;
    }
  | OrderError;

export const MAX_QUANTITY_PER_LINE = 4;

/** Price an order from server-side menu data. Client-sent prices are never trusted. */
export function priceOrder(lines: readonly OrderLineInput[], menu: readonly MenuItemForOrder[], shopId: string): { ok: true; lines: PricedLine[]; totalCents: number } | OrderError {
  if (lines.length === 0) return { ok: false, code: "EMPTY_ORDER", message: "Add at least one coffee." };
  const merged = new Map<string, number>();
  for (const l of lines) {
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > MAX_QUANTITY_PER_LINE)
      return { ok: false, code: "INVALID_QUANTITY", message: `Quantity must be 1 to ${MAX_QUANTITY_PER_LINE}.` };
    merged.set(l.menuItemId, (merged.get(l.menuItemId) ?? 0) + l.quantity);
  }
  const priced: PricedLine[] = [];
  let total = 0;
  for (const [id, quantity] of merged) {
    const item = menu.find((m) => m.id === id && m.shopId === shopId);
    if (!item) return { ok: false, code: "ITEM_NOT_FOUND", message: "One of those items isn't on this shop's menu." };
    if (!isCoffeeCategory(item.category)) return { ok: false, code: "NOT_COFFEE", message: "Only coffee can be ordered." };
    if (!item.available || item.soldOutToday)
      return { ok: false, code: "ITEM_UNAVAILABLE", message: `${item.name} is sold out right now.` };
    if (quantity > MAX_QUANTITY_PER_LINE)
      return { ok: false, code: "INVALID_QUANTITY", message: `Quantity must be 1 to ${MAX_QUANTITY_PER_LINE}.` };
    assertCents(item.priceCents);
    const lineTotal = item.priceCents * quantity;
    total += lineTotal;
    priced.push({ menuItemId: id, name: item.name, quantity, unitPriceCents: item.priceCents, lineTotalCents: lineTotal });
  }
  return { ok: true, lines: priced, totalCents: total };
}

/**
 * The single source of truth for whether an order may be placed. Runs on the server
 * (apps/web API) and in the apps for instant feedback. The database re-checks the daily limit
 * and credit cap atomically when it writes the order.
 */
export function validateOrder(lines: readonly OrderLineInput[], ctx: OrderContext): OrderValidation {
  const now = ctx.now;
  const sub = ctx.subscription;
  if (!sub || !["active", "trialing"].includes(sub.status) || new Date(sub.currentPeriodEnd).getTime() <= now.getTime())
    return { ok: false, code: "NO_ACTIVE_SUBSCRIPTION", message: "Choose a plan to start ordering." };
  if (ctx.shop.status !== "active") return { ok: false, code: "SHOP_NOT_ACTIVE", message: "This shop isn't taking orders right now." };

  const priced = priceOrder(lines, ctx.menu, ctx.shop.id);
  if (!priced.ok) return priced;

  const daily = checkDailyLimit(ctx.spentTodayCents, priced.totalCents, ctx.dailyLimitCents ?? RULES.dailyLimitCents);
  if (!daily.ok) return { ok: false, code: daily.code, message: daily.message };

  const credit = checkCreditCap(ctx.creditBalanceCents, priced.totalCents);
  if (!credit.ok) return { ok: false, code: credit.code, message: credit.message };

  const pickup = checkPickupTime(ctx.pickupAt, now, ctx.shop.hours, ctx.timeZone ?? RULES.timeZone);
  if (!pickup.ok) return pickup;

  return {
    ok: true,
    totalCents: priced.totalCents,
    lines: priced.lines,
    creditAfterCents: credit.remainingAfterCents,
    dailyRemainingAfterCents: daily.remainingAfterCents,
  };
}

/** Order statuses the shop moves through. "cancelled" refunds the credit. */
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
