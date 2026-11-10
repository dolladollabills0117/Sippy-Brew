// Tappable dashboard tiles, past weeks, and colored payout lines in reading order.
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

  // Member orders $11.25 at Montclair: $8 pass + $3.25 overage, then the shop scans it.
  await tap('[data-a="pick-tier"][data-id="macchiato_double_shot"]');
  await tap('form[data-form="signup"] button[type="submit"]');
  await tap('[data-a="checkout"]'); await p.check("#agree"); await tap('[data-a="pay"]');
  await tap('.shop-card[data-id="montclair"]');
  await tap('[data-a="open-customize"][data-id="mlatte"]'); await tap('[data-a="add-custom"]');
  await tap('[data-a="open-customize"][data-id="mhoney"]'); await tap('[data-a="add-custom"]');
  await tap('[data-a="view-cart"]'); await p.check("#ov"); await tap('[data-a="place"]');
  await tap('[data-a="back"]');
  await tap('[data-a="tab"][data-id="account"]'); await tap('[data-a="sign-out"]');
  await tap('[data-a="shop-login"]'); await p.selectOption("#s-shop", "montclair");
  await tap('form[data-form="shop-login"] button[type="submit"]');
  await tap('[data-a="shop-tab"][data-id="scan"]'); await tap('[data-a="scan-phone"]');
  await tap('[data-a="shop-tab"][data-id="dashboard"]');

  // Tiles expand and collapse.
  await tap('[data-a="dash-open"][data-id="today"]');
  if ((await p.getAttribute('[data-a="dash-open"][data-id="today"]', "aria-expanded")) !== "true") fail("today tile should expand");
  if (!(await p.textContent(".detail")).includes("Honey")) fail("today detail should list the order: " + (await p.textContent(".detail")));
  await tap('[data-a="dash-open"][data-id="month"]');
  if (!(await p.textContent(".detail")).includes("Net payout")) fail("month detail should show payout lines");
  await tap('[data-a="dash-open"][data-id="month"]');
  if (await p.locator(".detail").count()) fail("tapping again should close details");

  // Payout lines in order: pass sales, overages (green), deductions (red), net.
  const labels = await p.locator(".card .lines").last().locator(".pl").evaluateAll((els) => els.map((e) => [e.className, e.textContent, getComputedStyle(e.querySelector(".num")).color]));
  const order = labels.map((l) => l[0].replace("row between pl ", ""));
  if (order.join(",") !== "base,plus,minus,minus,minus,total") fail("line order wrong: " + order);
  if (labels[1][2] !== "rgb(47, 107, 58)") fail("overage should be green: " + labels[1][2]);
  if (labels[2][2] !== "rgb(155, 44, 44)") fail("deduction should be red: " + labels[2][2]);
  if (!labels[5][1].includes("$9.50")) fail("net should be $9.50: " + labels[5][1]);

  // Past weeks.
  await tap('[data-a="pay-week"][data-d="1"]');
  if (!(await txt()).includes("Last week")) fail("should step back to last week");
  await tap('[data-a="pay-week"][data-d="1"]');
  if (!/[A-Z][a-z]{2} \d+ – [A-Z][a-z]{2} \d+/.test(await txt())) fail("older weeks show a date range");
  await tap('[data-a="pay-week"][data-d="-1"]'); await tap('[data-a="pay-week"][data-d="-1"]');
  await tap('[data-a="pay-orders"]');
  if (!(await txt()).includes("you get")) fail("show orders should list per-order breakdown");
  await tap('[data-a="sign-out"]');

  // Admin: tiles and past weeks.
  await tap('[data-a="login"]'); await p.fill("#f-email", "admin@sippybrew.com"); await p.fill("#f-pass", "sippy-admin");
  await tap('form[data-form="signup"] button[type="submit"]');
  await tap('[data-a="admin-open"][data-id="keep"]');
  const keep = await p.textContent(".detail");
  if (!keep.includes("$86.28") || !keep.includes("Paid to shops")) fail("keep detail wrong: " + keep);
  await tap('[data-a="admin-open"][data-id="commission"]');
  if (!(await p.textContent(".detail")).includes("Montclair")) fail("commission by shop should list Montclair");
  await tap('[data-a="admin-week"][data-id="0"]');
  if (!(await txt()).includes("Net payout")) fail("admin week should expand to per-shop lines");
  await tap('[data-a="admin-week"][data-id="3"]');
  if (!(await txt()).includes("No orders that week")) fail("older week should be empty");

  if (errors.length) fail(errors.join("; "));
  if (!process.exitCode) console.log("dashboard: ok");
  await b.close();
})();
