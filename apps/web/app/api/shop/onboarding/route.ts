import { requireApiSession } from "@/lib/auth";
import { json, readJson, route } from "@/lib/http";
import { saveShop } from "@/lib/shop";

export const POST = route(async (req: Request) => {
  // Shop accounts only. Members can never reach the shop side.
  const s = await requireApiSession(req, "shop_owner");
  return json({ shop: await saveShop(s, await readJson(req)) });
});
