# Sippy Brew

A monthly coffee membership for independent coffee shops. Members buy a plan with a set number of **Daily Passes**, use one pass a day at any participating shop by ordering ahead for pickup, and show a QR code at the counter. Shops manage their menu, accept orders, scan redemptions, and get weekly payouts.

One backend (Supabase + Stripe), one brand system, three clients:

| App | Where | What |
| --- | --- | --- |
| `apps/web` | Next.js (App Router) | Full member and shop portals, onboarding, payouts, reporting, admin, and the HTTP API every client uses |
| `apps/consumer` | Expo (iOS + Android) | Shops map/list, order for pickup, full-brightness pickup QR, account |
| `apps/shop` | Expo (iOS + Android) | Live order queue, QR scanner, menu availability toggles, daily dashboard |

```
packages/core        Business rules, tier config, brand tokens, shared types, typed API client (+ tests)
packages/mobile-ui   React Native components, fonts, session and push setup shared by both Expo apps
apps/web             Next.js web app + API (app/api/*)
apps/consumer        Expo member app
apps/shop            Expo shop app
supabase/migrations  Postgres schema, atomic write functions, RLS
scripts/seed.ts      Demo data
scripts/check-schema.sh  Applies the migrations to a throwaway Postgres and tests the DB-level rules
docs/OPEN_DECISIONS.md   Decisions the owner still needs to make
```

## Membership rules

Tiers live in [`packages/core/config/tiers.json`](packages/core/config/tiers.json):

| Tier | Price | Daily Passes / month | Max value per day |
| --- | --- | --- | --- |
| Casual Brew | $30 | 5 | $6.00 |
| Routine (highlighted) | $60 | 8 | $7.50 |
| Daily Ritual | $100 | 12 | $8.33 |

