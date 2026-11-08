import { requireApiSession } from "@/lib/auth";
import { badRequest, json, readJson, route } from "@/lib/http";
import { setOrderStatus } from "@/lib/shop";
import { ORDER_STATUSES, type OrderStatus } from "@sippy/core";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const s = await requireApiSession(req, "shop_owner");
  const { status } = await readJson<{ status?: string }>(req);
  if (!ORDER_STATUSES.includes(status as OrderStatus)) throw badRequest("BAD_STATUS", "Unknown status.");
  return json({ order: await setOrderStatus(s, (await ctx.params).id, status as OrderStatus) });
});
