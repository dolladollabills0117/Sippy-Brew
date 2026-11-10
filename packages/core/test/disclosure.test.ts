import { describe, expect, it } from "vitest";
import { CONSENT_LABEL, confirmationEmail, getTier, purchaseSummary, SITE } from "../src";

describe("Pre-purchase summary and confirmation email", () => {
  const plan = getTier("macchiato_double_shot");
  it("states price, renewal, expiry, refunds and cancellation before payment", () => {
    const s = purchaseSummary(plan).lines.join(" ");
    expect(purchaseSummary(plan).title).toBe("Regular · Specialty: $96 a month");
    expect(s).toContain("charged $96 today, and again every month");
    expect(s).toContain("expire at the end of each month");
    expect(s).toContain("aren't refunded");
    expect(s).toContain("Cancel any time");
    expect(CONSENT_LABEL).toContain("renews monthly until I cancel");
  });
  it("confirmation email repeats the terms and says how to cancel", () => {
    const e = confirmationEmail({ name: "Dana", plan, renewsOn: new Date("2026-12-10T15:00:00Z"), accountUrl: "https://x/account", termsUrl: "https://x/terms" });
    expect(e.subject).toBe("You're in: Regular · Specialty is active");
    expect(e.text).toContain("Next charge: December 10, 2026");
    expect(e.text).toContain("How to cancel");
    expect(e.text).toContain(SITE.supportEmail);
    expect(SITE.supportEmail).toBe("support@sippybrew.com");
  });
});
