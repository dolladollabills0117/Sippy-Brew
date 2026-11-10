// Checkout: pre-purchase summary + required "I agree"; confirmation email; Contact us; cart icon.
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
  await tap('[data-a="checkout"]');
  const sheet = await p.textContent(".sheet");
  for (const s of ["Regular · Specialty: $96 a month", "again every month", "expire at the end of each month", "aren't refunded", "Cancel any time", "I agree to the"]) {
    if (!sheet.includes(s)) fail("summary missing: " + s);
  }
  if (!(await p.isDisabled('[data-a="pay"]'))) fail("Pay must be disabled until the box is checked");
  await p.check("#agree"); await p.waitForTimeout(100);
  if (await p.isDisabled('[data-a="pay"]')) fail("Pay should enable after agreeing");
  await tap('[data-a="pay"]');

  // Confirmation email.
  await tap('[data-a="tab"][data-id="account"]');
  await p.click(".email-preview summary"); await p.waitForTimeout(100);
  const mail = await p.textContent(".email-preview");
  if (!mail.includes("How to cancel") || !mail.includes("support@sippybrew.com") || !mail.includes("Next charge")) fail("confirmation email incomplete");

  // Contact.
  await tap('[data-a="contact"]');
  if (!(await txt()).includes("support@sippybrew.com")) fail("contact email missing");
  await p.fill("#ct-msg", "How do I change my pass?");
  await tap('form[data-form="contact"] button[type="submit"]');
  if (!(await txt()).includes("We got your message")) fail("contact form not sent");
  await tap('[data-a="contact-back"]');

  // Cart icon: Burnt Sugar line drawing, no circle background.
  const cart = await p.$eval(".cart-btn", (e) => ({ bg: getComputedStyle(e).backgroundColor, color: getComputedStyle(e).color, svg: !!e.querySelector("svg") }));
  if (!cart.svg || cart.bg !== "rgba(0, 0, 0, 0)" || cart.color !== "rgb(168, 100, 47)") fail("cart icon should be a Burnt Sugar drawing with no background: " + JSON.stringify(cart));

  // Shops can reach us from their FAQ.
  await tap('[data-a="sign-out"]');
  await tap('[data-a="shop-login"]');
  await tap('form[data-form="shop-login"] button[type="submit"]');
  await tap('[data-a="shop-tab"][data-id="faq"]');
  if (!(await p.locator('[data-a="contact"]').count())) fail("shop FAQ should link to Contact");

  if (errors.length) fail(errors.join("; "));
  if (!process.exitCode) console.log("consent: ok");
  await b.close();
})();
