import { MenuManager } from "@/components/MenuManager";
import { PageTitle } from "@/components/ui";
import { requireOwnerShop } from "@/lib/shopPage";
import { shopMenu } from "@/lib/shop";

export const dynamic = "force-dynamic";
export const metadata = { title: "Menu" };

export default async function MenuPage() {
  const { session } = await requireOwnerShop("/shop/menu");
  return (
    <>
      <PageTitle sub="Coffee only. Food can't be sold through the app.">Menu</PageTitle>
      <MenuManager initial={await shopMenu(session)} />
    </>
  );
}
