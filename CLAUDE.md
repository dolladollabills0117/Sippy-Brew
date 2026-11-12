# Sippy Brew: notes for Claude

Read this first in every session. It carries decisions and preferences from earlier chats.

## How to work with the owner
- Plain, direct language. No jargon; explain business/legal terms simply. Be honest about money and odds (they asked "be honest" more than once).
- When they say "brainstorm first" or "list them before you edit", list options and wait. Otherwise just build it.
- They test the demo on their phone. Every user-facing change goes in the **demo too**, not only the web/apps.
- After demo changes: run `pnpm demo:build`, then republish the demo artifact at
  https://claude.ai/artifact/BVahGmpddoJLVra5SK2wDn (always that URL, file `demo/dist/sippy-brew-demo.html`).
  An extra private artifact (QJonzmvbNFVitM4En3FCQA) exists; leave it alone.
- Git: develop on the session's `claude/...` branch and push the same commits to `main` too. No PRs unless asked.
- Never call the AI model by name in commits or code.
- They also run a separate business, Coveredly (the GitHub Pages setup there is the model for this one).

## The product
Two-sided coffee membership. Members pay monthly for a daily pass usable at any participating shop; shops get paid per drink.
- **Passes:** House ($4/drink) and Specialty ($8/drink), each as Visitor (5 passes), Regular (12) or Local (20) a month.
  Internal tier IDs never changed: affogato / macchiato / double_espresso and decaf / double_shot.
- **Overage:** if the order costs more than the pass covers, the member pays the difference in the app.
- **Plan changes:** any time, effective next month. "Get matched" quiz picks a pass (cheeky result like "You're a Local!"), then a map with up to a 15-mile radius.
- **Rewards:** Neighborhood Passport (5 different shops = 1 free day pass); Grand Tour (every shop live 30+ days = 2 months free, only once 50+ shops are live); referrals (every 2 paying friends = 3 bonus passes). Bonus passes last 365 days and can optionally cover an overage.
- **Commission:** founding shops 12% of pass value, everyone else 15%; 5% on overages for all shops. Shops also pay card processing on overages. Paid weekly every Monday through Stripe. Rates live in `packages/core/config/rules.json`.
- **No food, ever.** Drinks only. Strict food word list; customizations must say syrup/topping/etc. Shops caught selling food are removed, with one appeal for genuine error (not misrepresentation).
- **Orders:** members can cancel only before the shop marks it preparing. Shops can flag a no-show 30 min after pickup: no refund, shop still paid. "Start at" shows 5 min before pickup with a breathing light. Big red ALLERGY NOTICE for allergy notes.
- **Legal posture:** Sippy Brew doesn't make the coffee and has no contract over it; problems with a drink go to the shop. Required "I agree" checkbox, pre-purchase summary, confirmation email. Support email: support@sippybrew.com.
- **Admin demo login:** admin@sippybrew.com / sippy-admin (or `#admin` on the demo link).

## Brand
Colors: Espresso, Pecan, Burnt Sugar #A8642F (the "light brown" they like), Honey, Latte, Vanilla Bean, Cream Swirl, Sky Blue accent, danger #9B2C2C (deductions), success #2F6B3A (overages). Payout breakdowns always read: pass sales, overages (green), deductions (red), net.
The SB logo is tappable to go home everywhere. Cart is a plain Burnt Sugar line icon, no circle.

## Code map
- `packages/core`: all business rules + config JSON + vitest tests (`cd packages/core && npx vitest run`).
- `apps/web`: Next.js site, member/shop/admin portals, API routes. `apps/consumer` and `apps/shop`: Expo phone apps. `packages/mobile-ui`: shared phone UI.
- `supabase/migrations`: Postgres schema; check with `su postgres -s /bin/bash -c "cd /tmp && bash /home/user/Sippy-Brew/scripts/check-schema.sh"`.
- `demo/`: single-file tappable demo (`demo/src/app.js`), tests in `demo/tests/*.cjs` (`pnpm demo:test`). The build also writes `docs/` and root `index.html` for GitHub Pages; CI checks they're up to date.
- Before pushing: core tests, `pnpm -r typecheck`, demo tests, `cd apps/web && npx next build`, and an Expo export for changed apps.

## Not done yet (launch gaps they know about)
Account deletion, privacy policy, error monitoring, refund/support tooling, editing placed orders, a Toast (or other POS) integration, and a lawyer/CPA review (sales tax, marketplace facilitator question). Nothing has been tested against real Supabase, Stripe or devices yet.

## Selling to shops
Pitch Sippy Brew as a new-customer channel that sits beside their POS and rewards program (e.g. Toast), not a replacement. Be honest that orders come in on a separate screen today. Lead with the founding rate (keep 88%, locked in), no hardware, no contract, pause any time, no-shows still paid.
