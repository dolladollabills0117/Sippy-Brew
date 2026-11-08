import { requireApiSession } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { shopOrders } from "@/lib/shop";

export const GET = route(async (req: Request) => {
  const s = await requireApiSession(req, "shop_owner");
  const scope = new URL(req.url).searchParams.get("scope") === "today" ? "today" : "active";
  return json({ orders: await shopOrders(s, scope) }, { headers: { "Cache-Control": "no-store" } });
});
