// The logo in every top bar goes home: landing when signed out, Shops for members,
// the order queue for shops, the overview for admins.
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
  await p.waitForTimeout(800);
  const tap = async (sel) => { await p.click(sel); await p.waitForTimeout(100); };
  const logo = () => tap('[data-a="logo-home"]');
  const fail = (m) => { console.error("FAIL: " + m); process.exitCode = 1; };
  const isLanding = async () => (await p.textContent("#app")).includes("Your neighborhood, brewed daily.");

  // Signed out: shop log in → logo → landing; plans → logo → landing.
  await tap('[data-a="shop-login"]'); await logo();
  if (!(await isLanding())) fail("shop login logo did not go to landing");
  await tap('[data-a="get-pass"]').catch(() => {}); await logo();
  if (!(await isLanding())) fail("signup logo did not go to landing");
  if ((await p.locator('button[data-a="logo-home"]').count()) !== 1) fail("landing logo is not a button");

  // Member: open a shop, then logo → Shops tab with nothing open.
  await tap('[data-a="pick-sub"][data-id="decaf"]');
  await tap('[data-a="pick-tier"][data-id="affogato_decaf"]');
  await tap('form[data-form="signup"] button[type="submit"]');
  await tap('[data-a="checkout"]'); await tap('[data-a="pay"]');
  await tap('[data-a="tab"][data-id="account"]'); await logo();
  if ((await p.getAttribute('[data-a="tab"][data-id="shops"]', "aria-current")) !== "page") fail("member logo did not go to Shops");
  await tap('[data-a="open-shop"][data-id="main"]');
  await logo();
  if ((await p.getAttribute('[data-a="tab"][data-id="shops"]', "aria-current")) !== "page") fail("member logo from a shop did not go to Shops");
  await tap('[data-a="sign-out"]').catch(() => {});
  await tap('[data-a="tab"][data-id="account"]').catch(() => {});
  await tap('[data-a="sign-out"]').catch(() => {});

  // Shop: Menu tab → logo → Orders.
  await tap('[data-a="shop-login"]');
  await p.selectOption("#s-shop", "main");
  await tap('form[data-form="shop-login"] button[type="submit"]');
  await tap('[data-a="shop-tab"][data-id="menu"]'); await logo();
  if ((await p.getAttribute('[data-a="shop-tab"][data-id="orders"]', "aria-current")) !== "page") fail("shop logo did not go to Orders");

  if (errors.length) fail(errors.join("; "));
  if (!process.exitCode) console.log("logo-home: ok");
  await b.close();
})();
