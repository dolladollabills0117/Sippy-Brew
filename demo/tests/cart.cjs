// The cart: kept when you leave the shop, editable (customizations, quantity, remove), "add
// more", one shop per cart. And the shop queue's breathing "Start at" light.
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
  await tap('[data-a="checkout"]'); { if (await p.locator("#agree").count()) await p.check("#agree"); } await tap('[data-a="pay"]');

  // Add a latte with oat milk, leave the shop, come back: still in the cart.
  await tap('.shop-card[data-id="main"]');
  await tap('[data-a="open-customize"][data-id="latte"]');
  await tap('[data-a="pick-opt"][data-id="oat"]');
  await tap('[data-a="add-custom"]');
  if (!(await txt()).includes("View cart · 1 item")) fail("cart bar missing");
  await tap('[data-a="back"]');
  if ((await p.textContent(".cart-count").catch(() => "")) !== "1") fail("cart count should show in the top bar");
  await tap('.shop-card[data-id="main"]');
  if (!(await txt()).includes("1 in cart")) fail("cart should be kept after leaving the shop");

  // Cart screen: edit the latte (almond milk, 2 of them).
  await tap('[data-a="view-cart"]');
  if (!(await txt()).includes("Your cart")) fail("cart screen missing");
  await tap('[data-a="edit-line"][data-id="0"]');
  if (!(await p.textContent('[data-a="add-custom"]')).includes("Save changes")) fail("edit should open the saved options");
  await tap('[data-a="pick-opt"][data-id="almond"]');
  await tap('[data-a="cqty"][data-d="1"]');
  await tap('[data-a="add-custom"]');
  const edited = await txt();
  if (!edited.includes("2× Latte") || !edited.includes("Almond milk") || edited.includes("Oat milk")) fail("line not updated: " + edited.slice(0, 300));

  // Forgot something: add more, then remove the extra.
  await tap('[data-a="open-shop"][data-id="main"]');
  await tap('[data-a="add-plain"][data-id="drip"]');
  await tap('[data-a="view-cart"]');
  if (!(await txt()).includes("1× House Drip")) fail("add more failed");
  await tap('[data-a="remove-line"][data-id="1"]');
  if ((await txt()).includes("House Drip")) fail("remove failed");

  // One shop per cart.
  await tap('[data-a="cart-back"]'); await tap('[data-a="back"]');
  await tap('.shop-card[data-id="eagle"]');
  if (!(await txt()).includes("Your cart has coffee from Main Street Roasters")) fail("other-shop notice missing");
  if (await p.locator('[data-a="add-plain"]').count()) fail("can't add from a second shop without starting a new cart");

  // Place the order from the cart.
  await tap('[data-a="view-cart"]');
  const ov = p.locator("#ov"); if (await ov.count()) await ov.click();
  await tap('[data-a="place"]');
  if (!(await txt()).includes("Show this at the counter")) fail("order not placed from cart");
  await tap('[data-a="back"]');
  if (await p.locator(".cart-count").count()) fail("cart should be empty after ordering");
  await tap('[data-a="tab"][data-id="account"]'); await tap('[data-a="sign-out"]');

  // Shop queue: the Start at light breathes when it's close.
  await tap('[data-a="shop-login"]'); await p.selectOption("#s-shop", "main");
  await tap('form[data-form="shop-login"] button[type="submit"]');
  const cls = await p.getAttribute(".start-at", "class");
  if (!/\b(soon|now|late)\b/.test(cls || "")) fail("start-at should glow near the start time: " + cls);
  const anim = await p.$eval(".start-at", (e) => getComputedStyle(e).animationName);
  if (!/breathe/.test(anim)) fail("start-at should breathe, got " + anim);
  await tap('[data-a="skip-ahead"]');
  if (!(await txt()).includes("Due now")) fail("after pickup time it should say Due now");

  if (errors.length) fail(errors.join("; "));
  if (!process.exitCode) console.log("cart: ok");
  await b.close();
})();
