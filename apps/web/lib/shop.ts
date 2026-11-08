import "server-only";
import {
  canReleasePass,
  canTransition,
  checkCanPost,
  checkRedeemable,
  dayBounds,
  dayKey,
  monthBounds,
  normalizeShortCode,
  parseQrPayload,
  RULES,
  shopStats,
  splitOrder,
  validateHours,
  validateMenuItem,
  validateStory,
  type MenuItemInput,
  type OrderStatus,
  type ShopHours,
} from "@sippy/core";
import type { Session } from "./auth";
import { captureUpgrade, voidUpgrade } from "./billing";
import { mapMenuItem, mapOrder, mapPayout, mapPost, mapShop, ORDER_SELECT } from "./db";
import { AppError, badRequest, forbidden, fromDbError, notFound } from "./http";
import { getLiveSubscription, getOrder } from "./member";
import { notifyFollowersOfPost, notifyMemberOrderStatus } from "./notify";
import { supabaseAdmin } from "./supabase/server";

export async function getOwnerShopRow(s: Session, opts: { allowMissing?: boolean } = {}) {
  const { data } = await supabaseAdmin().from("shops").select("*").eq("owner_id", s.userId).maybeSingle();
  if (!data && !opts.allowMissing) throw new AppError(404, "NO_SHOP", "Set up your shop first.");
  return data;
}

export async function saveShop(
  s: Session,
  input: { name: string; address: string; lat: number; lng: number; hours: ShopHours; story: string; photoUrl?: string | null },
) {
  const name = String(input?.name ?? "").trim();
  if (name.length < 2) throw badRequest("BAD_NAME", "Add your business name.");
  if (!String(input.address ?? "").trim()) throw badRequest("BAD_ADDRESS", "Add your address.");
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) throw badRequest("BAD_LOCATION", "Set your shop's location on the map.");
  const storyErr = validateStory(String(input.story ?? ""));
  if (storyErr) throw badRequest("BAD_STORY", storyErr);
  const hoursErr = validateHours(input.hours ?? {});
  if (hoursErr) throw badRequest("BAD_HOURS", hoursErr);

  const db = supabaseAdmin();
  const existing = await getOwnerShopRow(s, { allowMissing: true });
  const row = {
    owner_id: s.userId,
    name,
    address: input.address.trim(),
    lat: input.lat,
    lng: input.lng,
    hours: input.hours,
    story: input.story.trim(),
    photo_url: input.photoUrl ?? existing?.photo_url ?? null,
  };
  const q = existing ? db.from("shops").update(row).eq("id", existing.id) : db.from("shops").insert({ ...row, status: "pending" });
  const { data, error } = await q.select("*").single();
  if (error) throw fromDbError(error);
  if (s.profile.role === "member") await db.from("profiles").update({ role: "shop_owner" }).eq("id", s.userId);
  return mapShop(data);
}

// ---- Orders ----

/** Cancel: return the pass (if still in the current period) and release any upgrade hold. */
export async function cancelOrderRow(row: { id: string; member_id: string; subscription_id: string; period_start: string; upgrade_payment_intent: string | null; upgrade_status: string }) {
  const db = supabaseAdmin();
  const sub = await getLiveSubscription(row.member_id);
  const release = Boolean(sub && sub.id === row.subscription_id && canReleasePass(row.period_start, sub.currentPeriodStart));
  const { error } = await db.rpc("cancel_order", { p_order: row.id, p_refund: release });
  if (error) throw fromDbError(error);
  if (row.upgrade_payment_intent && row.upgrade_status === "authorized") {
    const ok = await voidUpgrade(row.upgrade_payment_intent).then(() => true, () => false);
    await db.from("orders").update({ upgrade_status: ok ? "voided" : "failed" }).eq("id", row.id);
  }
}

export async function shopOrders(s: Session, scope: "active" | "today") {
  const shop = await getOwnerShopRow(s);
  let q = supabaseAdmin().from("orders").select(ORDER_SELECT).eq("shop_id", shop.id);
  if (scope === "active") {
    q = q.in("status", ["received", "preparing", "ready"]).order("pickup_time", { ascending: true });
  } else {
    const { start } = dayBounds(new Date(), RULES.timeZone);
    q = q.gte("created_at", start.toISOString()).order("created_at", { ascending: false });
  }
  const { data } = await q.limit(200);
  return (data ?? []).map(mapOrder);
}

