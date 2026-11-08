import { requireApiSession } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { shopPayouts } from "@/lib/shop";

export const GET = route(async (req: Request) => json({ payouts: await shopPayouts(await requireApiSession(req, "shop_owner")) }));
