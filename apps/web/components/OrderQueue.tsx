"use client";
import { nextStatus, ORDER_STATUS_LABELS, RULES, type Order } from "@sippy/core";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Alert, Badge, Button, buttonClass, EmptyState, Money } from "./ui";

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: RULES.timeZone });

/** Live pickup queue: polls every 8 seconds, big one-tap status buttons. */
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
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-live="polite">
        {orders.map((o) => {
          const next = nextStatus(o.status);
          return (
            <li key={o.id} className="card flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-heading text-2xl text-espresso">{o.memberFirstName}</p>
                  <p className="text-sm font-bold text-pecan">Pickup {timeFmt.format(new Date(o.pickupTime))}</p>
                </div>
                <Badge tone={o.status === "ready" ? "sky" : "latte"}>{ORDER_STATUS_LABELS[o.status]}</Badge>
              </div>
              <ul className="text-lg text-espresso">
                {o.items.map((i) => (
                  <li key={i.id}>
                    <strong>{i.quantity}×</strong> {i.name} <span className="text-pecan">({i.size})</span>
                  </li>
                ))}
              </ul>
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
