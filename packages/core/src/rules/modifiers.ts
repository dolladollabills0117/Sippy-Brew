import { assertCents } from "../money";
import { looksLikeFood } from "./menu";

/**
 * Drink customizations ("modifiers"), set by each shop: milk choices, extra shots, syrups,
 * temperature. Each option carries the shop's own price. The options a member picks are added
 * to the drink's price, so they count toward the pass (first $4 or $8 of the day) and anything
 * above becomes an overage the member confirms, paid 100% to the shop. No markup needed.
 */
export interface ModifierOption {
  id: string;
  name: string;
  /** Added to the drink's price, in cents. 0 for free choices (e.g. "Extra hot"). */
  priceCents: number;
}

export interface ModifierGroup {
  id: string;
  /** e.g. "Milk", "Espresso", "Syrups". */
  name: string;
  /** The member must pick at least one option (e.g. a milk choice). */
  required: boolean;
  /** How many options can be picked. 1 = "pick one". */
  maxSelect: number;
  options: ModifierOption[];
}

/** An option the member picked, copied onto the order so receipts never change later. */
export interface ChosenOption {
  groupId: string;
  groupName: string;
  optionId: string;
  name: string;
  priceCents: number;
}

export const MODIFIER_LIMITS = { groupsPerItem: 6, optionsPerGroup: 12, maxOptionPriceCents: 500, nameMaxChars: 30 } as const;

export type ModifierValidation = { ok: true } | { ok: false; message: string };

/** Check a shop's customization setup. Coffee only: options can't be food add-ons. */
export function validateModifierGroups(groups: readonly ModifierGroup[]): ModifierValidation {
  if (!Array.isArray(groups)) return { ok: false, message: "Customizations must be a list." };
  if (groups.length > MODIFIER_LIMITS.groupsPerItem) return { ok: false, message: `Up to ${MODIFIER_LIMITS.groupsPerItem} customization groups per drink.` };
  const groupIds = new Set<string>();
  for (const g of groups) {
    const gname = String(g?.name ?? "").trim();
    if (!g?.id || groupIds.has(g.id)) return { ok: false, message: "Each customization group needs its own id." };
    groupIds.add(g.id);
    if (!gname || gname.length > MODIFIER_LIMITS.nameMaxChars) return { ok: false, message: `Give each group a name up to ${MODIFIER_LIMITS.nameMaxChars} characters.` };
    if (!Array.isArray(g.options) || g.options.length === 0) return { ok: false, message: `Add at least one option to “${gname}”.` };
    if (g.options.length > MODIFIER_LIMITS.optionsPerGroup) return { ok: false, message: `Up to ${MODIFIER_LIMITS.optionsPerGroup} options in “${gname}”.` };
    if (!Number.isInteger(g.maxSelect) || g.maxSelect < 1 || g.maxSelect > g.options.length) {
      return { ok: false, message: `“${gname}”: choose how many options a member can pick (1 to ${g.options.length}).` };
    }
    const optionIds = new Set<string>();
    for (const o of g.options) {
      const oname = String(o?.name ?? "").trim();
      if (!o?.id || optionIds.has(o.id)) return { ok: false, message: `Each option in “${gname}” needs its own id.` };
      optionIds.add(o.id);
      if (!oname || oname.length > MODIFIER_LIMITS.nameMaxChars) return { ok: false, message: `Option names in “${gname}” must be 1 to ${MODIFIER_LIMITS.nameMaxChars} characters.` };
      if (looksLikeFood(oname)) return { ok: false, message: `“${oname}” looks like food. Customizations are for coffee only.` };
      try {
        assertCents(o.priceCents);
      } catch {
        return { ok: false, message: `“${oname}”: price must be a whole number of cents.` };
      }
      if (o.priceCents < 0 || o.priceCents > MODIFIER_LIMITS.maxOptionPriceCents) {
        return { ok: false, message: `“${oname}”: options can add $0 to $${MODIFIER_LIMITS.maxOptionPriceCents / 100}.` };
      }
    }
  }
  return { ok: true };
}

export type ResolvedOptions = { ok: true; chosen: ChosenOption[]; extraCents: number } | { ok: false; message: string };

/**
 * Turn the option ids a member picked into priced choices, checking them against the drink's
 * groups: every id must exist, "pick one" groups take one, required groups need a choice.
 */
export function resolveOptions(itemName: string, groups: readonly ModifierGroup[] | undefined, optionIds: readonly string[] | undefined): ResolvedOptions {
  const ids = optionIds ?? [];
  const list = groups ?? [];
  if (new Set(ids).size !== ids.length) return { ok: false, message: `Pick each option for ${itemName} once.` };
  const chosen: ChosenOption[] = [];
  const counts = new Map<string, number>();
  for (const id of ids) {
    let found: ChosenOption | null = null;
    for (const g of list) {
      const o = g.options.find((x) => x.id === id);
      if (o) found = { groupId: g.id, groupName: g.name, optionId: o.id, name: o.name, priceCents: o.priceCents };
    }
    if (!found) return { ok: false, message: `One of the options for ${itemName} isn't available any more.` };
    chosen.push(found);
    counts.set(found.groupId, (counts.get(found.groupId) ?? 0) + 1);
  }
  for (const g of list) {
    const n = counts.get(g.id) ?? 0;
    if (n > g.maxSelect) return { ok: false, message: g.maxSelect === 1 ? `Pick one ${g.name.toLowerCase()} for ${itemName}.` : `Pick up to ${g.maxSelect} in ${g.name} for ${itemName}.` };
    if (g.required && n === 0) return { ok: false, message: `Choose a ${g.name.toLowerCase()} for ${itemName}.` };
  }
  // Keep a stable order: by group, then option, as the shop listed them.
  const order = new Map<string, number>();
  list.forEach((g, gi) => g.options.forEach((o, oi) => order.set(o.id, gi * 100 + oi)));
  chosen.sort((a, b) => (order.get(a.optionId) ?? 0) - (order.get(b.optionId) ?? 0));
  return { ok: true, chosen, extraCents: chosen.reduce((s, c) => s + c.priceCents, 0) };
}

/** "Oat milk, Extra shot" for receipts and the shop's order queue. */
export function describeOptions(chosen: readonly { name: string }[] | undefined): string {
  return (chosen ?? []).map((c) => c.name).join(", ");
}

/** Defaults a shop starts with when it turns on customizations for a drink (all editable). */
export function starterModifierGroups(): ModifierGroup[] {
  return [
    {
      id: "milk",
      name: "Milk",
      required: false,
      maxSelect: 1,
      options: [
        { id: "whole", name: "Whole milk", priceCents: 0 },
        { id: "oat", name: "Oat milk", priceCents: 75 },
        { id: "almond", name: "Almond milk", priceCents: 75 },
      ],
    },
    { id: "shots", name: "Espresso", required: false, maxSelect: 1, options: [{ id: "extra-shot", name: "Extra shot", priceCents: 100 }] },
    {
      id: "syrups",
      name: "Syrups",
      required: false,
      maxSelect: 2,
      options: [
        { id: "vanilla", name: "Vanilla", priceCents: 50 },
        { id: "caramel", name: "Caramel", priceCents: 50 },
        { id: "hazelnut", name: "Hazelnut", priceCents: 50 },
      ],
    },
  ];
}
