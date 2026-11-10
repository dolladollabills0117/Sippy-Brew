import "server-only";
import {
  dayKey,
  distanceMiles,
  getTier,
  isOpenAt,
  issueQr,
  passBalance,
  overageIsCharged,
  suggestUpgrade,
  upgradeNowCost,
  upgradeOffer,
  RULES,
  validateOrder,
  type PassLedgerEntry,
  type MemberSummary,
  type OrderLineInput,
  type QrTicket,
  type SavedArea,
  type ShopListItem,
  type Subscription, clampRadius } from "@sippy/core";
import type { Session } from "./auth";
import { authorizeOverage, voidOverage } from "./billing";
import { mapMenuItem, mapOrder, mapPost, mapShop, mapSubscription, ORDER_SELECT } from "./db";
import { AppError, badRequest, forbidden, fromDbError, notFound } from "./http";
import { notifyShopNewOrder } from "./notify";
import { getBonusLeft, getMemberRewards } from "./rewards";
import { supabaseAdmin } from "./supabase/server";

const LIVE = ["active", "trialing", "past_due", "incomplete"];

export async function getLiveSubscription(memberId: string): Promise<Subscription | null> {
  const { data } = await supabaseAdmin()
    .from("subscriptions")
    .select("*")
    .eq("member_id", memberId)
    .in("status", LIVE)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? mapSubscription(data) : null;
}

/** The member's tier allowance for the current period (snapshot on the subscription, else config). */
export function periodAllowance(sub: Subscription) {
  const tier = getTier(sub.tier);
  return { tier, passesPerMonth: sub.periodPasses ?? tier.passesPerMonth, maxPassValueCents: sub.periodMaxPassValue ?? tier.maxPassValueCents };
}

/** Passes left this period and the days a pass was already used (any shop). */
export async function getPassState(
  memberId: string,
  sub: Subscription | null,
): Promise<{ passesLeft: number; bonusLeft: number; bonusExpiresAt: string | null; passDaysUsed: string[] }> {
  if (!sub) return { passesLeft: 0, bonusLeft: 0, bonusExpiresAt: null, passDaysUsed: [] };
  const db = supabaseAdmin();
  const [{ data: ledger }, { data: orders }, bonus] = await Promise.all([
    db.from("pass_ledger").select("passes, type, period_start").eq("member_id", memberId).eq("subscription_id", sub.id).eq("period_start", sub.currentPeriodStart),
    db.from("orders").select("pass_day").eq("member_id", memberId).neq("status", "cancelled").gte("pass_day", dayKey(new Date(Date.now() - 2 * 864e5), RULES.timeZone)),
    getBonusLeft(memberId),
  ]);
  const entries: PassLedgerEntry[] = (ledger ?? []).map((r) => ({ passes: r.passes, type: r.type, periodStart: r.period_start }));
  return {
    passesLeft: passBalance(entries, sub.currentPeriodStart),
    bonusLeft: bonus.left,
    bonusExpiresAt: bonus.expiresSoonest,
    passDaysUsed: (orders ?? []).map((o) => o.pass_day),
  };
}

export async function getAreas(memberId: string): Promise<SavedArea[]> {
  const { data } = await supabaseAdmin().from("member_areas").select("*").eq("member_id", memberId);
  return (data ?? []).map((a) => ({ kind: a.kind, label: a.label, lat: a.lat, lng: a.lng, radiusMiles: a.radius_miles }));
}

/**
 * The higher sub-tier for this member, with what moving up costs now. `suggested` is set when
 * they keep paying overages on the lower sub-tier this period, so the app nudges them.
 */