export async function setOrderStatus(s: Session, orderId: string, status: OrderStatus) {
  const shop = await getOwnerShopRow(s);
  const db = supabaseAdmin();
  const { data: row } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!row || row.shop_id !== shop.id) throw notFound("Order");
  if (status === "picked_up") throw badRequest("SCAN_REQUIRED", "Scan the member's QR code (or enter their code) to mark pickup.");
  if (!canTransition(row.status, status)) throw new AppError(409, "INVALID_TRANSITION", "That status change isn't allowed.");

  if (status === "cancelled") {
    await cancelOrderRow(row);
  } else {
    const { error } = await db.from("orders").update({ status }).eq("id", orderId).eq("status", row.status);
    if (error) throw fromDbError(error);
  }
  const order = await getOrder(orderId);
  void notifyMemberOrderStatus(order).catch((e) => console.error("notify failed", e));
  return order;
}

/** Redeem by scanned QR payload or manual short code. Single use, 30s expiry, this shop only. */
export async function redeem(s: Session, input: { qr?: string; shortCode?: string }) {
  const shop = await getOwnerShopRow(s);
  const db = supabaseAdmin();
  const now = new Date();

  let q = db.from("redemptions").select("*, orders!inner(shop_id, status, total)");
  if (input.qr) {
    const token = parseQrPayload(input.qr);
    if (!token) throw badRequest("NOT_SIPPY", "That isn't a Sippy Brew code.");
    q = q.eq("qr_token", token);
  } else if (input.shortCode) {
    const code = normalizeShortCode(input.shortCode);
    if (!code) throw badRequest("BAD_CODE", "Codes are 6 letters and numbers.");
    // Short codes are reused over time, so look only at this shop's most recent one.
    q = q.eq("short_code", code).eq("orders.shop_id", shop.id).order("created_at", { ascending: false }).limit(1);
  } else {
    throw badRequest("NO_CODE", "Scan a QR code or enter a code.");
  }
  const { data: rows } = await q;
  const r = rows?.[0];
  if (!r) throw notFound("Code");

  const check = checkRedeemable(
    { expiresAt: r.expires_at, redeemedAt: r.redeemed_at, orderShopId: r.orders.shop_id, orderStatus: r.orders.status },
    shop.id,
    now,
  );
  if (!check.ok) throw new AppError(check.code === "EXPIRED" ? 410 : 409, check.code, check.message);

  const split = splitOrder(r.orders.total);
  const { error } = await db.rpc("redeem_qr", {
    p_redemption: r.id,
    p_shop: shop.id,
    p_staff: s.userId,
    p_commission: split.commissionCents,
    p_net: split.netCents,
  });
  if (error) throw fromDbError(error);

  // The drink is handed over: collect any upgrade the member authorized at order time.
  const { data: paid } = await db.from("orders").select("upgrade_payment_intent, upgrade_status").eq("id", r.order_id).single();
  if (paid?.upgrade_payment_intent && paid.upgrade_status === "authorized") {
    const ok = await captureUpgrade(paid.upgrade_payment_intent);
    await db.from("orders").update({ upgrade_status: ok ? "captured" : "failed" }).eq("id", r.order_id);
  }

  const order = await getOrder(r.order_id);
  void notifyMemberOrderStatus(order).catch(() => {});
  return order;
}

// ---- Menu ----

export async function shopMenu(s: Session) {
  const shop = await getOwnerShopRow(s);
  const { data } = await supabaseAdmin().from("menu_items").select("*").eq("shop_id", shop.id).eq("archived", false).order("sort_order").order("name");
  return (data ?? []).map((m) => mapMenuItem(m));
}

export async function addMenuItem(s: Session, input: MenuItemInput) {
  const v = validateMenuItem(input);
  if (!v.ok) throw badRequest("BAD_MENU_ITEM", v.message);
  const shop = await getOwnerShopRow(s);
  const { data, error } = await supabaseAdmin()
    .from("menu_items")
    .insert({ shop_id: shop.id, name: input.name.trim(), size: input.size.trim(), price: input.priceCents, category: input.category })
    .select("*")
    .single();
  if (error) throw fromDbError(error);
  return mapMenuItem(data);
}

