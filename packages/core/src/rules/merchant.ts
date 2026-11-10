import { RULES } from "../config";
import { isCoffeeCategory, looksLikeFood, validateMenuItem, type MenuItemInput } from "./menu";

// ---------------------------------------------------------------------------
// No-shows
// ---------------------------------------------------------------------------

/**
 * A shop can flag an order as not picked up once its pickup time is `noShowGraceMinutes` (30)
 * in the past and it hasn't been picked up or cancelled. A no-show isn't refunded: the pass
 * stays used, any confirmed overage is charged, and the shop is paid for it like a pickup.
 */
export function canFlagNoShow(order: { status: string; pickupAt: Date | string }, now: Date): { ok: true } | { ok: false; message: string; availableAt?: Date } {
  if (order.status === "picked_up") return { ok: false, message: "This order was already picked up." };
  if (order.status === "cancelled") return { ok: false, message: "This order was cancelled." };
  if (order.status === "no_show") return { ok: false, message: "This order is already marked as not picked up." };
  const availableAt = new Date(new Date(order.pickupAt).getTime() + RULES.noShowGraceMinutes * 60_000);
  if (now.getTime() < availableAt.getTime()) {
    return { ok: false, availableAt, message: `You can mark this order as not picked up ${RULES.noShowGraceMinutes} minutes after its pickup time.` };
  }
  return { ok: true };
}

/** When the shop should start making a Sippy Brew order: just before pickup, so drinks are fresh and no-shows waste less. */
export function startMakingAt(pickupAt: Date | string): Date {
  return new Date(new Date(pickupAt).getTime() - RULES.prepLeadMinutes * 60_000);
}

// ---------------------------------------------------------------------------
// Order notes and allergies
// ---------------------------------------------------------------------------

export interface OrderNoteInput {
  note?: string | null;
  allergy?: string | null;
}
export type OrderNote = { ok: true; note: string | null; allergy: string | null } | { ok: false; message: string };

/** Notes for the barista, and allergies the shop must see. Trimmed, length-capped, no control characters. */
export function cleanOrderNote(input: OrderNoteInput | null | undefined): OrderNote {
  const clean = (s: string | null | undefined) => {
    const t = (s ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
    return t.length ? t : null;
  };
  const note = clean(input?.note);
  const allergy = clean(input?.allergy);
  const max = RULES.orderNoteMaxChars;
  if ((note?.length ?? 0) > max || (allergy?.length ?? 0) > max) return { ok: false, message: `Notes can be up to ${max} characters.` };
  return { ok: true, note, allergy };
}

/** Shop-facing label for an order with an allergy listed. */
export function allergyNotice(allergy: string | null | undefined): string | null {
  return allergy ? `ALLERGY NOTICE: ${allergy}` : null;
}

// ---------------------------------------------------------------------------
// Menu prices
// ---------------------------------------------------------------------------

/** "Price updated" shows on a menu item for a while after the shop changes its price. */
export function priceRecentlyUpdated(priceChangedAt: Date | string | null | undefined, now: Date): boolean {
  if (!priceChangedAt) return false;
  return now.getTime() - new Date(priceChangedAt).getTime() <= RULES.priceUpdatedBadgeDays * 864e5;
}

// ---------------------------------------------------------------------------
// Menu from a photo
// ---------------------------------------------------------------------------

/** One item as read from a menu photo, before checking. Prices may come as dollars or cents. */
export interface ScannedMenuItem {
  name: string;
  size?: string | null;
  price?: number | string | null;
  category?: string | null;
}

export interface ScannedMenuResult {
  /** Ready for the shop to review and save. Never saved without the shop confirming. */
  items: MenuItemInput[];
  /** Left out, with why (food, no price, duplicate…). */
  skipped: { name: string; reason: string }[];
}

function toCents(price: ScannedMenuItem["price"]): number | null {
  if (price === null || price === undefined || price === "") return null;
  const n = typeof price === "number" ? price : Number(String(price).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  // "4.5" / 4.5 are dollars; whole numbers of 100+ with no decimals are taken as cents.
  const cents = Number.isInteger(n) && n >= 100 ? n : Math.round(n * 100);
  return cents;
}

function guessCategory(name: string, category: string | null | undefined): string {
  if (isCoffeeCategory(category)) return category;
  const n = name.toLowerCase();
  if (/cold|iced|nitro|frapp/.test(n)) return "cold";
  if (/drip|pour|brew|americano|filter|house coffee/.test(n) && !/cold/.test(n)) return /americano/.test(n) ? "espresso" : "brewed";
  if (/latte|cappuc|flat white|cortado|macchiato|espresso|mocha|breve|ristretto/.test(n)) return /mocha|chai|caramel|vanilla|lavender|honey|pumpkin|maple/.test(n) ? "specialty" : "espresso";
  return "specialty";
}

/**
 * Turn what was read from a menu photo into items the shop can review: coffee only (food is
 * skipped), a price in cents, a size (defaults to "Regular"), a coffee category, no duplicates.
 */
export function cleanScannedMenu(raw: readonly ScannedMenuItem[]): ScannedMenuResult {
  const items: MenuItemInput[] = [];
  const skipped: ScannedMenuResult["skipped"] = [];
  const seen = new Set<string>();
  for (const r of raw.slice(0, RULES.maxScannedMenuItems * 2)) {
    const name = (r.name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!name) continue;
    if (r.category === "food" || looksLikeFood(name)) { skipped.push({ name, reason: "Food can't be sold through Sippy Brew" }); continue; }
    if (r.category === "other") { skipped.push({ name, reason: "Not a coffee drink" }); continue; }
    const priceCents = toCents(r.price);
    if (priceCents === null) { skipped.push({ name, reason: "No price found" }); continue; }
    const size = (r.size ?? "").replace(/\s+/g, " ").trim().slice(0, 20) || "Regular";
    const key = `${name.toLowerCase()}|${size.toLowerCase()}`;
    if (seen.has(key)) { skipped.push({ name, reason: "Listed twice" }); continue; }
    const item: MenuItemInput = { name, size, priceCents, category: guessCategory(name, r.category) };
    const v = validateMenuItem(item);
    if (!v.ok) { skipped.push({ name, reason: v.message }); continue; }
    if (items.length >= RULES.maxScannedMenuItems) { skipped.push({ name, reason: `Only ${RULES.maxScannedMenuItems} items per photo` }); continue; }
    seen.add(key);
    items.push(item);
  }
  return { items, skipped };
}
