// Allergy notes → red ALLERGY NOTICE for the shop; "start at" times; no-show flag (after 30 min)
// nudges the member and Sippy Brew and still pays the shop; merchant FAQ; menu from a photo;
// price changes show "price updated" to members.
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

  // Member orders with an allergy and a note.
  await tap('[data-a="pick-tier"][data-id="macchiato_double_shot"]');
  await tap('form[data-form="signup"] button[type="submit"]');
  await tap('[data-a="checkout"]'); await tap('[data-a="pay"]');
  await tap('.shop-card[data-id="main"]');
  await tap('[data-a="add-plain"]');
  await tap('[data-a="view-cart"]');
  if (!(await txt()).includes("Any allergies? Tell the shop here")) fail("allergy prompt missing");
  await p.fill("#o-allergy", "tree nuts");
  await p.fill("#o-note", "extra hot");
  await tap('[data-a="place"]');
  await tap('[data-a="back"]');
  await tap('[data-a="tab"][data-id="account"]'); await tap('[data-a="sign-out"]');

  // Shop sees the allergy notice, the note and when to start.
  await tap('[data-a="shop-login"]');
  await p.selectOption("#s-shop", "main");
  await tap('form[data-form="shop-login"] button[type="submit"]');
  const q = await txt();
  if (!(await p.locator(".allergy-notice", { hasText: "tree nuts" }).isVisible())) fail("ALLERGY NOTICE missing");
  if (!q.includes("Note: extra hot")) fail("order note missing");
  if (!q.includes("Start at")) fail("start-at time missing");
  if (!q.includes("Make Sippy Brew orders close to pickup")) fail("prep guidance missing");
  if (await p.locator('[data-a="no-show"]').count()) fail("no-show should wait until 30 min after pickup");

  // Cancel is only possible before the shop marks it preparing.
  if (!(await p.locator('[data-a="cancel"]').count())) fail("received order should be cancellable");
  await tap('[data-a="advance"]');
  if (await p.locator('[data-a="cancel"]').count()) fail("preparing order must not be cancellable");
  if (!(await txt()).includes("Can't be cancelled once you've started preparing it")) fail("no-cancel hint missing");

  // 45 minutes later: flag the no-show.
  await tap('[data-a="skip-ahead"]');
  await tap('[data-a="no-show"]');
  if (!(await txt()).includes("It isn't refunded")) fail("no-show confirmation missing");
  await tap('[data-a="no-show-yes"]');
  if ((await txt()).includes("tree nuts")) fail("no-show order should leave the queue");
  await tap('[data-a="shop-tab"][data-id="dashboard"]');
  if (!(await txt()).includes("Pass sales (1 order)")) fail("no-show should be paid to the shop");

  // Merchant FAQ.
  await tap('[data-a="shop-tab"][data-id="faq"]');
  const priceQ = p.locator("details.faq", { hasText: "Can I change my prices?" });
  await priceQ.locator("summary").click();
  if (!(await p.locator("details.faq p", { hasText: "you must update your Sippy Brew menu right away" }).isVisible())) fail("merchant pricing FAQ missing");

  // Menu from a photo, then a price change.
  await tap('[data-a="shop-tab"][data-id="menu"]');
  await p.setInputFiles("#menu-photo", { name: "menu.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) });
  await p.waitForTimeout(1600);
  const scan = await txt();
  if ((await p.locator(".scan-row").count()) !== 4) fail("expected 4 scanned coffee items");
  if (!scan.includes("Almond Croissant (food can't be sold through sippy brew)")) fail("food should be left out");
  await tap('[data-a="scan-add"]');
  if (!(await txt()).includes("Honey Oat Latte")) fail("scanned items not added");
  const latteForm = p.locator('form[data-form="price"][data-id="latte"]');
  await latteForm.locator("input").fill("5.75");
  await latteForm.locator("button").click(); await p.waitForTimeout(120);
  await tap('[data-a="sign-out"]');

  // Sippy Brew sees the no-show.
  await tap('[data-a="login"]');
  await p.fill("#f-email", "admin@sippybrew.com"); await p.fill("#f-pass", "sippy-admin");
  await tap('form[data-form="signup"] button[type="submit"]');
  if (!(await txt()).includes("marked Dana's order as not picked up")) fail("admin no-show alert missing");
  await tap('[data-a="sign-out"]');

  // Member gets the nudge and sees the new price.
  await tap('[data-a="login"]');
  await tap('form[data-form="signup"] button[type="submit"]');
  if (!(await txt()).includes("Missed your coffee?")) fail("member no-show nudge missing");
  await tap('.shop-card[data-id="main"]');
  const menu = await txt();
  if (!menu.includes("$5.75") || !menu.includes("Price updated")) fail("member should see the updated price");

  if (errors.length) fail(errors.join("; "));
  if (!process.exitCode) console.log("merchant: ok");
  await b.close();
})();
