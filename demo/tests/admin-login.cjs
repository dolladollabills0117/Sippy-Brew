// Admins can sign in from the regular "Log in" form; any other email still signs in as a member.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
(async () => {
  const src = fs.readFileSync(path.join(__dirname, "../dist/sippy-brew-demo.html"), "utf8");
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>${src}</body></html>`);
  await p.waitForTimeout(800);
  await p.click('[data-a="login"]');
  await p.fill("#f-email", "Admin@SippyBrew.com");
  await p.fill("#f-pass", "sippy-admin");
  await p.click('form[data-form="signup"] button[type="submit"]');
  await p.waitForTimeout(150);
  const ok = (await p.locator('[data-a="admin-tab"]').count()) > 0;
  await b.close();
  if (!ok) { console.error("FAIL: admin email/password did not open the admin side"); process.exit(1); }
  console.log("admin-login: ok");
})();
