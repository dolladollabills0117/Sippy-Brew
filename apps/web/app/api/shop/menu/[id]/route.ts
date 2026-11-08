import { requireApiSession } from "@/lib/auth";
import { json, readJson, route } from "@/lib/http";
import { deleteMenuItem, updateMenuItem } from "@/lib/shop";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const s = await requireApiSession(req, "shop_owner");
  return json({ item: await updateMenuItem(s, (await ctx.params).id, await readJson(req)) });
});

export const DELETE = route(async (req: Request, ctx: Ctx) => {
  const s = await requireApiSession(req, "shop_owner");
  return json(await deleteMenuItem(s, (await ctx.params).id));
});
