# Open decisions for the owner

These need a business or legal decision. The code has a working default for each, noted below.

## Legal

1. **New Jersey stored-value and gift-card rules.** Prepaid passes that expire monthly could be treated as stored value or gift cards under N.J.S.A. 56:8-110 (gift card expiration and fee limits) and the state's unclaimed-property rules. A lawyer should confirm that a subscription with use-it-or-lose-it passes is outside those rules, and how the terms should describe it. *Default:* passes expire at each renewal, with no cash value.
2. **Auto-renewal disclosures.** NJ and other states require clear auto-renew terms and easy cancellation. *Default:* cancellation runs through the Stripe customer portal, and a reminder push goes out 3 days before renewal. Members don't get a renewal reminder email yet.
3. **Sales tax on drinks.** Decide who collects and remits sales tax on prepared beverages: the shop (as the seller) or Sippy Brew (as the marketplace facilitator). This decides whether prices include tax and how payouts are reported. *Default:* menu prices are treated as tax-inclusive and no tax is calculated.
4. **Shop onboarding terms.** The shop agreement should cover the 12% commission, weekly payout timing, chargebacks, menu accuracy, the coffee-only rule, no-shows, and how a shop leaves the platform. *Default:* none. Shops are approved manually in the admin view.

## Pricing and product

5. **Final tier prices.** Casual Brew $30 / 5 passes / $6.00, Routine $60 / 8 / $7.50, Daily Ritual $100 / 12 / $8.33. When every pass is used at the max, platform revenue is $3.60, $7.20 and $12.04 per member-month, before Stripe fees (about 2.9% + 30¢ on the subscription, which comes to $1.17, $2.04 and $3.20). Margins depend on unused passes. Change them in `packages/core/config/tiers.json`.
6. **No-shows.** A pass is only used when a drink is redeemed, so a daily job cancels unclaimed orders from previous days and returns the pass. That means a shop may have made a drink it isn't paid for. Options: keep this, charge the pass after a grace period, or pay shops for unclaimed orders.
7. **When a pass is reserved.** Placing an order reserves that day's pass, so a member can't order at a second shop the same day. Cancelling (by the shop, or by the no-show job) releases it. Decide whether members can cancel their own order before the shop starts it. Not built yet.
8. **Small upgrades.** Stripe can't charge less than $0.50, so upgrades under that are waived. The shop is still paid in full and the platform absorbs the cost. Alternatives: round up to $0.50, or block small upgrades. Set in `rules.json` → `minUpgradeChargeCents`.
9. **Mid-period plan changes.** Upgrades and downgrades take effect at the next renewal (Stripe portal setting). Decide whether an upgrade should add passes right away.
10. **Time zone.** "Calendar day" uses one platform time zone (America/New_York). Expanding beyond one time zone means switching to per-shop or per-member time zones.
11. **Failed renewal payments.** A past-due subscription can't place orders, and the admin view lists failed payments. Decide on a grace period, if any.
12. **Payout timing and minimums.** Payouts are weekly, on Monday, for the previous Monday to Sunday, with no minimum. Shops without a finished Stripe account get a "failed" payout row that needs a manual re-run once they connect.

## Before launch

13. Replace the placeholder app icons and splash screens.
14. Choose an email provider and domain. The code supports Resend; without it, emails go to the server log.
15. Get a Google Maps API key for Android (iOS uses Apple Maps).
