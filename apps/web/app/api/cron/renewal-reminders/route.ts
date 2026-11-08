import { env } from "@/lib/env";
import { notifyMemberRenewalReminder } from "@/lib/notify";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getTier, RULES } from "@sippy/core";

export const runtime = "nodejs";

/** Run daily. Reminds members whose plan renews in about 3 days that unused credit won't roll over. */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${env.cronSecret()}`) return new Response("Unauthorized", { status: 401 });
  const from = new Date(Date.now() + 2.5 * 864e5).toISOString();
  const to = new Date(Date.now() + 3.5 * 864e5).toISOString();
  const { data } = await supabaseAdmin()
    .from("subscriptions")
    .select("member_id, tier, current_period_end")
    .eq("status", "active")
    .eq("cancel_at_period_end", false)
    .gte("current_period_end", from)
    .lt("current_period_end", to);
  for (const s of data ?? []) {
    const on = new Date(s.current_period_end).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: RULES.timeZone });
    await notifyMemberRenewalReminder(s.member_id, getTier(s.tier).name, on);
  }
  return Response.json({ reminded: data?.length ?? 0 });
}
