import type { TierId } from "./config";
import type { SavedArea } from "./geo";
import type { ShopHours } from "./rules/hours";
import type { CoffeeCategory } from "./rules/menu";
import type { ChosenOption, ModifierGroup } from "./rules/modifiers";
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
  /** Allowance snapshot for the current period (null until the period's passes are granted). */
  periodPasses: number | null;
  periodMaxPassValue: number | null;
  /** Plan switch waiting for the next renewal (plan changes take effect next month). */
  pendingTier?: TierId | null;
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
  /** Set when Sippy Brew removed the shop, e.g. "food" for selling food. */
  removalReason?: "food" | null;
  removedAt?: string | null;
  /** The shop's appeal, if it sent one. */
  appealNote?: string | null;
  appealedAt?: string | null;
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
  /** Customizations the shop offers on this drink (milk, shots, syrups), with its prices. */
  modifierGroups: ModifierGroup[];
  /** When the shop last changed the price (members see "price updated" for a while). */
  priceChangedAt?: string | null;
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
  /** Drink price plus customizations. */
  unitPriceCents: number;
  /** Customizations the member picked, as priced when they ordered. */
  options: ChosenOption[];
}

export type OverageStatus = "none" | "authorized" | "captured" | "voided" | "failed" | "waived";

export interface Order {
  id: string;
  memberId: string;
  memberFirstName: string;
  shopId: string;
  shopName: string;
  status: OrderStatus;
  /** Full value at menu prices = passCoveredCents + overageCents. */
  totalCents: number;
  passCoveredCents: number;
  overageCents: number;
  overageStatus: OverageStatus;
  passDay: string;
  createdAt: string;
  pickupTime: string;
  /** Picked up, or (for a no-show) when the shop flagged it. */
  redeemedAt: string | null;
  items: OrderItem[];
  /** The member's note for the barista. */
  note?: string | null;
  /** Allergies the member listed. Shown to the shop as a big red ALLERGY NOTICE. */
  allergyNote?: string | null;
  /** When the shop flagged it as not picked up. */
  noShowAt?: string | null;
}

/** Neighborhood Passport, Grand Tour and referral progress (rules/rewards.ts). */
export interface MemberRewards {
  passport: import("./rules/rewards").PassportStatus;
  referral: import("./rules/rewards").ReferralStatus & { code: string | null; link: string | null };
}

export interface MemberSummary {
  profile: Profile;
  subscription: Subscription | null;
  tierName: string | null;
  passesPerMonth: number;
  /** This period's passes left (bonus passes are separate). */
  passesLeft: number;
  /** Bonus passes from the passport and referrals; they roll over for a year. */
  bonusPassesLeft: number;
  bonusExpiresAt: string | null;
  rewards: MemberRewards | null;
  maxPassValueCents: number;
  /** True if today's pass is already used (one per calendar day, any shop). */
  passUsedToday: boolean;
  /** Calendar days with a live pass order this period. */
  passDaysUsed: string[];
  /**
   * Moving up to the higher sub-tier of the same tier (null when already at the top).
   * `suggested` is true when the member keeps paying overages, so the app nudges them.
   */
  upgrade: {
    suggested: boolean;
    toPlan: TierId;
    toName: string;
    toMaxPassValueCents: number;
    overageOrders: number;
    overagePaidCents: number;
    upgradeNowCents: number;
    newMonthlyPriceCents: number;
  } | null;
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
  /** Overages, 100% to the shop. */
  overageTotalCents: number;
  /** Card processing on overages, paid by the shop. */
  processingFeesCents: number;
  /** net + overage total - processing fees. */
  transferCents: number;
  orderCount: number;
  status: PayoutStatus;
  paidAt: string | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
