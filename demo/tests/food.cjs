// No food whatsoever: food items and unlabelled food add-ons are refused; labelled toppings and
// syrups are fine; sign-up needs the policy; admins can remove a shop for food; it can appeal.
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

  // Sign-up needs the food policy.
  await tap('[data-a="shop-signup"]');
  if (!(await txt()).includes("No food, whatsoever")) fail("food policy missing at sign-up");
  await tap('form[data-form="shop-signup"] button[type="submit"]');
  if (!(await txt()).includes("Please confirm you won't sell food")) fail("sign-up should need the food policy");
  await tap('[data-a="logo-home"]');

  // Existing shop: "Apples" is refused, a drink with fruit is fine.
  await tap('[data-a="shop-login"]');
  await p.selectOption("#s-shop", "main");
  await tap('form[data-form="shop-login"] button[type="submit"]');
  await tap('[data-a="shop-tab"][data-id="menu"]');
  const add = async (name) => {
    await p.fill("#a-name", name); await p.fill("#a-price", "4.00");
    await tap('form[data-form="menu-add"] button[type="submit"]');
  };
  await add("Apples");
  if (!(await txt()).includes("looks like food")) fail("Apples should be refused");
  await add("Dragonfruit Refresher");
  if (!(await txt()).includes("Dragonfruit Refresher")) fail("a fruit drink should be allowed");

  // Customizations must say what they are.
  await tap('[data-a="edit-mods"][data-id="latte"]');
  await p.fill('input[name="new-name"]', "Cookie"); await p.fill('input[name="new-price"]', "0.75");
  await tap('form[data-form="mods"] button[type="submit"]');
  if (!(await txt()).includes('like "Cookie syrup"')) fail("bare Cookie add-on should be refused with a hint");
  await p.fill('input[name="new-name"]', "Cookie syrup"); await p.fill('input[name="new-price"]', "0.75");
  await tap('form[data-form="mods"] button[type="submit"]');
  if (!(await txt()).includes("Cookie syrup +$0.75")) fail("Cookie syrup should be allowed");
  await tap('[data-a="sign-out"]');

  // Admin removes the shop for selling food.
  await tap('[data-a="login"]');
  await p.fill("#f-email", "admin@sippybrew.com"); await p.fill("#f-pass", "sippy-admin");
  await tap('form[data-form="signup"] button[type="submit"]');
  await tap('[data-a="admin-tab"][data-id="shops"]');
  await tap('[data-a="admin-remove-food"][data-id="eagle"]');
  if (!(await txt()).includes("Removed: food")) fail("shop should show as removed");
  await tap('[data-a="sign-out"]');

  // The shop sees it and appeals.
  await tap('[data-a="shop-login"]');
  await p.selectOption("#s-shop", "eagle");
  await tap('form[data-form="shop-login"] button[type="submit"]');
  if (!(await txt()).includes("Your shop was removed for selling food")) fail("removal banner missing");
  await p.fill("#appeal-note", "We listed dragonfruit as an add-on but meant the refresher topping. Renamed it.");
  await tap('form[data-form="appeal"] button[type="submit"]');
  if (!(await txt()).includes("We have your appeal")) fail("appeal not sent");
  await tap('[data-a="sign-out"]');

  // Admin sees the appeal and reinstates.
  await tap('[data-a="login"]');
  await p.fill("#f-email", "admin@sippybrew.com"); await p.fill("#f-pass", "sippy-admin");
  await tap('form[data-form="signup"] button[type="submit"]');
  await tap('[data-a="admin-tab"][data-id="shops"]');
  if (!(await txt()).includes("Appeal: We listed dragonfruit")) fail("admin should see the appeal");
  await tap('[data-a="admin-approve"][data-id="eagle"]');
  if ((await txt()).includes("Removed: food")) fail("reinstate should clear the removal");

  if (errors.length) fail(errors.join("; "));
  if (!process.exitCode) console.log("food: ok");
  await b.close();
})();
