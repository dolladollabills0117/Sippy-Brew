import { requireApiSession } from "@/lib/auth";
import { createPortal } from "@/lib/billing";
import { json, readJson, route } from "@/lib/http";

export const POST = route(async (req: Request) => {
  const s = await requireApiSession(req);
  const body = await readJson<{ returnUrl?: string }>(req).catch(() => ({ returnUrl: undefined }));
  return json(await createPortal(s, body.returnUrl));
});
