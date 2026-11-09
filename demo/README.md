# Sippy Brew tappable demo

A single-page, clickable demo of the whole product that you can open on a phone. It runs on
sample data stored in the viewer's browser, with no database and no real payments.

- **Members:** pick a pass (tier and Decaf / Double Shot sub-tier), browse shops, customize drinks,
  confirm overages, show the 30-second pickup QR, and get nudged to upgrade.
- **Shops** ("Shop log in" or "List your shop" on the home screen): list a shop, accept or pause
  orders, run the live queue, scan or type codes to redeem, manage the menu and drink
  customizations, and see the dashboard and weekly payout breakdown.
- **Admin** (hidden): open the page with `#admin` at the end of the address. The demo password is
  `sippy-admin`. Approve, pause and spotlight shops, and see members and totals.

The business rules are not re-implemented here. `pnpm demo:build` bundles `packages/core`
(passes, overage, commission, QR expiry, customizations, upgrades) straight into the page, so
the demo always behaves like the app.

## Files

| Path | What it is |
| --- | --- |
| `src/app.js` | The demo's screens and interactions (plain JavaScript, no framework) |
| `src/app.css` | Demo styles, using the brand tokens |
| `build.ts` | Bundles `packages/core` and the two files above into one page |
| `dist/index.html` | The built page for GitHub Pages and other hosts, with share-preview tags |
| `dist/sippy-brew-demo.html` | The same demo as page content only, for the claude.ai link |
| `tests/*.cjs` | End-to-end checks: admin approvals, sub-tier upgrade, customizations |

## Commands

```bash
pnpm demo:build   # rebuild dist/sippy-brew-demo.html after changing demo/src or packages/core
pnpm demo:test    # run the end-to-end checks (needs Playwright with Chromium installed)
```

## Hosting

**Live at https://dolladollabills0117.github.io/Sippy-Brew/** (GitHub Pages).

`pnpm demo:build` writes the site into `docs/` (`index.html`, the share card and `.nojekyll`),
and GitHub Pages serves that folder from `main`. `index.html` has share-preview tags, so links
pasted into LinkedIn, Slack or iMessage show `docs/marketing/sippy-brew-card.png`.

Any Pages setting works (Settings → Pages → Build and deployment → Source):

- **GitHub Actions** (recommended): `.github/workflows/pages.yml` deploys `docs/` on every
  push to `main`.
- **Deploy from a branch → `main` → `/docs`** or **`/ (root)`**: the build also writes
  `index.html`, the card and `.nojekyll` to the repo root, so either folder has a homepage.

CI fails if these copies are out of date with the build.

The built files are self-contained apart from Google Fonts, so any static host works too. What a viewer does is saved
only in their own browser. "Reset the demo" on the Account tab starts over.
