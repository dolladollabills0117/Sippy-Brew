import { RULES, SITE, type Tier } from "./config";

/**
 * What a member is told, and agrees to, before paying for a pass, and the confirmation email
 * that follows. Shared by the website, the member app and the demo so the wording always
 * matches. Draft copy for legal review (docs/OPEN_DECISIONS.md).
 */

/** Bump when the Terms or these disclosures change in a way members must agree to again. */
export const TERMS_VERSION = "2026-11-10";

const dollars = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: RULES.timeZone });

/** The pre-purchase summary: price, renewal, expiry and cancellation, in plain words. */
export function purchaseSummary(plan: Tier): { title: string; lines: string[] } {
  return {
    title: `${plan.name}: ${dollars(plan.priceCents)} a month`,
    lines: [
      `You'll be charged ${dollars(plan.priceCents)} today, and again every month on the same date until you cancel.`,
      `You get ${plan.passesPerMonth} Daily Passes a month, one per day, each covering up to ${dollars(plan.maxPassValueCents)} of that day's order. Anything over that is an overage you confirm and pay at checkout.`,
      "Unused passes expire at the end of each month and don't roll over. Payments aren't refunded for unused passes or partial months, except where the law requires it.",
      "Cancel any time in your account. Your passes keep working until the end of the month you've paid for, and you won't be charged again.",
      `Plan changes start with your next month. Questions? Email ${SITE.supportEmail}.`,
    ],
  };
}

/** Label for the required checkbox. */
export const CONSENT_LABEL =
  "I agree to the Terms of Service and understand this pass renews monthly until I cancel, and unused passes expire each month.";

/** The confirmation email sent after the first payment. */
export function confirmationEmail(params: { name: string; plan: Tier; renewsOn: Date; accountUrl: string; termsUrl: string }): { subject: string; text: string } {
  const p = params.plan;
  return {
    subject: `You're in: ${p.name} is active`,
    text: [
      `Hi ${params.name || "there"},`,
      "",
      `Welcome to Sippy Brew. Your ${p.name} pass is active.`,
      "",
      "Your membership",
      `- Price: ${dollars(p.priceCents)} a month, charged on the same date each month until you cancel. Next charge: ${dateFmt.format(params.renewsOn)}.`,
      `- Passes: ${p.passesPerMonth} Daily Passes a month, one per day, each covering up to ${dollars(p.maxPassValueCents)} of that day's order.`,
      "- Unused passes expire at the end of each month and don't roll over.",
      "- Payments aren't refunded for unused passes or partial months, except where the law requires it.",
      "",
      "How to cancel",
      `Go to your account (${params.accountUrl}) and choose "Billing and cancellation". You can cancel any time; your passes keep working until the end of the month you've paid for, and you won't be charged again.`,
      "",
      `Terms of Service: ${params.termsUrl}`,
      `Questions? Reply to this email or write to ${SITE.supportEmail}.`,
      "",
      "Enjoy your coffee,",
      "Sippy Brew",
    ].join("\n"),
  };
}