export async function getUpgradeOption(sub: Subscription | null, passesLeft: number): Promise<MemberSummary["upgrade"]> {
  if (!sub || !["active", "trialing"].includes(sub.status)) return null;
  const plan = getTier(sub.tier);
  // Hidden when only a few passes are left this period.
  const to = upgradeOffer(plan, passesLeft);
  if (!to) return null;
  const { data } = await supabaseAdmin()
    .from("orders")
    .select("overage_amount, status")
    .eq("subscription_id", sub.id)
    .eq("period_start", sub.currentPeriodStart);
  const periodOrders = (data ?? []).map((o) => ({ overageCents: o.overage_amount ?? 0, status: o.status }));
  const nudge = suggestUpgrade({ plan, periodOrders, passesLeft });
  const over = periodOrders.filter((o) => o.status !== "cancelled" && o.overageCents > 0);
  return {
    suggested: Boolean(nudge),
    toPlan: to.id,
    toName: to.name,
    toMaxPassValueCents: to.maxPassValueCents,
    overageOrders: over.length,
    overagePaidCents: over.reduce((t, o) => t + o.overageCents, 0),
    upgradeNowCents: upgradeNowCost(plan, to),
    newMonthlyPriceCents: to.priceCents,
  };
}

async function referralCodeOf(memberId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("profiles").select("referral_code").eq("id", memberId).maybeSingle();
  return (data?.referral_code as string | undefined) ?? null;
}

export async function getMemberSummary(s: Session): Promise<MemberSummary> {
  const sub = await getLiveSubscription(s.userId);
  const [passes, areas] = await Promise.all([getPassState(s.userId, sub), getAreas(s.userId)]);
  const allowance = sub ? periodAllowance(sub) : null;
  const today = dayKey(new Date(), RULES.timeZone);
  const [upgrade, rewards] = await Promise.all([
    getUpgradeOption(sub, passes.passesLeft),
    s.profile.role === "member" ? getMemberRewards(s.userId, await referralCodeOf(s.userId)) : Promise.resolve(null),
  ]);
  return {
    profile: s.profile,
    subscription: sub,
    tierName: allowance?.tier.name ?? null,
    passesPerMonth: allowance?.passesPerMonth ?? 0,
    passesLeft: passes.passesLeft,
    bonusPassesLeft: passes.bonusLeft,
    bonusExpiresAt: passes.bonusExpiresAt,
    rewards,
    maxPassValueCents: allowance?.maxPassValueCents ?? 0,
    passUsedToday: passes.passDaysUsed.includes(today),
    passDaysUsed: passes.passDaysUsed,
    upgrade,
    areas,
  };
}

export async function setAreas(memberId: string, areas: SavedArea[]): Promise<SavedArea[]> {
  if (!Array.isArray(areas) || areas.length > 2) throw badRequest("BAD_AREAS", "Save up to two areas: home and work.");
  const db = supabaseAdmin();
  const kinds = new Set<string>();
  for (const a of areas) {
    if (!["home", "work"].includes(a.kind) || kinds.has(a.kind)) throw badRequest("BAD_AREAS", "Areas must be one home and one work.");
    if (!Number.isFinite(a.lat) || !Number.isFinite(a.lng)) throw badRequest("BAD_AREAS", "Pick a location on the map.");
    kinds.add(a.kind);
  }
  await db.from("member_areas").delete().eq("member_id", memberId);
  if (areas.length) {
    const { error } = await db.from("member_areas").insert(
      areas.map((a) => ({
        member_id: memberId,
        kind: a.kind,
        label: String(a.label || (a.kind === "home" ? "Home" : "Work")).slice(0, 40),
        lat: a.lat,
        lng: a.lng,
        radius_miles: clampRadius(a.radiusMiles),
      })),
    );
    if (error) throw fromDbError(error);
  }
  return getAreas(memberId);
}

export async function setSaved(memberId: string, shopId: string, saved: boolean) {
  const db = supabaseAdmin();
  if (saved) await db.from("saved_shops").upsert({ member_id: memberId, shop_id: shopId });
  else await db.from("saved_shops").delete().eq("member_id", memberId).eq("shop_id", shopId);
  return { saved };
}

