import { requireApiSession } from "@/lib/auth";
import { json, readJson, route } from "@/lib/http";
import { appealRemoval } from "@/lib/shop";

/** Appeal a removal for selling food (once), if it was a genuine error. */
export const POST = route(async (req: Request) => {
  const s = await requireApiSession(req, "shop_owner");
  return json(await appealRemoval(s, (await readJson<{ note?: string }>(req)).note ?? ""));
});
