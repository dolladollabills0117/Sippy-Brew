/* Sippy Brew tappable demo. Business rules come from the real @sippy/core bundle (window.SippyCore). */
(function () {
  "use strict";
  var S = window.SippyCore;
  var KEY = "sippy-demo-v3";
  var TZ = S.RULES.timeZone;
  var ALL_DAY = { sun: { open: "00:00", close: "23:59" }, mon: { open: "00:00", close: "23:59" }, tue: { open: "00:00", close: "23:59" }, wed: { open: "00:00", close: "23:59" }, thu: { open: "00:00", close: "23:59" }, fri: { open: "00:00", close: "23:59" }, sat: { open: "00:00", close: "23:59" } };

  var BASE_SHOPS = [
    { id: "main", name: "Main Street Roasters", address: "25 Main St, West Orange", miles: 0.3, hours: "6:30am–6pm",
      story: "Small-batch roasting in the back room every Tuesday. Every shot pulled like it's the first.",
      menu: [["espresso", "Espresso", "double", 325, "espresso"], ["cortado", "Cortado", "4.5 oz", 425, "espresso"], ["latte", "Latte", "12 oz", 525, "espresso"],
             ["maple", "Maple Cinnamon Latte", "16 oz", 650, "specialty"], ["drip", "House Drip", "12 oz", 275, "brewed"], ["cold", "Cold Brew", "16 oz", 500, "cold"], ["mocha", "Big Mocha", "20 oz", 875, "specialty"]] },
    { id: "eagle", name: "Eagle Rock Espresso", address: "450 Eagle Rock Ave, West Orange", miles: 1.1, hours: "7am–5pm",
      story: "A bright corner café with a single-origin pour-over of the week. Neighbors, laptops and dogs welcome.",
      menu: [["americano", "Americano", "12 oz", 350, "espresso"], ["capp", "Cappuccino", "8 oz", 450, "espresso"], ["flat", "Flat White", "8 oz", 475, "espresso"],
             ["pour", "Pour-Over", "10 oz", 450, "brewed"], ["iced", "Iced Latte", "16 oz", 575, "cold"], ["nitro", "Nitro Cold Brew", "12 oz", 550, "cold"]] },
    { id: "valley", name: "Pleasant Valley Coffee Co.", address: "500 Pleasant Valley Way, West Orange", miles: 1.8, hours: "7am–3pm",
      story: "Family-run since 2009. Cardamom lattes from our grandmother's recipe.",
      menu: [["vespresso", "Espresso", "single", 275, "espresso"], ["cardamom", "Cardamom Latte", "12 oz", 600, "specialty"], ["vmocha", "Mocha", "12 oz", 575, "specialty"],
             ["vdrip", "Drip Coffee", "16 oz", 300, "brewed"], ["viced", "Iced Coffee", "16 oz", 375, "cold"]] },
  ].map(function (s) {
    s.menu = s.menu.map(function (m) {
      var mods = m[4] === "espresso" || m[4] === "specialty" ? S.starterModifierGroups() : m[4] === "cold" ? S.starterModifierGroups().slice(0, 1) : [];
      return { id: m[0], name: m[1], size: m[2], priceCents: m[3], category: m[4], shopId: s.id, modifierGroups: mods };
    });
    return s;
  });
  function allShops() { return BASE_SHOPS.concat(state.customShops || []).map(function (x) { return withExtras(x); }); }
  function withExtras(x) {
    var menu = x.menu.concat((state.extraMenu || {})[x.id] || []).map(function (m) {
      var own = (state.mods || {})[m.id];
      return Object.assign({}, m, { modifierGroups: own || m.modifierGroups || [] });
    });
    return Object.assign({}, x, { menu: menu });
  }
  function shopById(id) {
    var list = BASE_SHOPS.concat(state.customShops || []);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return withExtras(list[i]);
    return withExtras(BASE_SHOPS[0]);
  }
  function isPaused(id) { return !!(state.paused || {})[id]; }
  /** Admin-controlled listing status. Sample shops start active; newly listed shops start pending. */
  function shopStatus(id) { return (state.shopStatus || {})[id] || "active"; }
  function isSpotlight(id) { return !!(state.spotlight || {})[id]; }
  /** Members only see approved (active) shops; spotlighted shops come first. */
  function memberShops() {
    return allShops().filter(function (x) { return shopStatus(x.id) === "active"; })
      .sort(function (a, b) { return (isSpotlight(b.id) ? 1 : 0) - (isSpotlight(a.id) ? 1 : 0); });
  }
  var ADMIN_PASSWORD = "sippy-admin";
  // Admins can also sign in from the regular "Log in" form with this email and the password above.
  var ADMIN_EMAIL = "admin@sippybrew.com";

  function fresh() {
    return { screen: "landing", selectedTier: S.DEFAULT_TIER, user: null, tierId: null, passesLeft: 0, passDaysUsed: [], dayOffset: 0,
      session: null, tab: "shops", shopTab: "orders", counterShop: "main", detail: null, cart: [], customize: null, picked: [], cqty: 1, mods: {}, editMods: null, confirmedOverage: null, pickupIdx: 0,
      orders: [], tickets: [], soldOut: {}, customShops: [], extraMenu: {}, paused: {}, shopError: null, shopStatus: {}, spotlight: {}, adminTab: "overview", adminError: null, pickSub: S.DEFAULT_SUB_TIER, upgradeConfirm: false,
      error: null, scan: null, sheet: null, authMode: "signup" };
  }
  var state = fresh();
  try { var saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved && saved.screen) state = Object.assign(fresh(), saved, { sheet: null, scan: null, error: null }); } catch (e) {}
  delete state["view"];
  if (state.screen === "app" && state.session !== "member" && state.session !== "shop") state.session = state.user && state.tierId ? "member" : null;
  if (state.screen === "app" && !state.session) state.screen = "landing";
  function save() { try { var c = Object.assign({}, state); delete c.sheet; delete c.scan; delete c.error; localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById("toast");
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }

  // Demo clock: "Start a new day" moves the calendar forward so you can use another pass.
  function now() { return new Date(Date.now() + state.dayOffset * 864e5); }
  function money(c) { return S.formatCents(c, { showZeroCents: c % 100 !== 0 }); }
  function money2(c) { return S.formatCents(c, { showZeroCents: true }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); }
  function tier() { return state.tierId ? S.getTier(state.tierId) : null; }
  function firstName() { return state.user ? esc((state.user.name || "Member").split(" ")[0]) : "Member"; }
  var timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });
  var dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: TZ });

  var LOGO = S.LOGO_SVG;
  var BEANS = '<svg class="hero-beans" viewBox="0 0 120 80" aria-hidden="true">' +
    '<g class="drop" style="--d:0s"><g class="dance"><ellipse cx="30" cy="40" rx="14" ry="9" fill="#A8642F"/><path d="M22 40 Q30 36 38 40" fill="none" stroke="#FBF6EC" stroke-width="2" stroke-linecap="round"/></g></g>' +
    '<g class="drop" style="--d:0.15s"><g class="dance"><ellipse cx="60" cy="30" rx="14" ry="9" fill="#6B4F3A"/><path d="M52 30 Q60 26 68 30" fill="none" stroke="#FBF6EC" stroke-width="2" stroke-linecap="round"/></g></g>' +
    '<g class="drop" style="--d:0.3s"><g class="dance"><ellipse cx="90" cy="46" rx="14" ry="9" fill="#E0A847"/><path d="M82 46 Q90 42 98 46" fill="none" stroke="#FBF6EC" stroke-width="2" stroke-linecap="round"/></g></g></svg>';
  var ICONS = {
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14"/>',
    cup: '<path d="M4 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V9Zm12 1h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3m4-3v3"/>',
    user: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3m8 0h3a1 1 0 0 1 1 1v3m0 8v3a1 1 0 0 1-1 1h-3m-8 0H5a1 1 0 0 1-1-1v-3M7 12h10"/>',
    chart: '<path d="M4 20V10m6 10V4m6 16v-7m4 7H3"/>',
  };

  // ---------------------------------------------------------------- QR tickets (30s, single use)
  function latestTicket(orderId) {
    var t = null;
    state.tickets.forEach(function (x) { if (x.orderId === orderId && (!t || x.issuedAt > t.issuedAt)) t = x; });
    return t;
  }
  function issueTicket(orderId) {
    var nowMs = Date.now();
    state.tickets.forEach(function (x) { if (x.orderId === orderId && !x.redeemedAt && x.expiresAt > nowMs) x.expiresAt = nowMs; });
    var q = S.issueQr(new Date(nowMs));
    var t = { orderId: orderId, token: q.token, shortCode: q.shortCode, payload: q.payload, issuedAt: nowMs, expiresAt: q.expiresAt.getTime(), redeemedAt: null };
    state.tickets.push(t);
    if (state.tickets.length > 60) state.tickets = state.tickets.slice(-60);
    return t;
  }
  function liveTicket(orderId) {
    var t = latestTicket(orderId);
    if (!t || t.expiresAt - Date.now() <= 4000) t = issueTicket(orderId);
    return t;
  }

  // ---------------------------------------------------------------- Screens
  function planCards(action, selectedId) {
    var sub = state.pickSub || S.DEFAULT_SUB_TIER;
    var current = S.SUB_TIERS.filter(function (x) { return x.id === sub; })[0];
    var sw = '<div class="subswitch" role="radiogroup" aria-label="How much each pass covers">' + S.SUB_TIERS.map(function (x) {
      return '<button role="radio" aria-checked="' + (x.id === sub) + '" data-a="pick-sub" data-id="' + x.id + '"><b>' + x.name + '</b><span>up to ' + money(x.maxPassValueCents) + "/day</span></button>";
    }).join("") + '</div><p class="muted small" style="padding:0 4px">' + esc(current.blurb) + "</p>";
    var cards = S.TIER_GROUPS.map(function (g) {
      var t = g.plans[sub], pop = g.id === S.DEFAULT_TIER_GROUP, sel = selectedId === t.id;
      return '<button class="tier' + (pop ? " popular" : "") + (sel ? " selected" : "") + '" data-a="' + action + '" data-id="' + t.id + '" aria-pressed="' + sel + '" aria-label="' + t.name + ", " + money(t.priceCents) + " a month, " + t.passesPerMonth + ' passes">' +
        (pop ? '<span class="badge honey">Most popular</span>' : "") +
        '<span class="name">' + g.name + '</span><span class="price">' + money(t.priceCents) + '</span>' +
        '<span class="meta" style="margin-top:10px">' + t.passesPerMonth + ' passes</span><span class="meta">up to ' + money(t.maxPassValueCents) + "/day</span></button>";
    }).join("");
    return sw + '<div class="tiers">' + cards + "</div>";
  }

  // The logo in every top bar is a home button: people expect tapping it to go home.
  function logoHome() {
    return '<button class="logo" data-a="logo-home" aria-label="Sippy Brew home">' + LOGO + "</button>";
  }

  function landing() {
    var tiers = planCards("pick-tier", null);
    return '<div class="topbar">' + logoHome() + '<button class="pill dark" data-a="login">Log in</button></div>' +
      '<section class="card hero"><span class="sticker" style="align-self:flex-start">New in ' + esc(S.SITE.launchCity) + '</span>' +
      '<h1>Your neighborhood, brewed daily.</h1><p class="muted" style="font-size:1.0625rem">One monthly pass. Any local coffee shop.</p>' +
      '<div class="cta"><button class="pill honey" data-a="get-pass">Get my pass</button>' + BEANS + "</div></section>" +
      '<h2 class="section-title">Pick your pass</h2>' + tiers +
      '<h2 class="section-title">How it works</h2><ol class="steps"><li><span class="dot">1</span>Pick a pass</li><li><span class="dot">2</span>Order ahead from a shop near you</li><li><span class="dot">3</span>Scan at the counter. Sip.</li></ol>' +
      '<p class="demo-note">Own a coffee shop? <button class="linkbtn" data-a="shop-signup">List your shop</button> · <button class="linkbtn" data-a="shop-login">Shop log in</button></p>' +
      '<p class="demo-note">This is a working demo with sample shops. No real payments are made.</p>';
  }

  function shopLogin() {
    return '<div class="topbar"><button class="back" data-a="home">‹ Back</button>' + logoHome() + "</div>" +
      '<h1 style="font-size:2rem;padding:0 4px">Shop log in</h1>' +
      '<p class="muted" style="padding:0 4px">For coffee shops only. Member accounts can\'t open the shop side.</p>' +
      '<form class="card stack" data-form="shop-login">' +
      '<label class="field" for="s-shop">Shop<select class="input" id="s-shop" name="shop">' +
      allShops().map(function (x) { return '<option value="' + x.id + '"' + (x.id === state.counterShop ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join("") + "</select></label>" +
      '<label class="field" for="s-email">Shop email<input class="input" id="s-email" name="email" type="email" autocomplete="username" value="owner@shop.example"></label>' +
      '<label class="field" for="s-pass">Password<input class="input" id="s-pass" name="password" type="password" autocomplete="current-password" value="demo-password"></label>' +
      '<button class="btn" type="submit">Log in to the shop app</button></form>' +
      '<button class="btn line" data-a="shop-signup">New here? List your coffee shop</button>' +
      '<p class="demo-note">Demo: any details work. Each shop account runs one shop.</p>';
  }

  // Merchant sign-up: list a coffee shop (like a delivery app's merchant onboarding).
  function shopSignup() {
    var row = function (i, name, size, price, cat) {
      return '<div class="stack" style="gap:6px;border-top:1px solid var(--latte);padding-top:10px">' +
        '<label class="field" for="m' + i + '-name">Coffee ' + (i + 1) + '<input class="input" id="m' + i + '-name" name="m' + i + '-name" value="' + name + '"></label>' +
        '<div class="row" style="gap:8px;align-items:flex-end"><label class="field grow" for="m' + i + '-size">Size<input class="input" id="m' + i + '-size" name="m' + i + '-size" value="' + size + '"></label>' +
        '<label class="field grow" for="m' + i + '-price">Price ($)<input class="input" id="m' + i + '-price" name="m' + i + '-price" inputmode="decimal" value="' + price + '"></label></div>' +
        '<label class="field" for="m' + i + '-cat">Category<select class="input" id="m' + i + '-cat" name="m' + i + '-cat">' +
        S.COFFEE_CATEGORIES.map(function (c) { return '<option value="' + c + '"' + (c === cat ? " selected" : "") + ">" + S.CATEGORY_LABELS[c] + "</option>"; }).join("") + "</select></label></div>";
    };
    return '<div class="topbar"><button class="back" data-a="shop-login">‹ Back</button>' + logoHome() + "</div>" +
      '<h1 style="font-size:2rem;padding:0 4px">List your coffee shop</h1>' +
      '<p class="muted" style="padding:0 4px">Get pickup orders from members nearby and weekly payouts to your bank.</p>' +
      (state.shopError ? '<div class="alert" role="alert">' + esc(state.shopError) + "</div>" : "") +
      '<form class="stack" data-form="shop-signup">' +
      '<div class="card stack"><b>Your account</b>' +
      '<label class="field" for="o-name">Your name<input class="input" id="o-name" name="owner" autocomplete="name" value="Jordan Reyes"></label>' +
      '<label class="field" for="o-email">Shop email<input class="input" id="o-email" name="email" type="email" autocomplete="email" value="hello@yourshop.example"></label>' +
      '<label class="field" for="o-pass">Password<input class="input" id="o-pass" name="password" type="password" autocomplete="new-password" value="demo-password"></label></div>' +
      '<div class="card stack"><b>Your shop</b>' +
      '<label class="field" for="b-name">Business name<input class="input" id="b-name" name="name" value="Corner Cup Coffee"></label>' +
      '<label class="field" for="b-addr">Street address<input class="input" id="b-addr" name="address" autocomplete="street-address" value="88 Northfield Ave, West Orange"></label>' +
      '<div class="row" style="gap:8px;align-items:flex-end"><label class="field grow" for="b-open">Opens<input class="input" id="b-open" name="open" type="time" value="07:00"></label>' +
      '<label class="field grow" for="b-close">Closes<input class="input" id="b-close" name="close" type="time" value="17:00"></label></div>' +
      '<label class="field" for="b-story">Your story <span class="muted small" style="font-weight:400">(up to ' + S.RULES.shopStoryMaxChars + ' characters)</span><textarea class="input" id="b-story" name="story" rows="3" maxlength="' + S.RULES.shopStoryMaxChars + '">Neighborhood espresso bar with a bright window seat and the friendliest baristas on Northfield.</textarea></label></div>' +
      '<div class="card stack"><b>Starter menu</b><span class="muted small">Coffee only. Food can\'t be sold through the app. Leave a row blank to skip it.</span>' +
      row(0, "Latte", "12 oz", "5.00", "espresso") + row(1, "House Drip", "12 oz", "3.00", "brewed") + row(2, "Cold Brew", "16 oz", "4.75", "cold") + "</div>" +
      '<div class="card stack"><b>Payouts</b><span class="muted">In the real app you connect your bank through Stripe here. You keep 88% of what a member\'s pass covers, plus 100% of any overage less card processing, paid every Monday.</span></div>' +
      '<button class="btn" type="submit">List my shop</button></form>';
  }

  function signup() {
    var login = state.authMode === "login";
    return '<div class="topbar"><button class="back" data-a="home">‹ Back</button>' + logoHome() + "</div>" +
      '<h1 style="font-size:2rem;padding:0 4px">' + (login ? "Welcome back" : "Get your pass") + "</h1>" +
      '<form class="card stack" data-form="signup">' +
      (login ? "" : '<label class="field" for="f-name">Name<input class="input" id="f-name" name="name" autocomplete="name" value="Dana Kowalski" required></label>') +
      '<label class="field" for="f-email">Email<input class="input" id="f-email" name="email" type="email" autocomplete="email" value="dana@example.com" required></label>' +
      '<label class="field" for="f-pass">Password<input class="input" id="f-pass" name="password" type="password" autocomplete="' + (login ? "current-password" : "new-password") + '" value="demo-password"></label>' +
      '<button class="btn" type="submit">' + (login ? "Log in" : "Create account") + "</button>" +
      '<button class="btn ghost" type="button" data-a="toggle-auth">' + (login ? "New here? Create an account" : "Have an account? Log in") + "</button></form>" +
      '<p class="demo-note">Demo: any details work.</p>';
  }

  function plans() {
    var cards = planCards("select-tier", state.selectedTier);
    var t = S.getTier(state.selectedTier);
    return '<div class="topbar"><button class="back" data-a="' + (state.tierId ? "close-plans" : "home") + '">‹ Back</button>' + logoHome() + "</div>" +
      '<h1 style="font-size:2rem;padding:0 4px">Choose your pass</h1>' + cards +
      '<div class="card stack"><p><b>' + t.name + "</b>: " + t.passesPerMonth + " Daily Passes a month. Each pass covers the first " + money2(t.maxPassValueCents) +
      " of that day's order. Unused passes expire at renewal.</p>" +
      '<button class="btn" data-a="checkout">Continue · ' + money(t.priceCents) + "/month</button></div>";
  }

  function checkoutSheet() {
    var t = S.getTier(state.selectedTier);
    return '<div class="sheet-back" data-a="close-sheet"><div class="sheet" role="dialog" aria-modal="true" aria-label="Checkout" data-stop>' +
      '<p class="badge">Demo checkout</p><h2 style="font-size:1.6rem">' + t.name + " · " + money(t.priceCents) + "/month</h2>" +
      '<p class="muted">In the real app this opens Stripe Checkout, so card numbers never touch Sippy Brew. Nothing is charged here.</p>' +
      '<button class="btn" data-a="pay">Pay ' + money(t.priceCents) + " (demo)</button>" +
      '<button class="btn ghost" data-a="close-sheet">Cancel</button></div></div>';
  }

  function appTop() {
    if (state.session === "admin") {
      return '<div class="topbar"><span class="row" style="gap:10px">' + logoHome() + '<span class="badge">Admin</span></span>' +
        '<button class="pill dark" data-a="sign-out">Sign out</button></div>';
    }
    if (state.session === "shop") {
      return '<div class="topbar"><span class="row" style="gap:10px">' + logoHome() + '<span class="badge sky">Shop</span></span>' +
        '<button class="pill dark" data-a="sign-out">Sign out</button></div>';
    }
    return '<div class="topbar">' + logoHome() + "</div>";
  }

  // ---- Member app
  function passStatus() {
    var today = S.dayKey(now(), TZ);
    if (state.passDaysUsed.indexOf(today) >= 0) return '<span class="badge">Today\'s pass used</span>';
    if (state.passesLeft < 1) return '<span class="badge">No passes left</span>';
    return '<span class="badge sky">Today\'s pass ready</span>';
  }

  function upgradeInfo() {
    var t = tier(); if (!t) return null;
    var to = S.upgradeOffer(t, state.passesLeft); if (!to) return null;
    var periodOrders = state.orders.map(function (o) { return { overageCents: o.overageCents, status: o.status }; });
    var nudge = S.suggestUpgrade({ plan: t, periodOrders: periodOrders, passesLeft: state.passesLeft });
    var over = periodOrders.filter(function (o) { return o.status !== "cancelled" && o.overageCents > 0; });
    return { to: to, suggested: !!nudge, overageOrders: over.length, overagePaid: over.reduce(function (a, o) { return a + o.overageCents; }, 0), nowCents: S.upgradeNowCost(t, to) };
  }

  function upgradeCard(u, nudge) {
    var n = state.passesLeft;
    return '<div class="card stack" style="' + (nudge ? "border:2px solid var(--honey)" : "") + '">' +
      (nudge ? "<b>You've paid " + money2(u.overagePaid) + " in overages this month</b><span class=\"muted small\">" + u.overageOrders + " of your orders went over your pass. On <b>" + u.to.name + "</b>, each pass covers up to " + money2(u.to.maxPassValueCents) + ".</span>"
        : "<b>Move up to " + u.to.name + '</b><span class="muted small">Each pass covers up to ' + money2(u.to.maxPassValueCents) + ", so lattes and specialty drinks are covered.</span>") +
      '<span class="small">Pay the monthly difference, <b>' + money2(u.nowCents) + "</b>, now. Your " + n + " remaining " + (n === 1 ? "pass covers" : "passes cover") + " up to " + money2(u.to.maxPassValueCents) + " right away, and from your next renewal it's " + money(u.to.priceCents) + "/month.</span>" +
      (state.upgradeConfirm ? '<button class="btn" data-a="upgrade-confirm">Confirm and pay ' + money2(u.nowCents) + ' (demo)</button><button class="btn ghost" data-a="upgrade-cancel">Not now</button>'
        : '<button class="' + (nudge ? "pill honey" : "btn line") + '" style="width:100%" data-a="upgrade-start">Upgrade to ' + u.to.subTierName + "</button>") + "</div>";
  }

  function shopsTab() {
    var t = tier();
    var up = upgradeInfo();
    var list = memberShops().map(function (s) {
      return '<button class="card shop-card" data-a="open-shop" data-id="' + s.id + '"><span class="thumb"><span class="logo" style="width:40px;height:40px">' + LOGO + '</span></span>' +
        '<span class="grow stack" style="gap:2px"><b style="font-family:var(--head);font-weight:400;font-size:1.2rem">' + esc(s.name) + '</b>' +
        '<span class="muted small">' + esc(s.address) + '</span><span class="small"><b>' + (isPaused(s.id) ? "Not taking orders" : "Open now") + "</b> · " + s.hours + " · " + s.miles + ' mi' + (isSpotlight(s.id) ? ' · <span class="badge honey">Spotlight</span>' : s.custom ? ' · <span class="badge sky">New</span>' : "") + '</span>' +
        '<span class="muted small">' + esc(s.story) + "</span></span></button>";
    }).join("");
    return '<div class="row between" style="padding:0 4px"><h1 style="font-size:2rem">Hi, ' + firstName() + "</h1>" + passStatus() + "</div>" +
      (up && up.suggested ? upgradeCard(up, true) : "") +
      '<div class="card stack" style="gap:8px"><div class="row between"><span class="muted small">Daily Passes left this month</span><b class="num">' + state.passesLeft + " of " + t.passesPerMonth + "</b></div>" +
      '<div class="meter" role="meter" aria-label="Passes left" aria-valuemin="0" aria-valuemax="' + t.passesPerMonth + '" aria-valuenow="' + state.passesLeft + '"><span style="width:' + Math.round((100 * state.passesLeft) / t.passesPerMonth) + '%"></span></div>' +
      '<span class="muted small">Each pass covers the first ' + money2(t.maxPassValueCents) + " of one day's order.</span></div>" +
      '<h2 class="section-title">Shops near you</h2><div class="stack">' + list + "</div>";
  }

  function menuForOrder(s) {
    return s.menu.map(function (m) { return { id: m.id, shopId: s.id, name: m.name, priceCents: m.priceCents, category: m.category, available: true, soldOutToday: !!state.soldOut[m.id], modifierGroups: m.modifierGroups }; });
  }

  function customizeSheet(s) {
    var m = s.menu.filter(function (x) { return x.id === state.customize; })[0]; if (!m) return "";
    var extra = 0;
    var groups = m.modifierGroups.map(function (g) {
      var single = g.maxSelect === 1;
      return '<fieldset class="stack" style="gap:8px;border:0;padding:0;margin:0"><legend class="row between" style="width:100%"><b>' + esc(g.name) + '</b><span class="muted small">' + (g.required ? "Required · " : "") + (single ? "Pick one" : "Pick up to " + g.maxSelect) + "</span></legend>" +
        g.options.map(function (o) {
          var on = state.picked.indexOf(o.id) >= 0; if (on) extra += o.priceCents;
          return '<button class="opt' + (on ? " on" : "") + '" role="' + (single ? "radio" : "checkbox") + '" aria-checked="' + on + '" data-a="pick-opt" data-id="' + o.id + '" data-g="' + g.id + '"><span>' + (on ? "✓ " : "") + esc(o.name) + '</span><span class="muted small">' + (o.priceCents ? "+" + money2(o.priceCents) : "Free") + "</span></button>";
        }).join("") + "</fieldset>";
    }).join("");
    var unit = m.priceCents + extra;
    return '<div class="sheet-back" data-a="close-customize"><div class="sheet" role="dialog" aria-modal="true" aria-label="Customize ' + esc(m.name) + '" data-stop style="max-height:88vh;overflow:auto">' +
      '<div class="row between"><div><h2 style="font-size:1.6rem">' + esc(m.name) + '</h2><span class="muted small">' + m.size + " · " + money2(m.priceCents) + '</span></div><button class="back" data-a="close-customize" aria-label="Close">✕</button></div>' +
      groups +
      '<span class="muted small">Customizations are priced by the shop. Your pass covers your order up to its daily max; anything more is an overage you confirm.</span>' +
      (state.error ? '<div class="alert" role="alert">' + esc(state.error) + "</div>" : "") +
      '<div class="row between"><div class="stepper"><button data-a="cqty" data-d="-1" aria-label="One fewer" ' + (state.cqty <= 1 ? "disabled" : "") + '>−</button><output aria-live="polite">' + state.cqty + '</output><button data-a="cqty" data-d="1" aria-label="One more" ' + (state.cqty >= S.MAX_QUANTITY_PER_LINE ? "disabled" : "") + '>+</button></div><span class="muted small">' + money2(unit) + " each</span></div>" +
      '<button class="btn" data-a="add-custom">Add to order · ' + money2(unit * state.cqty) + "</button></div></div>";
  }

  function shopDetail(id) {
    var s = shopById(id), t = tier();
    var items = s.menu.map(function (m) {
      var out = !!state.soldOut[m.id], custom = m.modifierGroups.length > 0;
      var inCart = state.cart.filter(function (l) { return l.menuItemId === m.id; }).reduce(function (a, l) { return a + l.quantity; }, 0);
      return '<div class="menu-item"><div class="grow"><b>' + esc(m.name) + "</b>" + (inCart ? ' <span class="badge sky">' + inCart + " in order</span>" : "") + '<div class="muted small">' + m.size + " · " + money2(m.priceCents) + (out ? ' · <span style="color:var(--danger);font-weight:700">Sold out</span>' : custom ? " · Customizable" : "") + "</div></div>" +
        (out ? "" : '<button class="btn line" style="width:auto;padding:0 16px;min-height:44px;font-size:.95rem" data-a="' + (custom ? "open-customize" : "add-plain") + '" data-id="' + m.id + '">' + (custom ? "Customize" : "Add") + "</button>") + "</div>";
    }).join("");
    var priced = state.cart.length ? S.priceOrder(state.cart, menuForOrder(s), s.id) : null;
    var lines = priced && priced.ok ? priced.lines : [];
    var total = priced && priced.ok ? priced.totalCents : 0;
    var cartHtml = state.cart.length ? '<div class="stack" style="gap:8px">' + state.cart.map(function (l, li) {
      var key = l.optionIds.slice().sort().join(",");
      var p = lines.filter(function (x) { return x.menuItemId === l.menuItemId && x.options.map(function (o) { return o.optionId; }).sort().join(",") === key; })[0];
      var item = s.menu.filter(function (x) { return x.id === l.menuItemId; })[0];
      return '<div class="row between" style="align-items:flex-start;border-bottom:1px solid var(--latte);padding-bottom:8px"><div class="grow"><b>' + l.quantity + "× " + esc(item ? item.name : "Item") + "</b>" +
        (p && p.options.length ? '<div class="muted small">' + esc(S.describeOptions(p.options)) + "</div>" : "") +
        '<div class="stepper" style="margin-top:6px"><button data-a="cart-bump" data-id="' + li + '" data-d="-1" aria-label="One fewer">−</button><button data-a="cart-bump" data-id="' + li + '" data-d="1" aria-label="One more" ' + (l.quantity >= S.MAX_QUANTITY_PER_LINE ? "disabled" : "") + ">+</button></div></div>" +
        '<b class="num">' + (p ? money2(p.lineTotalCents) : "") + "</b></div>";
    }).join("") + "</div>" : '<span class="muted">Add a coffee from the menu.</span>';
    var split = S.splitPassValue(total, t.maxPassValueCents);
    var pass = S.checkPassAvailable({ passesLeft: state.passesLeft, passDaysUsed: state.passDaysUsed, now: now(), timeZone: TZ });
    var hasOver = split.overageCents > 0;
    var confirmed = !hasOver || state.confirmedOverage === split.overageCents;
    var slots = S.pickupSlots(now(), ALL_DAY, TZ).slice(0, 12);
    var chips = slots.map(function (d, i) { return '<button class="chip" data-a="pickup" data-id="' + i + '" aria-pressed="' + (i === state.pickupIdx) + '">' + timeFmt.format(d) + "</button>"; }).join("");
    var label = hasOver ? "Use pass + pay " + money2(split.overageCents) + " overage" : "Use today's pass";
    return '<button class="back" data-a="back">‹ Shops</button>' +
      '<div style="padding:0 4px" class="stack"><h1 style="font-size:2rem">' + esc(s.name) + '</h1><p class="muted">' + esc(s.address) + "</p><p>" + esc(s.story) + "</p></div>" +
      '<div class="card">' + items + "</div>" +
      '<div class="card stack"><h2 style="font-size:1.4rem">Your order</h2>' + cartHtml + (priced && !priced.ok ? '<div class="alert" role="alert">' + esc(priced.message) + "</div>" : "") +
      '<div class="lines"><div class="row"><span class="muted">Pass covers (first ' + money2(t.maxPassValueCents) + ')</span><b class="num">' + money2(split.passCoveredCents) + "</b></div>" +
      '<div class="row"><span class="muted">Overage</span><b class="num">' + money2(split.overageCents) + "</b></div>" +
      '<div class="row total"><span>Order total</span><span class="num">' + money2(total) + "</span></div></div>" +
      (hasOver ? '<div class="confirm"><b>This order is ' + money2(split.overageCents) + " over your pass.</b>" +
        '<span class="muted small">' + (S.overageIsCharged(split.overageCents) ? "It's charged to your card on file when the shop hands over your order, at the shop's menu prices. It goes 100% to the shop." : "Overages under " + money2(S.RULES.minOverageChargeCents) + " are waived, so you won't be charged for this one.") + "</span>" +
        '<label for="ov"><input id="ov" type="checkbox" data-a="confirm-overage" data-amount="' + split.overageCents + '" ' + (confirmed ? "checked" : "") + "><span>I confirm the " + money2(split.overageCents) + " overage. My pass covers " + money2(split.passCoveredCents) + " of the " + money2(total) + " total.</span></label>" +
        (upgradeInfo() && S.overageCoveredByUpgrade(t, total) > 0 ? '<span class="small" style="background:var(--cream);border-radius:12px;padding:8px 10px">Tip: on <b>' + S.upgradeTarget(t).name + "</b>, " + money2(S.overageCoveredByUpgrade(t, total)) + ' of this overage would be covered by your pass. <button class="linkbtn" style="min-height:0;padding:0" data-a="goto-upgrade">See upgrade</button></span>' : "") +
        "</div>" : "") +
      '<span class="muted small">' + state.passesLeft + " of " + t.passesPerMonth + " passes left · one pass per day</span>" +
      '<b>Pickup time</b><div class="chips">' + chips + "</div>" +
      (!pass.ok && total > 0 ? '<div class="alert" role="alert">' + esc(pass.message) + "</div>" : "") +
      (state.error ? '<div class="alert" role="alert">' + esc(state.error) + "</div>" : "") +
      (isPaused(s.id) ? '<div class="alert" role="alert">This shop isn\'t taking orders right now.</div>' : "") +
      '<button class="btn" data-a="place" data-id="' + s.id + '" ' + (total === 0 || !pass.ok || !confirmed || isPaused(s.id) || (priced && !priced.ok) ? "disabled" : "") + ">" + label + "</button></div>";
  }

  function orderById(id) { for (var i = 0; i < state.orders.length; i++) if (state.orders[i].id === id) return state.orders[i]; return null; }
  var OPEN = ["received", "preparing", "ready"];
  var LABEL = S.ORDER_STATUS_LABELS;

  function qrDetail(id) {
    var o = orderById(id); if (!o) return shopsTab();
    var open = OPEN.indexOf(o.status) >= 0;
    var title = o.status === "ready" ? "Ready for pickup!" : o.status === "picked_up" ? "Enjoy!" : o.status === "cancelled" ? "Order cancelled" : "Show this at the counter";
    var items = o.items.map(function (i) { return "<div>" + i.quantity + "× " + esc(i.name) + ' <span class="muted">(' + i.size + ")</span>" + (i.options && i.options.length ? '<div class="muted small">' + esc(S.describeOptions(i.options)) + "</div>" : "") + "</div>"; }).join("");
    var t = open ? liveTicket(id) : null;
    return '<button class="back" data-a="back">‹ Back</button>' +
      '<div class="qr-screen"><span class="muted small" style="text-transform:uppercase;letter-spacing:.08em;font-weight:800">' + esc(shopById(o.shopId).name) + "</span>" +
      '<h1 style="font-size:1.9rem">' + title + '</h1><span class="badge ' + (o.status === "ready" ? "sky" : o.status === "picked_up" ? "ok" : o.status === "cancelled" ? "bad" : "") + '">' + LABEL[o.status] + "</span>" +
      (open ? '<div class="qr-box" id="qr" role="img" aria-label="Pickup QR code"></div><span class="muted small">Or tell the barista</span><span class="code" id="qr-code">' + t.shortCode + '</span><span class="muted small" id="qr-left" aria-live="polite"></span>' +
        '<p class="muted small">Codes refresh every 30 seconds and work once. On a real phone the screen goes to full brightness.</p>' : "") +
      '<div style="align-self:stretch;text-align:left" class="stack"><span class="muted small">Pickup ' + timeFmt.format(new Date(o.pickupAt)) + "</span>" + items +
      '<div class="lines"><div class="row"><span class="muted">Covered by your Daily Pass</span><span class="num">' + money2(o.passCoveredCents) + "</span></div>" +
      (o.overageCents ? '<div class="row"><span class="muted">Overage you confirmed</span><span class="num">' + money2(o.overageCents) + "</span></div>" : "") +
      '<div class="row total"><span>Order total</span><span class="num">' + money2(o.totalCents) + "</span></div></div></div></div>" +
      (open ? '<p class="demo-note">Demo: to redeem it, sign out on the Account tab, then tap <b>Shop log in</b> on the home screen.</p>' : "");
  }

  function ordersTab() {
    var row = function (o) {
      return '<button class="card stack" style="gap:4px;text-align:left;width:100%;border:0' + (o.status === "ready" ? ";box-shadow:0 0 0 3px var(--sky)" : "") + '" data-a="open-order" data-id="' + o.id + '">' +
        '<div class="row between"><b>' + esc(shopById(o.shopId).name) + '</b><span class="badge' + (o.status === "ready" ? " sky" : o.status === "picked_up" ? " ok" : o.status === "cancelled" ? " bad" : "") + '">' + LABEL[o.status] + "</span></div>" +
        '<span class="muted small">' + dateFmt.format(new Date(o.createdAt)) + " · " + o.items.map(function (i) { return i.quantity + "× " + esc(i.name); }).join(", ") + "</span>" +
        '<span class="small">Daily Pass' + (o.overageCents ? " + " + money2(o.overageCents) + " overage" : "") + "</span>" +
        (OPEN.indexOf(o.status) >= 0 ? '<b style="color:var(--burnt-ink)">Show pickup QR →</b>' : "") + "</button>";
    };
    var open = state.orders.filter(function (o) { return OPEN.indexOf(o.status) >= 0; });
    var past = state.orders.filter(function (o) { return OPEN.indexOf(o.status) < 0; });
    return '<h1 style="font-size:2rem;padding:0 4px">Order</h1><button class="btn" data-a="tab" data-id="shops">Find a shop and order</button>' +
      '<h2 class="section-title">Waiting for pickup</h2>' + (open.length ? '<div class="stack">' + open.map(row).join("") + "</div>" : '<div class="card muted">Nothing waiting. Order from any shop and your pickup QR shows up here.</div>') +
      '<h2 class="section-title">History</h2>' + (past.length ? '<div class="stack">' + past.map(row).join("") + "</div>" : '<div class="card muted">No past orders yet.</div>');
  }

  function accountTab() {
    var t = tier();
    return '<h1 style="font-size:2rem;padding:0 4px">Account</h1>' +
      '<div class="card stack" style="gap:6px"><span class="muted small">Signed in as</span><b>' + esc(state.user.name) + '</b><span class="muted small">' + esc(state.user.email) + "</span></div>" +
      '<div class="card stack"><span class="muted small">Plan</span><h2 style="font-size:1.6rem">' + t.name + "</h2>" +
      '<span class="muted">' + money(t.priceCents) + "/month · " + t.passesPerMonth + " passes · " + money2(t.maxPassValueCents) + " max per pass</span>" +
      '<button class="btn line" data-a="change-plan">Change plan</button></div>' +
      (upgradeInfo() ? upgradeCard(upgradeInfo(), upgradeInfo().suggested) : "") +
      '<div class="card stack"><div class="row between"><span class="muted small">Daily Passes this month</span>' + passStatus() + "</div>" +
      '<b style="font-size:1.75rem" class="num">' + state.passesLeft + ' <span class="muted" style="font-size:1rem;font-weight:400">of ' + t.passesPerMonth + " left</span></b>" +
      '<div class="meter"><span style="width:' + Math.round((100 * state.passesLeft) / t.passesPerMonth) + '%"></span></div>' +
      '<span class="muted small">Unused passes expire at renewal. Nothing rolls over.</span></div>' +
      '<div class="card stack"><b>Demo controls</b><span class="muted small">Today in the demo: ' + dateFmt.format(now()) + ". You get one pass a day, so move to the next day to order again.</span>" +
      '<button class="btn line" data-a="new-day">Start the next day</button><button class="btn danger" data-a="reset">Reset the demo</button></div>' +
      '<button class="btn line" data-a="sign-out">Sign out</button>';
  }

  // ---- Shop app
  function counterPicker() {
    var st = shopStatus(state.counterShop);
    return '<p class="muted small" style="padding:0 4px;font-weight:800;text-transform:uppercase;letter-spacing:.06em">' + esc(shopById(state.counterShop).name) + "</p>" +
      (st === "pending" ? '<div class="alert ok" role="status" style="color:var(--espresso);border-color:var(--honey)">Your shop is waiting for approval. Members can\'t see it yet. We\'ll email you as soon as you\'re live.</div>' : "") +
      (st === "paused" ? '<div class="alert" role="alert">Your shop is paused by Sippy Brew and hidden from members. Contact support.</div>' : "");
  }

  function shopOrdersTab() {
    var list = state.orders.filter(function (o) { return o.shopId === state.counterShop && OPEN.indexOf(o.status) >= 0; });
    var cards = list.map(function (o) {
      var next = S.nextStatus(o.status);
      return '<div class="card stack"' + (o.status === "ready" ? ' style="box-shadow:0 0 0 3px var(--sky)"' : "") + '><div class="row between"><h2 style="font-size:1.6rem">' + firstName() + '</h2><span class="badge' + (o.status === "ready" ? " sky" : "") + '">' + LABEL[o.status] + "</span></div>" +
        '<span class="muted"><b>Pickup ' + timeFmt.format(new Date(o.pickupAt)) + "</b></span>" +
        o.items.map(function (i) { return '<div style="font-size:1.2rem">' + i.quantity + "× " + esc(i.name) + ' <span class="muted">(' + i.size + ")</span>" + (i.options && i.options.length ? '<div style="font-size:1rem;font-weight:800;color:var(--burnt-ink)">' + esc(S.describeOptions(i.options)) + "</div>" : "") + "</div>"; }).join("") +
        '<span class="muted small">' + money2(o.totalCents) + " · Daily Pass" + (o.overageCents ? " + " + money2(o.overageCents) + " overage (paid in app, 100% yours)" : "") + "</span>" +
        (next && next !== "picked_up" ? '<button class="btn" data-a="advance" data-id="' + o.id + '">Mark ' + LABEL[next].toLowerCase() + "</button>" : "") +
        (o.status === "ready" ? '<button class="btn" data-a="shop-tab" data-id="scan">Scan to hand off</button>' : "") +
        '<button class="btn ghost" data-a="cancel" data-id="' + o.id + '">Cancel order</button></div>';
    }).join("");
    var accepting = !isPaused(state.counterShop);
    return counterPicker() +
      '<label class="card row between" for="accepting" style="cursor:pointer"><span class="stack" style="gap:2px"><b>' + (accepting ? "Accepting orders" : "Paused") + '</b><span class="muted small">' +
      (accepting ? "Members can order from you now." : "Members can see your shop but can't order.") + '</span></span>' +
      '<input id="accepting" type="checkbox" data-a="accepting" ' + (accepting ? "checked" : "") + ' style="width:26px;height:26px;accent-color:var(--success)"></label>' +
      '<h1 style="font-size:2rem;padding:0 4px">Live orders</h1>' +
      (cards ? '<div class="stack">' + cards + "</div>" : '<div class="card muted">No orders right now. New pickup orders show up here. (Demo: sign out, log in as a member, and order from this shop.)</div>');
  }

  function shopScanTab() {
    var waiting = state.orders.filter(function (o) { return o.shopId === state.counterShop && OPEN.indexOf(o.status) >= 0; });
    var hint = waiting.map(function (o) {
      var t = latestTicket(o.id);
      return '<button class="btn line" data-a="scan-phone" data-id="' + o.id + '">Scan ' + firstName() + "'s phone" + (t ? " (code " + t.shortCode + ")" : "") + "</button>";
    }).join("");
    var r = state.scan;
    var result = r ? (r.ok
      ? '<div class="alert ok" role="status"><div style="font-size:1.2rem">✓ Redeemed for ' + firstName() + "</div>" +
        r.order.items.map(function (i) { return '<div style="font-weight:400;color:var(--espresso)">' + i.quantity + "× " + esc(i.name) + (i.options && i.options.length ? " · " + esc(S.describeOptions(i.options)) : "") + "</div>"; }).join("") +
        '<div class="lines small" style="margin-top:8px;color:var(--espresso);font-weight:400">' +
        '<div class="row"><span>Pass-covered value</span><span class="num">' + money2(r.pay.passCoveredCents) + "</span></div>" +
        '<div class="row"><span>12% commission</span><span class="num">−' + money2(r.pay.commissionCents) + "</span></div>" +
        (r.pay.overageCents ? '<div class="row"><span>Overage (100% yours)</span><span class="num">+' + money2(r.pay.overageCents) + '</span></div><div class="row"><span>Card processing on overage</span><span class="num">−' + money2(r.pay.processingFeeCents) + "</span></div>" : "") +
        '<div class="row total"><span>Your payout for this order</span><span class="num" style="font-size:1rem">' + money2(r.pay.shopCents) + "</span></div></div></div>"
      : '<div class="alert" role="alert">' + esc(r.message) + "</div>") : "";
    return counterPicker() + '<h1 style="font-size:2rem;padding:0 4px">Scan</h1>' +
      '<div class="card stack"><span class="muted small">On a real phone this is the camera. In the demo, tap to scan the member\'s screen, or type their code.</span>' +
      (hint || '<span class="muted">No orders waiting for this shop.</span>') + "</div>" + result +
      '<form class="card stack" data-form="code"><label class="field" for="code-in">Enter the 6-character code<input class="input" id="code-in" name="code" maxlength="7" autocomplete="off" autocapitalize="characters" style="font-family:ui-monospace,Menlo,monospace;font-size:1.6rem;letter-spacing:.25em;text-transform:uppercase" placeholder="ABC234"></label>' +
      '<button class="btn" type="submit">Redeem code</button></form>';
  }

  function modsEditor(m) {
    var groups = m.modifierGroups;
    return '<form class="stack" data-form="mods" data-id="' + m.id + '" style="background:var(--vanilla);border-radius:16px;padding:12px;margin-bottom:10px">' +
      '<span class="muted small">Price options at your normal menu prices. If a drink goes over what a member\'s pass covers, they pay the difference and you get 100% of it.</span>' +
      (groups.length ? groups.map(function (g, gi) {
        return '<div class="stack" style="gap:6px"><b>' + esc(g.name) + ' <span class="muted small" style="font-weight:600">' + (g.maxSelect === 1 ? "pick one" : "pick up to " + g.maxSelect) + "</span></b>" +
          g.options.map(function (o, oi) {
            return '<div class="row" style="gap:8px"><span class="grow">' + esc(o.name) + '</span><label class="row small" style="gap:4px">+$<input class="input" style="width:84px;min-height:44px" name="p-' + gi + "-" + oi + '" inputmode="decimal" value="' + (o.priceCents / 100).toFixed(2) + '" aria-label="Price for ' + esc(o.name) + '"></label></div>';
          }).join("") + "</div>";
      }).join("") : '<button class="btn line" type="button" data-a="starter-mods" data-id="' + m.id + '">Start with milk, extra shot and syrups</button>') +
      (groups.length ? '<div class="stack" style="gap:6px;border-top:1px solid var(--latte);padding-top:8px"><b>Add an option</b>' +
        '<select class="input" name="new-group" aria-label="Group">' + groups.map(function (g, gi) { return '<option value="' + gi + '">' + esc(g.name) + "</option>"; }).join("") + "</select>" +
        '<div class="row" style="gap:8px"><input class="input grow" name="new-name" placeholder="e.g. Brown sugar syrup" aria-label="Option name"><input class="input" style="width:84px" name="new-price" inputmode="decimal" placeholder="0.50" aria-label="Option price"></div>' +
        '<span class="muted small">Coffee only. Try adding a cookie to see it refused.</span></div>' : "") +
      (state.shopError ? '<div class="alert" role="alert">' + esc(state.shopError) + "</div>" : "") +
      (groups.length ? '<div class="row" style="gap:8px"><button class="btn small" type="submit" style="width:auto;padding:0 18px">Save</button><button class="btn ghost" type="button" data-a="clear-mods" data-id="' + m.id + '" style="width:auto">Remove all</button></div>' : "") +
      "</form>";
  }

  function shopMenuTab() {
    var s = shopById(state.counterShop);
    return counterPicker() + '<h1 style="font-size:2rem;padding:0 4px">Menu</h1><div class="card">' +
      s.menu.map(function (m) {
        var out = !!state.soldOut[m.id];
        return '<div class="menu-item"><div class="grow"><b>' + esc(m.name) + '</b><div class="muted small">' + m.size + " · " + money2(m.priceCents) + "</div></div>" +
          '<div class="stack" style="gap:4px;align-items:flex-end"><label class="row small" style="font-weight:700;min-height:44px"><input type="checkbox" data-a="sold-out" data-id="' + m.id + '" ' + (out ? "checked" : "") + ' style="width:22px;height:22px;accent-color:var(--burnt)">Sold out today</label>' +
          '<button class="linkbtn" style="min-height:36px;padding:0" data-a="edit-mods" data-id="' + m.id + '" aria-expanded="' + (state.editMods === m.id) + '">Customizations' + (m.modifierGroups.length ? " (" + m.modifierGroups.length + ")" : "") + "</button></div></div>" +
          (state.editMods === m.id ? modsEditor(m) : (m.modifierGroups.length ? '<p class="muted small" style="margin:-4px 0 8px">' + esc(m.modifierGroups.map(function (g) { return g.name + ": " + g.options.map(function (o) { return o.name + (o.priceCents ? " +" + money2(o.priceCents) : ""); }).join(", "); }).join(" · ")) + "</p>" : ""));
      }).join("") + "</div>" +
      (state.shopError ? '<div class="alert" role="alert">' + esc(state.shopError) + "</div>" : "") +
      '<form class="card stack" data-form="menu-add"><b>Add a coffee</b><span class="muted small">Coffee only. Try adding a muffin to see it blocked.</span>' +
      '<label class="field" for="a-name">Name<input class="input" id="a-name" name="name" placeholder="Honey Oat Latte"></label>' +
      '<div class="row" style="gap:8px;align-items:flex-end"><label class="field grow" for="a-size">Size<input class="input" id="a-size" name="size" value="12 oz"></label>' +
      '<label class="field grow" for="a-price">Price ($)<input class="input" id="a-price" name="price" inputmode="decimal" placeholder="6.25"></label></div>' +
      '<label class="field" for="a-cat">Category<select class="input" id="a-cat" name="category">' +
      S.COFFEE_CATEGORIES.map(function (c) { return '<option value="' + c + '">' + S.CATEGORY_LABELS[c] + "</option>"; }).join("") + "</select></label>" +
      '<button class="btn" type="submit">Add to menu</button></form>';
  }

  function shopDashTab() {
    var mine = state.orders.filter(function (o) { return o.shopId === state.counterShop; }).map(function (o) {
      return { id: o.id, memberId: "member", totalCents: o.totalCents, passCoveredCents: o.passCoveredCents, overageCents: o.overageCents, status: o.status, createdAt: o.createdAt, redeemedAt: o.redeemedAt, items: o.items.map(function (i) { return { name: i.name, quantity: i.quantity }; }) };
    });
    var st = S.shopStats(mine, now(), TZ);
    return counterPicker() + '<h1 style="font-size:2rem;padding:0 4px">Today</h1><div class="stats">' +
      '<div class="stat"><span class="muted small">Redemptions today</span><b>' + st.redemptions.today + "</b></div>" +
      '<div class="stat"><span class="muted small">This week</span><b>' + st.redemptions.week + "</b></div>" +
      '<div class="stat"><span class="muted small">Pass sales this month</span><b>' + money2(st.grossCents.month) + "</b></div>" +
      '<div class="stat"><span class="muted small">Est. payout this week</span><b>' + money2(st.estimatedWeeklyPayoutCents) + "</b></div></div>" +
      '<div class="card stack"><b>Top items</b>' + (st.topItems.length ? st.topItems.map(function (i, n) { return '<div class="row between"><span>' + (n + 1) + ". " + esc(i.name) + '</span><b class="num">' + i.quantity + "</b></div>"; }).join("") : '<span class="muted">No redemptions yet.</span>') + "</div>" +
      payoutCard() + listingCard();
  }

  function payoutCard() {
    var week = S.weekBounds(now(), TZ);
    var done = state.orders.filter(function (o) { return o.shopId === state.counterShop && o.status === "picked_up" && o.redeemedAt && S.isWithin(new Date(o.redeemedAt), week); });
    var p = S.summarizePayout(done.map(function (o) { return { passCoveredCents: o.passCoveredCents, overageCents: o.overageCents }; }));
    var line = function (l, v, cls) { return '<div class="row between"><span class="muted">' + l + '</span><span class="num' + (cls || "") + '">' + v + "</span></div>"; };
    return '<div class="card stack"><div class="row between"><b>This week\'s payout</b><span class="badge">Pays Monday</span></div><div class="lines">' +
      line("Pass sales (" + p.orderCount + (p.orderCount === 1 ? " order)" : " orders)"), money2(p.grossCents)) +
      line("12% commission", "−" + money2(p.commissionCents)) +
      line("Overages (100% yours)", "+" + money2(p.overageTotalCents)) +
      line("Card processing on overages", "−" + money2(p.processingFeesCents)) +
      '<div class="row total"><span>Net payout</span><span class="num" style="font-size:1.25rem">' + money2(p.transferCents) + "</span></div></div>" +
      '<span class="muted small">Sent to your bank through Stripe every Monday.</span></div>';
  }

  function listingCard() {
    var sh = shopById(state.counterShop);
    var st = shopStatus(sh.id);
    var badge = st === "pending" ? '<span class="badge honey">Waiting for approval</span>' : st === "paused" ? '<span class="badge bad">Paused by admin</span>' : isPaused(sh.id) ? '<span class="badge">Not accepting orders</span>' : '<span class="badge ok">Live</span>';
    return '<div class="card stack"><div class="row between"><b>Your listing</b>' + badge + "</div>" +
      '<b style="font-family:var(--head);font-weight:400;font-size:1.3rem">' + esc(sh.name) + '</b><span class="muted">' + esc(sh.address) + "</span>" +
      '<span class="small"><b>Hours</b> ' + esc(sh.hours) + '</span><span class="muted small">' + esc(sh.story) + "</span>" +
      '<span class="small"><b>' + sh.menu.length + "</b> coffees on your menu</span></div>";
  }

  function tabs() {
    var member = state.session === "member", admin = state.session === "admin";
    var items = admin ? [["overview", "Overview", "chart"], ["shops", "Shops", "list"], ["members", "Members", "user"]]
      : member ? [["shops", "Shops", "map"], ["orders", "Order", "cup"], ["account", "Account", "user"]] : [["orders", "Orders", "list"], ["scan", "Scan", "scan"], ["menu", "Menu", "cup"], ["dashboard", "Dashboard", "chart"]];
    var cur = admin ? state.adminTab : member ? state.tab : state.shopTab;
    var actName = admin ? "admin-tab" : member ? "tab" : "shop-tab";
    return '<nav class="tabs" aria-label="Tabs"><div class="inner">' + items.map(function (it) {
      var count = !member && !admin && it[0] === "orders" ? state.orders.filter(function (o) { return o.shopId === state.counterShop && o.status === "received"; }).length : 0;
      if (admin && it[0] === "shops") count = allShops().filter(function (x) { return shopStatus(x.id) === "pending"; }).length;
      return '<button class="tab" data-a="' + actName + '" data-id="' + it[0] + '"' + (cur === it[0] && !state.detail ? ' aria-current="page"' : "") + '><span class="ico" style="position:relative"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[it[2]] + "</svg>" +
        (count ? '<span class="badge honey" style="position:absolute;top:-4px;right:2px;padding:0 6px;font-size:.7rem" aria-label="' + count + ' new">' + count + "</span>" : "") + "</span>" + it[1] + "</button>";
    }).join("") + "</div></nav>";
  }

  // ---- Admin (hidden: no link anywhere; open the demo link with #admin)
  function adminLogin() {
    return '<div class="topbar">' + logoHome() + '<span class="badge">Admin</span></div>' +
      '<h1 style="font-size:2rem;padding:0 4px">Admin sign in</h1>' +
      '<p class="muted" style="padding:0 4px">Only platform admins can sign in here.</p>' +
      (state.adminError ? '<div class="alert" role="alert">' + esc(state.adminError) + "</div>" : "") +
      '<form class="card stack" data-form="admin-login">' +
      '<label class="field" for="ad-email">Email<input class="input" id="ad-email" name="email" type="email" autocomplete="username" placeholder="you@sippybrew.com"></label>' +
      '<label class="field" for="ad-pass">Password<input class="input" id="ad-pass" name="password" type="password" autocomplete="current-password"></label>' +
      '<button class="btn" type="submit">Sign in</button></form>' +
      '<button class="btn ghost" data-a="home">Back to the home screen</button>';
  }

  function statusBadge(st) {
    return st === "pending" ? '<span class="badge honey">Pending</span>' : st === "paused" ? '<span class="badge bad">Paused</span>' : '<span class="badge ok">Active</span>';
  }

  function adminOverview() {
    var t = tier();
    var members = state.tierId ? 1 : 0;
    var month = S.monthBounds(now(), TZ);
    var redeemed = state.orders.filter(function (o) { return o.status === "picked_up" && o.redeemedAt && S.isWithin(new Date(o.redeemedAt), month); });
    var sum = S.summarizePayout(redeemed.map(function (o) { return { passCoveredCents: o.passCoveredCents, overageCents: o.overageCents }; }));
    var pending = allShops().filter(function (x) { return shopStatus(x.id) === "pending"; });
    return '<h1 style="font-size:2rem;padding:0 4px">Overview</h1><div class="stats">' +
      '<div class="stat"><span class="muted small">Active subscriptions</span><b>' + members + '</b><span class="muted small">' + (t ? t.name : "None yet") + "</span></div>" +
      '<div class="stat"><span class="muted small">Monthly revenue</span><b>' + money(t ? t.priceCents : 0) + "</b></div>" +
      '<div class="stat"><span class="muted small">Commission this month</span><b>' + money2(sum.commissionCents) + '</b><span class="muted small">' + sum.orderCount + " redemptions</span></div>" +
      '<div class="stat"><span class="muted small">Failed payments</span><b>0</b></div></div>' +
      '<div class="card stack"><div class="row between"><b>Shops waiting for approval</b><span class="badge ' + (pending.length ? "honey" : "") + '">' + pending.length + "</span></div>" +
      (pending.length ? pending.map(function (x) {
        return '<div class="row between" style="border-top:1px solid var(--latte);padding-top:10px"><div class="grow"><b>' + esc(x.name) + '</b><div class="muted small">' + esc(x.address) + '</div></div><button class="btn small" style="width:auto;padding:0 18px" data-a="admin-approve" data-id="' + x.id + '">Approve</button></div>';
      }).join("") : '<span class="muted">Nothing to review. New shops show up here when they list.</span>') + "</div>" +
      '<div class="card stack"><b>Recent orders</b>' + (state.orders.length ? state.orders.slice(0, 6).map(function (o) {
        return '<div class="row between small" style="border-top:1px solid var(--latte);padding-top:8px"><span class="grow">' + esc(shopById(o.shopId).name) + " · " + dateFmt.format(new Date(o.createdAt)) + '</span><span class="num">' + money2(o.totalCents) + "</span>" + '<span class="badge">' + LABEL[o.status] + "</span></div>";
      }).join("") : '<span class="muted">No orders yet.</span>') + "</div>";
  }

  function adminShops() {
    return '<h1 style="font-size:2rem;padding:0 4px">Shops</h1><div class="stack">' + allShops().map(function (x) {
      var st = shopStatus(x.id), spot = isSpotlight(x.id);
      return '<div class="card stack"><div class="row between"><b style="font-family:var(--head);font-weight:400;font-size:1.2rem">' + esc(x.name) + "</b>" + statusBadge(st) + "</div>" +
        '<span class="muted small">' + esc(x.address) + " · " + x.menu.length + " coffees" + (isPaused(x.id) && st === "active" ? " · not accepting orders right now" : "") + "</span>" +
        '<div class="row" style="flex-wrap:wrap;gap:8px">' +
        (st === "pending" ? '<button class="btn small" style="width:auto;padding:0 18px" data-a="admin-approve" data-id="' + x.id + '">Approve</button>' : "") +
        (st === "active" ? '<button class="btn danger" style="width:auto;padding:0 18px" data-a="admin-pause" data-id="' + x.id + '">Pause</button>' : "") +
        (st === "paused" ? '<button class="btn small" style="width:auto;padding:0 18px" data-a="admin-approve" data-id="' + x.id + '">Resume</button>' : "") +
        (st === "active" ? '<button class="btn line" style="width:auto;padding:0 18px;font-size:.95rem;min-height:44px" data-a="admin-spotlight" data-id="' + x.id + '" aria-pressed="' + spot + '">' + (spot ? "★ Spotlighted" : "Spotlight") + "</button>" : "") +
        "</div></div>";
    }).join("") + "</div>";
  }

  function adminMembers() {
    var t = tier();
    var used = t ? (state.passDaysUsed.length) : 0;
    return '<h1 style="font-size:2rem;padding:0 4px">Members</h1>' +
      (state.user ? '<div class="card stack" style="gap:4px"><div class="row between"><b>' + esc(state.user.name) + "</b>" + (t ? '<span class="badge sky">' + t.name + " · active</span>" : '<span class="badge">No plan</span>') + "</div>" +
        '<span class="muted small">' + esc(state.user.email) + "</span>" +
        (t ? '<span class="small">' + used + " passes used · " + state.passesLeft + " left this month · " + state.orders.length + " orders</span>" : "") + "</div>"
        : '<div class="card muted">No members yet. Sign up on the home screen to create one.</div>') +
      '<p class="demo-note">Members see only their own account. This list is visible to admins only.</p>';
  }

  // ---------------------------------------------------------------- Render
  var root, qrTimer = null;
  function render() {
    var html = "";
    if (state.screen === "landing") html = landing();
    else if (state.screen === "signup") html = signup();
    else if (state.screen === "plans") html = plans();
    else if (state.screen === "shop-login") html = shopLogin();
    else if (state.screen === "shop-signup") html = shopSignup();
    else if (state.screen === "admin-login") html = adminLogin();
    else {
      html = appTop();
      if (state.session === "admin") {
        html += state.adminTab === "shops" ? adminShops() : state.adminTab === "members" ? adminMembers() : adminOverview();
      } else if (state.session === "member") {
        if (state.detail && state.detail.type === "shop") html += shopDetail(state.detail.id) + (state.customize ? customizeSheet(shopById(state.detail.id)) : "");
        else if (state.detail && state.detail.type === "qr") html += qrDetail(state.detail.id);
        else html += state.tab === "orders" ? ordersTab() : state.tab === "account" ? accountTab() : shopsTab();
      } else {
        html += state.shopTab === "scan" ? shopScanTab() : state.shopTab === "menu" ? shopMenuTab() : state.shopTab === "dashboard" ? shopDashTab() : shopOrdersTab();
      }
      html += tabs();
    }
    if (state.sheet === "checkout") html += checkoutSheet();
    root.innerHTML = html;
    save();
    startQr();
  }

  function drawQr(t) {
    var box = document.getElementById("qr");
    if (!box) return;
    S.qrToSvg(t.payload, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#3B2A1E", light: "#FFFFFF" } }, function (err, svg) {
      if (!err && box.isConnected) box.innerHTML = svg;
    });
    var code = document.getElementById("qr-code"); if (code) code.textContent = t.shortCode;
  }
  function startQr() {
    clearInterval(qrTimer);
    if (!(state.session === "member" && state.detail && state.detail.type === "qr")) return;
    var id = state.detail.id, o = orderById(id);
    if (!o || OPEN.indexOf(o.status) < 0) return;
    var t = liveTicket(id); drawQr(t);
    var tick = function () {
      var cur = latestTicket(id);
      var left = S.qrSecondsRemaining(new Date(cur.expiresAt), new Date());
      if (left <= 4) { cur = issueTicket(id); save(); drawQr(cur); left = S.qrSecondsRemaining(new Date(cur.expiresAt), new Date()); }
      var el = document.getElementById("qr-left"); if (el) el.textContent = "Refreshes in " + left + "s";
    };
    tick(); qrTimer = setInterval(tick, 500);
  }

  // ---------------------------------------------------------------- Actions
  function addToCart(menuItemId, optionIds, quantity) {
    var key = menuItemId + "|" + optionIds.slice().sort().join(",");
    var existing = state.cart.filter(function (l) { return l.key === key; })[0];
    if (existing) existing.quantity = Math.min(S.MAX_QUANTITY_PER_LINE, existing.quantity + quantity);
    else state.cart.push({ key: key, menuItemId: menuItemId, optionIds: optionIds, quantity: quantity });
    state.confirmedOverage = null; state.error = null;
  }

  function placeOrder(shopId) {
    var s = shopById(shopId), t = tier(), n = now();
    var lines = state.cart.map(function (l) { return { menuItemId: l.menuItemId, quantity: l.quantity, optionIds: l.optionIds }; });
    var slots = S.pickupSlots(n, ALL_DAY, TZ);
    var pickupAt = slots[Math.min(state.pickupIdx, slots.length - 1)];
    var menu = menuForOrder(s);
    var r = S.validateOrder(lines, {
      shop: { id: s.id, status: isPaused(s.id) || shopStatus(s.id) !== "active" ? "paused" : "active", hours: ALL_DAY },
      subscription: { status: "active", currentPeriodEnd: new Date(n.getTime() + 30 * 864e5).toISOString() },
      menu: menu, passesLeft: state.passesLeft, passDaysUsed: state.passDaysUsed, maxPassValueCents: t.maxPassValueCents,
      confirmedOverageCents: state.confirmedOverage, pickupAt: pickupAt, now: n, timeZone: TZ,
    });
    if (!r.ok) { state.error = r.message; return render(); }
    var sizes = {}; s.menu.forEach(function (m) { sizes[m.id] = m.size; });
    var id = "o" + Date.now().toString(36);
    state.orders.unshift({ id: id, shopId: s.id, status: "received", totalCents: r.totalCents, passCoveredCents: r.passCoveredCents, overageCents: r.overageCents,
      passDay: r.passDay, pickupAt: pickupAt.toISOString(), createdAt: n.toISOString(), redeemedAt: null,
      items: r.lines.map(function (l) { return { name: l.name, size: sizes[l.menuItemId], quantity: l.quantity, options: l.options }; }) });
    state.passesLeft = r.passesLeftAfter; state.passDaysUsed.push(r.passDay);
    state.cart = []; state.confirmedOverage = null; state.error = null; state.counterShop = s.id;
    state.detail = { type: "qr", id: id };
    issueTicket(id);
    render(); window.scrollTo(0, 0);
    toast("Order placed. Your pass is used for today.");
  }

  function redeem(input) {
    var nowMs = Date.now(), t = null;
    if (input.orderId) t = latestTicket(input.orderId);
    else {
      var code = S.normalizeShortCode(input.code || "");
      if (!code) { state.scan = { ok: false, message: "Codes are 6 letters and numbers." }; return render(); }
      state.tickets.forEach(function (x) { if (x.shortCode === code && (!t || x.issuedAt > t.issuedAt)) t = x; });
    }
    if (!t) { state.scan = { ok: false, message: "That code wasn't found." }; return render(); }
    var o = orderById(t.orderId);
    var check = S.checkRedeemable({ expiresAt: new Date(t.expiresAt), redeemedAt: t.redeemedAt ? new Date(t.redeemedAt) : null, orderShopId: o.shopId, orderStatus: o.status }, state.counterShop, new Date(nowMs));
    if (!check.ok) {
      state.scan = { ok: false, message: check.message };
      return render();
    }
    t.redeemedAt = nowMs; o.status = "picked_up"; o.redeemedAt = now().toISOString();
    state.scan = { ok: true, order: o, pay: S.orderPayout({ passCoveredCents: o.passCoveredCents, overageCents: o.overageCents }) };
    render();
  }

  function act(a, el, ev) {
    var id = el.getAttribute("data-id");
    switch (a) {
      case "get-pass": state.authMode = "signup"; state.selectedTier = S.planFor(S.DEFAULT_TIER_GROUP, state.pickSub || S.DEFAULT_SUB_TIER).id; state.screen = state.user ? (state.tierId ? "app" : "plans") : "signup"; break;
      case "pick-sub": {
        state.pickSub = id;
        if (state.screen === "plans") state.selectedTier = S.planFor(S.getTier(state.selectedTier).group, id).id;
        break;
      }
      case "upgrade-start": state.upgradeConfirm = true; break;
      case "upgrade-cancel": state.upgradeConfirm = false; break;
      case "goto-upgrade": state.detail = null; state.tab = "account"; state.upgradeConfirm = false; render(); return window.scrollTo(0, 0);
      case "upgrade-confirm": {
        var u = upgradeInfo(); if (!u) break;
        state.tierId = u.to.id; state.upgradeConfirm = false;
        render();
        return toast("You're on " + u.to.name + ". Paid the " + money2(u.nowCents) + " monthly difference (demo).");
      }
      case "pick-tier": state.selectedTier = id; state.pickSub = S.getTier(id).subTier; state.authMode = "signup"; state.screen = state.user ? "plans" : "signup"; break;
      case "login": state.authMode = "login"; state.screen = "signup"; break;
      case "shop-login": state.screen = "shop-login"; state.shopError = null; break;
      case "shop-signup": state.screen = "shop-signup"; state.shopError = null; break;
      case "admin-tab": state.adminTab = id; break;
      case "admin-approve": {
        var wasPending = shopStatus(id) === "pending";
        state.shopStatus[id] = "active";
        render(); return toast(shopById(id).name + (wasPending ? " is approved and live for members. We emailed the owner." : " is live again."));
      }
      case "admin-pause": state.shopStatus[id] = "paused"; delete state.spotlight[id]; render(); return toast(shopById(id).name + " is paused and hidden from members.");
      case "admin-spotlight": if (state.spotlight[id]) delete state.spotlight[id]; else state.spotlight[id] = true; render(); return toast(state.spotlight[id] ? "Spotlighted for members." : "Spotlight removed.");
      case "sign-out": state.session = null; state.screen = "landing"; state.detail = null; state.scan = null; state.sheet = null; render(); return window.scrollTo(0, 0);
      case "toggle-auth": state.authMode = state.authMode === "login" ? "signup" : "login"; break;
      case "home": state.screen = "landing"; break;
      case "logo-home": {
        // Home is wherever this person starts: the Shops tab for members, the order queue for
        // shops, the overview for admins, and the landing page when nobody is signed in.
        state.sheet = null; state.customize = null; state.detail = null; state.scan = null; state.error = null; state.shopError = null; state.upgradeConfirm = false;
        if (state.session === "member") { state.screen = "app"; state.tab = "shops"; }
        else if (state.session === "shop") { state.screen = "app"; state.shopTab = "orders"; }
        else if (state.session === "admin") { state.screen = "app"; state.adminTab = "overview"; }
        else state.screen = "landing";
        render(); return window.scrollTo(0, 0);
      }
      case "select-tier": state.selectedTier = id; break;
      case "checkout": state.sheet = "checkout"; break;
      case "close-sheet": if (ev.target !== el && el.classList.contains("sheet-back")) return; state.sheet = null; break;
      case "close-plans": state.screen = "app"; break;
      case "pay": {
        var changing = !!state.tierId;
        var t = S.getTier(state.selectedTier);
        state.tierId = t.id; state.sheet = null; state.screen = "app"; state.session = "member"; state.tab = changing ? "account" : "shops"; state.detail = null;
        if (!changing) { state.passesLeft = t.passesPerMonth; state.passDaysUsed = []; }
        else { state.passesLeft = Math.min(state.passesLeft, t.passesPerMonth); }
        render(); window.scrollTo(0, 0);
        return toast(changing ? "Plan changed to " + t.name + " (demo)." : "You're in! " + t.passesPerMonth + " Daily Passes loaded.");
      }
      case "change-plan": state.selectedTier = state.tierId; state.pickSub = S.getTier(state.tierId).subTier; state.screen = "plans"; break;
      case "tab": state.tab = id; state.detail = null; break;
      case "shop-tab": state.shopTab = id; state.scan = null; state.shopError = null; break;
      case "open-shop": state.detail = { type: "shop", id: id }; state.cart = []; state.customize = null; state.confirmedOverage = null; state.pickupIdx = 0; state.error = null; render(); return window.scrollTo(0, 0);
      case "open-order": state.detail = { type: "qr", id: id }; render(); return window.scrollTo(0, 0);
      case "back": state.detail = null; state.error = null; break;
      case "add-plain": addToCart(id, [], 1); break;
      case "open-customize": state.customize = id; state.picked = []; state.cqty = 1; state.error = null; break;
      case "close-customize": if (el.classList.contains("sheet-back") && ev.target !== el) return; state.customize = null; state.error = null; break;
      case "pick-opt": {
        var sh = shopById(state.detail.id), item = sh.menu.filter(function (x) { return x.id === state.customize; })[0];
        var g = item.modifierGroups.filter(function (x) { return x.id === el.getAttribute("data-g"); })[0];
        var ids = g.options.map(function (o) { return o.id; });
        if (state.picked.indexOf(id) >= 0) state.picked = state.picked.filter(function (x) { return x !== id; });
        else if (g.maxSelect === 1) state.picked = state.picked.filter(function (x) { return ids.indexOf(x) < 0; }).concat([id]);
        else if (state.picked.filter(function (x) { return ids.indexOf(x) >= 0; }).length < g.maxSelect) state.picked = state.picked.concat([id]);
        state.error = null; break;
      }
      case "cqty": state.cqty = Math.max(1, Math.min(S.MAX_QUANTITY_PER_LINE, state.cqty + Number(el.getAttribute("data-d")))); break;
      case "add-custom": {
        var sh2 = shopById(state.detail.id), it2 = sh2.menu.filter(function (x) { return x.id === state.customize; })[0];
        var res = S.resolveOptions(it2.name, it2.modifierGroups, state.picked);
        if (!res.ok) { state.error = res.message; break; }
        addToCart(it2.id, state.picked.slice(), state.cqty); state.customize = null; state.error = null;
        render(); return toast(it2.name + " added.");
      }
      case "cart-bump": {
        var line = state.cart[Number(id)];
        if (line) { line.quantity = Math.min(S.MAX_QUANTITY_PER_LINE, line.quantity + Number(el.getAttribute("data-d"))); if (line.quantity <= 0) state.cart.splice(Number(id), 1); }
        state.confirmedOverage = null; break;
      }
      case "edit-mods": state.editMods = state.editMods === id ? null : id; state.shopError = null; break;
      case "starter-mods": state.mods[id] = S.starterModifierGroups(); state.shopError = null; break;
      case "clear-mods": state.mods[id] = []; state.editMods = null; render(); return toast("Customizations removed.");
      case "pickup": state.pickupIdx = Number(id); break;
      case "place": return placeOrder(id);
      case "advance": {
        var o = orderById(id), next = S.nextStatus(o.status);
        if (next && next !== "picked_up") { o.status = next; toast(firstName() + "'s order is " + LABEL[next].toLowerCase() + "."); }
        break;
      }
      case "cancel": {
        var oc = orderById(id);
        if (oc && OPEN.indexOf(oc.status) >= 0) {
          oc.status = "cancelled";
          var i = state.passDaysUsed.indexOf(oc.passDay); if (i >= 0) state.passDaysUsed.splice(i, 1);
          state.passesLeft += 1;
          toast("Order cancelled. The member's pass was returned.");
        }
        break;
      }
      case "scan-phone": return redeem({ orderId: id });
      case "new-day": state.dayOffset += 1; render(); return toast("It's " + dateFmt.format(now()) + ". Today's pass is ready.");
      case "reset": try { localStorage.removeItem(KEY); } catch (e) {} state = fresh(); render(); return window.scrollTo(0, 0);
      default: return;
    }
    render();
  }

  function boot() {
    root = document.getElementById("app");
    document.addEventListener("click", function (ev) {
      var el = ev.target.closest("[data-a]");
      if (!el || el.tagName === "INPUT" || el.tagName === "SELECT") return;
      if (el.classList.contains("sheet-back") && ev.target.closest("[data-stop]")) return;
      act(el.getAttribute("data-a"), el, ev);
    });
    document.addEventListener("change", function (ev) {
      var el = ev.target, a = el.getAttribute && el.getAttribute("data-a");
      if (a === "confirm-overage") { state.confirmedOverage = el.checked ? Number(el.getAttribute("data-amount")) : null; render(); }
      else if (a === "accepting") { state.paused[state.counterShop] = !el.checked; if (el.checked) delete state.paused[state.counterShop]; render(); toast(el.checked ? "You're accepting orders." : "Orders paused. Members can't order until you turn this back on."); }
      else if (a === "sold-out") { state.soldOut[el.getAttribute("data-id")] = el.checked; if (!el.checked) delete state.soldOut[el.getAttribute("data-id")]; save(); toast(el.checked ? "Marked sold out for today." : "Back on the menu."); }
    });
    document.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = ev.target, kind = f.getAttribute("data-form");
      if (kind === "signup") {
        if (f.elements.email.value.trim().toLowerCase() === ADMIN_EMAIL && f.elements.password.value === ADMIN_PASSWORD) {
          state.session = "admin"; state.screen = "app"; state.adminTab = "overview"; state.adminError = null; state.detail = null;
          render(); window.scrollTo(0, 0); return toast("Signed in as admin.");
        }
        var name = (f.elements.name && f.elements.name.value.trim()) || (state.user && state.user.name) || "Dana Kowalski";
        state.user = { name: name, email: f.elements.email.value.trim() || "dana@example.com" };
        if (state.tierId) { state.session = "member"; state.screen = "app"; state.tab = "shops"; state.detail = null; } else state.screen = "plans";
        render(); window.scrollTo(0, 0);
      } else if (kind === "shop-login") {
        state.session = "shop"; state.counterShop = f.elements.shop.value; state.shopTab = "orders"; state.screen = "app"; state.scan = null; state.detail = null;
        render(); window.scrollTo(0, 0);
      } else if (kind === "shop-signup") {
        var v = function (n) { return (f.elements[n] && f.elements[n].value || "").trim(); };
        var err = null;
        if (v("name").length < 2) err = "Add your business name.";
        else if (!v("address")) err = "Add your street address.";
        else err = S.validateStory(v("story")) || S.validateHours({ mon: { open: v("open"), close: v("close") } });
        var id = "c" + Date.now().toString(36), menu = [];
        for (var i = 0; i < 3 && !err; i++) {
          if (!v("m" + i + "-name")) continue;
          var item = { name: v("m" + i + "-name"), size: v("m" + i + "-size"), priceCents: Math.round(Number(v("m" + i + "-price")) * 100), category: v("m" + i + "-cat") };
          var ok = S.validateMenuItem(item);
          if (!ok.ok) { err = "Coffee " + (i + 1) + ": " + ok.message; break; }
          menu.push({ id: id + "-" + i, shopId: id, name: item.name, size: item.size, priceCents: item.priceCents, category: item.category });
        }
        if (!err && !menu.length) err = "Add at least one coffee to your menu.";
        if (err) { state.shopError = err; render(); return window.scrollTo(0, 0); }
        state.shopStatus[id] = "pending";
        state.customShops.push({ id: id, name: v("name"), address: v("address"), miles: 0.6, custom: true,
          hours: S.formatHours({ open: v("open"), close: v("close") }), story: v("story"), menu: menu });
        state.session = "shop"; state.counterShop = id; state.shopTab = "dashboard"; state.screen = "app"; state.shopError = null; state.detail = null;
        render(); window.scrollTo(0, 0);
        toast("Your shop is listed! An admin reviews new shops before members can see them.");
      } else if (kind === "menu-add") {
        var item2 = { name: f.elements.name.value.trim(), size: f.elements.size.value.trim(), priceCents: Math.round(Number(f.elements.price.value) * 100), category: f.elements.category.value };
        var res = S.validateMenuItem(item2);
        if (!res.ok) { state.shopError = res.message; return render(); }
        state.extraMenu[state.counterShop] = (state.extraMenu[state.counterShop] || []).concat([{ id: "x" + Date.now().toString(36), shopId: state.counterShop, name: item2.name, size: item2.size, priceCents: item2.priceCents, category: item2.category }]);
        state.shopError = null; render(); toast(item2.name + " added to your menu.");
      } else if (kind === "mods") {
        var mid = f.getAttribute("data-id"), sh3 = shopById(state.counterShop);
        var item3 = sh3.menu.filter(function (x) { return x.id === mid; })[0];
        var groups = JSON.parse(JSON.stringify(item3.modifierGroups));
        groups.forEach(function (g, gi) { g.options.forEach(function (o, oi) { var el2 = f.elements["p-" + gi + "-" + oi]; if (el2) o.priceCents = Math.round(Number(el2.value || 0) * 100); }); });
        var newName = (f.elements["new-name"] && f.elements["new-name"].value || "").trim();
        if (newName) {
          var g2 = groups[Number(f.elements["new-group"].value)];
          g2.options.push({ id: "o" + Date.now().toString(36), name: newName, priceCents: Math.round(Number(f.elements["new-price"].value || 0) * 100) });
        }
        var v2 = S.validateModifierGroups(groups);
        if (!v2.ok) { state.shopError = v2.message; return render(); }
        state.mods[mid] = groups; state.shopError = null; state.editMods = null;
        render(); toast("Customizations saved. Members see them right away.");
      } else if (kind === "code") {
        redeem({ code: f.elements.code.value });
      } else if (kind === "admin-login") {
        if (f.elements.password.value !== ADMIN_PASSWORD || !f.elements.email.value.trim()) {
          state.adminError = "That email and password don't match an admin account.";
          return render();
        }
        state.session = "admin"; state.screen = "app"; state.adminTab = "overview"; state.adminError = null; state.detail = null;
        render(); window.scrollTo(0, 0);
      }
    });
    var openAdmin = function () {
      if (location.hash === "#admin" && state.session !== "admin") { state.screen = "admin-login"; state.session = null; state.adminError = null; render(); window.scrollTo(0, 0); }
    };
    window.addEventListener("hashchange", openAdmin);
    render();
    openAdmin();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
