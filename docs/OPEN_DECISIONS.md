# Open decisions for the owner

These need a business or legal decision. The code has a working default for each, noted below.

## Legal

1. **New Jersey stored-value and gift-card rules.** Prepaid passes that expire monthly could be treated as stored value or gift cards under N.J.S.A. 56:8-110 (gift card expiration and fee limits) and the state's unclaimed-property rules. A lawyer should confirm that a subscription with use-it-or-lose-it passes is outside those rules, and how the terms should describe it. *Default:* passes expire at each renewal, with no cash value.
2. **Auto-renewal disclosures.** NJ and other states require clear auto-renew terms and easy cancellation. *Default:* cancellation runs through the Stripe customer portal, and a reminder push goes out 3 days before renewal. Members don't get a renewal reminder email yet.
3. **Sales tax on drinks and overages.** Decide who collects and remits sales tax on prepared beverages: the shop (as the seller) or Sippy Brew (as the marketplace facilitator). This decides whether prices include tax and how payouts are reported. *Default:* menu prices are treated as tax-inclusive and no tax is calculated.
4. **Shop onboarding terms.** The shop agreement should cover the 12% commission, weekly payout timing, chargebacks, menu accuracy, the coffee-only rule, no-shows, and how a shop leaves the platform. *Default:* none. Shops are approved manually in the admin view.

## Pricing and product

5. **Stripe fees on subscriptions.** Affogato $40 / 5 passes, Macchiato $96 / 12, Double Espresso $160 / 20, each $8.00 max. When every pass is used at $8.00 or more, the platform keeps $4.80, $11.52 and $19.20 per member-month, before Stripe's fee on the subscription itself (about 2.9% + 30¢: $1.46, $3.08 and $4.94). Decide whether that's acceptable or whether prices or commission should change (`packages/core/config/tiers.json`, `rules.json`).
6. **No-shows.** A pass is only used when a drink is redeemed, so a daily job cancels unclaimed orders from previous days and returns the pass. That means a shop may have made a drink it isn't paid for. Options: keep this, charge the pass after a grace period, or pay shops for unclaimed orders.
7. **When a pass is reserved.** Placing an order reserves that day's pass, so a member can't order at a second shop the same day. Cancelling (by the shop, or by the no-show job) releases it. Decide whether members can cancel their own order before the shop starts it. Not built yet.
8. **Small overages.** Stripe can't charge less than $0.50, so overages under that are waived for the member. The shop is still paid the overage in full (no processing fee), so the platform absorbs those few cents. Alternatives: block small overages, or don't pay shops for them. Set in `rules.json` → `minOverageChargeCents`.
8a. **Card processing on overages.** The shop pays it. A fixed 30¢ is a large share of a small overage (34¢ of a $1.50 overage). Decide whether to absorb part of it, or batch overages. The estimate is in `rules.json`; payouts use Stripe's actual fee when available.
9. **Mid-period plan changes.** Plan changes take effect at the next renewal (Stripe portal setting). Decide whether moving to a bigger plan should add passes right away.
10. **Time zone.** "Calendar day" uses one platform time zone (America/New_York). Expanding beyond one time zone means switching to per-shop or per-member time zones.
11. **Failed renewal payments.** A past-due subscription can't place orders, and the admin view lists failed payments. Decide on a grace period, if any.
12. **Payout timing and minimums.** Payouts are weekly, on Monday, for the previous Monday to Sunday, with no minimum. Shops without a finished Stripe account get a "failed" payout row that needs a manual re-run once they connect.

## Before launch

13. Check the generated app icons and splash screens against store guidelines.
14. Choose an email provider and domain. The code supports Resend; without it, emails go to the server log.
15. Get a Google Maps API key for Android (iOS uses Apple Maps).
