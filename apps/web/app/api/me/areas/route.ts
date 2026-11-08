import { requireApiSession } from "@/lib/auth";
import { json, readJson, route } from "@/lib/http";
import { setAreas } from "@/lib/member";
import type { SavedArea } from "@sippy/core";

export const PUT = route(async (req: Request) => {
  const s = await requireApiSession(req, "member");
  const body = await readJson<{ areas: SavedArea[] }>(req);
  return json({ areas: await setAreas(s.userId, body.areas ?? []) });
});
