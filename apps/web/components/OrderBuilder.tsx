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
  describeOptions,
  priceOrder,
  bonusForOverageAvailable,
  bonusOverageCover,
  priceRecentlyUpdated,
  type MemberSummary,
  type MenuItem,
  type Shop,
} from "@sippy/core";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { CustomizeDialog } from "./CustomizeDialog";
import { Alert, Button, Card, EmptyState, Money } from "./ui";

interface CartLine {
  key: string;
  menuItemId: string;
  optionIds: string[];
  quantity: number;
}

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: RULES.timeZone });

/**
 * Pick coffees, see what today's pass covers, choose a pickup time. If the order is over the
 * pass, the member sees the pass amount, overage and total and must confirm the exact overage
 * before the order can be placed. The server re-checks all of it.
 */
export function OrderBuilder({ shop, menu, summary }: { shop: Shop; menu: MenuItem[]; summary: MemberSummary }) {
  const router = useRouter();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customizing, setCustomizing] = useState<MenuItem | null>(null);
  const slots = useMemo(() => pickupSlots(new Date(), shop.hours), [shop.hours]);
  const [pickup, setPickup] = useState<string>(slots[0]?.toISOString() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The overage amount the member ticked "I agree" for. A changed cart needs a new confirmation.
  const [confirmedOverage, setConfirmedOverage] = useState<number | null>(null);
  // The member's choice to put a bonus pass toward the overage.
  const [useBonus, setUseBonus] = useState(false);
  // Note for the barista, and allergies the shop must see (shown to them as an ALLERGY NOTICE).
  const [note, setNote] = useState("");
  const [allergy, setAllergy] = useState("");

  const available = menu.filter((m) => m.available && !m.soldOutToday);
  // Price the cart with the same rules the server uses (drink + customizations).
  const priced = cart.length ? priceOrder(cart, available, shop.id) : null;
  const pricedLines = priced && priced.ok ? priced.lines : [];
  const total = priced && priced.ok ? priced.totalCents : 0;
  const allPasses = summary.passesLeft + summary.bonusPassesLeft;
  const pass = checkPassAvailable({ passesLeft: allPasses, passDaysUsed: summary.passDaysUsed, now: new Date() });
  const base = splitPassValue(total, summary.maxPassValueCents);
  const spareBonus = bonusForOverageAvailable(allPasses, summary.bonusPassesLeft);
  const bonusCover = useBonus && spareBonus > 0 ? bonusOverageCover(base.overageCents, summary.maxPassValueCents) : 0;
  // What the member pays after any bonus pass they chose to use.
  const split = { passCoveredCents: base.passCoveredCents + bonusCover, overageCents: base.overageCents - bonusCover };
  const blocker = !pass.ok ? pass.message : null;
  const hasOverage = split.overageCents > 0;
  const overageConfirmed = !hasOverage || confirmedOverage === split.overageCents;
  const money = (c: number) => formatCents(c, { showZeroCents: true });
  const noPlan = !summary.subscription || !["active", "trialing"].includes(summary.subscription.status);

  function addLine(menuItemId: string, optionIds: string[], quantity: number) {
    const key = `${menuItemId}|${[...optionIds].sort().join(",")}`;
    setCart((c) => {
      const existing = c.find((l) => l.key === key);
      if (existing) return c.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QUANTITY_PER_LINE, l.quantity + quantity) } : l));
      return [...c, { key, menuItemId, optionIds, quantity }];
    });
  }

  function bumpLine(key: string, delta: number) {
    setCart((c) => c.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QUANTITY_PER_LINE, l.quantity + delta) } : l)).filter((l) => l.quantity > 0));
  }

  function lineFor(l: CartLine) {
    const key = [...l.optionIds].sort().join(",");
    return pricedLines.find((p) => p.menuItemId === l.menuItemId && p.options.map((o) => o.optionId).sort().join(",") === key);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const items = cart.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, optionIds: l.optionIds }));
      const { order } = await api.placeOrder({
        shopId: shop.id,
        items,
        pickupAt: pickup,
        confirmedOverageCents: hasOverage ? confirmedOverage : null,
        useBonusForOverage: bonusCover > 0,
        note: note.trim() || null,
        allergy: allergy.trim() || null,
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
      {customizing && (
        <CustomizeDialog
          item={customizing}
          onClose={() => setCustomizing(null)}
          onAdd={(optionIds, quantity) => {
            addLine(customizing.id, optionIds, quantity);
            setCustomizing(null);
          }}
        />
      )}
      <Card className="p-0 sm:p-0">
        {available.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Everything's sold out">Check back later or try another shop.</EmptyState>
          </div>
        ) : (
          <ul className="divide-y divide-latte">
            {available.map((m) => {
              const customizable = m.modifierGroups.length > 0;
              const inCart = cart.filter((l) => l.menuItemId === m.id).reduce((n, l) => n + l.quantity, 0);
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-bold text-espresso">
                      {m.name}
                      {inCart > 0 && <span className="ml-2 rounded-full bg-sky-blue px-2 text-xs font-extrabold text-espresso">{inCart} in order</span>}
                    </p>
                    <p className="text-sm text-pecan">
                      {m.size} · <Money cents={m.priceCents} />
                      {customizable && " · Customizable"}
                      {priceRecentlyUpdated(m.priceChangedAt, new Date()) && (
                        <span className="ml-2 rounded-full bg-honey px-2 text-xs font-extrabold text-espresso">Price updated</span>
                      )}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={customizable ? `Customize ${m.name}` : `Add ${m.name}`}
                    onClick={() => (customizable ? setCustomizing(m) : addLine(m.id, [], 1))}
                  >
                    {customizable ? "Customize" : "Add"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <h2 className="text-2xl text-espresso">Your order</h2>
          {cart.length === 0 ? (
            <p className="mt-3 text-pecan">Add a coffee from the menu.</p>
          ) : (
            <ul className="mt-3 divide-y divide-latte">
              {cart.map((l) => {
                const p = lineFor(l);
                const item = available.find((m) => m.id === l.menuItemId);
                return (
                  <li key={l.key} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-bold text-espresso">
                        {l.quantity}× {item?.name ?? "Unavailable"}
                      </p>
                      {p && p.options.length > 0 && <p className="text-sm text-pecan">{describeOptions(p.options)}</p>}
                      <div className="mt-1 flex items-center gap-1" role="group" aria-label={`Quantity of ${item?.name ?? "item"}`}>
                        <button type="button" className="grid h-9 w-9 place-items-center rounded-full border-2 border-pecan text-lg font-extrabold" aria-label="One fewer" onClick={() => bumpLine(l.key, -1)}>
                          −
                        </button>
                        <button type="button" className="grid h-9 w-9 place-items-center rounded-full border-2 border-pecan text-lg font-extrabold disabled:opacity-40" aria-label="One more" disabled={l.quantity >= MAX_QUANTITY_PER_LINE} onClick={() => bumpLine(l.key, 1)}>
                          +
                        </button>
                      </div>
                    </div>
                    <span className="font-bold tabular-nums text-espresso">{p ? money(p.lineTotalCents) : ""}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {priced && !priced.ok && <Alert tone="error">{priced.message}</Alert>}
          <dl className="mt-4 space-y-2">
            <div className="flex justify-between">
              <dt className="text-pecan">Pass covers (first {money(summary.maxPassValueCents)})</dt>
              <dd className="font-bold text-espresso">
                <Money cents={base.passCoveredCents} />
              </dd>
            </div>
            {bonusCover > 0 && (
              <div className="flex justify-between">
                <dt className="text-pecan">Bonus pass toward the overage</dt>
                <dd className="font-bold text-espresso">
                  <Money cents={bonusCover} />
                </dd>
              </div>
            )}
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
          {base.overageCents > 0 && spareBonus > 0 && (
            <label htmlFor="use-bonus" className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 rounded-[14px] border-2 border-honey bg-cream-swirl p-4 font-bold text-espresso">
              <input
                id="use-bonus"
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0 accent-burnt-sugar"
                checked={useBonus}
                onChange={(e) => {
                  setUseBonus(e.target.checked);
                  setConfirmedOverage(null);
                }}
              />
              <span>
                Use a bonus pass toward the overage
                <span className="block text-sm font-normal text-pecan">
                  It covers up to {money(Math.min(base.overageCents, summary.maxPassValueCents))} of the {money(base.overageCents)} overage. You have {spareBonus} bonus pass
                  {spareBonus === 1 ? "" : "es"} to use.
                </span>
              </span>
            </label>
          )}
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

          <label htmlFor="allergy" className="mt-5 block font-bold text-espresso">
            Allergies
          </label>
          <p id="allergy-help" className="text-sm text-pecan">
            Any allergies? Tell the shop here so it shows on your order, and remind the barista at pickup.
          </p>
          <input
            id="allergy"
            aria-describedby="allergy-help"
            maxLength={RULES.orderNoteMaxChars}
            placeholder="e.g. tree nuts, dairy"
            className="mt-1.5 min-h-12 w-full rounded-[12px] border-2 border-pecan/70 bg-cream-swirl px-3 text-espresso"
            value={allergy}
            onChange={(e) => setAllergy(e.target.value)}
          />
          <label htmlFor="note" className="mt-4 block font-bold text-espresso">
            Note for the barista <span className="font-normal text-pecan">(optional)</span>
          </label>
          <input
            id="note"
            maxLength={RULES.orderNoteMaxChars}
            placeholder="e.g. extra hot, light ice"
            className="mt-1.5 min-h-12 w-full rounded-[12px] border-2 border-pecan/70 bg-cream-swirl px-3 text-espresso"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

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
            <Button disabled={busy || total === 0 || Boolean(blocker) || !pickup || !overageConfirmed || Boolean(priced && !priced.ok)} onClick={submit}>
              {busy ? "Placing order…" : hasOverage ? `Use pass + pay ${money(split.overageCents)} overage` : "Use today's pass"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
