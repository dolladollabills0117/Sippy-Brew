import Link from "next/link";
import { ORDER_STATUS_LABELS, RULES, type Order } from "@sippy/core";
import { Badge, EmptyState, Money } from "./ui";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: RULES.timeZone });

export function OrderList({ orders, empty }: { orders: Order[]; empty?: React.ReactNode }) {
  if (orders.length === 0) return <EmptyState title="No orders yet">{empty ?? "Your coffee history will show up here."}</EmptyState>;
  return (
    <ul className="card divide-y divide-latte">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/orders/${o.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-vanilla-bean/60">
            <div className="min-w-0">
              <p className="font-bold text-espresso">{o.shopName}</p>
              <p className="truncate text-sm text-pecan">
                {dateFmt.format(new Date(o.createdAt))} · {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Money cents={o.totalCents} className="font-extrabold" />
              <Badge tone={o.status === "ready" ? "sky" : o.status === "cancelled" ? "danger" : "latte"}>{ORDER_STATUS_LABELS[o.status]}</Badge>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
