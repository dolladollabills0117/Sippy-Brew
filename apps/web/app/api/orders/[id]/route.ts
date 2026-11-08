import { requireApiSession } from "@/lib/auth";
import { forbidden, json, route } from "@/lib/http";
import { getOrder } from "@/lib/member";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, ctx: Ctx) => {
  const s = await requireApiSession(req);
  const order = await getOrder((await ctx.params).id);
  if (order.memberId !== s.userId && s.profile.role !== "admin") throw forbidden();
  return json({ order });
});
