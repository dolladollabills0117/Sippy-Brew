// Neighborhood Passport (5 shops → free day pass), Grand Tour locked under 51 shops,
// referrals (2 friends → 3 bonus passes), bonus passes used after monthly passes and kept at renewal.
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

  // Join on Visitor · House (5 passes).
  await tap('[data-a="pick-sub"][data-id="decaf"]');
  await tap('[data-a="pick-tier"][data-id="affogato_decaf"]');
  await tap('form[data-form="signup"] button[type="submit"]');
  await tap('[data-a="checkout"]'); await tap('[data-a="pay"]');
  const home = await txt();
  if (!home.includes("Neighborhood Passport") || !home.includes("Unlocks once more than 50 shops join")) fail("passport card / locked Grand Tour missing");

  // Visit 5 different shops, one a day, each picked up.
  const shops = ["main", "eagle", "valley", "montclair", "southorange"];
  for (let i = 0; i < shops.length; i++) {
    await tap('[data-a="tab"][data-id="shops"]');
    await tap(`.shop-card[data-id="${shops[i]}"]`);
    const plain = p.locator('[data-a="add-plain"]').first();
    if (await plain.count()) await plain.click(); else await tap('[data-a="open-customize"]'), await tap('[data-a="add-custom"]');
    await p.waitForTimeout(80);
    await tap('[data-a="view-cart"]');
    const ov = p.locator("#ov");
    if (await ov.count() && !(await ov.isChecked())) await ov.click();
    await tap('[data-a="place"]');
    await tap('[data-a="demo-pickup"]');
    await tap('[data-a="back"]');
    if (i < shops.length - 1) { await tap('[data-a="tab"][data-id="account"]'); await tap('[data-a="new-day"]'); }
  }
  await tap('[data-a="tab"][data-id="shops"]');
  const after = await txt();
  if (!after.includes("Stamped!")) fail("passport not stamped after 5 shops");
  if (!after.includes("+ 1 bonus pass")) fail("free day pass not added");
  if (!after.includes("0 of 5")) fail("monthly passes should be used up: " + after.slice(0, 300));

  // Referrals: 2 friends → 3 bonus passes.
  await tap('[data-a="tab"][data-id="account"]');
  if (!(await txt()).match(/SB-[A-HJ-NP-Z2-9]{6}/)) fail("referral code missing");
  await tap('[data-a="friend-joined"]');
  if (!(await txt()).includes("1 of 2 friends joined")) fail("friend count 1");
  await tap('[data-a="friend-joined"]');
  if (!(await txt()).includes("+ 4 bonus passes")) fail("3 referral passes not added: " + (await txt()).slice(0, 600));

  // Day 6: monthly passes are gone, so the order uses a bonus pass.
  await tap('[data-a="new-day"]');
  await tap('[data-a="tab"][data-id="shops"]');
  await tap('.shop-card[data-id="main"]');
  await tap('[data-a="add-plain"]');
  await tap('[data-a="view-cart"]');
  await tap('[data-a="place"]');
  if (!(await p.textContent("#toast")).includes("bonus pass")) fail("order should use a bonus pass");
  await tap('[data-a="back"]');
  if (!(await txt()).includes("+ 3 bonus passes")) fail("bonus not decremented");

  // Day 7: an $8.75 mocha on House ($4). The member chooses to put a bonus pass toward the
  // $4.75 overage: it covers $4, so they confirm only $0.75. Uses 2 bonus passes in total.
  await tap('[data-a="tab"][data-id="account"]'); await tap('[data-a="new-day"]');
  await tap('[data-a="tab"][data-id="shops"]');
  await tap('.shop-card[data-id="main"]');
  await tap('[data-a="open-customize"][data-id="mocha"]'); await tap('[data-a="add-custom"]'); await tap('[data-a="view-cart"]');
  if (!(await txt()).includes("Use a bonus pass toward the overage")) fail("bonus-for-overage option missing");
  if (!(await txt()).includes("This order is $4.75 over")) fail("overage before bonus should be $4.75");
  await tap("#ub");
  if (!(await txt()).includes("This order is $0.75 over")) fail("bonus should cover $4 of the overage");
  await tap("#ov"); await tap('[data-a="place"]');
  const qr = await txt();
  if (!qr.includes("Show this at the counter")) fail("order with bonus cover not placed: " + ((await p.textContent(".alert").catch(() => "")) || ""));
  await tap('[data-a="back"]');
  if (!(await txt()).includes("+ 1 bonus pass")) fail("two bonus passes should be used");

  // New month: monthly passes reset, bonus passes stay.
  await tap('[data-a="tab"][data-id="account"]');
  await tap('[data-a="new-month"]');
  const acct = await txt();
  if (!acct.includes("+ 1 bonus pass")) fail("bonus passes should roll over");

  // Account: no duplicate passport; FAQ opens and answers stay hidden until tapped.
  if (acct.includes("Neighborhood Passport")) fail("passport should not be on the account page");
  await tap('[data-a="faq"]');
  const q = p.locator("details.faq", { hasText: "Who do I contact?" });
  if (!(await q.count())) fail("FAQ missing the contact-the-shop question");
  if (await p.locator("details.faq p", { hasText: "Contact the coffee shop that made it" }).isVisible()) fail("answer visible before tap");
  await q.locator("summary").click();
  if (!(await p.locator("details.faq p", { hasText: "Contact the coffee shop that made it" }).isVisible())) fail("answer not revealed on tap");
  if (!(await txt()).includes("the Terms apply")) fail("FAQ footnote missing");

  if (errors.length) fail(errors.join("; "));
  if (!process.exitCode) console.log("rewards: ok");
  await b.close();
})();
