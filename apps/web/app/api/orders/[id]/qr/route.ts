import { requireApiSession } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { issueQrFor } from "@/lib/member";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (req: Request, ctx: Ctx) => {
  const s = await requireApiSession(req, "member");
  return json(await issueQrFor(s, (await ctx.params).id), { headers: { "Cache-Control": "no-store" } });
});
