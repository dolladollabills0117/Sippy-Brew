import { requireApiSession } from "@/lib/auth";
import { changePlan } from "@/lib/billing";
import { AppError, json, readJson, route } from "@/lib/http";
import { getLiveSubscription } from "@/lib/member";

/** Switch to any plan; it takes effect at the next renewal. This month stays as it is. */
export const POST = route(async (req: Request) => {
  const s = await requireApiSession(req, "member");
  const body = await readJson<{ toPlan?: string }>(req);
  const sub = await getLiveSubscription(s.userId);
  if (!sub || !["active", "trialing", "past_due"].includes(sub.status)) throw new AppError(409, "NO_ACTIVE_SUBSCRIPTION", "Choose a plan first.");
  return json(await changePlan(s.userId, sub, body.toPlan));
});
