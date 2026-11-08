import { requireApiSession } from "@/lib/auth";
import { json, readJson, route } from "@/lib/http";
import { addMenuItem, shopMenu } from "@/lib/shop";
import type { MenuItemInput } from "@sippy/core";

export const GET = route(async (req: Request) => json({ items: await shopMenu(await requireApiSession(req, "shop_owner")) }));

export const POST = route(async (req: Request) => {
  const s = await requireApiSession(req, "shop_owner");
  return json({ item: await addMenuItem(s, await readJson<MenuItemInput>(req)) }, { status: 201 });
});
