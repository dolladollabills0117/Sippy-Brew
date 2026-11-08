import { describe, expect, it } from "vitest";
import { checkRedeemable, issueQr, normalizeShortCode, parseQrPayload, qrSecondsRemaining, RULES } from "../src";

const now = new Date("2026-11-04T13:00:00Z");

describe("QR expiry and single use", () => {
  it("expires 30 seconds after issue", () => {
    expect(RULES.qrTtlSeconds).toBe(30);
    const qr = issueQr(now);
    expect(qr.expiresAt.getTime() - now.getTime()).toBe(30_000);
  });

  const base = { orderShopId: "shop-1", orderStatus: "ready", redeemedAt: null };

  it("is redeemable at 29.999 seconds", () => {
    const qr = issueQr(now);
    expect(checkRedeemable({ ...base, expiresAt: qr.expiresAt }, "shop-1", new Date(now.getTime() + 29_999))).toEqual({ ok: true });
  });

  it("is rejected at exactly 30 seconds", () => {
    const qr = issueQr(now);
    const r = checkRedeemable({ ...base, expiresAt: qr.expiresAt }, "shop-1", new Date(now.getTime() + 30_000));
    expect(r).toMatchObject({ ok: false, code: "EXPIRED" });
  });

  it("can only be redeemed once", () => {
    const qr = issueQr(now);
    const r = checkRedeemable({ ...base, expiresAt: qr.expiresAt, redeemedAt: now }, "shop-1", now);
    expect(r).toMatchObject({ ok: false, code: "ALREADY_REDEEMED" });
  });

  it("can't be redeemed at a different shop", () => {
    const qr = issueQr(now);
    expect(checkRedeemable({ ...base, expiresAt: qr.expiresAt }, "shop-2", now)).toMatchObject({ ok: false, code: "WRONG_SHOP" });
  });

  it("can't redeem a cancelled or already picked-up order", () => {
    const qr = issueQr(now);
    expect(checkRedeemable({ ...base, orderStatus: "cancelled", expiresAt: qr.expiresAt }, "shop-1", now)).toMatchObject({ code: "ORDER_CANCELLED" });
    expect(checkRedeemable({ ...base, orderStatus: "picked_up", expiresAt: qr.expiresAt }, "shop-1", now)).toMatchObject({ code: "ALREADY_REDEEMED" });
  });

  it("issues unique, unguessable tokens", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => issueQr(now).token));
    expect(tokens.size).toBe(200);
    for (const t of tokens) expect(t).toMatch(/^[0-9a-f]{48}$/);
  });

  it("round-trips the QR payload and rejects foreign codes", () => {
    const qr = issueQr(now);
    expect(parseQrPayload(qr.payload)).toBe(qr.token);
    expect(parseQrPayload("https://example.com")).toBeNull();
    expect(parseQrPayload("SIPPY1:not-a-token")).toBeNull();
  });

  it("normalizes manual short codes", () => {
    const qr = issueQr(now);
    expect(normalizeShortCode(qr.shortCode.toLowerCase())).toBe(qr.shortCode);
    expect(normalizeShortCode("abc-234")).toBe("ABC234");
    expect(normalizeShortCode("ABC10O")).toBeNull(); // ambiguous characters are never issued
    expect(normalizeShortCode("ABC")).toBeNull();
  });

  it("counts down whole seconds", () => {
    const qr = issueQr(now);
    expect(qrSecondsRemaining(qr.expiresAt, now)).toBe(30);
    expect(qrSecondsRemaining(qr.expiresAt, new Date(now.getTime() + 29_500))).toBe(1);
    expect(qrSecondsRemaining(qr.expiresAt, new Date(now.getTime() + 31_000))).toBe(0);
  });
});
