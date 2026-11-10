# Open decisions for the owner

These need a business or legal decision. The code has a working default for each, noted below.

## Legal

1. **New Jersey stored-value and gift-card rules.** Prepaid passes that expire monthly could be treated as stored value or gift cards under N.J.S.A. 56:8-110 (gift card expiration and fee limits) and the state's unclaimed-property rules. A lawyer should confirm that a subscription with use-it-or-lose-it passes is outside those rules, and how the terms should describe it. *Default:* passes expire at each renewal, with no cash value.
2. **Auto-renewal disclosures.** NJ and other states require clear auto-renew terms and easy cancellation. *Default:* cancellation runs through the Stripe customer portal, and a reminder push goes out 3 days before renewal. Members don't get a renewal reminder email yet.
3. **Sales tax on drinks and overages.** Decide who collects and remits sales tax on prepared beverages: the shop (as the seller) or Sippy Brew (as the marketplace facilitator). This decides whether prices include tax and how payouts are reported. *Default:* menu prices are treated as tax-inclusive and no tax is calculated.
4. **Shop onboarding terms.** The shop agreement should cover the 12% commission, weekly payout timing, chargebacks, menu accuracy, the coffee-only rule, no-shows, and how a shop leaves the platform. *Default:* none. Shops are approved manually in the admin view.

## Pricing and product

5. **Stripe fees on subscriptions.** Plans run from $20 (Visitor · House) to $160 (Local · Specialty). When every pass is used up to its max, the platform keeps 12% of the price ($2.40 to $19.20 per member-month), before Stripe's fee on the subscription itself (about 2.9% + 30¢; $0.88 on a $20 plan, $4.94 on a $160 plan). On the House plans that fee takes a large share of the platform's cut. Decide whether that's acceptable or whether prices or commission should change (`packages/core/config/tiers.json`, `rules.json`).
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

- **Terms of Service and Privacy Policy.** `/terms` has a plain-language "Our role" section (`packages/core/src/legal.ts`): Sippy Brew isn't the coffee shop, shops are independent businesses, and order problems go to the shop. Have a lawyer review it and write the full Terms and a Privacy Policy before launch. Note: shops do sign a merchant agreement with Sippy Brew (payouts, commission), so the copy says shops are independent and not our agents or partners, rather than that there's no contract.
- **Stripe customer portal.** Plan switches now go through `POST /api/subscription/change` so they start next month. In the Stripe dashboard, turn off "Customers can switch plans" in the customer portal settings so the portal is only for cards, invoices and cancelling.
- **Grand Tour cost and "every shop".** Two free months cost the platform the full plan price for those months, while shops are still paid for every pass used (up to about $282 for a Local · Specialty member who uses every pass). "Every shop" currently means every shop that's been live for 30+ days when the member finishes, so new shops don't keep moving the finish line. Decide if that's right, or whether to limit it to shops within the member's area.
- **Referral fraud.** A friend counts only after their first month is paid, and members can't refer themselves. Consider also blocking the same card or address being used across referrals before running referral promotions at scale.
- **Shop loyalty programs.** Members can still collect a shop's own loyalty points on Sippy Brew orders (they give their number at pickup). Automatic points through Square, Toast or Clover loyalty APIs could come later.
- **No-show payout.** No-shows are paid to the shop like a pickup: 88% of the pass value, with Sippy Brew keeping its 12% commission. If you meant the shop should get 100% of the pass on a no-show, change `flagNoShow` in `apps/web/lib/shop.ts` to pass zero commission.
- **No-show timing.** Shops can flag an order 30 minutes after its pickup time (`noShowGraceMinutes` in `rules.json`). Members can't cancel orders themselves; they contact the shop.
- **Menu photo reading** uses the Claude API (`ANTHROPIC_API_KEY`, model `claude-opus-5-5` with server-side refusal fallback). Each photo costs a few cents. Shops always review items before they're saved.
- **Allergy wording.** The ALLERGY NOTICE and FAQ answers put allergen responsibility on the shop and ask members to tell the barista too. Have your lawyer review this along with the Terms.
- **Food policy wording.** The zero-tolerance removal and appeal policy (`FOOD_POLICY` in `packages/core/src/rules/food.ts`) is shown at shop sign-up, in the merchant FAQ and in the Terms. Put the same terms in the merchant agreement and have your lawyer review it. The food word list catches common foods; review menus during shop approval too, since no word list catches everything.

