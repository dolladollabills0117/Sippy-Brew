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
  const shot = async (n, full) => { await p.screenshot({ path: `${require("os").tmpdir()}/w-${n}.png`, fullPage: !!full }); };
  const tap = async (sel) => { await p.click(sel); await p.waitForTimeout(150); };
  const txt = async () => p.textContent('#app');
  const out = {};

  await tap('[data-a="pick-sub"][data-id="decaf"]');
  await shot('1-landing-decaf');
  out.landingPrices = (await p.$$eval('.tier .price', (e) => e.map((x) => x.textContent))).join(' ');
  out.decafCaption = (await txt()).includes('Your go-to cup');
  await tap('[data-a="pick-tier"][data-id="affogato_decaf"]');
  await tap('form[data-form="signup"] button[type="submit"]');
  out.plansSelected = await p.$eval('.tier.selected .name', (e) => e.textContent);
  await tap('[data-a="checkout"]'); await tap('[data-a="pay"]');

  const orderLatte = async () => {
    await tap('[data-a="tab"][data-id="shops"]');
    await tap('[data-a="open-shop"][data-id="main"]');
    await tap('[data-a="open-customize"][data-id="latte"]');
    await tap('[data-a="add-custom"]');
    await tap('[data-a="view-cart"]');
  };
  await orderLatte();
  out.tipShown = (await txt()).includes('Tip: on Visitor · Specialty');
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot('2-checkout-tip');
  await tap('#ov'); await tap('[data-a="place"]');
  await tap('[data-a="back"]');
  out.nudgeAfterOne = (await txt()).includes("in overages this month");
  await tap('[data-a="tab"][data-id="account"]'); await tap('[data-a="new-day"]');
  await orderLatte(); await tap('#ov'); await tap('[data-a="place"]'); await tap('[data-a="back"]');
  await tap('[data-a="tab"][data-id="shops"]');
  out.nudgeAfterTwo = (await txt()).includes("You've paid $2.50 in overages this month");
  await shot('3-nudge');
  await tap('[data-a="upgrade-start"]');
  out.confirmLabel = await p.textContent('[data-a="upgrade-confirm"]');
  await tap('[data-a="upgrade-confirm"]');
  await tap('[data-a="tab"][data-id="account"]');
  out.planAfter = await p.textContent('.card h2');
  await tap('[data-a="new-day"]');
  await orderLatte();
  out.latteOverageAfterUpgrade = await p.$('#ov') ? 'still overage' : 'covered';
  out.errors = errors;
  out.overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
