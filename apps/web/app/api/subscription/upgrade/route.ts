import { requireApiSession } from "@/lib/auth";
import { upgradeSubTier } from "@/lib/billing";
import { AppError, json, readJson, route } from "@/lib/http";
import { getLiveSubscription, getPassState } from "@/lib/member";

/** Move up to the higher sub-tier. The member must confirm the exact amount they'll pay now. */
export const POST = route(async (req: Request) => {
  const s = await requireApiSession(req, "member");
  const body = await readJson<{ toPlan?: string; confirmedCents?: number }>(req);
  const sub = await getLiveSubscription(s.userId);
  if (!sub || !["active", "trialing"].includes(sub.status)) throw new AppError(409, "NO_ACTIVE_SUBSCRIPTION", "Choose a plan first.");
  const { passesLeft } = await getPassState(s.userId, sub);
  return json(await upgradeSubTier(s.userId, sub, body.toPlan, body.confirmedCents, passesLeft));
});
