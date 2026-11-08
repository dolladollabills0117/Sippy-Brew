import { requireApiSession } from "@/lib/auth";
import { badRequest, json, readJson, route } from "@/lib/http";
import { setSaved } from "@/lib/member";

export const POST = route(async (req: Request) => {
  const s = await requireApiSession(req, "member");
  const body = await readJson<{ shopId?: string; saved?: boolean }>(req);
  if (!body.shopId) throw badRequest("BAD_SHOP", "Missing shopId.");
  return json(await setSaved(s.userId, body.shopId, Boolean(body.saved)));
});
