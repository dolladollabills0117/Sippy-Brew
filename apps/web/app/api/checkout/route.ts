import { requireApiSession } from "@/lib/auth";
import { createCheckout } from "@/lib/billing";
import { json, readJson, route } from "@/lib/http";

export const POST = route(async (req: Request) => {
  const s = await requireApiSession(req);
  const body = await readJson<{ tier?: string; returnUrl?: string }>(req);
  return json(await createCheckout(s, body.tier, body.returnUrl));
});
