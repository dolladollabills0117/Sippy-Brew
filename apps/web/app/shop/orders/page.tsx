import { OrderQueue } from "@/components/OrderQueue";
import { PageTitle } from "@/components/ui";
import { requireOwnerShop } from "@/lib/shopPage";
import { shopOrders } from "@/lib/shop";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live orders" };

export default async function ShopOrdersPage() {
  const { session } = await requireOwnerShop("/shop/orders");
  return (
    <>
      <PageTitle sub="New orders appear automatically.">Live orders</PageTitle>
      <OrderQueue initial={await shopOrders(session, "active")} />
    </>
  );
}
