"use client";
import { DEFAULT_SUB_TIER, DEFAULT_TIER_GROUP, formatCents, getTier, isTierId, SUB_TIERS, TIER_GROUPS, type SubTierId, type TierId } from "@sippy/core";
import Link from "next/link";
import { useState } from "react";
import { cx } from "./ui";

/**
 * The plan picker: a Decaf / Double Shot switch over the three tier cards (Affogato, Macchiato,
 * Double Espresso). Prices and the daily max follow the switch. Plans come from tiers.json.
 *
 * mode "link": each card links to sign-up with that plan (landing page).
 * mode "select": tapping a card selects it and onSelect reports the plan (plans page).
 */
export function PlanCards({
  mode,
  selected,
  onSelect,
}: {
  mode: "link" | "select";
  selected?: TierId | null;
  onSelect?: (plan: TierId) => void;
}) {
  const initialSub = selected && isTierId(selected) ? getTier(selected).subTier : DEFAULT_SUB_TIER;
  const [sub, setSub] = useState<SubTierId>(initialSub);
  const current = SUB_TIERS.find((s) => s.id === sub)!;

  function pickSub(id: SubTierId) {
    setSub(id);
    if (mode === "select" && selected && isTierId(selected)) onSelect?.(TIER_GROUPS.find((g) => g.id === getTier(selected).group)!.plans[id].id);
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="How much each pass covers" className="flex rounded-full border-2 border-latte bg-cream-swirl p-1">
        {SUB_TIERS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={sub === s.id}
            onClick={() => pickSub(s.id)}
            className={cx(
              "flex min-h-14 flex-1 flex-col items-center justify-center rounded-full px-3 leading-tight transition-colors",
              sub === s.id ? "bg-espresso text-cream-swirl" : "text-espresso hover:bg-latte/60",
            )}
          >
            <span className="text-[0.95rem] font-extrabold">{s.name}</span>
            <span className={cx("text-xs font-semibold", sub === s.id ? "text-cream-swirl/85" : "text-pecan")}>up to {formatCents(s.maxPassValueCents)}/day</span>
          </button>
        ))}
      </div>
      <p className="px-1 text-sm text-pecan">{current.blurb}</p>

      <ul className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {TIER_GROUPS.map((g) => {
          const plan = g.plans[sub];
          const popular = g.id === DEFAULT_TIER_GROUP;
          const isSelected = mode === "select" && selected === plan.id;
          const label = `${plan.name}: ${formatCents(plan.priceCents)} a month, ${plan.passesPerMonth} passes, up to ${formatCents(plan.maxPassValueCents)} a day${popular ? ", most popular" : ""}`;
          const inner = (
            <>
              {popular && (
                <span className="mb-2 self-start whitespace-nowrap rounded-full bg-honey px-2 py-0.5 text-[0.6875rem] font-extrabold text-espresso sm:px-2.5 sm:text-xs">
                  Most popular
                </span>
              )}
              <span className="text-sm leading-tight text-pecan sm:text-base">{g.name}</span>
              <span className="mt-1.5 font-heading text-[1.75rem] leading-none text-espresso sm:text-4xl">{formatCents(plan.priceCents)}</span>
              <span className="mt-3 text-sm text-pecan">{plan.passesPerMonth} passes</span>
              <span className="text-sm text-pecan">up to {formatCents(plan.maxPassValueCents)}/day</span>
            </>
          );
          const cls = cx(
            "flex h-full w-full flex-col items-start rounded-[22px] border-2 bg-cream-swirl px-3 py-4 text-left transition-shadow hover:shadow-lift sm:px-5 sm:py-5",
            isSelected ? "border-espresso shadow-[var(--brand-focus-ring)]" : popular ? "border-honey" : "border-transparent",
          );
          return (
            <li key={g.id}>
              {mode === "link" ? (
                <Link href={`/signup?plan=${plan.id}`} aria-label={label} className={cls}>
                  {inner}
                </Link>
              ) : (
                <button type="button" aria-label={label} aria-pressed={isSelected} onClick={() => onSelect?.(plan.id)} className={cls}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
