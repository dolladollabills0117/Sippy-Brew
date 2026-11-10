import { monthBounds, RULES } from "@sippy/core";
import { requireApiSession } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { getShopStats, shopSettledOrders } from "@/lib/shop";

/** Dashboard numbers plus the settled orders behind them, so each tile can open its detail. */
export const GET = route(async (req: Request) => {
  const s = await requireApiSession(req, "shop_owner");
  const since = new Date(monthBounds(new Date(), RULES.timeZone).start.getTime() - 7 * 864e5);
  const [stats, recent] = await Promise.all([getShopStats(s), shopSettledOrders(s, since)]);
  return json({ ...stats, recent });
});
