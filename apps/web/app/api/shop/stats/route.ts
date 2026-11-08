import { requireApiSession } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { getShopStats } from "@/lib/shop";

export const GET = route(async (req: Request) => json(await getShopStats(await requireApiSession(req, "shop_owner"))));
