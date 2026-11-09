import { assertCents } from "../money";
import { validateModifierGroups, type ModifierGroup } from "./modifiers";

/** Coffee items only. Food is not sold through the app. */
export const COFFEE_CATEGORIES = ["espresso", "brewed", "cold", "specialty"] as const;
export type CoffeeCategory = (typeof COFFEE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<CoffeeCategory, string> = {
  espresso: "Espresso drinks",
  brewed: "Brewed coffee",
  cold: "Cold coffee",
  specialty: "Specialty coffee",
};

export const SIZES = ["8 oz", "12 oz", "16 oz", "20 oz", "single", "double"] as const;

const FOOD_WORDS = [
  "bagel", "bar", "biscotti", "biscuit", "bread", "brownie", "burrito", "cake", "cookie", "croissant",
  "danish", "donut", "doughnut", "egg", "empanada", "food", "granola", "muffin", "oatmeal", "pastry",
  "pie", "quiche", "salad", "sandwich", "scone", "snack", "soup", "taco", "toast", "waffle", "wrap", "yogurt",
];
const FOOD_RE = new RegExp(`\\b(${FOOD_WORDS.join("|")})s?\\b`, "i");

/** True if a name reads like food (coffee only on Sippy Brew). */
export function looksLikeFood(name: string): boolean {
  return FOOD_RE.test(name);
}

export function isCoffeeCategory(c: unknown): c is CoffeeCategory {
  return typeof c === "string" && (COFFEE_CATEGORIES as readonly string[]).includes(c);
}

export interface MenuItemInput {
  name: string;
  size: string;
  priceCents: number;
  category: string;
  /** Optional drink customizations (milk, shots, syrups) with the shop's prices. */
  modifierGroups?: ModifierGroup[];
}

export type MenuValidation = { ok: true } | { ok: false; field: keyof MenuItemInput; message: string };

export function validateMenuItem(item: MenuItemInput): MenuValidation {
  const name = item.name.trim();
  if (name.length < 2 || name.length > 60) return { ok: false, field: "name", message: "Name must be 2 to 60 characters." };
  if (!isCoffeeCategory(item.category))
    return { ok: false, field: "category", message: "Only coffee categories are allowed. Food isn't sold through Sippy Brew." };
  if (FOOD_RE.test(name)) return { ok: false, field: "name", message: "That looks like a food item. Only coffee can be listed." };
  if (!item.size.trim() || item.size.length > 20) return { ok: false, field: "size", message: "Add a size, like 12 oz." };
  try {
    assertCents(item.priceCents);
  } catch {
    return { ok: false, field: "priceCents", message: "Price must be a whole number of cents." };
  }
  if (item.priceCents < 100 || item.priceCents > 2000)
    return { ok: false, field: "priceCents", message: "Price must be between $1 and $20." };
  if (item.modifierGroups) {
    const m = validateModifierGroups(item.modifierGroups);
    if (!m.ok) return { ok: false, field: "modifierGroups", message: m.message };
  }
  return { ok: true };
}