export async function listShops(
  s: Session | null,
  opts: { near?: "home" | "work"; lat?: number; lng?: number } = {},
): Promise<{ shops: ShopListItem[]; spotlights: ShopListItem[]; posts: ReturnType<typeof mapPost>[] }> {
  const db = supabaseAdmin();
  const [{ data: shops }, savedRes, areas, { data: posts }] = await Promise.all([
    db.from("shops").select("*").eq("status", "active").order("name"),
    s ? db.from("saved_shops").select("shop_id").eq("member_id", s.userId) : Promise.resolve({ data: [] as { shop_id: string }[] }),
    s ? getAreas(s.userId) : Promise.resolve([] as SavedArea[]),
    db.from("posts").select("*, shops!inner(name, status)").eq("shops.status", "active").order("created_at", { ascending: false }).limit(6),
  ]);
  const saved = new Set((savedRes.data ?? []).map((r) => r.shop_id));
  const area = opts.near ? areas.find((a) => a.kind === opts.near) : undefined;
  const origin = area ?? (opts.lat !== undefined && opts.lng !== undefined ? { lat: opts.lat, lng: opts.lng } : areas[0]);
  const now = new Date();

  let list: ShopListItem[] = (shops ?? []).map((r) => {
    const shop = mapShop(r);
    return {
      ...shop,
      distanceMiles: origin ? distanceMiles(origin, shop) : null,
      saved: saved.has(shop.id),
      openNow: isOpenAt(shop.hours, now),
    };
  });
  if (area) list = list.filter((x) => (x.distanceMiles ?? Infinity) <= area.radiusMiles);
  if (origin) list.sort((a, b) => (a.distanceMiles ?? 0) - (b.distanceMiles ?? 0));

  return { shops: list, spotlights: list.filter((x) => x.spotlight), posts: (posts ?? []).map(mapPost) };
}

