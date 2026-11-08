import { requireApiSession } from "@/lib/auth";
import { json, readJson, route } from "@/lib/http";
import { memberOrders, placeOrder } from "@/lib/member";
import type { OrderLineInput } from "@sippy/core";

export const GET = route(async (req: Request) => {
  const s = await requireApiSession(req);
  return json({ orders: await memberOrders(s.userId) });
});

export const POST = route(async (req: Request) => {
  const s = await requireApiSession(req, "member");
  const body = await readJson<{ shopId: string; items: OrderLineInput[]; pickupAt: string }>(req);
  return json({ order: await placeOrder(s, body) }, { status: 201 });
});
