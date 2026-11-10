import { requireApiSession } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { shopPayoutHistory } from "@/lib/shop";

/** Past payouts (each with its orders) plus this week's orders so far. */
export const GET = route(async (req: Request) => json(await shopPayoutHistory(await requireApiSession(req, "shop_owner"))));
