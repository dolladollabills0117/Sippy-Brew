import { requireApiSession } from "@/lib/auth";
import { badRequest, json, readJson, route } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/server";

export const POST = route(async (req: Request) => {
  const s = await requireApiSession(req);
  const b = await readJson<{ token?: string; app?: string; platform?: string }>(req);
  if (!b.token || !/^Expo(nent)?PushToken\[.+\]$/.test(b.token)) throw badRequest("BAD_TOKEN", "Invalid push token.");
  if (b.app !== "consumer" && b.app !== "shop") throw badRequest("BAD_APP", "Unknown app.");
  await supabaseAdmin()
    .from("push_tokens")
    .upsert({ token: b.token, user_id: s.userId, app: b.app, platform: String(b.platform ?? "unknown").slice(0, 20), updated_at: new Date().toISOString() });
  return json({ ok: true as const });
});