- Coffee only. Menus can't contain food categories, and food-sounding names are rejected.
- One pass per member per calendar day (America/New_York), at one shop.
- A pass covers that day's order up to the tier's max. Anything above it is an **upgrade** the member pays in the app, at the shop's menu price. The upgrade is authorized on the member's card on file when they order, captured when the shop scans the QR, and released if the order is cancelled. Upgrades under $0.50 (Stripe's minimum card charge) are waived; the shop is still paid in full.
- Passes reset on the subscription renewal date. Unused passes expire. Nothing rolls over.
- Commission is 12% of each redeemed order's full value (pass-covered value plus upgrade). The shop gets 88%. The platform keeps the rest of the subscription, including the value of unused passes.
- Pickup QR codes expire after 30 seconds and can be redeemed once. The member's screen fetches a fresh code just before expiry.
- A pass is only used when a drink is redeemed. A daily job cancels orders from earlier days that were never picked up and returns their passes.

### Where each rule is enforced

The rules are written once in `packages/core` and used by the web app, both mobile apps, and the API. Every write goes through the API, which re-runs the core checks, and the database checks again inside a transaction:

| Rule | packages/core | Database |
| --- | --- | --- |
| One pass per day, any shop | `checkPassAvailable` | `place_order` + unique index `orders_one_pass_per_day_idx` |
| Monthly pass allowance | `passBalance`, `checkPassAvailable` | `place_order` (per-member advisory lock) |
| Pass value vs. upgrade | `splitPassValue` | `place_order` checks `pass_value = least(total, max)` |
| No rollover | `planRenewal`, `passBalance` (period-scoped) | `pass_ledger.period_start`, one grant/expire per period |
| QR 30 s + single use | `issueQr`, `checkRedeemable` | `redeem_qr` (row lock) + unique index on redeemed orders |
| Commission 12% / 88% | `splitOrder`, `monthEconomics` | `orders.commission + net = total`, `create_payout` sum check |

## Setup

Requirements: Node 22+, pnpm 10, the [Supabase CLI](https://supabase.com/docs/guides/cli) (Docker), and a Stripe account in test mode.

```bash
pnpm install
cp .env.example apps/web/.env.local     # fill in the values below
supabase start                          # local Supabase; prints the URL, anon key and service-role key
supabase db reset                       # applies supabase/migrations
pnpm seed                               # demo shops, members, orders, a payout and posts
pnpm dev:web                            # http://localhost:3000
```

### Environment variables (`apps/web/.env.local`)

| Variable | Where it's used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server. The anon key is public by design; RLS protects data. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Bypasses RLS; never ship it to a client. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Server only. |
| `STRIPE_PRICE_CASUAL`, `STRIPE_PRICE_ROUTINE`, `STRIPE_PRICE_DAILY_RITUAL` | Stripe Price IDs for each tier (names come from `tiers.json` → `stripePriceEnv`). |
| `NEXT_PUBLIC_SITE_URL` | Used for email links and Stripe return URLs. |
| `CRON_SECRET` | Bearer token for `/api/cron/*`. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional. Without a key, emails are printed to the server log. |

### Demo accounts (after `pnpm seed`)

Password for all: `sippy-demo-123` (override with `DEMO_PASSWORD`).

| Role | Email |
| --- | --- |
| Member, Casual Brew | `casual@demo.sippybrew.test` |
| Member, Routine | `routine@demo.sippybrew.test` |
| Member, Daily Ritual (has an open order today) | `ritual@demo.sippybrew.test` |
| Shop: Mile Square Roasters | `owner.mile@demo.sippybrew.test` |
| Shop: Grove Street Grind | `owner.grove@demo.sippybrew.test` |
| Shop: Heights Coffee Co. | `owner.heights@demo.sippybrew.test` |
| Admin | `admin@demo.sippybrew.test` |

Seeded subscriptions use fake Stripe IDs, so upgrades and the billing portal need a real test-mode checkout. Sign up a new member and pay with Stripe's `4242 4242 4242 4242` test card.

### Stripe

1. Create one product with three monthly prices ($30, $60, $100) and put the IDs in the `STRIPE_PRICE_*` variables.
2. Enable the **Customer portal** (plan switching between the three prices, and cancellation). Members change or cancel plans there; a change takes effect at the next renewal.
3. Enable **Connect** with Express accounts. Shops onboard from `/shop/onboarding`.
4. Add a webhook endpoint at `https://<site>/api/stripe/webhook` for: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `account.updated`. Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

Card numbers never touch Sippy Brew. Subscriptions use Stripe Checkout (a browser session on mobile), plan changes use the Stripe portal, and upgrades charge the card saved during Checkout.

### Scheduled jobs

`apps/web/vercel.json` schedules these on Vercel. Elsewhere, call them with `Authorization: Bearer $CRON_SECRET`:

- `GET /api/cron/payouts`, weekly (Monday). Pays each shop for the previous Monday–Sunday: gross, 12% commission and net, transferred through Stripe Connect. Safe to re-run.
- `GET /api/cron/daily`, daily. Closes no-show orders from earlier days (returns the pass and releases the upgrade hold), and sends renewal reminders.

## Changing tier prices, passes or limits

Edit [`packages/core/config/tiers.json`](packages/core/config/tiers.json): `priceCents`, `passesPerMonth`, `maxPassValueCents`, `name`, `blurb`. Amounts are in cents. Then:

- **Price changes** also need a new Stripe Price (Stripe prices can't be edited). Point `STRIPE_PRICE_*` at the new ID. Existing subscribers stay on their old price until you migrate them in Stripe.
- **Pass count / max value** changes apply to each member from their next renewal. The current period's allowance is snapshotted on the subscription when it's granted.
- Platform-wide rules (commission, QR lifetime, time zone, minimum upgrade charge, pickup window, post limits) are in [`packages/core/config/rules.json`](packages/core/config/rules.json).

Run `pnpm test` afterwards. The economics tests pin the current numbers, so update them when you change prices on purpose.

## Mobile apps

Both apps use Expo Router, the shared `@sippy/core` rules and brand tokens, and `@sippy/mobile-ui`. Cherry Bomb One and Nunito load through `expo-font`, and text follows iOS Dynamic Type and Android font scaling.

```bash
cd apps/consumer   # or apps/shop
EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:3000 \
EXPO_PUBLIC_SUPABASE_URL=http://<your-LAN-IP>:54321 \
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key> \
pnpm start
```

The camera, maps, brightness and push notifications need a **development build** (`eas build --profile development`), not Expo Go.

### Builds, TestFlight and stores

1. `npm i -g eas-cli && eas login`, then `eas init` in each app folder. Set `EAS_PROJECT_ID` (used for push tokens).
2. Set build-time variables in EAS (`eas env:create`) for each environment: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and for the consumer app `GOOGLE_MAPS_ANDROID_API_KEY`. Only public values go to the apps. The Stripe secret key and the Supabase service-role key exist only on the web server and are never in an app bundle.
3. `pnpm build:preview` for internal testers, `pnpm build:production` for the stores.
4. `pnpm submit:ios` uploads to App Store Connect / TestFlight; `pnpm submit:android` to the Play Console internal track. Fill in `ascAppId`/`appleTeamId` in `eas.json` and add the Play service-account JSON (gitignored).
5. Test on a real iPhone and a real Android phone before release: QR scanning in bright and dim light, brightness boost on the pickup screen, push notifications, the largest text size, and TalkBack/VoiceOver.

Icons and splash images in `apps/*/assets` are generated placeholders. Replace them with final artwork before submission.

## Accessibility notes

`packages/core/test/misc.test.ts` checks the brand colors against WCAG AA:

- **Sky Blue on Espresso: 7.9:1.** Passes. Active tabs, badges and selected chips are Sky Blue fills with Espresso text or icons.
- **Burnt Sugar on Cream Swirl: 4.3:1.** Passes AA only for large text. Primary buttons use 19px extra-bold labels (large text). Small text and small buttons use a deeper **Burnt Sugar Ink** (`#8E5226`, 5.8:1).
- **Sky Blue focus rings are only 1.6:1 on light surfaces**, so focus rings pair Sky Blue with an Espresso outline.
- Caramel hover states use Espresso text (4.8:1). Form-field borders use Pecan so they meet the 3:1 non-text contrast rule.

Every list has loading and empty states. Pages are keyboard navigable, with labeled fields and a skip link. Touch targets are at least 48pt, and larger in the shop app.

## Tests and checks

```bash
pnpm test             # packages/core business-rule tests (vitest)
pnpm typecheck        # all packages and apps
pnpm build:web        # Next.js production build
bash scripts/check-schema.sh   # migrations + DB rule tests on a throwaway Postgres (run as a non-root user)
```

CI runs all four on every push (`.github/workflows/ci.yml`).

## Before public release

See [`docs/OPEN_DECISIONS.md`](docs/OPEN_DECISIONS.md) for owner decisions, plus this checklist:

- [ ] Apple Developer and Google Play Console accounts
- [ ] App Store and Play listings: screenshots, privacy policy URL, support email, data-safety forms
- [ ] Production Stripe and Supabase keys only in EAS environment variables and the web host's env, never committed
- [ ] Lawyer review of the pass/stored-value terms and the shop payout terms
