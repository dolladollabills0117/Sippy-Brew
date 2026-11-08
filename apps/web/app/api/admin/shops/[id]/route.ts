import { requireApiSession } from "@/lib/auth";
import { badRequest, forbidden, json, readJson, route } from "@/lib/http";
import { notifyShopStatus } from "@/lib/notify";
import { supabaseAdmin } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const s = await requireApiSession(req, "admin");
  if (s.profile.role !== "admin") throw forbidden();
  const b = await readJson<{ status?: string; spotlight?: boolean }>(req);
  const update: Record<string, unknown> = {};
  if (b.status !== undefined) {
    if (!["active", "paused", "pending"].includes(b.status)) throw badRequest("BAD_STATUS", "Unknown status.");
    update.status = b.status;
  }
  if (b.spotlight !== undefined) update.spotlight = Boolean(b.spotlight);
  const id = (await ctx.params).id;
  const { data, error } = await supabaseAdmin().from("shops").update(update).eq("id", id).select("id, status, spotlight").single();
  if (error) throw badRequest("UPDATE_FAILED", error.message);
  if (b.status) void notifyShopStatus(id, b.status).catch(() => {});
  return json({ shop: data });
});
