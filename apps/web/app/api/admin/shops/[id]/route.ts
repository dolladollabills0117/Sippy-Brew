import { requireApiSession } from "@/lib/auth";
import { badRequest, forbidden, json, readJson, route } from "@/lib/http";
import { notifyShopRemovedForFood, notifyShopStatus } from "@/lib/notify";
import { supabaseAdmin } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const s = await requireApiSession(req, "admin");
  if (s.profile.role !== "admin") throw forbidden();
  const b = await readJson<{ status?: string; spotlight?: boolean; remove?: string; founding?: boolean }>(req);
  const update: Record<string, unknown> = {};
  if (b.remove !== undefined) {
    // Zero tolerance: selling food gets a shop removed. It can appeal if it was a genuine error.
    if (b.remove !== "food") throw badRequest("BAD_REASON", "Unknown removal reason.");
    Object.assign(update, { status: "paused", spotlight: false, removal_reason: "food", removed_at: new Date().toISOString(), appeal_note: null, appealed_at: null });
  } else if (b.status !== undefined) {
    if (!["active", "paused", "pending"].includes(b.status)) throw badRequest("BAD_STATUS", "Unknown status.");
    update.status = b.status;
    // Reinstating (e.g. after an appeal) clears the removal.
    if (b.status === "active") Object.assign(update, { removal_reason: null, removed_at: null });
  }
  if (b.spotlight !== undefined) update.spotlight = Boolean(b.spotlight);
  // Founding shops pay 12% on pass value instead of 15%. Applies to orders picked up from now on.
  if (b.founding !== undefined) update.founding = Boolean(b.founding);
  const id = (await ctx.params).id;
  const { data, error } = await supabaseAdmin().from("shops").update(update).eq("id", id).select("id, status, spotlight").single();
  if (error) throw badRequest("UPDATE_FAILED", error.message);
  if (b.remove === "food") void notifyShopRemovedForFood(id).catch(() => {});
  else if (b.status) void notifyShopStatus(id, b.status).catch(() => {});
  return json({ shop: data });
});
