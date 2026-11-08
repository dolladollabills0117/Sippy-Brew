import "server-only";
import { redirect } from "next/navigation";
import { requirePageSession } from "./auth";
import { mapShop } from "./db";
import { getOwnerShopRow } from "./shop";

/** For shop portal pages: signed-in owner with a shop, otherwise off to onboarding. */
export async function requireOwnerShop(path: string) {
  const s = await requirePageSession("shop_owner", path);
  const row = await getOwnerShopRow(s, { allowMissing: true });
  if (!row) redirect("/shop/onboarding");
  return { session: s, shop: mapShop(row), row };
}
