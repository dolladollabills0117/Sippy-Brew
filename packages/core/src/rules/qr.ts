import { RULES } from "../config";

export const QR_PREFIX = "SIPPY1:";
/** No 0/O/1/I/L so codes are easy to read aloud and type. */
const SHORT_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const SHORT_CODE_LENGTH = 6;

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export interface IssuedQr {
  token: string;
  shortCode: string;
  issuedAt: Date;
  expiresAt: Date;
  payload: string;
}

/** Issue a fresh single-use QR token. Server only. Expires `ttlSeconds` (30s) after issue. */
export function issueQr(
  now: Date,
  ttlSeconds: number = RULES.qrTtlSeconds,
  rand: (n: number) => Uint8Array = randomBytes,
): IssuedQr {
  const token = Array.from(rand(24), (b) => b.toString(16).padStart(2, "0")).join("");
  const codeBytes = rand(SHORT_CODE_LENGTH);
  const shortCode = Array.from(codeBytes, (b) => SHORT_CODE_ALPHABET[b % SHORT_CODE_ALPHABET.length]).join("");
  return {
    token,
    shortCode,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
    payload: QR_PREFIX + token,
  };
}

/** Extract a token from scanned QR text. Returns null if it isn't a Sippy Brew code. */
export function parseQrPayload(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith(QR_PREFIX)) return null;
  const token = trimmed.slice(QR_PREFIX.length);
  return /^[0-9a-f]{48}$/.test(token) ? token : null;
}

export function normalizeShortCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== SHORT_CODE_LENGTH) return null;
  for (const ch of code) if (!SHORT_CODE_ALPHABET.includes(ch)) return null;
  return code;
}

export interface RedemptionState {
  expiresAt: Date | string;
  redeemedAt: Date | string | null;
  orderShopId: string;
  orderStatus: string;
}

export type RedeemCheck =
  | { ok: true }
  | { ok: false; code: "EXPIRED" | "ALREADY_REDEEMED" | "WRONG_SHOP" | "ORDER_CANCELLED"; message: string };

/** A QR code expires 30 seconds after issue and can only be redeemed once, at the order's shop. */
export function checkRedeemable(r: RedemptionState, scanningShopId: string, now: Date): RedeemCheck {
  if (r.redeemedAt) return { ok: false, code: "ALREADY_REDEEMED", message: "This code was already redeemed." };
  if (r.orderStatus === "cancelled") return { ok: false, code: "ORDER_CANCELLED", message: "This order was cancelled." };
  if (r.orderStatus === "picked_up") return { ok: false, code: "ALREADY_REDEEMED", message: "This order was already picked up." };
  if (r.orderShopId !== scanningShopId)
    return { ok: false, code: "WRONG_SHOP", message: "This order belongs to a different shop." };
  if (now.getTime() >= new Date(r.expiresAt).getTime())
    return { ok: false, code: "EXPIRED", message: "This code expired. Ask the member to refresh their QR." };
  return { ok: true };
}

/** Whole seconds left before a code expires (0 when expired). For the member's countdown. */
export function qrSecondsRemaining(expiresAt: Date | string, now: Date): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 1000));
}
