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
  const shot = async (n, full) => { await p.screenshot({ path: `${require("os").tmpdir()}/x-${n}.png`, fullPage: !!full }); };
  const tap = async (sel) => { await p.click(sel); await p.waitForTimeout(120); };
  const txt = async () => p.textContent('#app');
  const out = {};

  await tap('[data-a="pick-sub"][data-id="decaf"]');
  await tap('[data-a="pick-tier"][data-id="affogato_decaf"]');
  await tap('form[data-form="signup"] button[type="submit"]');
  await tap('[data-a="checkout"]'); { if (await p.locator("#agree").count()) await p.check("#agree"); } await tap('[data-a="pay"]');

  // Day 1: customized latte.
  await tap('[data-a="open-shop"][data-id="main"]');
  await tap('[data-a="open-customize"][data-id="latte"]');
  await tap('[data-a="pick-opt"][data-id="oat"]');
  await tap('[data-a="pick-opt"][data-id="extra-shot"]');
  await shot('1-customize');
  out.sheetButton = await p.textContent('[data-a="add-custom"]');
  await tap('[data-a="add-custom"]');
  await tap('[data-a="view-cart"]');
  await p.waitForTimeout(200);
  out.cartText = (await p.textContent('.card.stack')) || '';
  out.overageLine = await p.textContent('.confirm b').catch(() => null);
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot('2-order-with-options');
  await tap('#ov'); await tap('[data-a="place"]');
  out.qrShowsOptions = (await txt()).includes('Oat milk, Extra shot');
  await tap('[data-a="back"]');

  // Day 2: another overage → nudge (3 passes left).
  await tap('[data-a="tab"][data-id="account"]'); await tap('[data-a="new-day"]');
  await tap('[data-a="tab"][data-id="shops"]');
  await tap('[data-a="open-shop"][data-id="main"]');
  await tap('[data-a="add-plain"]').catch(() => {});
  await tap('[data-a="open-customize"][data-id="latte"]'); await tap('[data-a="add-custom"]'); await tap('[data-a="view-cart"]');
  await tap('#ov'); await tap('[data-a="place"]'); await tap('[data-a="back"]');
  await tap('[data-a="tab"][data-id="shops"]');
  out.nudgeWith3Left = (await txt()).includes('in overages this month');
  // Day 3: third order → 2 left → hidden.
  await tap('[data-a="tab"][data-id="account"]'); await tap('[data-a="new-day"]');
  await tap('[data-a="tab"][data-id="shops"]');
  await tap('[data-a="open-shop"][data-id="main"]');
  await tap('[data-a="open-customize"][data-id="latte"]'); await tap('[data-a="add-custom"]'); await tap('[data-a="view-cart"]');
  out.tipWith3Left = (await txt()).includes('Tip: on');
  await tap('#ov'); await tap('[data-a="place"]'); await tap('[data-a="back"]');
  await tap('[data-a="tab"][data-id="shops"]');
  out.nudgeWith2Left = (await txt()).includes('in overages this month');
  await tap('[data-a="tab"][data-id="account"]');
  out.accountUpgradeWith2Left = (await txt()).includes('Move up to') || (await txt()).includes('Upgrade to');
  await tap('[data-a="sign-out"]');

  // Merchant: sees options, edits customizations.
  await tap('[data-a="shop-login"]');
  await p.selectOption('#s-shop', 'main');
  await tap('form[data-form="shop-login"] button[type="submit"]');
  out.queueShowsOptions = (await txt()).includes('Oat milk, Extra shot');
  await shot('3-queue');
  await tap('[data-a="shop-tab"][data-id="menu"]');
  await tap('[data-a="edit-mods"][data-id="latte"]');
  await p.fill('input[name="new-name"]', 'Chocolate chip cookie'); await p.fill('input[name="new-price"]', '2.00');
  await tap('form[data-form="mods"] button[type="submit"]');
  out.cookieRefused = await p.textContent('.alert').catch(() => null);
  await p.fill('input[name="new-name"]', 'Brown sugar syrup'); await p.fill('input[name="new-price"]', '0.60');
  await p.selectOption('select[name="new-group"]', '2');
  await tap('form[data-form="mods"] button[type="submit"]');
  out.menuShowsNewOption = (await txt()).includes('Brown sugar syrup +$0.60');
  await shot('4-menu-mods', true);
  await tap('[data-a="sign-out"]');
  await tap('[data-a="login"]'); await tap('form[data-form="signup"] button[type="submit"]');
  await tap('[data-a="open-shop"][data-id="main"]');
  await tap('[data-a="open-customize"][data-id="latte"]');
  out.memberSeesNewOption = (await txt()).includes('Brown sugar syrup');
  out.errors = errors;
  out.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