export async function getShopDetail(id: string, s: Session | null) {
  const db = supabaseAdmin();
  const { data: shop } = await db.from("shops").select("*").eq("id", id).maybeSingle();
  if (!shop || (shop.status !== "active" && shop.owner_id !== s?.userId && s?.profile.role !== "admin")) throw notFound("Shop");
  const [{ data: menu }, { data: post }, savedRes] = await Promise.all([
    db.from("menu_items").select("*").eq("shop_id", id).eq("archived", false).order("sort_order").order("name"),
    db.from("posts").select("*").eq("shop_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    s ? db.from("saved_shops").select("shop_id").eq("member_id", s.userId).eq("shop_id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    shop: mapShop(shop),
    menu: (menu ?? []).map((m) => mapMenuItem(m)),
    post: post ? mapPost(post) : null,
    saved: Boolean(savedRes.data),
  };
}

/**
 * Place a Daily Pass order. Rules run in packages/core, then the database re-checks them
 * atomically. The pass covers the first $8.00. If the order is over, the member must have
 * confirmed the exact overage (`confirmedOverageCents`); only then is it authorized on their
 * card on file, to be captured when the shop scans the QR.
 */
export async function placeOrder(
  s: Session,
  input: { shopId: string; items: OrderLineInput[]; pickupAt: string; confirmedOverageCents?: number | null; useBonusForOverage?: boolean },
) {
  if (!input?.shopId || !Array.isArray(input.items)) throw badRequest("BAD_ORDER", "Pick a shop and at least one coffee.");
  const pickupAt = new Date(input.pickupAt);
  if (Number.isNaN(pickupAt.getTime())) throw badRequest("INVALID_PICKUP", "Pick a pickup time.");
  const db = supabaseAdmin();
  const now = new Date();
  const [{ data: shop }, { data: menu }, sub] = await Promise.all([
    db.from("shops").select("*").eq("id", input.shopId).maybeSingle(),
    db.from("menu_items").select("*").eq("shop_id", input.shopId).eq("archived", false),
    getLiveSubscription(s.userId),
  ]);
  if (!shop) throw notFound("Shop");
  const passes = await getPassState(s.userId, sub);
  const allowance = sub ? periodAllowance(sub) : null;

  const result = validateOrder(input.items, {
    shop: { id: shop.id, status: shop.status, hours: shop.hours ?? {} },
    subscription: sub,
    menu: (menu ?? []).map((m) => mapMenuItem(m, now)),
    // This month's passes first, then bonus passes (the database picks which, atomically).
    passesLeft: passes.passesLeft + passes.bonusLeft,
    passDaysUsed: passes.passDaysUsed,
    maxPassValueCents: allowance?.maxPassValueCents ?? 0,
    confirmedOverageCents: typeof input.confirmedOverageCents === "number" ? input.confirmedOverageCents : null,
    bonusPassesLeft: passes.bonusLeft,
    useBonusForOverage: input.useBonusForOverage === true,
    pickupAt,
    now,
  });
  if (!result.ok) {
    const conflict = ["PASS_USED_TODAY", "NO_PASSES_LEFT", "OVERAGE_CONFIRMATION_REQUIRED", "BONUS_NOT_AVAILABLE"].includes(result.code);
    throw new AppError(conflict ? 409 : 400, result.code, result.message);
  }

  let paymentIntent: string | null = null;
  if (overageIsCharged(result.overageCents)) {
    paymentIntent = await authorizeOverage(s.userId, sub!, result.overageCents, { shop_id: shop.id, pass_day: result.passDay });
  }

  const sizes = new Map((menu ?? []).map((m) => [m.id, m.size as string]));
  const { data: orderId, error } = await db.rpc("place_order", {
    p_member: s.userId,
    p_shop: shop.id,
    p_subscription: sub!.id,
    p_period_start: sub!.currentPeriodStart,
    p_total: result.totalCents,
    p_pass_covered: result.passCoveredCents,
    p_overage: result.overageCents,
    p_max_pass_value: allowance!.maxPassValueCents,
    p_pass_day: result.passDay,
    p_items: result.lines.map((l) => ({
      menu_item_id: l.menuItemId,
      name: l.name,
      size: sizes.get(l.menuItemId) ?? "",
      quantity: l.quantity,
      unit_price: l.unitPriceCents,
      options: l.options,
    })),
    p_pickup: pickupAt.toISOString(),
    p_overage_payment_intent: paymentIntent,
    p_overage_confirmed: result.overageCents > 0,
    p_bonus_cover: result.bonusCoveredCents,
  });
  if (error) {
    if (paymentIntent) await voidOverage(paymentIntent).catch(() => {});
    throw fromDbError(error);
  }

  const order = await getOrder(orderId as string);
  void notifyShopNewOrder(order).catch((e) => console.error("notify failed", e));
  return order;
}

export async function getOrder(id: string) {
  const { data } = await supabaseAdmin().from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle();
  if (!data) throw notFound("Order");
  return mapOrder(data);
}

export async function memberOrders(memberId: string, limit = 50) {
  const { data } = await supabaseAdmin()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(mapOrder);
}

/**
 * Issue a fresh 30-second QR for an order. Older unredeemed codes for the order are expired
 * right away so only the newest one on the member's screen works.
 */
export async function issueQrFor(s: Session, orderId: string): Promise<QrTicket> {
  const db = supabaseAdmin();
  const order = await getOrder(orderId);
  if (order.memberId !== s.userId) throw forbidden();
  if (order.status === "picked_up" || order.status === "cancelled") throw new AppError(409, "ORDER_CLOSED", "This order is already closed.");

  const now = new Date();
  await db.from("redemptions").update({ expires_at: now.toISOString() }).eq("order_id", orderId).is("redeemed_at", null).gt("expires_at", now.toISOString());
  for (let attempt = 0; attempt < 5; attempt++) {
    const qr = issueQr(now);
    // Short codes are only 6 characters; make sure no other live code shares this one.
    const { data: clash } = await db.from("redemptions").select("id").eq("short_code", qr.shortCode).gt("expires_at", now.toISOString()).limit(1);
    if (clash?.length) continue;
    const { error } = await db.from("redemptions").insert({
      order_id: orderId,
      qr_token: qr.token,
      short_code: qr.shortCode,
      expires_at: qr.expiresAt.toISOString(),
    });
    if (error) throw fromDbError(error);
    return { orderId, payload: qr.payload, shortCode: qr.shortCode, expiresAt: qr.expiresAt.toISOString(), ttlSeconds: RULES.qrTtlSeconds };
  }
  throw new AppError(503, "QR_BUSY", "Couldn't make a code just now. Try again.");
}
