/* Sippy Brew tappable demo. Business rules come from the real @sippy/core bundle (window.SippyCore). */
(function () {
  "use strict";
  var S = window.SippyCore;
  var KEY = "sippy-demo-v4";
  var TZ = S.RULES.timeZone;
  var ALL_DAY = { sun: { open: "00:00", close: "23:59" }, mon: { open: "00:00", close: "23:59" }, tue: { open: "00:00", close: "23:59" }, wed: { open: "00:00", close: "23:59" }, thu: { open: "00:00", close: "23:59" }, fri: { open: "00:00", close: "23:59" }, sat: { open: "00:00", close: "23:59" } };

  var BASE_SHOPS = [
    { id: "main", name: "Main Street Roasters", address: "25 Main St, West Orange", lat: 40.7962, lng: -74.2360, hours: "6:30am–6pm",
      story: "Small-batch roasting in the back room every Tuesday. Every shot pulled like it's the first.",
      menu: [["espresso", "Espresso", "double", 325, "espresso"], ["cortado", "Cortado", "4.5 oz", 425, "espresso"], ["latte", "Latte", "12 oz", 525, "espresso"],
             ["maple", "Maple Cinnamon Latte", "16 oz", 650, "specialty"], ["drip", "House Drip", "12 oz", 275, "brewed"], ["cold", "Cold Brew", "16 oz", 500, "cold"], ["mocha", "Big Mocha", "20 oz", 875, "specialty"]] },
    { id: "eagle", name: "Eagle Rock Espresso", address: "450 Eagle Rock Ave, West Orange", lat: 40.8125, lng: -74.2520, hours: "7am–5pm",
      story: "A bright corner café with a single-origin pour-over of the week. Neighbors, laptops and dogs welcome.",
      menu: [["americano", "Americano", "12 oz", 350, "espresso"], ["capp", "Cappuccino", "8 oz", 450, "espresso"], ["flat", "Flat White", "8 oz", 475, "espresso"],
             ["pour", "Pour-Over", "10 oz", 450, "brewed"], ["iced", "Iced Latte", "16 oz", 575, "cold"], ["nitro", "Nitro Cold Brew", "12 oz", 550, "cold"]] },
    { id: "valley", name: "Pleasant Valley Coffee Co.", address: "500 Pleasant Valley Way, West Orange", lat: 40.7790, lng: -74.2610, hours: "7am–3pm",
      story: "Family-run since 2009. Cardamom lattes from our grandmother's recipe.",
      menu: [["vespresso", "Espresso", "single", 275, "espresso"], ["cardamom", "Cardamom Latte", "12 oz", 600, "specialty"], ["vmocha", "Mocha", "12 oz", 575, "specialty"],
             ["vdrip", "Drip Coffee", "16 oz", 300, "brewed"], ["viced", "Iced Coffee", "16 oz", 375, "cold"]] },
    { id: "montclair", name: "Common Grounds Montclair", address: "12 Church St, Montclair", lat: 40.8150, lng: -74.2120, hours: "6am–7pm",
      story: "Communal tables, local art on the walls and a cold brew that's steeped for 20 hours.",
      menu: [["mlatte", "Latte", "12 oz", 500, "espresso"], ["mcold", "Cold Brew", "16 oz", 475, "cold"], ["mdrip", "Drip Coffee", "12 oz", 275, "brewed"], ["mhoney", "Honey Lavender Latte", "12 oz", 625, "specialty"]] },
    { id: "southorange", name: "South Orange Social", address: "15 Sloan St, South Orange", lat: 40.7490, lng: -74.2580, hours: "7am–4pm",
      story: "Right by the train. Commuter-fast espresso and the friendliest morning crew in town.",
      menu: [["sespresso", "Espresso", "double", 300, "espresso"], ["sflat", "Flat White", "8 oz", 475, "espresso"], ["sdrip", "House Drip", "12 oz", 250, "brewed"], ["siced", "Iced Coffee", "16 oz", 375, "cold"]] },
  ].map(function (s) {
    s.menu = s.menu.map(function (m) {
      var mods = m[4] === "espresso" || m[4] === "specialty" ? S.starterModifierGroups() : m[4] === "cold" ? S.starterModifierGroups().slice(0, 1) : [];
      return { id: m[0], name: m[1], size: m[2], priceCents: m[3], category: m[4], shopId: s.id, modifierGroups: mods };
    });
    return s;
  });
  // Participating shops in other towns. Members can see who takes part elsewhere, but Sippy Brew
  // keeps ordering local: search stops at a 15-mile radius from where you are.
  var OTHER_SHOPS = [
    { id: "x-hoboken", name: "Hudson Pier Coffee", address: "120 Washington St, Hoboken", lat: 40.7377, lng: -74.0302 },
    { id: "x-princeton", name: "Nassau Street Grind", address: "60 Nassau St, Princeton", lat: 40.3500, lng: -74.6590 },
    { id: "x-asbury", name: "Boardwalk Bean", address: "700 Ocean Ave, Asbury Park", lat: 40.2210, lng: -73.9990 },
    { id: "x-philly", name: "Rittenhouse Roast", address: "1800 Walnut St, Philadelphia", lat: 39.9500, lng: -75.1710 },
  ].map(function (x) { x.far = true; return x; });
  var WEST_ORANGE = { lat: 40.7987, lng: -74.2391, label: "West Orange, NJ", source: "sample" };
  function here() { return state.loc || WEST_ORANGE; }
  /** Approved shops plus other towns' shops, split by the member's radius (rules from core). */
  function localSplit() {
    var list = memberShops().map(function (x) { return x.lat ? x : Object.assign({}, x, { lat: WEST_ORANGE.lat + 0.004, lng: WEST_ORANGE.lng - 0.006 }); }).concat(OTHER_SHOPS);
    var split = S.splitByRadius(list, here(), state.radius || S.RULES.defaultRadiusMiles);
    // Spotlighted shops first, then nearest.
    split.nearby.sort(function (a, b) { return (isSpotlight(b.id) ? 1 : 0) - (isSpotlight(a.id) ? 1 : 0) || a.distanceMiles - b.distanceMiles; });
    return split;
  }

  function allShops() { return BASE_SHOPS.concat(state.customShops || []).map(function (x) { return withExtras(x); }); }
  function withExtras(x) {
    var menu = x.menu.concat((state.extraMenu || {})[x.id] || []).map(function (m) {
      var own = (state.mods || {})[m.id];
      var price = (state.prices || {})[m.id];
      return Object.assign({}, m, { modifierGroups: own || m.modifierGroups || [] }, price ? { priceCents: price, priceChangedAt: (state.priceChangedAt || {})[m.id] } : {});
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
      error: null, scan: null, sheet: null, authMode: "signup",
      quizStep: 0, quiz: {}, loc: null, locAsked: false, radius: S.RULES.defaultRadiusMiles, showBeyond: false, periodStart: 0, pendingTier: null,
      bonus: [], refCode: null, friends: 0, grandTour: false,
      removed: {}, appeals: {}, agreed: false, lastEmail: null, contactSent: false, cartShop: null, editLine: null, customizeShop: null,
      minuteOffset: 0, prices: {}, priceChangedAt: {}, notices: [], teamAlerts: [], scanRows: null, scanSkipped: [], scanning: false, orderNote: "", orderAllergy: "" };
  }
  var state = fresh();
  try { var saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved && saved.screen) state = Object.assign(fresh(), saved, { sheet: null, scan: null, error: null }); } catch (e) {}
  delete state["view"];
  // Drinks only: drop any saved items or add-ons that break the food rule (from older versions of the demo).
  Object.keys(state.extraMenu || {}).forEach(function (k) {
    state.extraMenu[k] = state.extraMenu[k].filter(function (m) { return !S.foodProblemInMenuItem(m.name); });
  });
  (state.customShops || []).forEach(function (sh) { sh.menu = sh.menu.filter(function (m) { return !S.foodProblemInMenuItem(m.name); }); });
  Object.keys(state.mods || {}).forEach(function (k) {
    state.mods[k] = state.mods[k].map(function (g) { return Object.assign({}, g, { options: g.options.filter(function (o) { return !S.foodProblemInCustomization(o.name); }) }); }).filter(function (g) { return g.options.length; });
  });
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
  function now() { return new Date(Date.now() + state.dayOffset * 864e5 + (state.minuteOffset || 0) * 6e4); }
  function money(c) { return S.formatCents(c, { showZeroCents: c % 100 !== 0 }); }
  function money2(c) { return S.formatCents(c, { showZeroCents: true }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); }
  function tier() { return state.tierId ? S.getTier(state.tierId) : null; }
  // ---- Rewards (rules from core: passport, Grand Tour, referrals; bonus passes roll over a year)
  function bonusLeft() { return S.bonusBalance(state.bonus || [], now()); }
  function totalPassesLeft() { return state.passesLeft + bonusLeft(); }
  function hasBonus(key) { return (state.bonus || []).some(function (g) { return g.key === key; }); }
  function grantBonus(source, key, passes) {
    if (hasBonus(key)) return false;
    var n = now();
    state.bonus.push({ source: source, key: key, passes: passes, used: 0, grantedAt: n.toISOString(), expiresAt: S.bonusExpiry(n).toISOString() });
    return true;
  }
  function liveShopsForPassport() {
    var ago = new Date(now().getTime() - 90 * 864e5).toISOString();
    return memberShops().map(function (x) { return { id: x.id, liveSince: x.custom ? now().toISOString() : ago }; });
  }
  function passport() {
    var visited = state.orders.filter(function (o) { return o.status === "picked_up"; }).map(function (o) { return o.shopId; });
    return S.passportStatus({ visitedShopIds: visited, liveShops: liveShopsForPassport(), passportEarned: hasBonus("passport"), grandTourEarned: !!state.grandTour, now: now() });
  }
  /** After a pickup: maybe complete the passport or the Grand Tour. */
  function awardVisit() {
    var st = passport();
    if (st.passportDue && grantBonus("passport", "passport", S.RULES.passportFreePasses)) {
      setTimeout(function () { toast("🎉 Passport stamped! " + st.goal + " local shops visited. A free day pass is yours, good for a year."); }, 700);
    }
    if (st.grandTour.due) { state.grandTour = true; setTimeout(function () { toast("🏆 Grand Tour complete! " + S.RULES.grandTourFreeMonths + " months free."); }, 900); }
  }
  function friendJoined() {
    state.friends = (state.friends || 0) + 1;
    var granted = (state.bonus || []).filter(function (g) { return g.source === "referral"; }).length;
    var r = S.referralStatus(state.friends, granted);
    for (var i = 0; i < r.rewardsDue; i++) grantBonus("referral", "referral-" + (granted + i + 1), r.passesPerReward);
    return r;
  }
  function bonusLine() {
    var b = bonusLeft(); if (!b) return "";
    var exp = S.bonusExpiresSoonest(state.bonus, now());
    return '<span class="small"><b>+ ' + b + " bonus pass" + (b === 1 ? "" : "es") + "</b> · " + (b === 1 ? "rolls" : "roll") + " over until " + dateFmt.format(exp) + "</span>";
  }
  function passportCard() {
    var st = passport(), gt = st.grandTour, stamps = Math.min(st.visited, st.goal);
    var dots = ""; for (var i = 0; i < st.goal; i++) dots += '<span class="stamp' + (i < stamps ? " on" : "") + '" aria-hidden="true">' + (i < stamps ? "☕" : i + 1) + "</span>";
    return '<div class="card stack" style="gap:10px"><div class="row between"><b style="font-family:var(--head);font-weight:400;font-size:1.3rem">Neighborhood Passport</b>' + (st.passportEarned ? '<span class="badge honey">Stamped!</span>' : "") + "</div>" +
      '<span class="small">' + (st.passportEarned ? "You visited " + st.goal + " local shops and earned a free day pass. Keep exploring!" : "Pick up at " + st.goal + " different shops and get a free day pass.") + "</span>" +
      '<div class="stamps" role="img" aria-label="' + stamps + " of " + st.goal + ' shops visited">' + dots + "</div>" +
      '<div class="tour"><b>🏆 Grand Tour:</b> ' + (gt.earned ? "done! " + S.RULES.grandTourFreeMonths + " months of your plan are on us."
        : gt.unlocked ? "visit every participating shop and get " + S.RULES.grandTourFreeMonths + " months free. " + gt.visitedCounting + " of " + gt.countingShops + " visited."
        : "visit every shop for " + S.RULES.grandTourFreeMonths + " months free. Unlocks once more than " + (gt.minShops - 1) + " shops join (" + gt.liveShops + " so far).") + "</div></div>";
  }
  function inviteCard() {
    var granted = (state.bonus || []).filter(function (g) { return g.source === "referral"; }).length;
    var r = S.referralStatus(state.friends || 0, granted);
    var need = S.RULES.referralFriendsNeeded;
    return '<div class="card stack" style="gap:10px"><b style="font-family:var(--head);font-weight:400;font-size:1.3rem">Bring ' + need + " friends, get " + r.passesPerReward + " passes</b>" +
      '<span class="small">When ' + need + " friends join with your link and start their pass, you get " + r.passesPerReward + " bonus passes. Bonus passes roll over for a year.</span>" +
      '<span class="muted small"><b>' + (need - r.friendsToNext) + " of " + need + " friends joined</b>" + (r.rewardsEarned ? " · " + r.rewardsEarned * r.passesPerReward + " bonus passes earned so far" : "") + "</span>" +
      '<div class="row" style="flex-wrap:wrap;gap:8px"><code class="refcode">' + esc(state.refCode || "") + '</code><button class="pill dark" data-a="share-link">Share my link</button></div>' +
      '<button class="btn ghost" data-a="friend-joined">Demo: a friend joins with my link</button></div>';
  }
  // Demo billing month: 30 demo days from the day you joined (or last renewed).
  function periodStartDate() { return new Date(Date.now() + state.periodStart * 864e5); }
  function periodEndDate() { return new Date(Date.now() + (state.periodStart + 30) * 864e5); }
  function firstName() { return state.user ? esc((state.user.name || "Member").split(" ")[0]) : "Member"; }
  var timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ });
  var dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: TZ });

  var LOGO = S.LOGO_SVG;
  // Cart icon: a simple line drawing that takes the text color (Burnt Sugar in the top bar).
  var CART = '<svg class="cart-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 4h2.2l2.3 10.1a1.6 1.6 0 0 0 1.6 1.2h8.7a1.6 1.6 0 0 0 1.5-1.1L21 7.6H6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.6" cy="19.6" r="1.7" fill="currentColor"/><circle cx="17.2" cy="19.6" r="1.7" fill="currentColor"/></svg>';
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
    help: '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.5-11.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>',
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
    var sw = '<p class="step-label" id="lbl-drink"><span class="dot">1</span>What do you usually order?</p>' +
      '<div class="subswitch" role="radiogroup" aria-labelledby="lbl-drink">' + S.SUB_TIERS.map(function (x) {
      return '<button role="radio" aria-checked="' + (x.id === sub) + '" data-a="pick-sub" data-id="' + x.id + '"><b>' + x.name + " · up to " + money(x.maxPassValueCents) + '</b><span>' + esc(x.examples) + "</span></button>";
    }).join("") + '</div><p class="muted small" style="padding:0 4px">' + esc(current.blurb) + "</p>" +
      '<p class="step-label"><span class="dot">2</span>How often do you go?</p>';
    var cards = S.TIER_GROUPS.map(function (g) {
      var t = g.plans[sub], pop = g.id === S.DEFAULT_TIER_GROUP, sel = selectedId === t.id;
      return '<button class="tier' + (pop ? " popular" : "") + (sel ? " selected" : "") + '" data-a="' + action + '" data-id="' + t.id + '" aria-pressed="' + sel + '" aria-label="' + t.name + ", " + money(t.priceCents) + " a month, " + t.passesPerMonth + ' passes">' +
        (pop ? '<span class="badge honey">Most popular</span>' : "") +
        '<span class="name">' + g.name + '</span><span class="price">' + money(t.priceCents) + '</span>' +
        '<span class="meta" style="margin-top:10px"><b>' + t.passesPerMonth + ' coffees</b>/mo</span><span class="meta">' + esc(g.frequency) + "</span></button>";
    }).join("");
    return sw + '<div class="tiers">' + cards + "</div>";
  }

  // The logo in every top bar is a home button: people expect tapping it to go home.
  function reduceMotion() { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }
  function logoHome() {
    return '<button class="logo" data-a="logo-home" aria-label="Sippy Brew home">' + LOGO + "</button>";
  }

  function landing() {
    var tiers = planCards("pick-tier", null);
    return '<div class="topbar">' + logoHome() + '<button class="pill dark" data-a="login">Log in</button></div>' +
      '<section class="card hero"><span class="sticker" style="align-self:flex-start">New in ' + esc(S.SITE.launchCity) + '</span>' +
      '<h1>Your neighborhood, <em>brewed daily.</em></h1><p class="muted" style="font-size:1.0625rem">One monthly pass. Any local coffee shop.</p>' +
      '<div class="cta"><button class="pill honey" data-a="start-quiz">Get my pass</button>' + BEANS + "</div></section>" +
      '<h2 class="section-title">Pick your pass</h2>' +
      '<button class="card quiz-cta" data-a="start-quiz"><span class="quiz-cta-emoji" aria-hidden="true">☕️</span><span class="grow stack" style="gap:2px;text-align:left"><b>Not sure which pass?</b><span class="muted small">Get matched in two taps.</span></span><span class="pill dark" aria-hidden="true">Take the quiz</span></button>' +
      tiers +
      '<h2 class="section-title">How it works</h2><ol class="steps"><li><span class="dot">1</span>Pick a pass</li><li><span class="dot">2</span>Order ahead from a shop near you</li><li><span class="dot">3</span>Scan at the counter. Sip.</li></ol>' +
      '<p class="demo-note">Own a coffee shop? <button class="linkbtn" data-a="shop-signup">List your shop</button> · <button class="linkbtn" data-a="shop-login">Shop log in</button></p>' +
      '<p class="demo-note">This is a working demo with sample shops. No real payments are made. <button class="linkbtn" data-a="terms">Terms</button> · <button class="linkbtn" data-a="contact">Contact</button></p>';
  }

  // ---- "Get matched" quiz: one question per card; the card swipes away when you answer.
  function quiz() {
    var q = state.quizStep === 0 ? S.QUIZ.drink : S.QUIZ.often;
    var key = state.quizStep === 0 ? "drink" : "often";
    var total = 2;
    return '<div class="topbar"><button class="back" data-a="quiz-back">‹ Back</button>' + logoHome() + "</div>" +
      '<div class="quiz-stage"><section class="card quiz-card" id="quiz-card" aria-labelledby="quiz-q">' +
      '<div class="row between"><span class="badge sky">Question ' + (state.quizStep + 1) + " of " + total + '</span><span class="quiz-dots" aria-hidden="true">' +
      [0, 1].map(function (i) { return '<i class="' + (i <= state.quizStep ? "on" : "") + '"></i>'; }).join("") + "</span></div>" +
      '<h1 id="quiz-q" class="quiz-q">' + esc(q.question) + "</h1>" +
      '<div class="stack" style="gap:10px">' + q.answers.map(function (a) {
        return '<button class="quiz-answer' + (state.quiz[key] === a.id ? " on" : "") + '" data-a="quiz-answer" data-k="' + key + '" data-id="' + a.id + '"><b>' + esc(a.label) + '</b><span class="muted small">' + esc(a.hint) + "</span></button>";
      }).join("") + "</div></section></div>" +
      '<button class="btn ghost" data-a="see-passes">Skip, show me all the passes</button>';
  }

  function quizResultScreen() {
    var r = S.quizResult(S.recommendPlan(state.quiz));
    var t = r.plan;
    return '<div class="topbar"><button class="back" data-a="quiz-back">‹ Back</button>' + logoHome() + "</div>" +
      '<section class="card result-card quiz-in" aria-labelledby="result-h">' +
      '<span class="result-emoji" aria-hidden="true">' + r.emoji + "</span>" +
      '<h1 id="result-h" class="result-h">' + esc(r.headline) + "</h1>" +
      '<p class="result-line">' + esc(r.line) + "</p>" +
      '<div class="result-plan"><span class="badge honey">Your match</span><b class="result-name">' + esc(t.name) + '</b><span class="muted">' + esc(r.summary) + '</span><b class="num result-price">' + money(t.priceCents) + '<span class="muted" style="font-size:1rem;font-family:var(--body)">/month</span></b></div>' +
      '<button class="pill honey" style="width:100%" data-a="find-shops">Find my local shops</button>' +
      '<p class="muted small" style="text-align:center">Change your pass any time. Changes kick in at the start of your next month.</p>' +
      '<div class="row" style="justify-content:center;gap:4px;flex-wrap:wrap"><button class="linkbtn" data-a="retake-quiz">Retake the quiz</button><span class="muted" aria-hidden="true">·</span><button class="linkbtn" data-a="see-passes">See all passes</button></div>' +
      "</section>";
  }

  // ---- Map of local shops (location + radius, capped at 15 miles)
  function project(p, c, radius) {
    var k = 92 / radius; // px per mile; the radius circle is 92px
    var dx = (p.lng - c.lng) * 69.17 * Math.cos((c.lat * Math.PI) / 180);
    var dy = (p.lat - c.lat) * 69;
    return { x: 160 + dx * k, y: 112 - dy * k };
  }
  function mapSvg(split, numbered) {
    var c = here(), r = state.radius || S.RULES.defaultRadiusMiles;
    var pins = split.nearby.map(function (x, i) {
      var pt = project(x, c, r);
      return '<g class="pin"><title>' + esc(x.name) + " · " + S.formatMiles(x.distanceMiles) + "</title>" +
        '<path d="M' + pt.x + " " + (pt.y + 2) + ' l-7 -12 a8 8 0 1 1 14 0 z" fill="#A8642F" stroke="#FBF6EC" stroke-width="1.5"/>' +
        '<text x="' + pt.x + '" y="' + (pt.y - 10.5) + '" text-anchor="middle" font-size="8" font-weight="800" fill="#FBF6EC" font-family="Nunito, sans-serif">' + (numbered ? i + 1 : "") + "</text></g>";
    }).join("");
    return '<svg class="map" viewBox="0 0 320 224" role="img" aria-label="Map: ' + split.nearby.length + " coffee shops within " + r + " miles of " + esc(c.label) + '">' +
      '<rect width="320" height="224" rx="18" fill="#EFE1C4"/>' +
      '<g stroke="#FBF6EC" stroke-width="7" fill="none" stroke-linecap="round" opacity=".9"><path d="M-10 60 C 80 40, 140 95, 330 70"/><path d="M40 -10 C 70 80, 60 150, 110 240"/><path d="M-10 180 C 90 160, 210 200, 330 150"/><path d="M230 -10 C 215 70, 260 140, 240 240"/></g>' +
      '<g stroke="#FBF6EC" stroke-width="2.5" fill="none" opacity=".8"><path d="M0 110 H320"/><path d="M160 0 V224"/><path d="M0 30 L320 200"/></g>' +
      '<circle cx="160" cy="112" r="92" fill="rgba(135,206,235,.22)" stroke="#3B2A1E" stroke-width="1.5" stroke-dasharray="5 4"/>' +
      pins +
      '<circle cx="160" cy="112" r="9" fill="rgba(135,206,235,.45)"/><circle cx="160" cy="112" r="5.5" fill="#87CEEB" stroke="#3B2A1E" stroke-width="2"/>' +
      '<text x="160" y="214" text-anchor="middle" font-size="10" font-weight="700" fill="#6B4F3A" font-family="Nunito, sans-serif">' + r + " mi radius</text></svg>";
  }
  function radiusControl() {
    var r = state.radius || S.RULES.defaultRadiusMiles;
    return '<label class="field" for="radius" style="gap:4px"><span class="row between"><span>Search radius</span><output id="radius-out" class="num">' + r + " mi</output></span>" +
      '<input type="range" id="radius" class="range" min="1" max="' + S.RULES.maxRadiusMiles + '" step="1" value="' + r + '" aria-describedby="radius-help"></label>' +
      '<span id="radius-help" class="muted small">Up to ' + S.RULES.maxRadiusMiles + " miles. We keep it local, so your coffee supports the shops around you.</span>";
  }
  function shopRow(x, i, tappable) {
    var inner = '<span class="map-num' + (i === null ? " far" : "") + '" aria-hidden="true">' + (i === null ? "" : i + 1) + '</span><span class="grow stack" style="gap:2px;text-align:left"><b>' + esc(x.name) + '</b><span class="muted small">' + esc(x.address) + " · " + S.formatMiles(x.distanceMiles) + "</span></span>";
    return tappable ? '<button class="shop-row" data-a="open-shop" data-id="' + x.id + '">' + inner + '<span aria-hidden="true">›</span></button>' : '<div class="shop-row">' + inner + "</div>";
  }
  function localShops(member, memberCards) {
    var split = localSplit();
    var c = here();
    var noneNear = !split.nearby.length;
    var html = '<div class="card stack" style="gap:12px">' +
      '<div class="row between"><span class="small"><b>Near ' + esc(c.label) + "</b></span>" +
      (c.source === "device" ? '<span class="badge sky">Your location</span>' : '<button class="linkbtn" data-a="ask-location" style="min-height:32px;padding:0">Use my location</button>') + "</div>" +
      mapSvg(split, !member) + radiusControl() + "</div>";
    if (noneNear) {
      html += '<div class="card stack"><b>No shops within ' + state.radius + " miles yet</b>" +
        '<span class="muted small">' + (c.source === "device" ? "Sippy Brew is live in West Orange, NJ for now, and we're signing up shops near you." : "Try a bigger radius.") + "</span>" +
        (c.source === "device" ? '<button class="btn line" data-a="use-sample-loc">Preview West Orange</button>' : "") + "</div>";
    } else if (memberCards) {
      // Members get the full shop cards (with descriptions) here instead of a second list.
      html += memberCards;
    } else {
      html += '<h2 class="section-title" style="font-size:1.4rem">' + split.nearby.length + " local shop" + (split.nearby.length === 1 ? "" : "s") + "</h2>" +
        '<div class="card" style="padding:6px 14px">' + split.nearby.map(function (x, i) { return shopRow(x, i, member && !x.far); }).join("") + "</div>";
    }
    if (split.beyond.length) {
      html += '<button class="btn ghost" data-a="toggle-beyond" aria-expanded="' + !!state.showBeyond + '">' + (state.showBeyond ? "Hide" : "See") + " other participating shops (" + split.beyond.length + ")</button>" +
        (state.showBeyond ? '<div class="card stack" style="gap:4px;padding:12px 14px"><span class="muted small">Outside your ' + state.radius + "-mile area. Visiting? These shops take Sippy Brew passes too.</span>" +
          split.beyond.map(function (x) { return shopRow(x, null, false); }).join("") + "</div>" : "");
    }
    return html;
  }
  function locationPrompt() {
    return '<div class="card stack loc-card"><span class="loc-emoji" aria-hidden="true">📍</span><h2 style="font-size:1.5rem">See the coffee shops around you</h2>' +
      '<p class="muted">Turn on location and we\'ll show every participating shop within ' + S.RULES.defaultRadiusMiles + " miles. We only use it to find shops near you.</p>" +
      '<button class="pill honey" style="width:100%" data-a="ask-location">Use my location</button>' +
      '<button class="btn ghost" data-a="use-sample-loc">Not now, show me West Orange</button></div>';
  }
  function nearScreen() {
    var t = S.getTier(state.selectedTier);
    var body = !state.locAsked ? locationPrompt() : localShops(false);
    return '<div class="topbar"><button class="back" data-a="near-back">‹ Back</button>' + logoHome() + "</div>" +
      '<h1 style="font-size:2rem;padding:0 4px">Your local coffee shops</h1>' + body +
      '<div class="sticky-cta"><button class="btn" data-a="get-pass-selected" aria-label="Get my pass: ' + esc(t.name) + ", " + money(t.priceCents) + ' a month">Get my pass · ' + money(t.priceCents) + "/mo</button></div>";
  }

  function faqList(sections, footnote, title) {
    return '<h1 style="font-size:2rem;padding:0 4px">' + title + '</h1><p class="muted" style="padding:0 4px">Tap a question to see the answer.</p>' +
      sections.map(function (sec) {
        return '<section class="stack" style="gap:8px"><h2 class="section-title" style="font-size:1.35rem">' + esc(sec.title) + "</h2>" +
          '<div class="card faq-list">' + sec.items.map(function (it) {
            return '<details class="faq"><summary>' + esc(it.q) + '</summary><p>' + esc(it.a) + "</p></details>";
          }).join("") + "</div></section>";
      }).join("") + '<p class="demo-note">' + esc(footnote) + "</p>";
  }

  function contactScreen() {
    var shop = state.session === "shop";
    return '<div class="topbar"><button class="back" data-a="contact-back">‹ Back</button>' + logoHome() + "</div>" +
      '<h1 style="font-size:2rem;padding:0 4px">Contact us</h1><p class="muted" style="padding:0 4px">Members and coffee shops: we read every message.</p>' +
      '<div class="card stack" style="gap:6px"><b>Email us directly</b><a href="mailto:' + S.SITE.supportEmail + '" style="font-size:1.2rem;font-weight:800;color:var(--burnt-ink)">' + S.SITE.supportEmail + "</a>" +
      '<span class="muted small">About an order (a drink, a mistake, a wait)? The shop that made it can fix it fastest. For your pass, billing, your shop listing or payouts, write to us.</span></div>' +
      (state.contactSent ? '<div class="alert ok" role="status">Thanks! We got your message and will reply soon.</div>' :
        '<form class="card stack" data-form="contact"><label class="field" for="ct-name">Your name<input class="input" id="ct-name" name="name" value="' + esc(shop ? "Jordan Reyes" : (state.user && state.user.name) || "") + '"></label>' +
        '<label class="field" for="ct-email">Email we can reply to<input class="input" id="ct-email" name="email" type="email" value="' + esc(shop ? "owner@shop.example" : (state.user && state.user.email) || "") + '"></label>' +
        '<label class="field" for="ct-topic">I\'m a…<select class="input" id="ct-topic" name="topic"><option value="member"' + (shop ? "" : " selected") + '>Member (coffee drinker)</option><option value="shop"' + (shop ? " selected" : "") + '>Coffee shop</option><option value="other">Something else</option></select></label>' +
        '<label class="field" for="ct-msg">Message<textarea class="input" id="ct-msg" name="message" rows="4"></textarea></label>' +
        '<button class="btn" type="submit">Send message</button><span class="demo-note" style="text-align:left;padding:0">Demo: nothing is sent. In the real app this goes to ' + S.SITE.supportEmail + ".</span></form>");
  }

  function faqScreen() {
    return '<div class="topbar"><button class="back" data-a="faq-back">‹ Back</button>' + logoHome() + "</div>" +
      '<h1 style="font-size:2rem;padding:0 4px">FAQ</h1>' +
      '<p class="muted" style="padding:0 4px">Tap a question to see the answer.</p>' +
      S.FAQ.map(function (sec) {
        return '<section class="stack" style="gap:8px"><h2 class="section-title" style="font-size:1.35rem">' + esc(sec.title) + "</h2>" +
          '<div class="card faq-list">' + sec.items.map(function (it) {
            return '<details class="faq"><summary>' + esc(it.q) + '</summary><p>' + esc(it.a) + "</p></details>";
          }).join("") + "</div></section>";
      }).join("") +
      '<p class="demo-note">' + esc(S.FAQ_FOOTNOTE) + ' <button class="linkbtn" data-a="terms">Read the Terms</button></p>';
  }

  function termsScreen() {
    return '<div class="topbar"><button class="back" data-a="terms-back">‹ Back</button>' + logoHome() + "</div>" +
      '<h1 style="font-size:2rem;padding:0 4px">Terms, in plain words</h1>' +
      '<div class="card stack terms">' + S.PLATFORM_ROLE_TERMS.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") +
      '<p class="muted small">This is the demo summary. The full Terms of Service apply in the real app.</p></div>';
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
      '<div class="card stack" style="border:2px solid var(--danger)"><b>No food, whatsoever</b><span class="small">' + esc(S.FOOD_POLICY) + '</span>' +
      '<label class="row" for="food-ok" style="gap:10px;align-items:flex-start;font-weight:700;cursor:pointer"><input id="food-ok" name="foodpolicy" type="checkbox" style="width:22px;height:22px;accent-color:var(--burnt);flex-shrink:0;margin-top:2px"><span>I understand: my shop will sell only drinks through Sippy Brew, and selling food means removal.</span></label></div>' +
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
      '<div class="card stack"><p><b>' + t.name + "</b>: " + t.passesPerMonth + " coffees a month, up to " + money2(t.maxPassValueCents) + " each, " + money(t.priceCents) + "/mo. Each pass covers the first " + money2(t.maxPassValueCents) +
      " of that day's order. Unused passes expire at renewal.</p>" +
      (state.tierId ? '<p class="muted small">Plan changes start with your next month, on ' + dateFmt.format(periodEndDate()) + ". This month stays as it is.</p>" : '<p class="muted small">Change your pass any time. Changes kick in at the start of your next month.</p>') +
      '<button class="btn" data-a="checkout"' + (state.tierId === t.id ? " disabled" : "") + ">" + (state.tierId === t.id ? "This is your current plan" : state.tierId ? "Switch from " + dateFmt.format(periodEndDate()) : "Continue · " + money(t.priceCents) + "/month") + "</button></div>";
  }

  /** Before paying: price, renewal, expiry, refunds, cancellation, and a required "I agree". */
  function purchaseSummaryHtml(t) {
    var sm = S.purchaseSummary(t), parts = S.CONSENT_LABEL.split("Terms of Service");
    return '<div class="summary-box"><b>' + esc(sm.title) + '</b><ul>' + sm.lines.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>" +
      '<label for="agree" class="agree"><input id="agree" type="checkbox" data-a="agree" ' + (state.agreed ? "checked" : "") + '><span>' + esc(parts[0]) +
      '<button class="linkbtn" style="min-height:0;padding:0" data-a="terms">Terms of Service</button>' + esc(parts[1]) + "</span></label></div>";
  }

  function checkoutSheet() {
    var t = S.getTier(state.selectedTier);
    return '<div class="sheet-back" data-a="close-sheet"><div class="sheet" role="dialog" aria-modal="true" aria-label="Checkout" data-stop>' +
      '<p class="badge">Demo checkout</p><h2 style="font-size:1.6rem">' + t.name + " · " + money(t.priceCents) + "/month</h2>" +
      (state.tierId ? '<p class="muted">No charge today. Your new pass starts ' + dateFmt.format(periodEndDate()) + ", when your next month begins.</p>" : purchaseSummaryHtml(t)) +
      '<p class="muted small">In the real app this opens Stripe Checkout, so card numbers never touch Sippy Brew. Nothing is charged here.</p>' +
      '<button class="btn" data-a="pay"' + (!state.tierId && !state.agreed ? " disabled" : "") + ">" + (state.tierId ? "Confirm the switch (demo)" : "Pay " + money(t.priceCents) + " (demo)") + "</button>" +
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
    var n = state.session === "member" ? cartCount() : 0;
    return '<div class="topbar">' + logoHome() + (state.session === "member" ? '<button class="cart-btn" data-a="view-cart" aria-label="Cart, ' + n + ' item' + (n === 1 ? "" : "s") + '">' + CART + (n ? '<span class="cart-count">' + n + "</span>" : "") + "</button>" : "") + "</div>";
  }

  // ---- Member app
  function passStatus() {
    var today = S.dayKey(now(), TZ);
    if (state.passDaysUsed.indexOf(today) >= 0) return '<span class="badge">Today\'s pass used</span>';
    if (totalPassesLeft() < 1) return '<span class="badge">No passes left</span>';
    return '<span class="badge sky">Today\'s pass ready</span>';
  }

  function upgradeInfo() {
    var t = tier(); if (!t) return null;
    var to = S.upgradeOffer(t, state.passesLeft); if (!to) return null;
    var since = periodStartDate().getTime() - 864e5;
    var periodOrders = state.orders.filter(function (o) { return new Date(o.createdAt).getTime() >= since; }).map(function (o) { return { overageCents: o.overageCents, status: o.status }; });
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
    var list = localSplit().nearby.filter(function (s) { return !s.far; }).map(function (s) {
      return '<button class="card shop-card" data-a="open-shop" data-id="' + s.id + '"><span class="thumb"><span class="logo" style="width:40px;height:40px">' + LOGO + '</span></span>' +
        '<span class="grow stack" style="gap:2px"><b style="font-family:var(--head);font-weight:400;font-size:1.2rem">' + esc(s.name) + '</b>' +
        '<span class="muted small">' + esc(s.address) + '</span><span class="small"><b>' + (isPaused(s.id) ? "Not taking orders" : "Open now") + "</b> · " + s.hours + " · " + S.formatMiles(s.distanceMiles) + (isSpotlight(s.id) ? ' · <span class="badge honey">Spotlight</span>' : s.custom ? ' · <span class="badge sky">New</span>' : "") + '</span>' +
        '<span class="muted small">' + esc(s.story) + "</span></span></button>";
    }).join("");
    return '<div class="row between" style="padding:0 4px"><h1 style="font-size:2rem">Hi, ' + firstName() + "</h1>" + passStatus() + "</div>" +
      (state.notices || []).map(function (n, i) { return '<div class="card stack notice-card" role="status"><b>☕ Missed your coffee?</b><span class="small">' + esc(n) + '</span><button class="linkbtn" style="align-self:flex-start;min-height:32px;padding:0" data-a="dismiss-notice" data-id="' + i + '">Got it</button></div>'; }).join("") +
      (up && up.suggested ? upgradeCard(up, true) : "") +
      '<div class="card stack" style="gap:8px"><div class="row between"><span class="muted small">Daily Passes left this month</span><b class="num">' + state.passesLeft + " of " + t.passesPerMonth + "</b></div>" +
      '<div class="meter" role="meter" aria-label="Passes left" aria-valuemin="0" aria-valuemax="' + t.passesPerMonth + '" aria-valuenow="' + state.passesLeft + '"><span style="width:' + Math.round((100 * state.passesLeft) / t.passesPerMonth) + '%"></span></div>' +
      '<span class="muted small">Each pass covers the first ' + money2(t.maxPassValueCents) + " of one day's order.</span>" + bonusLine() + "</div>" + passportCard() +
      '<h2 class="section-title">Shops near you</h2>' + localShops(true, list ? '<div class="stack">' + list + "</div>" : "");
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
      '<button class="btn" data-a="add-custom">' + (state.editLine !== null && state.editLine !== undefined ? "Save changes · " : "Add to cart · ") + money2(unit * state.cqty) + "</button></div></div>";
  }

  function cartCount() { return state.cart.reduce(function (a, l) { return a + l.quantity; }, 0); }
  function cartTotal() {
    if (!state.cartShop || !state.cart.length) return 0;
    var pr = S.priceOrder(state.cart, menuForOrder(shopById(state.cartShop)), state.cartShop);
    return pr.ok ? pr.totalCents : 0;
  }
  /** "View cart" bar, shown wherever there's something in the cart. */
  function cartBar() {
    var n = cartCount(); if (!n) return "";
    return '<div class="sticky-cta cart-bar"><button class="btn" data-a="view-cart"><span class="row" style="gap:8px">' + CART + "View cart · " + n + " item" + (n === 1 ? "" : "s") + "</span><span class=\"num\">" + money2(cartTotal()) + "</span></button></div>";
  }

  function shopDetail(id) {
    var s = shopById(id);
    var other = state.cart.length && state.cartShop && state.cartShop !== id;
    var items = s.menu.map(function (m) {
      var out = !!state.soldOut[m.id], custom = m.modifierGroups.length > 0;
      var inCart = state.cartShop === id ? state.cart.filter(function (l) { return l.menuItemId === m.id; }).reduce(function (a, l) { return a + l.quantity; }, 0) : 0;
      return '<div class="menu-item"><div class="grow"><b>' + esc(m.name) + "</b>" + (inCart ? ' <span class="badge sky">' + inCart + " in cart</span>" : "") + '<div class="muted small">' + m.size + " · " + money2(m.priceCents) + (out ? ' · <span style="color:var(--danger);font-weight:700">Sold out</span>' : custom ? " · Customizable" : "") + (S.priceRecentlyUpdated(m.priceChangedAt, now()) ? ' <span class="badge honey">Price updated</span>' : "") + "</div></div>" +
        (out || other ? "" : '<button class="btn line" style="width:auto;padding:0 16px;min-height:44px;font-size:.95rem" data-a="' + (custom ? "open-customize" : "add-plain") + '" data-id="' + m.id + '">' + (custom ? "Customize" : "Add") + "</button>") + "</div>";
    }).join("");
    return '<button class="back" data-a="back">‹ Shops</button>' +
      '<div style="padding:0 4px" class="stack"><h1 style="font-size:2rem">' + esc(s.name) + '</h1><p class="muted">' + esc(s.address) + "</p><p>" + esc(s.story) + "</p></div>" +
      (other ? '<div class="card stack notice-card"><b>Your cart has coffee from ' + esc(shopById(state.cartShop).name) + "</b><span class=\"muted small\">One pass covers one order at one shop. Start a new cart here, or go back to your cart.</span>" +
        '<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn small" style="width:auto;padding:0 16px" data-a="new-cart" data-id="' + id + '">Start a new cart here</button><button class="btn ghost" style="width:auto" data-a="view-cart">View my cart</button></div></div>' : "") +
      '<div class="card">' + items + "</div>" + cartBar();
  }

  function cartScreen() {
    var id = state.cartShop, s = shopById(id), t = tier();
    var items = s.menu.map(function (m) {
      var out = !!state.soldOut[m.id], custom = m.modifierGroups.length > 0;
      var inCart = state.cart.filter(function (l) { return l.menuItemId === m.id; }).reduce(function (a, l) { return a + l.quantity; }, 0);
      return '<div class="menu-item"><div class="grow"><b>' + esc(m.name) + "</b>" + (inCart ? ' <span class="badge sky">' + inCart + " in order</span>" : "") + '<div class="muted small">' + m.size + " · " + money2(m.priceCents) + (out ? ' · <span style="color:var(--danger);font-weight:700">Sold out</span>' : custom ? " · Customizable" : "") + (S.priceRecentlyUpdated(m.priceChangedAt, now()) ? ' <span class="badge honey">Price updated</span>' : "") + "</div></div>" +
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
        '<div class="row" style="gap:8px;margin-top:6px;flex-wrap:wrap"><div class="stepper"><button data-a="cart-bump" data-id="' + li + '" data-d="-1" aria-label="One fewer">−</button><button data-a="cart-bump" data-id="' + li + '" data-d="1" aria-label="One more" ' + (l.quantity >= S.MAX_QUANTITY_PER_LINE ? "disabled" : "") + ">+</button></div>" +
        (item && item.modifierGroups.length ? '<button class="linkbtn" style="min-height:36px;padding:0 4px" data-a="edit-line" data-id="' + li + '">Edit</button>' : "") +
        '<button class="linkbtn" style="min-height:36px;padding:0 4px;color:var(--danger)" data-a="remove-line" data-id="' + li + '">Remove</button></div></div>' +
        '<b class="num">' + (p ? money2(p.lineTotalCents) : "") + "</b></div>";
    }).join("") + "</div>" : "";
    var base = S.splitPassValue(total, t.maxPassValueCents);
    var spareBonus = S.bonusForOverageAvailable(totalPassesLeft(), bonusLeft());
    var bonusCover = state.useBonus && spareBonus > 0 ? S.bonusOverageCover(base.overageCents, t.maxPassValueCents) : 0;
    // What the member pays after any bonus pass they chose to use.
    var split = { passCoveredCents: base.passCoveredCents + bonusCover, overageCents: base.overageCents - bonusCover };
    var pass = S.checkPassAvailable({ passesLeft: totalPassesLeft(), passDaysUsed: state.passDaysUsed, now: now(), timeZone: TZ });
    var hasOver = split.overageCents > 0;
    var confirmed = !hasOver || state.confirmedOverage === split.overageCents;
    var slots = S.pickupSlots(now(), ALL_DAY, TZ).slice(0, 12);
    var chips = slots.map(function (d, i) { return '<button class="chip" data-a="pickup" data-id="' + i + '" aria-pressed="' + (i === state.pickupIdx) + '">' + timeFmt.format(d) + "</button>"; }).join("");
    var label = hasOver ? "Use pass + pay " + money2(split.overageCents) + " overage" : "Use today's pass";
    if (!state.cart.length) {
      return '<button class="back" data-a="back">‹ Back</button><h1 style="font-size:2rem;padding:0 4px">Your cart</h1>' +
        '<div class="card stack" style="align-items:center;text-align:center"><span class="cart-empty-ico">' + CART + '</span><b>Your cart is empty</b><span class="muted small">Pick a shop and add a coffee.</span>' +
        '<button class="btn" data-a="tab" data-id="shops">Find a shop</button></div>';
    }
    return '<button class="back" data-a="cart-back">‹ ' + esc(s.name) + "</button>" +
      '<h1 style="font-size:2rem;padding:0 4px">Your cart</h1><p class="muted" style="padding:0 4px;margin-top:-12px">From ' + esc(s.name) + "</p>" +
      '<div class="card stack"><h2 style="font-size:1.4rem">Items</h2>' + cartHtml +
      '<button class="btn line" data-a="open-shop" data-id="' + s.id + '">+ Add more from ' + esc(s.name) + "</button>" + (priced && !priced.ok ? '<div class="alert" role="alert">' + esc(priced.message) + "</div>" : "") +
      '<div class="lines"><div class="row"><span class="muted">Pass covers (first ' + money2(t.maxPassValueCents) + ')</span><b class="num">' + money2(base.passCoveredCents) + "</b></div>" +
      (bonusCover ? '<div class="row"><span class="muted">Bonus pass toward the overage</span><b class="num">' + money2(bonusCover) + "</b></div>" : "") +
      '<div class="row"><span class="muted">Overage</span><b class="num">' + money2(split.overageCents) + "</b></div>" +
      '<div class="row total"><span>Order total</span><span class="num">' + money2(total) + "</span></div></div>" +
      (base.overageCents > 0 && spareBonus > 0 ? '<label class="bonus-opt" for="ub"><input id="ub" type="checkbox" data-a="use-bonus" ' + (state.useBonus ? "checked" : "") + '><span><b>Use a bonus pass toward the overage</b><span class="muted small" style="display:block">It covers up to ' + money2(Math.min(base.overageCents, t.maxPassValueCents)) + " of the " + money2(base.overageCents) + " overage. You have " + spareBonus + " bonus pass" + (spareBonus === 1 ? "" : "es") + " to use.</span></span></label>" : "") +
      (hasOver ? '<div class="confirm"><b>This order is ' + money2(split.overageCents) + " over your pass.</b>" +
        '<span class="muted small">' + (S.overageIsCharged(split.overageCents) ? "It's charged to your card on file when the shop hands over your order, at the shop's menu prices. It goes 100% to the shop." : "Overages under " + money2(S.RULES.minOverageChargeCents) + " are waived, so you won't be charged for this one.") + "</span>" +
        '<label for="ov"><input id="ov" type="checkbox" data-a="confirm-overage" data-amount="' + split.overageCents + '" ' + (confirmed ? "checked" : "") + "><span>I confirm the " + money2(split.overageCents) + " overage. My pass covers " + money2(split.passCoveredCents) + " of the " + money2(total) + " total.</span></label>" +
        (upgradeInfo() && S.overageCoveredByUpgrade(t, total) > 0 ? '<span class="small" style="background:var(--cream);border-radius:12px;padding:8px 10px">Tip: on <b>' + S.upgradeTarget(t).name + "</b>, " + money2(S.overageCoveredByUpgrade(t, total)) + ' of this overage would be covered by your pass. <button class="linkbtn" style="min-height:0;padding:0" data-a="goto-upgrade">See upgrade</button></span>' : "") +
        "</div>" : "") +
      '<span class="muted small">' + state.passesLeft + " of " + t.passesPerMonth + " passes left" + (bonusLeft() ? " + " + bonusLeft() + " bonus" : "") + " · one pass per day</span>" +
      '<label class="field" for="o-allergy" style="gap:4px">Allergies<span class="muted small" style="font-weight:400">Any allergies? Tell the shop here so it shows on your order, and remind the barista at pickup.</span>' +
      '<input class="input" id="o-allergy" data-a="order-allergy" maxlength="' + S.RULES.orderNoteMaxChars + '" placeholder="e.g. tree nuts, dairy" value="' + esc(state.orderAllergy || "") + '"></label>' +
      '<label class="field" for="o-note" style="gap:4px">Note for the barista <span class="muted small" style="font-weight:400">(optional)</span>' +
      '<input class="input" id="o-note" data-a="order-note" maxlength="' + S.RULES.orderNoteMaxChars + '" placeholder="e.g. extra hot, light ice" value="' + esc(state.orderNote || "") + '"></label>' +
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
    var title = o.status === "ready" ? "Ready for pickup!" : o.status === "picked_up" ? "Enjoy!" : o.status === "cancelled" ? "Order cancelled" : o.status === "no_show" ? "Not picked up" : "Show this at the counter";
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
      (open ? '<button class="btn line" data-a="demo-pickup" data-id="' + o.id + '">Demo: the shop scans it</button><p class="demo-note">Or sign out on the Account tab and tap <b>Shop log in</b> to scan it from the shop side.</p>' : "");
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
      (state.pendingTier ? '<div class="alert ok" role="status" style="color:var(--espresso);border-color:var(--honey)">Switching to <b>' + S.getTier(state.pendingTier).name + "</b> on " + dateFmt.format(periodEndDate()) + '. <button class="linkbtn" style="min-height:0;padding:0" data-a="keep-plan">Keep my current plan</button></div>' : "") +
      '<span class="muted small">Change your pass any time. Changes start with your next month, on ' + dateFmt.format(periodEndDate()) + ".</span>" +
      '<button class="btn line" data-a="change-plan">Change plan</button></div>' +
      (upgradeInfo() ? upgradeCard(upgradeInfo(), upgradeInfo().suggested) : "") +
      '<div class="card stack"><div class="row between"><span class="muted small">Daily Passes this month</span>' + passStatus() + "</div>" +
      '<b style="font-size:1.75rem" class="num">' + state.passesLeft + ' <span class="muted" style="font-size:1rem;font-weight:400">of ' + t.passesPerMonth + " left</span></b>" +
      '<div class="meter"><span style="width:' + Math.round((100 * state.passesLeft) / t.passesPerMonth) + '%"></span></div>' +
      '<span class="muted small">Unused monthly passes expire at renewal. Bonus passes roll over for a year.</span>' + bonusLine() + "</div>" +
      inviteCard() +
      (state.lastEmail ? '<details class="card email-preview"><summary><b>📧 Your confirmation email</b><span class="muted small">Sent when you joined: your terms and how to cancel</span></summary><p class="muted small"><b>' + esc(state.lastEmail.subject) + "</b></p><pre>" + esc(state.lastEmail.text) + "</pre></details>" : "") +
      '<button class="card faq-cta" data-a="contact"><span aria-hidden="true" style="font-size:1.6rem">✉️</span><span class="grow stack" style="gap:2px;text-align:left"><b>Contact us</b><span class="muted small">' + esc(S.SITE.supportEmail) + '</span></span><span aria-hidden="true" style="font-size:1.4rem">›</span></button>' +
      '<button class="card faq-cta" data-a="faq"><span aria-hidden="true" style="font-size:1.6rem">❓</span><span class="grow stack" style="gap:2px;text-align:left"><b>Questions?</b><span class="muted small">Passes, orders, billing, rewards and who to contact.</span></span><span aria-hidden="true" style="font-size:1.4rem">›</span></button>' +
      '<div class="card stack"><b>Demo controls</b><span class="muted small">Today in the demo: ' + dateFmt.format(now()) + ". You get one pass a day, so move to the next day to order again.</span>" +
      '<button class="btn line" data-a="new-day">Start the next day</button><button class="btn line" data-a="new-month">Skip to next month</button><button class="btn danger" data-a="reset">Reset the demo</button></div>' +
      '<button class="btn line" data-a="sign-out">Sign out</button>' +
      '<p class="demo-note"><button class="linkbtn" data-a="terms">Terms</button> · Questions about an order go to the shop that made it.</p>';
  }

  // ---- Shop app
  function counterPicker() {
    var st = shopStatus(state.counterShop);
    return '<p class="muted small" style="padding:0 4px;font-weight:800;text-transform:uppercase;letter-spacing:.06em">' + esc(shopById(state.counterShop).name) + "</p>" +
      (st === "pending" ? '<div class="alert ok" role="status" style="color:var(--espresso);border-color:var(--honey)">Your shop is waiting for approval. Members can\'t see it yet. We\'ll email you as soon as you\'re live.</div>' : "") +
      ((state.removed || {})[state.counterShop] ? removedCard() : st === "paused" ? '<div class="alert" role="alert">Your shop is paused by Sippy Brew and hidden from members. Contact support.</div>' : "");
  }
  function removedCard() {
    var appeal = (state.appeals || {})[state.counterShop];
    return '<div class="card stack removed-card" role="alert"><b style="color:var(--danger);font-size:1.15rem">Your shop was removed for selling food</b>' +
      '<span class="small">Sippy Brew is drinks only, with no exceptions. Your shop is hidden from members and can\'t take orders. If this happened by genuine error rather than misrepresentation, you can appeal once.</span>' +
      (appeal ? '<b>We have your appeal and will email you our decision.</b>' :
        '<form class="stack" data-form="appeal" style="gap:8px"><label class="field" for="appeal-note">Appeal: tell us what happened<textarea class="input" id="appeal-note" name="note" rows="3" maxlength="1000" placeholder="e.g. We meant the dragonfruit topping for our refresher, not fruit. We\'ve renamed it."></textarea></label><button class="btn" type="submit">Send appeal</button></form>') +
      "</div>";
  }

  /** "Start at" glows and breathes as the start time gets close; "Start now" pulses stronger. */
  function startAt(o) {
    var u = o.status === "received" ? S.prepUrgency(o.pickupAt, now()) : "later";
    var label = u === "now" ? "Start now" : u === "late" ? "Due now: start it" : "Start at " + timeFmt.format(S.startMakingAt(o.pickupAt));
    return '<span class="start-at ' + u + '"' + (u === "later" ? "" : ' role="status"') + ">" + (u === "later" ? "" : '<span aria-hidden="true">●</span>') + label + "</span>";
  }

  function shopOrdersTab() {
    var list = state.orders.filter(function (o) { return o.shopId === state.counterShop && OPEN.indexOf(o.status) >= 0; });
    var cards = list.map(function (o) {
      var next = S.nextStatus(o.status);
      var canNoShow = S.canFlagNoShow({ status: o.status, pickupAt: o.pickupAt }, now()).ok;
      return '<div class="card stack' + (o.allergy ? " allergy-card" : "") + '"' + (o.status === "ready" && !o.allergy ? ' style="box-shadow:0 0 0 3px var(--sky)"' : "") + ">" +
        (o.allergy ? '<div class="allergy-notice" role="alert"><b>⚠️ ALLERGY NOTICE</b><span>' + esc(o.allergy) + "</span></div>" : "") +
        '<div class="row between"><h2 style="font-size:1.6rem">' + firstName() + '</h2><span class="badge' + (o.status === "ready" ? " sky" : "") + '">' + LABEL[o.status] + "</span></div>" +
        '<span class="muted"><b>Pickup ' + timeFmt.format(new Date(o.pickupAt)) + "</b></span>" + startAt(o) +
        (o.note ? '<div class="order-note"><b>Note:</b> ' + esc(o.note) + "</div>" : "") +
        o.items.map(function (i) { return '<div style="font-size:1.2rem">' + i.quantity + "× " + esc(i.name) + ' <span class="muted">(' + i.size + ")</span>" + (i.options && i.options.length ? '<div style="font-size:1rem;font-weight:800;color:var(--burnt-ink)">' + esc(S.describeOptions(i.options)) + "</div>" : "") + "</div>"; }).join("") +
        '<span class="muted small">' + money2(o.totalCents) + " · Daily Pass" + (o.overageCents ? " + " + money2(o.overageCents) + " overage (paid in app, 100% yours)" : "") + "</span>" +
        (next && next !== "picked_up" ? '<button class="btn" data-a="advance" data-id="' + o.id + '">Mark ' + LABEL[next].toLowerCase() + "</button>" : "") +
        (o.status === "ready" ? '<button class="btn" data-a="shop-tab" data-id="scan">Scan to hand off</button>' : "") +
        (canNoShow ? (state.confirmNoShow === o.id
          ? '<div class="confirm"><b>Mark as not picked up?</b><span class="muted small">It isn\'t refunded: the member\'s pass stays used and you\'re paid for it. We\'ll let them and Sippy Brew know.</span><button class="btn" data-a="no-show-yes" data-id="' + o.id + '">Yes, not picked up</button><button class="btn ghost" data-a="no-show-no">Not yet</button></div>'
          : '<button class="btn line" data-a="no-show" data-id="' + o.id + '">Not picked up</button>') : "") +
        (o.status === "received" ? '<button class="btn ghost" data-a="cancel" data-id="' + o.id + '">Cancel order</button>' : '<span class="muted small">Can\'t be cancelled once you\'ve started preparing it.</span>') + "</div>";
    }).join("");
    var accepting = !isPaused(state.counterShop);
    return counterPicker() +
      '<label class="card row between" for="accepting" style="cursor:pointer"><span class="stack" style="gap:2px"><b>' + (accepting ? "Accepting orders" : "Paused") + '</b><span class="muted small">' +
      (accepting ? "Members can order from you now." : "Members can see your shop but can't order.") + '</span></span>' +
      '<input id="accepting" type="checkbox" data-a="accepting" ' + (accepting ? "checked" : "") + ' style="width:26px;height:26px;accent-color:var(--success)"></label>' +
      '<h1 style="font-size:2rem;padding:0 4px">Live orders</h1>' +
      '<div class="tip-card"><b>Make Sippy Brew orders close to pickup.</b> Each order shows when to start (' + S.RULES.prepLeadMinutes + " minutes before pickup), so drinks are fresh and fewer are wasted if someone doesn't show.</div>" +
      (list.length ? '<button class="btn ghost" data-a="skip-ahead">Demo: jump ahead 45 minutes</button>' : "") +
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

  // Sample of what reading a menu photo returns (the real app sends the photo to Claude).
  var SAMPLE_SCAN = [
    { name: "Honey Oat Latte", size: "12 oz", price: 6.25, category: "specialty" },
    { name: "Cappuccino", size: "8 oz", price: 4.5, category: "espresso" },
    { name: "Cold Brew", size: "16 oz", price: 4.75, category: "cold" },
    { name: "House Drip", size: "12 oz", price: 2.75, category: "brewed" },
    { name: "Almond Croissant", price: 4.25, category: "food" },
    { name: "Seasonal Special", price: null },
  ];
  function photoImportCard() {
    var rows = state.scanRows;
    var head = '<div class="card stack photo-card"><b style="font-family:var(--head);font-weight:400;font-size:1.3rem">📸 Add items from a photo</b>' +
      '<span class="muted small">Snap your menu board or printed menu. We fill in the coffee drinks and prices for you to check.</span>';
    if (state.scanning) return head + '<div class="tip-card">Reading your menu…</div></div>';
    if (!rows) return head + '<label class="pill dark" for="menu-photo" style="align-self:flex-start;cursor:pointer">Take or upload a photo</label>' +
      '<input id="menu-photo" type="file" accept="image/*" capture="environment" data-a="menu-photo" class="sr-only">' +
      '<span class="demo-note" style="text-align:left;padding:0">Demo: any photo shows sample results. The real app reads your actual menu.</span></div>';
    return head + "<b>Check these before adding. Untick anything you don't want.</b>" +
      rows.map(function (r, i) {
        return '<div class="scan-row"><label class="row small" style="gap:8px;font-weight:700"><input type="checkbox" data-a="scan-keep" data-i="' + i + '" ' + (r.keep ? "checked" : "") + ' style="width:22px;height:22px;accent-color:var(--burnt)">Add</label>' +
          '<input class="input" aria-label="Name" data-a="scan-field" data-i="' + i + '" data-k="name" value="' + esc(r.name) + '">' +
          '<div class="row" style="gap:8px"><input class="input" aria-label="Size" data-a="scan-field" data-i="' + i + '" data-k="size" value="' + esc(r.size) + '">' +
          '<input class="input" aria-label="Price" inputmode="decimal" data-a="scan-field" data-i="' + i + '" data-k="price" value="' + esc(r.price) + '"></div></div>';
      }).join("") +
      (state.scanSkipped.length ? '<span class="muted small">Left out: ' + esc(state.scanSkipped.map(function (x) { return x.name + " (" + x.reason.toLowerCase() + ")"; }).join(", ")) + ".</span>" : "") +
      '<button class="btn" data-a="scan-add">Add ' + rows.filter(function (r) { return r.keep; }).length + ' items to my menu</button><button class="btn ghost" data-a="scan-discard">Discard</button></div>';
  }

  function shopMenuTab() {
    var s = shopById(state.counterShop);
    return counterPicker() + '<h1 style="font-size:2rem;padding:0 4px">Menu</h1>' + photoImportCard() +
      '<div class="tip-card" style="border:2px solid var(--danger)"><b>Drinks only, no food whatsoever.</b> Name add-ons for what they are, like "Cookie syrup" or "Dragonfruit topping". Shops caught selling food are removed from Sippy Brew.</div>' +
      '<div class="tip-card"><b>Changed a price?</b> Update it here right away. Your Sippy Brew menu is how members are told, and they see the price before they order.</div>' +
      '<div class="card">' +
      s.menu.map(function (m) {
        var out = !!state.soldOut[m.id];
        return '<div class="menu-item"><div class="grow"><b>' + esc(m.name) + '</b><div class="muted small">' + m.size + " · " + money2(m.priceCents) + (S.priceRecentlyUpdated(m.priceChangedAt, now()) ? ' <span class="badge honey">Price updated</span>' : "") + "</div>" +
          '<form class="row price-form" data-form="price" data-id="' + m.id + '" style="gap:6px;margin-top:6px"><input class="input" name="price" inputmode="decimal" aria-label="New price for ' + esc(m.name) + '" value="' + (m.priceCents / 100).toFixed(2) + '" style="min-height:40px;max-width:96px;padding:6px 10px"><button class="btn small" type="submit" style="width:auto;min-height:40px;padding:0 14px">Update price</button></form></div>' +
          '<div class="stack" style="gap:4px;align-items:flex-end"><label class="row small" style="font-weight:700;min-height:44px"><input type="checkbox" data-a="sold-out" data-id="' + m.id + '" ' + (out ? "checked" : "") + ' style="width:22px;height:22px;accent-color:var(--burnt)">Sold out today</label>' +
          '<button class="linkbtn" style="min-height:36px;padding:0" data-a="edit-mods" data-id="' + m.id + '" aria-expanded="' + (state.editMods === m.id) + '">Customizations' + (m.modifierGroups.length ? " (" + m.modifierGroups.length + ")" : "") + "</button></div></div>" +
          (state.editMods === m.id ? modsEditor(m) : (m.modifierGroups.length ? '<p class="muted small" style="margin:-4px 0 8px">' + esc(m.modifierGroups.map(function (g) { return g.name + ": " + g.options.map(function (o) { return o.name + (o.priceCents ? " +" + money2(o.priceCents) : ""); }).join(", "); }).join(" · ")) + "</p>" : ""));
      }).join("") + "</div>" +
      (state.shopError ? '<div class="alert" role="alert">' + esc(state.shopError) + "</div>" : "") +
      '<form class="card stack" data-form="menu-add"><b>Add a drink</b><span class="muted small">Drinks only, no food whatsoever. Try adding "Apples" to see it blocked.</span>' +
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
    // No-shows are paid like pickups.
    var done = state.orders.filter(function (o) { return o.shopId === state.counterShop && (o.status === "picked_up" || o.status === "no_show") && o.redeemedAt && S.isWithin(new Date(o.redeemedAt), week); });
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
      : member ? [["shops", "Shops", "map"], ["orders", "Order", "cup"], ["account", "Account", "user"]] : [["orders", "Orders", "list"], ["scan", "Scan", "scan"], ["menu", "Menu", "cup"], ["dashboard", "Dashboard", "chart"], ["faq", "FAQ", "help"]];
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
    var redeemed = state.orders.filter(function (o) { return (o.status === "picked_up" || o.status === "no_show") && o.redeemedAt && S.isWithin(new Date(o.redeemedAt), month); });
    var sum = S.summarizePayout(redeemed.map(function (o) { return { passCoveredCents: o.passCoveredCents, overageCents: o.overageCents }; }));
    var pending = allShops().filter(function (x) { return shopStatus(x.id) === "pending"; });
    return '<h1 style="font-size:2rem;padding:0 4px">Overview</h1><div class="stats">' +
      '<div class="stat"><span class="muted small">Active subscriptions</span><b>' + members + '</b><span class="muted small">' + (t ? t.name : "None yet") + "</span></div>" +
      '<div class="stat"><span class="muted small">Monthly revenue</span><b>' + money(t ? t.priceCents : 0) + "</b></div>" +
      '<div class="stat"><span class="muted small">Commission this month</span><b>' + money2(sum.commissionCents) + '</b><span class="muted small">' + sum.orderCount + " redemptions</span></div>" +
      (function () {
        // What Sippy Brew keeps: revenue − shop payouts − card fees (commission + unused passes).
        var tk = S.platformTake({ planPricesCents: t ? [t.priceCents] : [], shopNetCents: sum.netCents });
        return '<div class="stat"><span class="muted small">You keep (so far)</span><b>' + money2(tk.keepCents) + '</b><span class="muted small">Revenue − ' + money2(tk.shopPayoutCents) + " to shops − " + money2(tk.cardFeesCents) + " card fees</span></div>";
      })() +
      '<div class="stat"><span class="muted small">Failed payments</span><b>0</b></div></div>' +
      ((state.teamAlerts || []).length ? '<div class="card stack" style="border:2px solid var(--honey)"><div class="row between"><b>No-shows</b><span class="badge honey">' + state.teamAlerts.length + "</span></div>" +
        state.teamAlerts.slice(0, 6).map(function (a) { return '<div class="small" style="border-top:1px solid var(--latte);padding-top:8px"><b>' + esc(a.shop) + "</b> marked " + esc(a.member) + "'s order as not picked up · " + dateFmt.format(new Date(a.at)) + "</div>"; }).join("") + "</div>" : "") +
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
      var st = shopStatus(x.id), spot = isSpotlight(x.id), removed = !!(state.removed || {})[x.id], appeal = (state.appeals || {})[x.id];
      return '<div class="card stack"><div class="row between"><b style="font-family:var(--head);font-weight:400;font-size:1.2rem">' + esc(x.name) + "</b>" + (removed ? '<span class="badge bad">Removed: food</span>' : statusBadge(st)) + "</div>" +
        (appeal ? '<div class="order-note"><b>Appeal:</b> ' + esc(appeal) + "</div>" : "") +
        '<span class="muted small">' + esc(x.address) + " · " + x.menu.length + " coffees" + (isPaused(x.id) && st === "active" ? " · not accepting orders right now" : "") + "</span>" +
        '<div class="row" style="flex-wrap:wrap;gap:8px">' +
        (st === "pending" ? '<button class="btn small" style="width:auto;padding:0 18px" data-a="admin-approve" data-id="' + x.id + '">Approve</button>' : "") +
        (st === "active" ? '<button class="btn danger" style="width:auto;padding:0 18px" data-a="admin-pause" data-id="' + x.id + '">Pause</button>' : "") +
        (st === "paused" ? '<button class="btn small" style="width:auto;padding:0 18px" data-a="admin-approve" data-id="' + x.id + '">' + (removed ? "Reinstate" : "Resume") + "</button>" : "") +
        (!removed && st !== "pending" ? '<button class="btn danger" style="width:auto;padding:0 18px" data-a="admin-remove-food" data-id="' + x.id + '">Remove: selling food</button>' : "") +
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
    else if (state.screen === "quiz") html = quiz();
    else if (state.screen === "result") html = quizResultScreen();
    else if (state.screen === "near") html = nearScreen();
    else if (state.screen === "terms") html = termsScreen();
    else if (state.screen === "faq") html = faqScreen();
    else if (state.screen === "contact") html = contactScreen();
    else {
      html = appTop();
      if (state.session === "admin") {
        html += state.adminTab === "shops" ? adminShops() : state.adminTab === "members" ? adminMembers() : adminOverview();
      } else if (state.session === "member") {
        if (state.detail && state.detail.type === "shop") html += shopDetail(state.detail.id) + (state.customize ? customizeSheet(shopById(state.customizeShop || state.detail.id)) : "");
        else if (state.detail && state.detail.type === "cart") html += cartScreen() + (state.customize ? customizeSheet(shopById(state.customizeShop || state.cartShop)) : "");
        else if (state.detail && state.detail.type === "qr") html += qrDetail(state.detail.id);
        else html += state.tab === "orders" ? ordersTab() : state.tab === "account" ? accountTab() : shopsTab();
      } else {
        html += state.shopTab === "scan" ? shopScanTab() : state.shopTab === "menu" ? shopMenuTab() : state.shopTab === "dashboard" ? shopDashTab() : state.shopTab === "faq" ? faqList(S.MERCHANT_FAQ, S.MERCHANT_FAQ_FOOTNOTE, "Shop FAQ") + '<button class="btn line" data-a="contact">Contact Sippy Brew</button>' : shopOrdersTab();
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
  function addToCart(menuItemId, optionIds, quantity, shopId) {
    if (shopId) state.cartShop = shopId;
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
      menu: menu, passesLeft: totalPassesLeft(), passDaysUsed: state.passDaysUsed, maxPassValueCents: t.maxPassValueCents,
      confirmedOverageCents: state.confirmedOverage, pickupAt: pickupAt, now: n, timeZone: TZ,
      bonusPassesLeft: bonusLeft(), useBonusForOverage: !!state.useBonus,
    });
    if (!r.ok) { state.error = r.message; return render(); }
    var sizes = {}; s.menu.forEach(function (m) { sizes[m.id] = m.size; });
    var id = "o" + Date.now().toString(36);
    var notes = S.cleanOrderNote({ note: state.orderNote, allergy: state.orderAllergy });
    if (!notes.ok) { state.error = notes.message; return render(); }
    state.orders.unshift({ id: id, shopId: s.id, status: "received", note: notes.note, allergy: notes.allergy, totalCents: r.totalCents, passCoveredCents: r.passCoveredCents, overageCents: r.overageCents,
      passDay: r.passDay, pickupAt: pickupAt.toISOString(), createdAt: n.toISOString(), redeemedAt: null,
      items: r.lines.map(function (l) { return { name: l.name, size: sizes[l.menuItemId], quantity: l.quantity, options: l.options }; }) });
    // This month's passes first (they expire sooner), then the bonus pass that expires soonest.
    var bonusKey = null;
    if (S.passSourceForOrder(state.passesLeft, bonusLeft()) === "bonus") { var g = S.nextBonusToUse(state.bonus, n); g.used += 1; bonusKey = g.key; }
    else state.passesLeft -= 1;
    state.orders[0].bonusKey = bonusKey;
    if (r.bonusCoveredCents > 0) { var g2 = S.nextBonusToUse(state.bonus, n); g2.used += 1; state.orders[0].overageBonusKey = g2.key; state.orders[0].bonusCoveredCents = r.bonusCoveredCents; }
    state.useBonus = false; state.orderNote = ""; state.orderAllergy = "";
    state.passDaysUsed.push(r.passDay);
    state.cart = []; state.cartShop = null; state.confirmedOverage = null; state.error = null; state.counterShop = s.id;
    state.detail = { type: "qr", id: id };
    issueTicket(id);
    render(); window.scrollTo(0, 0);
    toast(bonusKey ? "Order placed with a bonus pass." : "Order placed. Your pass is used for today.");
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
    awardVisit();
    state.scan = { ok: true, order: o, pay: S.orderPayout({ passCoveredCents: o.passCoveredCents, overageCents: o.overageCents }) };
    render();
  }

  function act(a, el, ev) {
    var id = el.getAttribute("data-id");
    switch (a) {
      case "start-quiz": state.quiz = {}; state.quizStep = 0; state.screen = "quiz"; render(); return window.scrollTo(0, 0);
      case "retake-quiz": state.quiz = {}; state.quizStep = 0; state.screen = "quiz"; render(); return window.scrollTo(0, 0);
      case "quiz-answer": {
        var key = el.getAttribute("data-k"), card = document.getElementById("quiz-card");
        state.quiz[key] = id;
        var go = function () {
          if (state.quizStep === 0) state.quizStep = 1;
          else { var rec = S.recommendPlan(state.quiz); state.selectedTier = rec.id; state.pickSub = rec.subTier; state.screen = "result"; }
          render(); window.scrollTo(0, 0);
          var next = document.getElementById("quiz-card"); if (next) next.classList.add("quiz-in");
        };
        if (card && !reduceMotion()) { el.classList.add("on"); card.classList.add("quiz-out"); setTimeout(go, 280); } else go();
        return;
      }
      case "quiz-back":
        if (state.screen === "result") { state.screen = "quiz"; state.quizStep = 1; }
        else if (state.quizStep > 0) state.quizStep -= 1;
        else state.screen = "landing";
        render(); return window.scrollTo(0, 0);
      case "see-passes": state.screen = "landing"; render(); var pp = document.querySelector(".tiers"); if (pp) pp.scrollIntoView({ block: "center" }); return;
      case "find-shops": state.screen = "near"; render(); return window.scrollTo(0, 0);
      case "near-back": state.screen = state.quiz && state.quiz.often ? "result" : "landing"; render(); return window.scrollTo(0, 0);
      case "get-pass-selected": state.authMode = "signup"; state.screen = state.user ? (state.tierId ? "app" : "plans") : "signup"; render(); return window.scrollTo(0, 0);
      case "ask-location": {
        state.locAsked = true;
        if (!navigator.geolocation) { state.loc = null; render(); return toast("Location isn't available here, so we're showing West Orange."); }
        toast("Finding coffee near you…");
        navigator.geolocation.getCurrentPosition(function (pos) {
          state.loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: "you", source: "device" };
          render(); toast("Showing shops around you.");
        }, function () {
          state.loc = null; render(); toast("No location access, so we're showing West Orange. You can change this later.");
        }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 });
        return render();
      }
      case "use-sample-loc": state.locAsked = true; state.loc = null; break;
      case "toggle-beyond": state.showBeyond = !state.showBeyond; break;
      case "faq": state.sheet = null; state.screen = "faq"; render(); return window.scrollTo(0, 0);
      case "contact": state.sheet = null; state.contactSent = false; state.screen = "contact"; render(); return window.scrollTo(0, 0);
      case "contact-back": state.screen = state.session ? "app" : "landing"; render(); return window.scrollTo(0, 0);
      case "faq-back": state.screen = state.session ? "app" : "landing"; render(); return window.scrollTo(0, 0);
      case "terms": state.termsFrom = state.screen; state.sheet = null; state.screen = "terms"; render(); return window.scrollTo(0, 0);
      case "terms-back": state.screen = state.termsFrom && state.termsFrom !== "terms" ? state.termsFrom : (state.session ? "app" : "landing"); break;
      case "keep-plan": state.pendingTier = null; render(); return toast("You're staying on " + tier().name + ".");
      case "new-month": {
        state.dayOffset = state.periodStart + 30; state.periodStart = state.dayOffset;
        if (state.pendingTier) state.tierId = state.pendingTier;
        state.pendingTier = null;
        var tm = tier(); state.passesLeft = tm.passesPerMonth; state.passDaysUsed = []; state.upgradeConfirm = false;
        render(); return toast("New month! " + tm.name + ": " + tm.passesPerMonth + " passes loaded. Last month's unused passes expired.");
      }
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
      case "admin-remove-food": {
        // Zero tolerance: removed and hidden right away; the shop can appeal if it was a genuine error.
        state.shopStatus[id] = "paused"; state.removed[id] = true; delete state.appeals[id]; delete state.spotlight[id];
        render(); return toast(shopById(id).name + " was removed for selling food. We emailed the owner how to appeal.");
      }
      case "admin-approve": {
        if ((state.removed || {})[id]) { delete state.removed[id]; delete state.appeals[id]; }
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
        state.sheet = null; state.screen = "app"; state.session = "member"; state.tab = changing ? "account" : "shops"; state.detail = null;
        if (!changing && !state.agreed) return;
        if (!changing) state.lastEmail = S.confirmationEmail({ name: (state.user && state.user.name) || "", plan: t, renewsOn: new Date(now().getTime() + 30 * 864e5), accountUrl: "sippybrew.com/account", termsUrl: "sippybrew.com/terms" });
        if (!changing) { state.tierId = t.id; state.passesLeft = t.passesPerMonth; state.passDaysUsed = []; state.periodStart = state.dayOffset; state.pendingTier = null; state.refCode = state.refCode || S.makeReferralCode(); }
        else state.pendingTier = t.id === state.tierId ? null : t.id; // takes effect next month
        render(); window.scrollTo(0, 0);
        return toast(changing ? "Done! " + t.name + " starts " + dateFmt.format(periodEndDate()) + ". This month stays as it is." : "You're in! " + t.passesPerMonth + " Daily Passes loaded. We emailed your membership details to " + ((state.user && state.user.email) || "you") + ".");
      }
      case "change-plan": state.selectedTier = state.pendingTier || state.tierId; state.pickSub = S.getTier(state.tierId).subTier; state.screen = "plans"; break;
      case "tab": state.tab = id; state.detail = null; break;
      case "shop-tab": state.shopTab = id; state.scan = null; state.shopError = null; break;
      // The cart is kept when you leave a shop and come back (one shop per cart).
      case "open-shop": state.useBonus = false; state.detail = { type: "shop", id: id }; state.customize = null; state.editLine = null; state.error = null; render(); return window.scrollTo(0, 0);
      case "view-cart": state.detail = { type: "cart" }; state.customize = null; state.error = null; render(); return window.scrollTo(0, 0);
      case "cart-back": state.detail = state.cartShop ? { type: "shop", id: state.cartShop } : null; break;
      case "new-cart": state.cart = []; state.cartShop = id; state.confirmedOverage = null; state.useBonus = false; state.pickupIdx = 0; render(); return toast("New cart started.");
      case "remove-line": state.cart.splice(Number(id), 1); state.confirmedOverage = null; if (!state.cart.length) state.useBonus = false; render(); return toast("Removed from your cart.");
      case "edit-line": {
        var ln = state.cart[Number(id)]; if (!ln) break;
        state.editLine = Number(id); state.customize = ln.menuItemId; state.customizeShop = state.cartShop; state.picked = ln.optionIds.slice(); state.cqty = ln.quantity; state.error = null; break;
      }
      case "open-order": state.detail = { type: "qr", id: id }; render(); return window.scrollTo(0, 0);
      case "back": state.detail = null; state.error = null; break;
      case "add-plain": addToCart(id, [], 1, state.detail.id); render(); return toast("Added to your cart.");
      case "open-customize": state.customize = id; state.customizeShop = state.detail.id; state.editLine = null; state.picked = []; state.cqty = 1; state.error = null; break;
      case "close-customize": if (el.classList.contains("sheet-back") && ev.target !== el) return; state.customize = null; state.editLine = null; state.error = null; break;
      case "pick-opt": {
        var sh = shopById(state.customizeShop || state.detail.id), item = sh.menu.filter(function (x) { return x.id === state.customize; })[0];
        var g = item.modifierGroups.filter(function (x) { return x.id === el.getAttribute("data-g"); })[0];
        var ids = g.options.map(function (o) { return o.id; });
        if (state.picked.indexOf(id) >= 0) state.picked = state.picked.filter(function (x) { return x !== id; });
        else if (g.maxSelect === 1) state.picked = state.picked.filter(function (x) { return ids.indexOf(x) < 0; }).concat([id]);
        else if (state.picked.filter(function (x) { return ids.indexOf(x) >= 0; }).length < g.maxSelect) state.picked = state.picked.concat([id]);
        state.error = null; break;
      }
      case "cqty": state.cqty = Math.max(1, Math.min(S.MAX_QUANTITY_PER_LINE, state.cqty + Number(el.getAttribute("data-d")))); break;
      case "add-custom": {
        var sh2 = shopById(state.customizeShop || state.detail.id), it2 = sh2.menu.filter(function (x) { return x.id === state.customize; })[0];
        var res = S.resolveOptions(it2.name, it2.modifierGroups, state.picked);
        if (!res.ok) { state.error = res.message; break; }
        var editing = state.editLine !== null && state.editLine !== undefined;
        if (editing) state.cart.splice(state.editLine, 1);
        addToCart(it2.id, state.picked.slice(), state.cqty, sh2.id); state.customize = null; state.editLine = null; state.error = null;
        render(); return toast(editing ? it2.name + " updated." : it2.name + " added to your cart.");
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
        if (oc && S.canTransition(oc.status, "cancelled")) {
          oc.status = "cancelled";
          var i = state.passDaysUsed.indexOf(oc.passDay); if (i >= 0) state.passDaysUsed.splice(i, 1);
          var bg = oc.bonusKey && (state.bonus || []).filter(function (g) { return g.key === oc.bonusKey; })[0];
          if (bg) bg.used = Math.max(0, bg.used - 1); else state.passesLeft += 1;
          var obg = oc.overageBonusKey && (state.bonus || []).filter(function (g) { return g.key === oc.overageBonusKey; })[0];
          if (obg) obg.used = Math.max(0, obg.used - 1);
          toast("Order cancelled. The member's pass was returned.");
        }
        break;
      }
      case "scan-phone": return redeem({ orderId: id });
      case "skip-ahead": state.minuteOffset = (state.minuteOffset || 0) + 45; render(); return toast("It's now " + timeFmt.format(now()) + ".");
      case "no-show": state.confirmNoShow = id; break;
      case "no-show-no": state.confirmNoShow = null; break;
      case "no-show-yes": {
        var ns = orderById(id);
        if (!ns || !S.canFlagNoShow({ status: ns.status, pickupAt: ns.pickupAt }, now()).ok) break;
        // Not refunded: the pass stays used; the shop is paid like a pickup. Nudge the member and Sippy Brew.
        ns.status = "no_show"; ns.redeemedAt = now().toISOString(); ns.noShowAt = ns.redeemedAt; state.confirmNoShow = null;
        var tkn = latestTicket(id); if (tkn) tkn.expiresAt = Math.min(tkn.expiresAt, Date.now());
        state.notices.push("Your order at " + shopById(ns.shopId).name + " wasn't picked up, so the shop marked it as missed. No-shows aren't refunded: today's pass was used and the shop was paid for the drink it made.");
        state.teamAlerts.unshift({ shop: shopById(ns.shopId).name, member: firstName(), at: now().toISOString() });
        render(); return toast("Marked as not picked up. We let the member and Sippy Brew know.");
      }
      case "dismiss-notice": state.notices.splice(Number(id), 1); break;
      case "scan-add": {
        var add = (state.scanRows || []).filter(function (r) { return r.keep; });
        var built = [];
        for (var si = 0; si < add.length; si++) {
          var it = { name: add[si].name.trim(), size: add[si].size.trim(), priceCents: Math.round(Number(add[si].price) * 100), category: add[si].category };
          var ok2 = S.validateMenuItem(it);
          if (!ok2.ok) { render(); return toast((it.name || "An item") + ": " + ok2.message); }
          built.push({ id: "x" + Date.now().toString(36) + si, shopId: state.counterShop, name: it.name, size: it.size, priceCents: it.priceCents, category: it.category });
        }
        state.extraMenu[state.counterShop] = (state.extraMenu[state.counterShop] || []).concat(built);
        state.scanRows = null; state.scanSkipped = [];
        render(); return toast(built.length + " items added to your menu.");
      }
      case "scan-discard": state.scanRows = null; state.scanSkipped = []; break;
      case "demo-pickup": {
        var od = orderById(id); if (!od || OPEN.indexOf(od.status) < 0) break;
        var tk = latestTicket(id); if (tk) tk.redeemedAt = Date.now();
        od.status = "picked_up"; od.redeemedAt = now().toISOString();
        awardVisit(); render(); return toast("Picked up. Enjoy!");
      }
      case "friend-joined": {
        var fr = friendJoined(); render();
        return toast(fr.friendsToNext === S.RULES.referralFriendsNeeded ? "🎉 " + fr.passesPerReward + " bonus passes added! They roll over for a year." : "A friend joined! " + fr.friendsToNext + " more to go.");
      }
      case "share-link": {
        var link = "https://sippybrew.com/signup?ref=" + (state.refCode || "");
        try { if (navigator.share) { navigator.share({ title: "Sippy Brew", text: "Join me on Sippy Brew:", url: link }).catch(function () {}); return; } } catch (e) {}
        try { navigator.clipboard.writeText(link); } catch (e) {}
        return toast("Link copied: " + link);
      }
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
      else if (a === "agree") { state.agreed = el.checked; render(); }
      else if (a === "use-bonus") { state.useBonus = el.checked; state.confirmedOverage = null; render(); }
      else if (a === "scan-keep") { state.scanRows[Number(el.getAttribute("data-i"))].keep = el.checked; render(); }
      else if (a === "menu-photo" && el.files && el.files[0]) {
        state.scanning = true; render();
        setTimeout(function () {
          var res = S.cleanScannedMenu(SAMPLE_SCAN);
          state.scanRows = res.items.map(function (x) { return { name: x.name, size: x.size, price: (x.priceCents / 100).toFixed(2), category: x.category, keep: true }; });
          state.scanSkipped = res.skipped; state.scanning = false; render();
        }, 1200);
      }
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
        if (!f.elements.foodpolicy.checked) err = "Please confirm you won't sell food through Sippy Brew.";
        else if (v("name").length < 2) err = "Add your business name.";
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
        state.customShops.push({ id: id, name: v("name"), address: v("address"), lat: 40.7930, lng: -74.2440, custom: true,
          hours: S.formatHours({ open: v("open"), close: v("close") }), story: v("story"), menu: menu });
        state.session = "shop"; state.counterShop = id; state.shopTab = "dashboard"; state.screen = "app"; state.shopError = null; state.detail = null;
        render(); window.scrollTo(0, 0);
        toast("Your shop is listed! An admin reviews new shops before members can see them.");
      } else if (kind === "contact") {
        if ((f.elements.message.value || "").trim().length < 10) { toast("Write a message of at least 10 characters."); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.elements.email.value || "")) { toast("Add an email we can reply to."); return; }
        state.contactSent = true; render(); toast("Message sent (demo).");
      } else if (kind === "appeal") {
        var note = (f.elements.note.value || "").trim();
        if (note.length < 20) { toast("Tell us what happened in at least 20 characters."); return; }
        state.appeals[state.counterShop] = note.slice(0, 1000);
        render(); toast("Appeal sent. We'll email you our decision.");
      } else if (kind === "price") {
        var pid = f.getAttribute("data-id"), cents = Math.round(Number(f.elements.price.value) * 100);
        if (!Number.isFinite(cents) || cents < 50 || cents > 5000) { toast("Enter a price between $0.50 and $50."); return; }
        var cur = shopById(state.counterShop).menu.filter(function (x) { return x.id === pid; })[0];
        if (cur && cur.priceCents === cents) { toast("That's already the price."); return; }
        state.prices[pid] = cents; state.priceChangedAt[pid] = now().toISOString();
        render(); toast("Price updated. Members see the new price, marked \"price updated\".");
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
    setInterval(function () {
      var focused = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (state.session === "shop" && state.shopTab === "orders" && state.screen === "app" && !focused) render();
    }, 20000);
    // Typing in fields that shouldn't re-render on every key.
    document.addEventListener("input", function (ev) {
      var a = ev.target && ev.target.getAttribute && ev.target.getAttribute("data-a");
      if (a === "order-note") state.orderNote = ev.target.value;
      else if (a === "order-allergy") state.orderAllergy = ev.target.value;
      else if (a === "scan-field") state.scanRows[Number(ev.target.getAttribute("data-i"))][ev.target.getAttribute("data-k")] = ev.target.value;
    });
    // Radius slider: update the label while dragging, re-draw the map when released.
    document.addEventListener("input", function (ev) {
      if (ev.target && ev.target.id === "radius") { var o = document.getElementById("radius-out"); if (o) o.textContent = ev.target.value + " mi"; }
    });
    document.addEventListener("change", function (ev) {
      if (ev.target && ev.target.id === "radius") { state.radius = S.clampRadius(ev.target.value); render(); var r = document.getElementById("radius"); if (r) r.focus(); }
    });
    render();
    openAdmin();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
