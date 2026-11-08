import { requireApiSession } from "@/lib/auth";
import { json, readJson, route } from "@/lib/http";
import { saveShop } from "@/lib/shop";

export const POST = route(async (req: Request) => {
  // Members can become shop owners by completing onboarding.
  const s = await requireApiSession(req);
  return json({ shop: await saveShop(s, await readJson(req)) });
});
