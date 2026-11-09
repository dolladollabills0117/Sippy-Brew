"use client";
import { DEFAULT_SUB_TIER, DEFAULT_TIER_GROUP, formatCents, getTier, isTierId, SUB_TIERS, TIER_GROUPS, type SubTierId, type TierId } from "@sippy/core";
import Link from "next/link";
import { useState } from "react";
import { cx } from "./ui";

/**
 * The plan picker, in two labelled steps: what you usually order (House / Specialty, which sets
 * the daily max) and how often you go (Visitor / Regular / Local, which sets the passes).
 * Prices follow the first choice. Plans come from tiers.json.
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
      <StepLabel n={1} id={`${mode}-drink`}>What do you usually order?</StepLabel>
      <div role="radiogroup" aria-labelledby={`${mode}-drink`} className="flex rounded-full border-2 border-latte bg-cream-swirl p-1">
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
            <span className="text-[0.95rem] font-extrabold">
              {s.name} · up to {formatCents(s.maxPassValueCents)}
            </span>
            <span className={cx("text-xs font-semibold", sub === s.id ? "text-cream-swirl/85" : "text-pecan")}>{s.examples}</span>
          </button>
        ))}
      </div>
      <p className="px-1 text-sm text-pecan">{current.blurb}</p>
      <StepLabel n={2}>How often do you go?</StepLabel>

      <ul className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {TIER_GROUPS.map((g) => {
          const plan = g.plans[sub];
          const popular = g.id === DEFAULT_TIER_GROUP;
          const isSelected = mode === "select" && selected === plan.id;
          const label = `${plan.name}: ${formatCents(plan.priceCents)} a month, ${plan.passesPerMonth} coffees, up to ${formatCents(plan.maxPassValueCents)} each, ${g.frequency.toLowerCase()}${popular ? ", most popular" : ""}`;
          const inner = (
            <>
              {popular && (
                <span className="mb-2 self-start whitespace-nowrap rounded-full bg-honey px-2 py-0.5 text-[0.6875rem] font-extrabold text-espresso sm:px-2.5 sm:text-xs">
                  Most popular
                </span>
              )}
              <span className="text-sm leading-tight text-pecan sm:text-base">{g.name}</span>
              <span className="mt-1.5 font-heading text-[1.75rem] leading-none text-espresso sm:text-4xl">{formatCents(plan.priceCents)}</span>
              <span className="mt-3 text-sm text-pecan">
                <b className="text-espresso">{plan.passesPerMonth} coffees</b>/mo
              </span>
              <span className="text-sm text-pecan">{g.frequency}</span>
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

function StepLabel({ n, id, children }: { n: number; id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-2.5 px-1 text-[1.05rem] font-extrabold text-espresso">
      <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-blue text-sm">
        {n}
      </span>
      {children}
    </p>
  );
}
