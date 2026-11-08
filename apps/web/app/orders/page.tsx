import { OrderList } from "@/components/OrderList";
import { ButtonLink, PageTitle, SectionTitle } from "@/components/ui";
import { requirePageSession } from "@/lib/auth";
import { memberOrders } from "@/lib/member";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders" };

export default async function OrdersPage() {
  const s = await requirePageSession("member", "/orders");
  const orders = await memberOrders(s.userId);
  const open = orders.filter((o) => ["received", "preparing", "ready"].includes(o.status));
  const past = orders.filter((o) => !open.includes(o));
  return (
    <>
      <PageTitle sub="Tap an open order to show its pickup QR.">Orders</PageTitle>
      <ButtonLink href="/shops">Order a coffee</ButtonLink>
      <SectionTitle>Open</SectionTitle>
      <OrderList orders={open} empty="Nothing waiting for pickup." />
      <SectionTitle>History</SectionTitle>
      <OrderList orders={past} />
    </>
  );
}
