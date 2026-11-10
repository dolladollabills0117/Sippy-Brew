import { requireApiSession } from "@/lib/auth";
import { json, readJson, route } from "@/lib/http";
import { scanMenuPhoto } from "@/lib/menuScan";

export const maxDuration = 60;

/** Read a menu photo into items for the shop to review. Nothing is saved here. */
export const POST = route(async (req: Request) => {
  await requireApiSession(req, "shop_owner");
  return json(await scanMenuPhoto(await readJson<{ image?: string; mediaType?: string }>(req)));
});
