import { describe, expect, it } from "vitest";
import {
  canRefund,
  checkCreditCap,
  creditBalance,
  getTier,
  hasGrantForPeriod,
  planRenewal,
  validateLedgerEntry,
  type LedgerEntry,
} from "../src";

const periodStart = "2026-11-01T14:00:00.000Z";
const prevStart = "2026-10-01T14:00:00.000Z";

describe("monthly credit cap", () => {
  it("allows spending exactly the remaining credit", () => {
    expect(checkCreditCap(450, 450)).toEqual({ ok: true, remainingAfterCents: 0 });
  });

  it("rejects an order over the remaining credit", () => {
    const r = checkCreditCap(450, 451);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("CREDIT_CAP");
  });

  it("computes the balance from grants, spends and refunds in the period", () => {
    const entries: LedgerEntry[] = [
      { type: "grant", amountCents: 3000, periodStart },
      { type: "spend", amountCents: -550, periodStart },
      { type: "spend", amountCents: -400, periodStart },
      { type: "refund", amountCents: 400, periodStart },
    ];
    expect(creditBalance(entries, periodStart)).toBe(2450);
  });

  it("a Sip member can't spend past $30 in a month, even staying under $8 every day", () => {
    const tier = getTier("sip");
    const entries: LedgerEntry[] = [{ type: "grant", amountCents: tier.creditCents, periodStart }];
    for (let d = 0; d < 4; d++) entries.push({ type: "spend", amountCents: -750, periodStart }); // 4 × $7.50
    const balance = creditBalance(entries, periodStart);
    expect(balance).toBe(0);
    expect(checkCreditCap(balance, 100).ok).toBe(false);
  });

  it("enforces sign conventions on ledger entries", () => {
    expect(() => validateLedgerEntry({ type: "spend", amountCents: 500, periodStart })).toThrow();
    expect(() => validateLedgerEntry({ type: "grant", amountCents: -500, periodStart })).toThrow();
    expect(() => validateLedgerEntry({ type: "grant", amountCents: 0, periodStart })).toThrow();
    expect(() => validateLedgerEntry({ type: "expire", amountCents: -1, periodStart })).not.toThrow();
  });
});

describe("no rollover", () => {
  const prev: LedgerEntry[] = [
    { type: "grant", amountCents: 6000, periodStart: prevStart },
    { type: "spend", amountCents: -2200, periodStart: prevStart },
  ];

  it("expires unused credit and grants exactly the tier credit at renewal", () => {
    const entries = planRenewal({ previousEntries: prev, previousPeriodStart: prevStart, newPeriodStart: periodStart, tier: getTier("regular") });
    expect(entries).toEqual([
      { type: "expire", amountCents: -3800, periodStart: prevStart, note: expect.any(String) },
      { type: "grant", amountCents: 6000, periodStart, note: expect.any(String) },
    ]);
  });

  it("new balance equals the tier credit no matter how much was left over", () => {
    for (const spent of [0, 1000, 6000]) {
      const previous: LedgerEntry[] = [{ type: "grant", amountCents: 6000, periodStart: prevStart }];
      if (spent) previous.push({ type: "spend", amountCents: -spent, periodStart: prevStart });
      const renewal = planRenewal({ previousEntries: previous, previousPeriodStart: prevStart, newPeriodStart: periodStart, tier: getTier("regular") });
      const all: LedgerEntry[] = [...previous, ...renewal];
      expect(creditBalance(all, periodStart)).toBe(6000);
      expect(creditBalance(all, prevStart)).toBe(0); // the old period is closed out
      // Summing the whole ledger also gives exactly one month of credit.
      expect(all.reduce((s, e) => s + e.amountCents, 0)).toBe(6000);
    }
  });

  it("skips the expire entry when nothing is left", () => {
    const spentAll: LedgerEntry[] = [...prev, { type: "spend", amountCents: -3800, periodStart: prevStart }];
    const entries = planRenewal({ previousEntries: spentAll, previousPeriodStart: prevStart, newPeriodStart: periodStart, tier: getTier("regular") });
    expect(entries.map((e) => e.type)).toEqual(["grant"]);
  });

  it("the first period only grants", () => {
    expect(planRenewal({ previousEntries: [], previousPeriodStart: null, newPeriodStart: periodStart, tier: getTier("daily") })).toEqual([
      { type: "grant", amountCents: 10000, periodStart, note: expect.any(String) },
    ]);
  });

  it("ignores old-period entries even if an expire entry was never written", () => {
    const entries: LedgerEntry[] = [...prev, { type: "grant", amountCents: 6000, periodStart }];
    expect(creditBalance(entries, periodStart)).toBe(6000);
  });

  it("detects a duplicate grant (webhook retried)", () => {
    const entries: LedgerEntry[] = [...prev, { type: "grant", amountCents: 6000, periodStart }];
    expect(hasGrantForPeriod(entries, periodStart)).toBe(true);
    expect(hasGrantForPeriod(prev, periodStart)).toBe(false);
  });

  it("does not refund an order from an expired period", () => {
    expect(canRefund(prevStart, periodStart)).toBe(false);
    expect(canRefund(periodStart, periodStart)).toBe(true);
  });

  it("downgrading at renewal grants the new tier's credit", () => {
    const entries = planRenewal({ previousEntries: prev, previousPeriodStart: prevStart, newPeriodStart: periodStart, tier: getTier("sip") });
    expect(entries.at(-1)).toMatchObject({ type: "grant", amountCents: 3000 });
  });
});
