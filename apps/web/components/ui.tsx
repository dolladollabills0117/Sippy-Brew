import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { formatCents } from "@sippy/core";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "honey";
type Size = "md" | "sm";

/**
 * Buttons. Primary is Burnt Sugar with Cream Swirl text. That pair is 4.3:1, which meets AA
 * only for large text, so md labels are 19px extra-bold ("large" under WCAG). Small buttons
 * use the deeper Burnt Sugar Ink so their 15px labels still pass. Hover is Caramel with
 * Espresso text (4.8:1).
 */
export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-[14px] font-extrabold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 select-none",
    size === "md" ? "min-h-12 px-6 text-[1.1875rem]" : "min-h-11 px-4 text-[0.9375rem]",
    variant === "primary" &&
      (size === "md"
        ? "bg-burnt-sugar text-cream-swirl hover:bg-caramel hover:text-espresso shadow-card"
        : "bg-burnt-sugar-ink text-cream-swirl hover:bg-caramel hover:text-espresso"),
    variant === "secondary" && "border-2 border-pecan bg-cream-swirl text-espresso hover:bg-latte",
    variant === "ghost" && "text-burnt-sugar-ink hover:bg-latte/60",
    variant === "danger" && "border-2 border-danger bg-cream-swirl text-danger hover:bg-danger hover:text-cream-swirl",
    variant === "honey" && "bg-honey text-espresso shadow-card hover:bg-caramel",
    extra,
  );
}

export function Button({ variant, size, className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button {...props} className={buttonClass(variant, size, className)} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={buttonClass(variant, size, className)} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cx("card p-5 sm:p-6", className)} />;
}

/** Sky Blue badge with Espresso text (7.9:1). Sky Blue is for small accents only. */
export function Badge({ children, tone = "sky" }: { children: ReactNode; tone?: "sky" | "latte" | "danger" | "success" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wide",
        tone === "sky" && "bg-sky-blue text-espresso",
        tone === "latte" && "bg-latte text-espresso",
        tone === "danger" && "bg-danger text-cream-swirl",
        tone === "success" && "bg-success text-cream-swirl",
      )}
    >
      {children}
    </span>
  );
}

export function PageTitle({ children, kicker, sub }: { children: ReactNode; kicker?: string; sub?: ReactNode }) {
  return (
    <header className="pb-6 pt-8 sm:pt-12">
      {kicker && <p className="mb-2 text-sm font-extrabold uppercase tracking-widest text-pecan">{kicker}</p>}
      <h1 className="glow inline-block text-4xl text-espresso sm:text-5xl">{children}</h1>
      {sub && <p className="mt-3 max-w-2xl text-lg text-pecan">{sub}</p>}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 mt-10 flex items-end justify-between gap-4">
      <h2 className="text-2xl text-espresso sm:text-3xl">{children}</h2>
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  id,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-bold text-espresso">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-pecan">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Inputs use a Pecan border (6.9:1) so the field edge meets the 3:1 non-text contrast rule. */
export const inputClass =
  "min-h-12 w-full rounded-[12px] border-2 border-pecan/70 bg-cream-swirl px-4 py-2.5 text-base text-espresso placeholder:text-pecan/80 focus:border-espresso";

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <CupIcon className="h-12 w-12 text-latte" />
      <h3 className="text-xl text-espresso">{title}</h3>
      {children && <div className="max-w-md text-pecan">{children}</div>}
      {action}
    </div>
  );
}

export function SkeletonList({ rows = 3, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-20" />
      ))}
    </div>
  );
}

export function Money({ cents, className }: { cents: number; className?: string }) {
  return <span className={cx("tabular-nums", className)}>{formatCents(cents, { showZeroCents: cents % 100 !== 0 })}</span>;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-sm font-bold text-pecan">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-espresso tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-sm text-pecan">{sub}</p>}
    </div>
  );
}

/** A horizontal meter, e.g. passes left this month. */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className="h-3 w-full overflow-hidden rounded-full bg-latte"
      >
        <div className="h-full rounded-full bg-burnt-sugar transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "rounded-[14px] border-2 px-4 py-3 font-bold",
        tone === "info" && "border-latte bg-cream-swirl text-espresso",
        tone === "error" && "border-danger bg-cream-swirl text-danger",
        tone === "success" && "border-success bg-cream-swirl text-success",
      )}
    >
      {children}
    </div>
  );
}

export function CupIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
      <path d="M8 18h26v10a12 12 0 0 1-12 12h-2A12 12 0 0 1 8 28V18Z" fill="currentColor" />
      <path d="M34 21h3a5 5 0 0 1 0 10h-3" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M16 6c-2 3 2 4 0 7M23 6c-2 3 2 4 0 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

/** Cart icon: a line drawing in the current text color. */
export function CartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M2.5 4h2.2l2.3 10.1a1.6 1.6 0 0 0 1.6 1.2h8.7a1.6 1.6 0 0 0 1.5-1.1L21 7.6H6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9.6" cy="19.6" r="1.7" fill="currentColor" />
      <circle cx="17.2" cy="19.6" r="1.7" fill="currentColor" />
    </svg>
  );
}
