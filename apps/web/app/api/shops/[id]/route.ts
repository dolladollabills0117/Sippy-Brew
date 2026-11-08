import { getSession } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { getShopDetail } from "@/lib/member";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, ctx: Ctx) => json(await getShopDetail((await ctx.params).id, await getSession(req))));