export async function updateMenuItem(
  s: Session,
  id: string,
  patch: { available?: boolean; soldOutToday?: boolean; priceCents?: number; name?: string; size?: string },
) {
  const shop = await getOwnerShopRow(s);
  const db = supabaseAdmin();
  const { data: row } = await db.from("menu_items").select("*").eq("id", id).maybeSingle();
  if (!row || row.shop_id !== shop.id) throw notFound("Menu item");

  const next = { name: patch.name ?? row.name, size: patch.size ?? row.size, priceCents: patch.priceCents ?? row.price, category: row.category };
  const v = validateMenuItem(next);
  if (!v.ok) throw badRequest("BAD_MENU_ITEM", v.message);

  const update: Record<string, unknown> = { name: next.name.trim(), size: next.size.trim(), price: next.priceCents };
  if (patch.available !== undefined) update.available = Boolean(patch.available);
  if (patch.soldOutToday !== undefined) update.sold_out_on = patch.soldOutToday ? dayKey(new Date(), RULES.timeZone) : null;
  const { data, error } = await db.from("menu_items").update(update).eq("id", id).select("*").single();
  if (error) throw fromDbError(error);
  return mapMenuItem(data);
}

export async function deleteMenuItem(s: Session, id: string) {
  const shop = await getOwnerShopRow(s);
  // Archive rather than delete so past orders keep their history.
  const { error } = await supabaseAdmin().from("menu_items").update({ archived: true, available: false }).eq("id", id).eq("shop_id", shop.id);
  if (error) throw fromDbError(error);
  return { ok: true as const };
}

// ---- Dashboard, payouts, posts ----

export async function getShopStats(s: Session) {
  const shopRow = await getOwnerShopRow(s);
  const db = supabaseAdmin();
  const now = new Date();
  const month = monthBounds(now, RULES.timeZone);
  // This month's orders plus each member's earlier first visit, for new vs. returning.
  const [{ data: recent }, { data: earlier }] = await Promise.all([
    db.from("orders").select("id, member_id, total, status, created_at, redeemed_at, order_items(name, quantity)").eq("shop_id", shopRow.id).gte("created_at", new Date(month.start.getTime() - 7 * 864e5).toISOString()),
    db.from("orders").select("member_id, redeemed_at").eq("shop_id", shopRow.id).eq("status", "picked_up").lt("redeemed_at", month.start.toISOString()).limit(5000),
  ]);
  const orders = [
    ...(earlier ?? []).map((o, i) => ({ id: `e${i}`, memberId: o.member_id, totalCents: 0, status: "picked_up", createdAt: o.redeemed_at, redeemedAt: o.redeemed_at, items: [] })),
    ...(recent ?? []).map((o) => ({
      id: o.id,
      memberId: o.member_id,
      totalCents: o.total,
      status: o.status,
      createdAt: o.created_at,
      redeemedAt: o.redeemed_at,
      items: (o.order_items ?? []).map((i: { name: string; quantity: number }) => ({ name: i.name, quantity: i.quantity })),
    })),
  ];
  return { stats: shopStats(orders, now), shop: mapShop(shopRow) };
}

export async function shopPayouts(s: Session) {
  const shop = await getOwnerShopRow(s);
  const { data } = await supabaseAdmin().from("payouts").select("*").eq("shop_id", shop.id).order("period_start", { ascending: false }).limit(52);
  return (data ?? []).map(mapPayout);
}

export async function shopPosts(s: Session) {
  const shop = await getOwnerShopRow(s);
  const { data } = await supabaseAdmin().from("posts").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(30);
  return (data ?? []).map(mapPost);
}

export async function createPost(s: Session, body: string) {
  const shop = await getOwnerShopRow(s);
  if (shop.status !== "active") throw forbidden("Your shop needs to be approved before posting.");
  const db = supabaseAdmin();
  const now = new Date();
  const { data: recent } = await db.from("posts").select("post_day").eq("shop_id", shop.id).gte("post_day", dayKey(new Date(now.getTime() - 2 * 864e5), RULES.timeZone));
  const check = checkCanPost(String(body ?? ""), (recent ?? []).map((p) => p.post_day), now);
  if (!check.ok) throw new AppError(check.code === "POST_LIMIT" ? 409 : 400, check.code, check.message);
  const { data, error } = await db.from("posts").insert({ shop_id: shop.id, body: body.trim(), post_day: check.postDay }).select("*").single();
  if (error) {
    if (error.code === "23505") throw new AppError(409, "POST_LIMIT", "You've already posted today. Come back tomorrow.");
    throw fromDbError(error);
  }
  const post = mapPost({ ...data, shops: { name: shop.name } });
  void notifyFollowersOfPost(shop.id, shop.name, post.body).catch((e) => console.error("notify failed", e));
  return post;
}
