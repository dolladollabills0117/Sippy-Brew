/* Row → API shape mappers. Database columns are snake_case; the API is camelCase. */
import {
  dayKey,
  firstName,
  RULES,
  type MenuItem,
  type Order,
  type Payout,
  type Post,
  type Profile,
  type Shop,
  type ShopHours,
  type Subscription,
} from "@sippy/core";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export const mapProfile = (r: Row): Profile => ({ id: r.id, name: r.name ?? "", email: r.email ?? "", role: r.role });

export const mapSubscription = (r: Row): Subscription => ({
  id: r.id,
  memberId: r.member_id,
  tier: r.tier,
  status: r.status,
  currentPeriodStart: r.current_period_start,
  currentPeriodEnd: r.current_period_end,
  cancelAtPeriodEnd: Boolean(r.cancel_at_period_end),
});

export const mapShop = (r: Row): Shop => ({
  id: r.id,
  name: r.name,
  address: r.address,
  lat: r.lat,
  lng: r.lng,
  hours: (r.hours ?? {}) as ShopHours,
  story: r.story ?? "",
  photoUrl: r.photo_url ?? null,
  status: r.status,
  spotlight: Boolean(r.spotlight),
  payoutsEnabled: Boolean(r.payouts_enabled),
});

export const mapMenuItem = (r: Row, now = new Date()): MenuItem => ({
  id: r.id,
  shopId: r.shop_id,
  name: r.name,
  size: r.size,
  priceCents: r.price,
  category: r.category,
  available: Boolean(r.available),
  soldOutToday: r.sold_out_on === dayKey(now, RULES.timeZone),
});

export const ORDER_SELECT = "*, order_items(*), profiles:member_id(name), shops:shop_id(name)";

export const mapOrder = (r: Row): Order => ({
  id: r.id,
  memberId: r.member_id,
  memberFirstName: firstName(r.profiles?.name),
  shopId: r.shop_id,
  shopName: r.shops?.name ?? "",
  status: r.status,
  totalCents: r.total,
  createdAt: r.created_at,
  pickupTime: r.pickup_time,
  redeemedAt: r.redeemed_at ?? null,
  items: (r.order_items ?? []).map((i: Row) => ({
    id: i.id,
    menuItemId: i.menu_item_id,
    name: i.name,
    size: i.size,
    quantity: i.quantity,
    unitPriceCents: i.unit_price,
  })),
});

export const mapPayout = (r: Row): Payout => ({
  id: r.id,
  shopId: r.shop_id,
  periodStart: r.period_start,
  periodEnd: r.period_end,
  grossCents: r.gross,
  commissionCents: r.commission,
  netCents: r.net,
  orderCount: r.order_count,
  status: r.status,
  paidAt: r.paid_at ?? null,
});

export const mapPost = (r: Row): Post => ({
  id: r.id,
  shopId: r.shop_id,
  shopName: r.shops?.name,
  body: r.body,
  createdAt: r.created_at,
});
