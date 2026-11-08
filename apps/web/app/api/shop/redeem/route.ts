import { requireApiSession } from "@/lib/auth";
import { json, readJson, route } from "@/lib/http";
import { redeem } from "@/lib/shop";

export const POST = route(async (req: Request) => {
  const s = await requireApiSession(req, "shop_owner");
  const body = await readJson<{ qr?: string; shortCode?: string }>(req);
  return json({ order: await redeem(s, body) });
});
