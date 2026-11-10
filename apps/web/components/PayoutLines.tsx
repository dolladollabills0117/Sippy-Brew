import { formatCents, type PayoutLine } from "@sippy/core";
import type { SettledOrder } from "@/lib/settled";
import { shopCents } from "@/lib/settled";
import { RULES } from "@sippy/core";

const m = (c: number) => formatCents(c, { showZeroCents: true });

/** Pass sales, then overages in green, then deductions in red, then the net. */
export function PayoutLines({ lines }: { lines: PayoutLine[] }) {
  return (
    <dl className="flex flex-col gap-1.5">
      {lines.map((l) => (
        <div
          key={l.label}
          className={`flex justify-between gap-4 ${l.kind === "minus" ? "text-danger" : "text-espresso"} ${l.kind === "total" ? "mt-1 border-t border-latte pt-2 font-extrabold" : ""}`}
        >
          <dt>{l.label}</dt>
          <dd className={`tabular-nums ${l.kind === "plus" ? "font-extrabold text-success" : ""} ${l.kind === "minus" ? "font-extrabold" : ""} ${l.kind === "total" ? "text-lg" : ""}`}>
            {l.kind === "plus" ? "+" : l.kind === "minus" ? "−" : ""}
            {m(l.cents)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: RULES.timeZone });

/** One row per order with its own breakdown. */
export function SettledOrderList({ orders }: { orders: SettledOrder[] }) {
  if (!orders.length) return <p className="text-sm text-pecan">No orders.</p>;
  return (
    <ul className="divide-y divide-latte">
      {orders.map((o) => (
        <li key={o.id} className="py-2.5">
          <div className="flex justify-between gap-3">
            <strong className="text-espresso">{when.format(new Date(o.redeemedAt))}</strong>
            <span className="tabular-nums">{m(o.totalCents)}</span>
          </div>
          <p className="text-sm text-pecan">
            {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
            {o.status === "no_show" ? " · not picked up" : ""}
          </p>
          <p className="text-sm">
            Pass {m(o.passCoveredCents)}
            {o.overageCents > 0 && <span className="font-bold text-success"> · +{m(o.overageCents)} overage</span>}
            <span className="text-danger"> · −{m(o.commissionCents + o.overageCommissionCents + o.overageFeeCents)}</span> · you get{" "}
            <strong>{m(shopCents(o))}</strong>
          </p>
        </li>
      ))}
    </ul>
  );
}
