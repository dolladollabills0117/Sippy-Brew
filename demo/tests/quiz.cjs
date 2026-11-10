// Get matched quiz → cheeky result → local shops map (radius capped at 15 mi) → sign up,
// then a plan change that only takes effect next month, and the Terms summary.
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
  await p.waitForTimeout(600);
  const tap = async (sel, wait = 120) => { await p.click(sel); await p.waitForTimeout(wait); };
  const txt = () => p.textContent("#app");
  const fail = (m) => { console.error("FAIL: " + m); process.exitCode = 1; };

  // Landing labels.
  const landing = await txt();
  if (!landing.includes("What do you usually order?") || !landing.includes("How often do you go?")) fail("landing plan labels missing");
  if (!landing.includes("Regular") || !landing.includes("Specialty")) fail("new pass names missing on landing");

  // Quiz: two cards, each swipes away.
  await tap('[data-a="start-quiz"]');
  if (!(await txt()).includes("Question 1 of 2")) fail("quiz card 1 missing");
  await p.click('[data-a="quiz-answer"][data-id="specialty"]');
  await p.waitForTimeout(80);
  if (!(await p.locator("#quiz-card.quiz-out").count())) fail("card did not swipe out");
  await p.waitForTimeout(450);
  if (!(await txt()).includes("Question 2 of 2")) fail("quiz card 2 missing");
  await tap('[data-a="quiz-answer"][data-id="daily"]', 500);
  const result = await txt();
  if (!result.includes("You're a Local!")) fail("result headline missing");
  if (!result.includes("Mayor energy") || !result.includes("👑")) fail("cheeky line or emoji missing");
  if (!result.includes("Local · Specialty") || !result.includes("$160")) fail("matched plan missing");
  if (!result.includes("Changes kick in at the start of your next month")) fail("next-month note missing on result");

  // Map: location prompt, then West Orange, radius, other shops.
  await tap('[data-a="find-shops"]');
  if (!(await txt()).includes("Use my location")) fail("location prompt missing");
  await tap('[data-a="use-sample-loc"]');
  if ((await p.locator("svg.map").count()) !== 1) fail("map missing");
  if ((await p.getAttribute("#radius", "max")) !== "15") fail("radius max is not 15");
  if (!(await txt()).includes("5 local shops")) fail("expected 5 shops within 5 mi: " + (await txt()).slice(0, 400));
  await p.fill("#radius", "15"); await p.dispatchEvent("#radius", "change"); await p.waitForTimeout(150);
  if (!(await txt()).includes("6 local shops")) fail("Hoboken should be within 15 mi");
  await tap('[data-a="toggle-beyond"]');
  const beyond = await txt();
  if (!beyond.includes("Nassau Street Grind") || !beyond.includes("Outside your 15-mile area")) fail("other participating shops missing");

  // Get the matched pass.
  await tap('[data-a="get-pass-selected"]');
  await tap('form[data-form="signup"] button[type="submit"]');
  if ((await p.getAttribute('[data-a="select-tier"][data-id="double_espresso_double_shot"]', "aria-pressed")) !== "true") fail("quiz plan not preselected");
  await tap('[data-a="checkout"]');
  if (!(await txt() + (await p.textContent("body"))).includes("Terms")) fail("checkout terms link missing");
  { if (await p.locator("#agree").count()) await p.check("#agree"); } await tap('[data-a="pay"]');
  if (!(await txt()).includes("Shops near you")) fail("member shops tab missing");

  // Plan change takes effect next month.
  await tap('[data-a="tab"][data-id="account"]');
  await tap('[data-a="change-plan"]');
  await tap('[data-a="pick-sub"][data-id="decaf"]');
  await tap('[data-a="select-tier"][data-id="affogato_decaf"]');
  await tap('[data-a="checkout"]');
  if (!(await p.textContent("body")).includes("No charge today")) fail("change checkout should say no charge today");
  { if (await p.locator("#agree").count()) await p.check("#agree"); } await tap('[data-a="pay"]');
  const acct = await txt();
  if (!acct.includes("Local · Specialty") || !acct.includes("Switching to Visitor · House")) fail("plan should stay until next month");
  await tap('[data-a="new-month"]');
  const acct2 = await txt();
  if (!acct2.includes("Visitor · House") || acct2.includes("Switching to")) fail("pending plan should apply at renewal");
  if (!acct2.includes("5 ")) fail("Visitor passes not loaded");

  // Terms summary.
  await tap('[data-a="terms"]');
  const terms = await txt();
  if (!terms.includes("We are not a coffee shop") || !terms.includes("contact the coffee shop that made it")) fail("terms disclaimer missing");

  if (errors.length) fail(errors.join("; "));
  if (!process.exitCode) console.log("quiz: ok");
  await b.close();
})();
