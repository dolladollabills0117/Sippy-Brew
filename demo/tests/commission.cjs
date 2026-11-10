// Founding shops 12% on pass value, everyone else 15%; 5% on overages for every shop.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
(async () => {
  const src = fs.readFileSync(path.join(__dirname, "../dist/sippy-brew-demo.html"), "utf8");
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>${src}</body></html>`);
  await p.waitForTimeout(500);
  const tap = async (sel, wait = 100) => { await p.click(sel); await p.waitForTimeout(wait); };
  const txt = () => p.textContent("#app");
  const fail = (m) => { console.error("FAIL: " + m); process.exitCode = 1; };

  await tap('[data-a="pick-tier"][data-id="macchiato_double_shot"]');
  await tap('form[data-form="signup"] button[type="submit"]');
  await tap('[data-a="checkout"]'); await p.check("#agree"); await tap('[data-a="pay"]');

  // Day 1: Montclair (standard shop): latte $5.00 + honey latte $6.25 = $11.25 → $8 pass + $3.25 overage.
  await tap('.shop-card[data-id="montclair"]');
  await tap('[data-a="open-customize"][data-id="mlatte"]'); await tap('[data-a="add-custom"]');
  await tap('[data-a="open-customize"][data-id="mhoney"]'); await tap('[data-a="add-custom"]');
  await tap('[data-a="view-cart"]'); await p.check("#ov"); await tap('[data-a="place"]');
  await tap('[data-a="back"]');
  await tap('[data-a="tab"][data-id="account"]'); await tap('[data-a="sign-out"]');

  await tap('[data-a="shop-login"]'); await p.selectOption("#s-shop", "montclair");
  await tap('form[data-form="shop-login"] button[type="submit"]');
  await tap('[data-a="shop-tab"][data-id="scan"]');
  await tap('[data-a="scan-phone"]');
  const scan = await txt();
  // $8.00 × 15% = $1.20; $3.25 × 5% = 16.25¢ → $0.16; processing 2.9% + 30¢ = 9¢ + 30¢ = $0.39.
  if (!scan.includes("15% commission") || !scan.includes("−$1.20")) fail("standard shop should pay 15%: " + scan.slice(0, 400));
  if (!scan.includes("5% fee on overage") || !scan.includes("−$0.16")) fail("5% overage fee missing");
  if (!scan.includes("$9.50")) fail("payout should be $6.80 + $3.25 − $0.16 − $0.39 = $9.50");
  await tap('[data-a="shop-tab"][data-id="dashboard"]');
  if (!(await txt()).includes("You keep 85% of pass value and 95% of overages")) fail("standard rate line missing");
  await tap('[data-a="sign-out"]');

  // A founding shop sees 12%.
  await tap('[data-a="shop-login"]'); await p.selectOption("#s-shop", "main");
  await tap('form[data-form="shop-login"] button[type="submit"]');
  await tap('[data-a="shop-tab"][data-id="dashboard"]');
  const dash = await txt();
  if (!dash.includes("Founding shop") || !dash.includes("You keep 88% of pass value")) fail("founding rate line missing");
  await tap('[data-a="sign-out"]');

  // Admin: "You keep" includes overage fees; founding can be toggled.
  await tap('[data-a="login"]'); await p.fill("#f-email", "admin@sippybrew.com"); await p.fill("#f-pass", "sippy-admin");
  await tap('form[data-form="signup"] button[type="submit"]');
  const keep = await p.locator(".stat", { hasText: "You keep" }).textContent();
  // $96 − $6.80 to shops − $3.08 card fees + $0.16 overage fees = $86.28
  if (!keep.includes("$86.28")) fail("You keep should be $86.28: " + keep);
  await tap('[data-a="admin-tab"][data-id="shops"]');
  await tap('[data-a="admin-founding"][data-id="montclair"]');
  if (!(await p.textContent('[data-a="admin-founding"][data-id="montclair"]')).includes("Founding (12%)")) fail("founding toggle failed");

  if (errors.length) fail(errors.join("; "));
  if (!process.exitCode) console.log("commission: ok");
  await b.close();
})();
