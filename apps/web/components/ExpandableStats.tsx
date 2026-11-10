"use client";
import { useState, type ReactNode } from "react";

export interface ExpandableTile {
  id: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  detailTitle: string;
  detail: ReactNode;
}

/** Stat tiles you can tap to open the detail behind the number. */
export function ExpandableStats({ tiles, className = "lg:grid-cols-4" }: { tiles: ExpandableTile[]; className?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const current = tiles.find((t) => t.id === open);
  return (
    <>
      <p className="mt-2 text-sm text-pecan">Tap any number for the details.</p>
      <div className={`mt-2 grid grid-cols-2 gap-3 ${className}`}>
        {tiles.map((t) => {
          const isOpen = open === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-expanded={isOpen}
              aria-controls="stat-detail"
              onClick={() => setOpen(isOpen ? null : t.id)}
              className={`card flex flex-col items-start p-4 text-left transition hover:-translate-y-0.5 focus-visible:outline-2 ${isOpen ? "ring-2 ring-espresso" : ""}`}
            >
              <span className="text-sm font-bold text-pecan">{t.label}</span>
              <span className="mt-1 text-3xl font-extrabold text-espresso tabular-nums">{t.value}</span>
              {t.sub && <span className="mt-1 text-sm text-pecan">{t.sub}</span>}
              <span className="mt-2 text-xs font-extrabold text-burnt-sugar-ink">{isOpen ? "Hide details ▴" : "Details ▾"}</span>
            </button>
          );
        })}
      </div>
      {current && (
        <section id="stat-detail" aria-label={current.detailTitle} className="card mt-3 p-5 ring-2 ring-espresso">
          <h2 className="mb-3 text-xl text-espresso">{current.detailTitle}</h2>
          {current.detail}
        </section>
      )}
    </>
  );
}
