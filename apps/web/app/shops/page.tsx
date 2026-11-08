import { ShopsBrowser } from "@/components/ShopsBrowser";
import { PageTitle } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { getAreas, listShops } from "@/lib/member";

export const metadata = { title: "Shops" };
export const dynamic = "force-dynamic";

export default async function ShopsPage() {
  const s = await getSession();
  const [{ shops }, areas] = await Promise.all([listShops(s), s ? getAreas(s.userId) : Promise.resolve([])]);
  return (
    <>
      <PageTitle sub="Redeem your credit at any of them.">Participating shops</PageTitle>
      <ShopsBrowser initial={shops} areas={areas} signedIn={Boolean(s)} />
    </>
  );
}
