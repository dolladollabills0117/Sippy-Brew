"use client";
import { canFlagNoShow, describeOptions, nextStatus, ORDER_STATUS_LABELS, RULES, startMakingAt, type Order } from "@sippy/core";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Alert, Badge, Button, buttonClass, EmptyState, Money } from "./ui";

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: RULES.timeZone });

/**
 * Live pickup queue: polls every 8 seconds, big one-tap status buttons. Orders show when to
 * start making them (just before pickup), a red ALLERGY NOTICE when the member listed one, and
 * a "Not picked up" button once the pickup time is 30 minutes past.
 */
export function OrderQueue({ initial }: { initial: Order[] }) {
  const [orders, setOrders] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOrders((await api.shopOrders("active")).orders);
      setError(null);
    } catch {
      setError("Lost connection. Retrying…");
    }
  }, []);

  useEffect(() => {
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  async function advance(o: Order, to: Order["status"]) {
    if (to === "cancelled" && !window.confirm(`Cancel ${o.memberFirstName}'s order? Their pass will be returned.`)) return;
    setBusy(o.id);
    try {
      const { order } = await api.setOrderStatus(o.id, to);
      setOrders((list) => list.map((x) => (x.id === o.id ? order : x)).filter((x) => x.status !== "cancelled"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't update. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function noShow(o: Order) {
    if (!window.confirm(`Mark ${o.memberFirstName}'s order as not picked up? It isn't refunded: their pass stays used and you're paid for it. We'll let them know.`)) return;
    setBusy(o.id);
    try {
      await api.flagNoShow(o.id);
      setOrders((list) => list.filter((x) => x.id !== o.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't update. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (orders.length === 0)
    return (
      <>
        {error && <Alert tone="error">{error}</Alert>}
        <EmptyState title="No orders right now">New pickup orders show up here automatically.</EmptyState>
      </>
    );

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      <p className="rounded-xl bg-cream-swirl px-4 py-3 text-sm text-espresso">
        <strong>Make Sippy Brew orders close to pickup.</strong> Each order shows when to start ({RULES.prepLeadMinutes} minutes before pickup), so drinks are fresh and
        fewer are wasted if someone doesn&apos;t show.
      </p>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-live="polite">
        {orders.map((o) => {
          const next = nextStatus(o.status);
          const canNoShow = canFlagNoShow({ status: o.status, pickupAt: o.pickupTime }, new Date()).ok;
          return (
            <li key={o.id} className={`card flex flex-col gap-3 p-5 ${o.allergyNote ? "ring-4 ring-danger" : ""}`}>
              {o.allergyNote && (
                <div role="alert" className="rounded-xl bg-danger px-4 py-3 text-cream-swirl">
                  <p className="text-xl font-extrabold tracking-wide">⚠️ ALLERGY NOTICE</p>
                  <p className="text-lg font-bold">{o.allergyNote}</p>
                </div>
              )}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-heading text-2xl text-espresso">{o.memberFirstName}</p>
                  <p className="text-sm font-bold text-pecan">
                    Pickup {timeFmt.format(new Date(o.pickupTime))} · <span className="text-burnt-sugar-ink">Start at {timeFmt.format(startMakingAt(o.pickupTime))}</span>
                  </p>
                </div>
                <Badge tone={o.status === "ready" ? "sky" : "latte"}>{ORDER_STATUS_LABELS[o.status]}</Badge>
              </div>
              <ul className="text-lg text-espresso">
                {o.items.map((i) => (
                  <li key={i.id}>
                    <strong>{i.quantity}×</strong> {i.name} <span className="text-pecan">({i.size})</span>
                    {i.options.length > 0 && <span className="block text-base font-bold text-burnt-sugar-ink">{describeOptions(i.options)}</span>}
                  </li>
                ))}
              </ul>
              {o.note && <p className="rounded-lg bg-vanilla-bean px-3 py-2 text-espresso"><strong>Note:</strong> {o.note}</p>}
              <p className="text-sm text-pecan">
                <Money cents={o.totalCents} /> · Daily Pass{o.overageCents > 0 ? <> + <Money cents={o.overageCents} /> overage (paid in app)</> : null}
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                {next && next !== "picked_up" && (
                  <Button className="flex-1" disabled={busy === o.id} onClick={() => advance(o, next)}>
                    Mark {ORDER_STATUS_LABELS[next].toLowerCase()}
                  </Button>
                )}
                {o.status === "ready" && (
                  <Link href="/shop/redeem" className={buttonClass("primary", "md", "flex-1")}>
                    Scan to hand off
                  </Link>
                )}
                {canNoShow && (
                  <Button variant="secondary" size="sm" disabled={busy === o.id} onClick={() => noShow(o)}>
                    Not picked up
                  </Button>
                )}
                <Button variant="ghost" size="sm" disabled={busy === o.id} onClick={() => advance(o, "cancelled")}>
                  Cancel
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
