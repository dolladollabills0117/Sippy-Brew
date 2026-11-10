import { requireApiSession } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { flagNoShow } from "@/lib/shop";

type Ctx = { params: Promise<{ id: string }> };

/** The member didn't pick up. Allowed from 30 minutes after pickup time; not refunded. */
export const POST = route(async (req: Request, ctx: Ctx) => {
  const s = await requireApiSession(req, "shop_owner");
  return json({ order: await flagNoShow(s, (await ctx.params).id) });
});
