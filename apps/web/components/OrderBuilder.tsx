"use client";
import {
  checkPassAvailable,
  formatCents,
  MAX_QUANTITY_PER_LINE,
  pickupSlots,
  RULES,
  splitPassValue,
  overageIsCharged,
  overageCoveredByUpgrade,
  getTier,
  type MemberSummary,
  type MenuItem,
  type Shop,
} from "@sippy/core";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Card, EmptyState, Money } from "./ui";

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: RULES.timeZone });

/**
 * Pick coffees, see what today's pass covers, choose a pickup time. If the order is over the
 * pass, the member sees the pass amount, overage and total and must confirm the exact overage
 * before the order can be placed. The server re-checks all of it.
 */
export function OrderBuilder({ shop, menu, summary }: { shop: Shop; menu: MenuItem[]; summary: MemberSummary }) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>({});
  const slots = useMemo(() => pickupSlots(new Date(), shop.hours), [shop.hours]);
  const [pickup, setPickup] = useState<string>(slots[0]?.toISOString() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The overage amount the member ticked "I agree" for. A changed cart needs a new confirmation.
  const [confirmedOverage, setConfirmedOverage] = useState<number | null>(null);

  const available = menu.filter((m) => m.available && !m.soldOutToday);
  const total = available.reduce((sum, m) => sum + (qty[m.id] ?? 0) * m.priceCents, 0);
  const pass = checkPassAvailable({ passesLeft: summary.passesLeft, passDaysUsed: summary.passDaysUsed, now: new Date() });
  const split = splitPassValue(total, summary.maxPassValueCents);
  const blocker = !pass.ok ? pass.message : null;
  const hasOverage = split.overageCents > 0;
  const overageConfirmed = !hasOverage || confirmedOverage === split.overageCents;
  const money = (c: number) => formatCents(c, { showZeroCents: true });
  const noPlan = !summary.subscription || !["active", "trialing"].includes(summary.subscription.status);

  function bump(id: string, delta: number) {
    setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(MAX_QUANTITY_PER_LINE, (q[id] ?? 0) + delta)) }));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const items = Object.entries(qty)
        .filter(([, n]) => n > 0)
        .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
      const { order } = await api.placeOrder({
        shopId: shop.id,
        items,
        pickupAt: pickup,
        confirmedOverageCents: hasOverage ? confirmedOverage : null,
      });
      router.push(`/orders/${order.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't place your order. Please try again.");
      setBusy(false);
    }
  }

  if (noPlan) {
    return (
      <EmptyState title="Choose a plan to order" action={<a className="font-bold text-burnt-sugar-ink underline" href="/plans">See plans</a>}>
        Your Daily Passes work at every participating shop.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card className="p-0 sm:p-0">
        {available.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Everything's sold out">Check back later or try another shop.</EmptyState>
          </div>
        ) : (
          <ul className="divide-y divide-latte">
            {available.map((m) => {
              const n = qty[m.id] ?? 0;
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="font-bold text-espresso">{m.name}</p>
                    <p className="text-sm text-pecan">
                      {m.size} · <Money cents={m.priceCents} />
                    </p>
                  </div>
                  <div className="flex items-center gap-2" role="group" aria-label={`Quantity of ${m.name}`}>
                    <Button size="sm" variant="secondary" aria-label={`Remove one ${m.name}`} disabled={n === 0} onClick={() => bump(m.id, -1)}>
                      −
                    </Button>
                    <span className="w-6 text-center text-lg font-extrabold tabular-nums" aria-live="polite">
                      {n}
                    </span>
                    <Button size="sm" variant="secondary" aria-label={`Add one ${m.name}`} disabled={n >= MAX_QUANTITY_PER_LINE} onClick={() => bump(m.id, 1)}>
                      +
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <h2 className="text-2xl text-espresso">Your order</h2>
          <dl className="mt-4 space-y-2">
            <div className="flex justify-between">
              <dt className="text-pecan">Pass covers (first {money(summary.maxPassValueCents)})</dt>
              <dd className="font-bold text-espresso">
                <Money cents={split.passCoveredCents} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-pecan">Overage</dt>
              <dd className="font-bold text-espresso">
                <Money cents={split.overageCents} />
              </dd>
            </div>
            <div className="flex justify-between border-t border-latte pt-2">
              <dt className="font-bold text-espresso">Order total</dt>
              <dd className="text-2xl font-extrabold text-espresso">
                <Money cents={total} />
              </dd>
            </div>
          </dl>
          {hasOverage && (
            <div className="mt-4 rounded-[14px] border-2 border-espresso bg-vanilla-bean p-4">
              <p className="font-bold text-espresso">
                This order is {money(split.overageCents)} over your pass.
              </p>
              <p className="mt-1 text-sm text-pecan">
                {overageIsCharged(split.overageCents)
                  ? "The overage is charged to your card on file when the shop hands over your order, at the shop's menu prices. It's released if the order is cancelled."
                  : `Overages under ${money(RULES.minOverageChargeCents)} are waived, so you won't be charged for this one.`}
              </p>
              <label htmlFor="confirm-overage" className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 font-bold text-espresso">
                <input
                  id="confirm-overage"
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0 accent-burnt-sugar"
                  checked={overageConfirmed}
                  onChange={(e) => setConfirmedOverage(e.target.checked ? split.overageCents : null)}
                />
                <span>
                  I confirm the {money(split.overageCents)} overage. My pass covers {money(split.passCoveredCents)} of the {money(total)} total.
                </span>
              </label>
              {summary.upgrade && summary.subscription && overageCoveredByUpgrade(getTier(summary.subscription.tier), total) > 0 && (
                <p className="rounded-xl bg-cream-swirl px-3 py-2 text-sm text-espresso">
                  Tip: on <strong>{summary.upgrade.toName}</strong>, {money(overageCoveredByUpgrade(getTier(summary.subscription.tier), total))} of this overage
                  would be covered by your pass.{" "}
                  <a href="/account#upgrade" className="font-bold text-burnt-sugar-ink underline underline-offset-4">
                    See upgrade
                  </a>
                </p>
              )}
            </div>
          )}
          <p className="mt-3 text-sm text-pecan">
            {summary.passesLeft} of {summary.passesPerMonth} passes left this month · one pass per day
          </p>

          <label htmlFor="pickup" className="mt-5 block font-bold text-espresso">
            Pickup time
          </label>
          {slots.length === 0 ? (
            <p className="mt-1 text-pecan">This shop isn&apos;t open for pickup in the next two hours.</p>
          ) : (
            <select
              id="pickup"
              className="mt-1.5 min-h-12 w-full rounded-[12px] border-2 border-pecan/70 bg-cream-swirl px-3 text-espresso"
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
            >
              {slots.map((d) => (
                <option key={d.toISOString()} value={d.toISOString()}>
                  {timeFmt.format(d)}
                </option>
              ))}
            </select>
          )}

          <div className="mt-5 flex flex-col gap-3">
            {blocker && total > 0 && <Alert tone="error">{blocker}</Alert>}
            {error && <Alert tone="error">{error}</Alert>}
            <Button disabled={busy || total === 0 || Boolean(blocker) || !pickup || !overageConfirmed} onClick={submit}>
              {busy ? "Placing order…" : hasOverage ? `Use pass + pay ${money(split.overageCents)} overage` : "Use today's pass"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
