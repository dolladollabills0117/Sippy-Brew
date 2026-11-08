"use client";
import {
  checkPassAvailable,
  formatCents,
  MAX_QUANTITY_PER_LINE,
  pickupSlots,
  RULES,
  splitPassValue,
  upgradeIsCharged,
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
 * Pick coffees, see what today's pass covers and any upgrade, choose a pickup time.
 * The same core checks run again on the server when the order is placed.
 */
export function OrderBuilder({ shop, menu, summary }: { shop: Shop; menu: MenuItem[]; summary: MemberSummary }) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>({});
  const slots = useMemo(() => pickupSlots(new Date(), shop.hours), [shop.hours]);
  const [pickup, setPickup] = useState<string>(slots[0]?.toISOString() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = menu.filter((m) => m.available && !m.soldOutToday);
  const total = available.reduce((sum, m) => sum + (qty[m.id] ?? 0) * m.priceCents, 0);
  const pass = checkPassAvailable({ passesLeft: summary.passesLeft, passDaysUsed: summary.passDaysUsed, now: new Date() });
  const split = splitPassValue(total, summary.maxPassValueCents);
  const blocker = !pass.ok ? pass.message : null;
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
      const { order } = await api.placeOrder({ shopId: shop.id, items, pickupAt: pickup });
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
              <dt className="text-pecan">Order value</dt>
              <dd className="font-bold text-espresso">
                <Money cents={total} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-pecan">Covered by today&apos;s pass (up to {formatCents(summary.maxPassValueCents, { showZeroCents: true })})</dt>
              <dd className="font-bold text-espresso">
                <Money cents={split.passValueCents} />
              </dd>
            </div>
            <div className="flex justify-between border-t border-latte pt-2">
              <dt className="font-bold text-espresso">You pay (upgrade)</dt>
              <dd className="text-2xl font-extrabold text-espresso">
                <Money cents={split.upgradeCents} />
              </dd>
            </div>
          </dl>
          {split.upgradeCents > 0 && (
            <p className="mt-2 text-sm text-pecan">
              {upgradeIsCharged(split.upgradeCents)
                ? "Charged to your card on file at pickup, at the shop's menu price. Released if the order is cancelled."
                : `Upgrades under ${formatCents(RULES.minUpgradeChargeCents, { showZeroCents: true })} are on us.`}
            </p>
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
            <Button disabled={busy || total === 0 || Boolean(blocker) || !pickup} onClick={submit}>
              {busy ? "Placing order…" : upgradeIsCharged(split.upgradeCents) ? `Use pass + pay ${formatCents(split.upgradeCents, { showZeroCents: true })}` : "Use today's pass"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
