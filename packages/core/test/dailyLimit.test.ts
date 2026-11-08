import { describe, expect, it } from "vitest";
import { checkDailyLimit, remainingToday, spentToday, RULES } from "../src";

const TZ = "America/New_York";

describe("daily limit ($8 per calendar day)", () => {
  it("is $8 by default from config", () => {
    expect(RULES.dailyLimitCents).toBe(800);
  });

  it("allows an order that lands exactly on the limit", () => {
    expect(checkDailyLimit(300, 500)).toEqual({ ok: true, remainingAfterCents: 0 });
  });

  it("rejects an order one cent over the limit", () => {
    const r = checkDailyLimit(300, 501);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("DAILY_LIMIT");
      expect(r.remainingCents).toBe(500);
    }
  });

  it("rejects any order once the limit is used up", () => {
    expect(checkDailyLimit(800, 1).ok).toBe(false);
    expect(remainingToday(950)).toBe(0);
  });

  it("rejects a single order above $8 even with nothing spent", () => {
    expect(checkDailyLimit(0, 801).ok).toBe(false);
  });

  it("rejects non-integer money", () => {
    expect(() => checkDailyLimit(0, 4.5)).toThrow();
  });

  it("counts only the local calendar day, not the last 24 hours", () => {
    const orders = [
      // 11:30pm Nov 3 in New York (04:30Z Nov 4) — yesterday
      { totalCents: 700, createdAt: "2026-11-04T04:30:00Z", status: "picked_up" },
      // 7:00am Nov 4 in New York
      { totalCents: 450, createdAt: "2026-11-04T12:00:00Z", status: "ready" },
    ];
    const now = new Date("2026-11-04T15:00:00Z"); // 10am Nov 4 New York
    expect(spentToday(orders, now, TZ)).toBe(450);
  });

  it("resets at local midnight even though UTC hasn't rolled over", () => {
    const orders = [{ totalCents: 800, createdAt: "2026-07-01T03:00:00Z", status: "picked_up" }]; // 11pm Jun 30 EDT
    const justAfterMidnight = new Date("2026-07-01T04:05:00Z"); // 12:05am Jul 1 EDT
    expect(spentToday(orders, justAfterMidnight, TZ)).toBe(0);
  });

  it("does not count cancelled (refunded) orders", () => {
    const now = new Date("2026-11-04T15:00:00Z");
    const orders = [
      { totalCents: 600, createdAt: "2026-11-04T13:00:00Z", status: "cancelled" },
      { totalCents: 200, createdAt: "2026-11-04T13:30:00Z", status: "received" },
    ];
    expect(spentToday(orders, now, TZ)).toBe(200);
  });

  it("handles the DST fall-back day (25 hours long)", () => {
    // Nov 1 2026 is the US fall-back day.
    const orders = [
      { totalCents: 300, createdAt: "2026-11-01T04:30:00Z", status: "picked_up" }, // 12:30am EDT Nov 1
      { totalCents: 300, createdAt: "2026-11-02T04:30:00Z", status: "picked_up" }, // 11:30pm EST Nov 1
    ];
    expect(spentToday(orders, new Date("2026-11-01T20:00:00Z"), TZ)).toBe(600);
  });
});
