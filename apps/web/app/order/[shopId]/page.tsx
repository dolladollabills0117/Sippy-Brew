import { OrderBuilder } from "@/components/OrderBuilder";
import { PageTitle } from "@/components/ui";
import { requirePageSession } from "@/lib/auth";
import { getMemberSummary, getShopDetail } from "@/lib/member";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order for pickup" };

export default async function OrderPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const s = await requirePageSession("member", `/order/${shopId}`);
  const [{ shop, menu }, summary] = await Promise.all([getShopDetail(shopId, s), getMemberSummary(s)]);
  return (
    <>
      <PageTitle kicker="Order for pickup" sub="Coffee only. One Daily Pass per day.">
        {shop.name}
      </PageTitle>
      <OrderBuilder shop={shop} menu={menu} summary={summary} />
    </>
  );
}
