import { DEFAULT_TIER, formatCents, RULES, TIERS } from "@sippy/core";
import type { ReactNode } from "react";
import { Badge, cx } from "./ui";

/** The three plans, straight from packages/core/config/tiers.json. Regular is highlighted. */
export function TierCards({ action }: { action: (tierId: string, highlighted: boolean) => ReactNode }) {
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {TIERS.map((t) => {
        const hl = t.id === DEFAULT_TIER;
        return (
          <li key={t.id} className={cx("card relative flex flex-col gap-4 p-6", hl && "ring-4 ring-sky-blue md:-translate-y-2")}>
            {hl && (
              <span className="absolute -top-3 left-6">
                <Badge>Most popular</Badge>
              </span>
            )}
            <div>
              <h3 className="text-3xl text-espresso">{t.name}</h3>
              <p className="text-pecan">{t.blurb}</p>
            </div>
            <p className="text-espresso">
              <span className="text-5xl font-extrabold tabular-nums">{formatCents(t.priceCents)}</span>
              <span className="font-bold text-pecan"> / month</span>
            </p>
            <ul className="flex flex-col gap-2 text-espresso">
              <li>
                <strong>{formatCents(t.creditCents)}</strong> coffee credit every month
              </li>
              <li>
                Up to <strong>{formatCents(RULES.dailyLimitCents)}</strong> a day
              </li>
              <li>Any participating shop</li>
              <li className="text-pecan">Credit resets monthly. No rollover.</li>
            </ul>
            <div className="mt-auto">{action(t.id, hl)}</div>
          </li>
        );
      })}
    </ul>
  );
}
