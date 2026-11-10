// Demo end-to-end check. Run: pnpm demo:test (needs Playwright with Chromium).
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const dir = process.argv[2];
  const src = fs.readFileSync(`${dir}/sippy-brew-demo.html`, 'utf8');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${src}</body></html>`);
  await p.waitForTimeout(1200);
  const shot = async (n, full) => { await p.screenshot({ path: `${require("os").tmpdir()}/v-${n}.png`, fullPage: !!full }); };
  const tap = async (sel) => { await p.click(sel); await p.waitForTimeout(150); };
  const text = async () => (await p.textContent('#app')).toLowerCase();
  const out = {};

  out.landingMentionsAdmin = (await text()).includes('admin');

  // A shop lists itself: pending.
  await tap('[data-a="shop-signup"]');
  await p.check('#food-ok');
  await tap('form[data-form="shop-signup"] button[type="submit"]');
  out.shopSeesPending = (await text()).includes('waiting for approval');
  await tap('[data-a="sign-out"]');

  // Member: pending shop is hidden; no admin anywhere.
  await tap('[data-a="pick-tier"][data-id="macchiato_double_shot"]');
  await tap('form[data-form="signup"] button[type="submit"]');
  await tap('[data-a="checkout"]'); await tap('[data-a="pay"]');
  out.memberSeesPendingShop = (await text()).includes('corner cup');
  out.memberMentionsAdmin = (await text()).includes('admin');
  await tap('[data-a="tab"][data-id="account"]');
  out.memberAccountMentionsAdmin = (await text()).includes('admin');
  await tap('[data-a="sign-out"]');

  // Hidden admin door.
  await p.evaluate(() => { location.hash = '#admin'; });
  await p.waitForTimeout(300);
  out.adminLoginShown = (await p.textContent('h1')).trim();
  await p.fill('#ad-email', 'me@sippybrew.com'); await p.fill('#ad-pass', 'wrong');
  await tap('form[data-form="admin-login"] button[type="submit"]');
  out.wrongPassword = await p.textContent('.alert');
  await p.fill('#ad-email', 'me@sippybrew.com'); await p.fill('#ad-pass', 'sippy-admin');
  await tap('form[data-form="admin-login"] button[type="submit"]');
  await shot('1-overview', true);
  out.pendingBadge = await p.textContent('.tab .badge').catch(() => null);
  await tap('[data-a="admin-approve"]');
  await tap('[data-a="admin-tab"][data-id="shops"]');
  await tap('[data-a="admin-spotlight"][data-id="valley"]');
  await tap('[data-a="admin-pause"][data-id="eagle"]');
  await shot('2-shops', true);
  await tap('[data-a="admin-tab"][data-id="members"]');
  out.adminSeesMember = (await text()).includes('dana');
  await tap('[data-a="sign-out"]');

  // Member again: approved shop visible, spotlight first, paused shop hidden.
  await tap('[data-a="login"]');
  await tap('form[data-form="signup"] button[type="submit"]');
  const ids = await p.$$eval('[data-a="open-shop"]', (els) => els.map((e) => e.getAttribute('data-id')));
  out.memberShopOrder = ids;
  out.memberSeesApprovedShop = (await text()).includes('corner cup');
  out.spotlightFirst = ids[0] === 'valley';
  out.pausedHidden = !ids.includes('eagle');
  out.errors = errors;
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
