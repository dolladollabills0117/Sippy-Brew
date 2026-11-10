import type { TierId } from "../config";
import type { SavedArea } from "../geo";
import type { ShopStats } from "../analytics";
import type { MenuItemInput } from "../rules/menu";
import type { OrderLineInput, OrderStatus } from "../rules/order";
import type { ShopHours } from "../rules/hours";
import type {
  ApiErrorBody,
  MemberSummary,
  MenuItem,
  Order,
  Payout,
  Post,
  QrTicket,
  Shop,
  ShopListItem,
} from "../types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  /** Base URL of apps/web, e.g. https://sippybrew.com. Empty string for same-origin (web). */
  baseUrl: string;
  /** Supabase access token for the signed-in user. Mobile sends it as a Bearer token; web uses cookies. */
  getAccessToken?: () => Promise<string | null | undefined>;
  fetch?: typeof fetch;
}

/**
 * Typed client for the Sippy Brew HTTP API (apps/web/app/api). Every write that touches a
 * business rule goes through the API so the server can enforce it.
 */
export function createApiClient(opts: ApiClientOptions) {
  const doFetch = opts.fetch ?? globalThis.fetch.bind(globalThis);

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const token = await opts.getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await doFetch(`${opts.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "include",
    });
    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) {
      const err = (json as ApiErrorBody | null)?.error;
      throw new ApiError(res.status, err?.code ?? "HTTP_ERROR", err?.message ?? `Request failed (${res.status})`);
    }
    return json as T;
  }

  const q = (params: Record<string, string | number | undefined>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined) s.set(k, String(v));
    const str = s.toString();
    return str ? `?${str}` : "";
  };

  return {
    // ---- Members ----
    me: () => request<MemberSummary>("GET", "/api/me"),
    checkout: (tier: TierId, returnUrl?: string) => request<{ url: string }>("POST", "/api/checkout", { tier, returnUrl }),
    upgradePlan: (toPlan: TierId, confirmedCents: number) =>
      request<{ plan: TierId; chargedCents: number }>("POST", "/api/subscription/upgrade", { toPlan, confirmedCents }),
    /** Switch plans from next month (or pass the current plan to cancel a pending switch). */
    changePlan: (toPlan: TierId) => request<{ pendingPlan: TierId | null; effectiveAt: string }>("POST", "/api/subscription/change", { toPlan }),
    billingPortal: (returnUrl?: string) => request<{ url: string }>("POST", "/api/billing/portal", { returnUrl }),
    setAreas: (areas: SavedArea[]) => request<{ areas: SavedArea[] }>("PUT", "/api/me/areas", { areas }),
    setSaved: (shopId: string, saved: boolean) => request<{ saved: boolean }>("POST", "/api/me/saved-shops", { shopId, saved }),
    listShops: (params: { near?: "home" | "work"; lat?: number; lng?: number } = {}) =>
      request<{ shops: ShopListItem[]; spotlights: ShopListItem[]; posts: Post[] }>("GET", `/api/shops${q(params)}`),
    getShop: (id: string) => request<{ shop: Shop; menu: MenuItem[]; post: Post | null; saved: boolean }>("GET", `/api/shops/${id}`),
    placeOrder: (input: { shopId: string; items: OrderLineInput[]; pickupAt: string; confirmedOverageCents?: number | null; useBonusForOverage?: boolean; note?: string | null; allergy?: string | null }) => request<{ order: Order }>("POST", "/api/orders", input),
    myOrders: () => request<{ orders: Order[] }>("GET", "/api/orders"),
    getOrder: (id: string) => request<{ order: Order }>("GET", `/api/orders/${id}`),
    issueQr: (orderId: string) => request<QrTicket>("POST", `/api/orders/${orderId}/qr`),
    registerPush: (token: string, app: "consumer" | "shop", platform: string) =>
      request<{ ok: true }>("POST", "/api/push/register", { token, app, platform }),

    // ---- Shops ----
    shopOrders: (scope: "active" | "today" = "active") => request<{ orders: Order[] }>("GET", `/api/shop/orders${q({ scope })}`),
    setOrderStatus: (orderId: string, status: OrderStatus) => request<{ order: Order }>("PATCH", `/api/shop/orders/${orderId}`, { status }),
    /** The member didn't pick up (from 30 minutes after pickup time). Not refunded; the shop is paid. */
    /** Appeal a removal for selling food (once), if it was a genuine error. */
    appealRemoval: (note: string) => request<{ appealed: boolean }>("POST", "/api/shop/appeal", { note }),
    flagNoShow: (orderId: string) => request<{ order: Order }>("POST", `/api/shop/orders/${orderId}/no-show`),
    /** Read a photo of the menu. Returns items for the shop to review; nothing is saved. */
    scanMenu: (image: string, mediaType: string) =>
      request<{ items: MenuItemInput[]; skipped: { name: string; reason: string }[] }>("POST", "/api/shop/menu/scan", { image, mediaType }),
    redeem: (input: { qr?: string; shortCode?: string }) => request<{ order: Order }>("POST", "/api/shop/redeem", input),
    shopMenu: () => request<{ items: MenuItem[] }>("GET", "/api/shop/menu"),
    addMenuItem: (item: MenuItemInput) => request<{ item: MenuItem }>("POST", "/api/shop/menu", item),
    updateMenuItem: (id: string, patch: Partial<Pick<MenuItem, "available" | "soldOutToday" | "priceCents" | "name" | "size" | "modifierGroups">>) =>
      request<{ item: MenuItem }>("PATCH", `/api/shop/menu/${id}`, patch),
    deleteMenuItem: (id: string) => request<{ ok: true }>("DELETE", `/api/shop/menu/${id}`),
    shopStats: () => request<{ stats: ShopStats; shop: Shop }>("GET", "/api/shop/stats"),
    shopPayouts: () => request<{ payouts: Payout[] }>("GET", "/api/shop/payouts"),
    shopPost: (body: string) => request<{ post: Post }>("POST", "/api/shop/posts", { body }),
    shopPosts: () => request<{ posts: Post[] }>("GET", "/api/shop/posts"),
    saveShop: (input: { name: string; address: string; lat: number; lng: number; hours: ShopHours; story: string; photoUrl?: string | null; acceptFoodPolicy?: boolean }) =>
      request<{ shop: Shop }>("POST", "/api/shop/onboarding", input),
    connectOnboarding: () => request<{ url: string }>("POST", "/api/shop/connect"),
  };
}

export type SippyApi = ReturnType<typeof createApiClient>;
