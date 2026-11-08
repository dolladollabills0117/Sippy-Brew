import { requireApiSession } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { getMemberSummary } from "@/lib/member";
import { maybeSendWelcome } from "@/lib/notify";

export const GET = route(async (req: Request) => {
  const s = await requireApiSession(req);
  void maybeSendWelcome(s.userId).catch(() => {});
  return json(await getMemberSummary(s));
});
