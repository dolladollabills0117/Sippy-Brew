import type { TierId } from "./config";
import type { SavedArea } from "./geo";
import type { ShopHours } from "./rules/hours";
import type { CoffeeCategory } from "./rules/menu";
import type { OrderStatus } from "./rules/order";

/** API shapes shared by apps/web, apps/consumer and apps/shop. Money is integer cents. */
export type Role = "member" | "shop_owner" | "admin";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "unpaid";
export type ShopStatus = "pending" | "active" | "paused";
export type PayoutStatus = "pending" | "paid" | "failed";

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Subscription {
  id: string;
  memberId: string;
  tier: TierId;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface Shop {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  hours: ShopHours;
  story: string;
  photoUrl: string | null;
  status: ShopStatus;
  spotlight: boolean;
  payoutsEnabled: boolean;
}

export interface ShopListItem extends Shop {
  distanceMiles: number | null;
  saved: boolean;
  openNow: boolean;
}

export interface MenuItem {
  id: string;
  shopId: string;
  name: string;
  size: string;
  priceCents: number;
  category: CoffeeCategory;
  available: boolean;
  soldOutToday: boolean;
}

export interface Post {
  id: string;
  shopId: string;
  shopName?: string;
  body: string;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  size: string;
  quantity: number;
  unitPriceCents: number;
}

export type UpgradeStatus = "none" | "authorized" | "captured" | "voided" | "failed";

export interface Order {
  id: string;
  memberId: string;
  memberFirstName: string;
  shopId: string;
  shopName: string;
  status: OrderStatus;
  /** Full value at menu prices = passValueCents + upgradeCents. */
  totalCents: number;
  passValueCents: number;
  upgradeCents: number;
  upgradeStatus: UpgradeStatus;
  passDay: string;
  createdAt: string;
  pickupTime: string;
  redeemedAt: string | null;
  items: OrderItem[];
}

export interface MemberSummary {
  profile: Profile;
  subscription: Subscription | null;
  tierName: string | null;
  passesPerMonth: number;
  passesLeft: number;
  maxPassValueCents: number;
  /** True if today's pass is already used (one per calendar day, any shop). */
  passUsedToday: boolean;
  /** Calendar days with a live pass order this period. */
  passDaysUsed: string[];
  areas: SavedArea[];
}

export interface QrTicket {
  orderId: string;
  payload: string;
  shortCode: string;
  expiresAt: string;
  ttlSeconds: number;
}

export interface Payout {
  id: string;
  shopId: string;
  periodStart: string;
  periodEnd: string;
  grossCents: number;
  commissionCents: number;
  netCents: number;
  orderCount: number;
  status: PayoutStatus;
  paidAt: string | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
