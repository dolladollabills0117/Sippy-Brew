import { ORDER_STATUS_LABELS, RULES } from "@sippy/core";
import { notFound } from "next/navigation";
import { OrderStatusPoller } from "@/components/OrderStatusPoller";
import { QrTicket } from "@/components/QrTicket";
import { Badge, ButtonLink, Card, Money } from "@/components/ui";
import { requirePageSession } from "@/lib/auth";
import { getOrder } from "@/lib/member";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your pickup" };

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: RULES.timeZone });

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePageSession("member", `/orders/${id}`);
  const order = await getOrder(id).catch(() => null);
  if (!order || order.memberId !== s.userId) notFound();
  const open = order.status !== "picked_up" && order.status !== "cancelled";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 pt-6">
      <OrderStatusPoller orderId={order.id} status={order.status} />
      <div className="text-center">
        <p className="text-sm font-extrabold uppercase tracking-widest text-pecan">{order.shopName}</p>
        <h1 className="glow mt-1 inline-block text-4xl text-espresso">
          {order.status === "ready" ? "Ready for pickup!" : order.status === "picked_up" ? "Enjoy!" : order.status === "cancelled" ? "Order cancelled" : "Show this at the counter"}
        </h1>
        <p className="mt-2">
          <Badge tone={order.status === "ready" ? "sky" : order.status === "cancelled" ? "danger" : "latte"}>{ORDER_STATUS_LABELS[order.status]}</Badge>
          <span className="ml-2 text-pecan">Pickup {timeFmt.format(new Date(order.pickupTime))}</span>
        </p>
      </div>

      <QrTicket orderId={order.id} active={open} />

      <Card>
        <ul className="divide-y divide-latte">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between py-2">
              <span className="text-espresso">
                {i.quantity}× {i.name} <span className="text-pecan">({i.size})</span>
              </span>
              <Money cents={i.unitPriceCents * i.quantity} />
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-latte pt-3">
          <div className="flex justify-between">
            <dt className="text-pecan">Covered by your Daily Pass</dt>
            <dd><Money cents={order.passValueCents} /></dd>
          </div>
          {order.upgradeCents > 0 && (
            <div className="flex justify-between">
              <dt className="text-pecan">Upgrade {order.upgradeStatus === "captured" ? "charged" : order.upgradeStatus === "voided" ? "released" : order.upgradeStatus === "waived" ? "(on us)" : "(charged at pickup)"}</dt>
              <dd><Money cents={order.upgradeCents} /></dd>
            </div>
          )}
          <div className="flex justify-between font-extrabold">
            <dt>Order total</dt>
            <dd><Money cents={order.totalCents} /></dd>
          </div>
        </dl>
        {order.status === "cancelled" && <p className="mt-2 text-sm text-pecan">Your pass was returned and any upgrade hold released.</p>}
      </Card>
      <ButtonLink href="/shops" variant="secondary">
        Back to shops
      </ButtonLink>
    </div>
  );
}
