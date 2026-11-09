/**
 * Seeds demo data: three shops (with owners and coffee menus), one member on each tier, an
 * admin, sample orders across the last few weeks, a past payout, posts, saved shops and areas.
 *
 *   pnpm seed            (reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env / apps/web/.env.local)
 *
 * Safe to re-run: it removes the previous demo users (and their data) first.
 * Every demo account uses the password in DEMO_PASSWORD (default "sippy-demo-123").
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  dayKey,
  getTier,
  planRenewal,
  previousWeekBounds,
  RULES,
  overageProcessingFee,
  splitOrder,
  splitPassValue,
  summarizePayout,
  zonedTimeToUtc,
  zonedParts,
  type ShopHours,
  type TierGroupId,
  type TierId,
} from "../packages/core/src/index";

for (const f of [".env", "apps/web/.env.local", "apps/web/.env"]) {
  const p = resolve(process.cwd(), f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2];
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const PASSWORD = process.env.DEMO_PASSWORD ?? "sippy-demo-123";
const TZ = RULES.timeZone;

const weekday = (open: string, close: string) => ({ open, close });
const HOURS: ShopHours = {
  mon: weekday("06:30", "18:00"),
  tue: weekday("06:30", "18:00"),
  wed: weekday("06:30", "18:00"),
  thu: weekday("06:30", "18:00"),
  fri: weekday("06:30", "18:00"),
  sat: weekday("07:30", "17:00"),
  sun: weekday("08:00", "15:00"),
};

const SHOPS = [
  {
    owner: { email: "owner.mile@demo.sippybrew.test", name: "Rosa Delgado" },
    name: "Mile Square Roasters",
    address: "212 Washington St, Hoboken, NJ 07030",
    lat: 40.7395,
    lng: -74.0303,
    story: "Small-batch roasting since 2014. We roast every Tuesday in the back room and pull every shot like it's our first.",
    spotlight: true,
    menu: [
      ["Espresso", "double", 325, "espresso"],
      ["Cortado", "4.5 oz", 425, "espresso"],
      ["Latte", "12 oz", 525, "espresso"],
      ["Oat Milk Latte", "12 oz", 575, "espresso"],
      ["House Drip", "12 oz", 275, "brewed"],
      ["Cold Brew", "16 oz", 500, "cold"],
      ["Maple Cinnamon Latte", "12 oz", 625, "specialty"],
    ],
  },
  {
    owner: { email: "owner.grove@demo.sippybrew.test", name: "Marcus Chen" },
    name: "Grove Street Grind",
    address: "88 Newark Ave, Jersey City, NJ 07302",
    lat: 40.7197,
    lng: -74.0431,
    story: "A bright corner café by the PATH. Neighbors, laptops and dogs welcome. Ask about our single-origin pour-over of the week.",
    spotlight: true,
    menu: [
      ["Americano", "12 oz", 350, "espresso"],
      ["Cappuccino", "8 oz", 450, "espresso"],
      ["Flat White", "8 oz", 475, "espresso"],
      ["Pour-Over", "10 oz", 450, "brewed"],
      ["Iced Latte", "16 oz", 575, "cold"],
      ["Nitro Cold Brew", "12 oz", 550, "cold"],
    ],
  },
  {
    owner: { email: "owner.heights@demo.sippybrew.test", name: "Priya Natarajan" },
    name: "Heights Coffee Co.",
    address: "301 Central Ave, Jersey City, NJ 07307",
    lat: 40.7448,
    lng: -74.0496,
    story: "Family-run since 2009. Cardamom lattes from our grandmother's recipe and the best view of the Palisades on the block.",
    spotlight: false,
    menu: [
      ["Espresso", "single", 275, "espresso"],
      ["Cardamom Latte", "12 oz", 600, "specialty"],
      ["Mocha", "12 oz", 575, "specialty"],
      ["Drip Coffee", "16 oz", 300, "brewed"],
      ["Iced Coffee", "16 oz", 375, "cold"],
    ],
  },
] as const;

const MEMBERS: { email: string; name: string; tier: TierId }[] = [
  { email: "affogato@demo.sippybrew.test", name: "Sam Rivera", tier: "affogato_decaf" },
  { email: "macchiato@demo.sippybrew.test", name: "Riley Okafor", tier: "macchiato_double_shot" },
  { email: "double@demo.sippybrew.test", name: "Dana Kowalski", tier: "double_espresso_double_shot" },
  { email: "commuter@demo.sippybrew.test", name: "Chris Patel", tier: "double_espresso_decaf" },
];
const ADMIN = { email: "admin@demo.sippybrew.test", name: "Avery Admin" };

async function must<T>(p: PromiseLike<{ data: T; error: unknown }>, what: string): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error || data === null || data === undefined) throw new Error(`${what}: ${JSON.stringify(error)}`);
  return data as NonNullable<T>;
}

async function mustOk(p: PromiseLike<{ error: unknown }>, what: string): Promise<void> {
  const { error } = await p;
  if (error) throw new Error(`${what}: ${JSON.stringify(error)}`);
}

async function removeDemoUsers() {
  const emails = new Set([...SHOPS.map((s) => s.owner.email), ...MEMBERS.map((m) => m.email), ADMIN.email]);
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const ids = (data?.users ?? []).filter((u) => u.email && emails.has(u.email)).map((u) => u.id);
  if (!ids.length) return;
  // Orders and payouts restrict deletes, so clear demo rows first.
  const shopIds = (await must(db.from("shops").select("id").in("owner_id", ids), "shops")).map((s: { id: string }) => s.id);
  await db.from("pass_ledger").delete().in("member_id", ids);
  await db.from("orders").delete().in("member_id", ids);
  if (shopIds.length) {
    await db.from("orders").delete().in("shop_id", shopIds);
    await db.from("payouts").delete().in("shop_id", shopIds);
  }
  for (const id of ids) await db.auth.admin.deleteUser(id);
}

async function createUser(email: string, name: string, role: "member" | "shop_owner" | "admin") {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name, role: role === "admin" ? "member" : role },
  });
  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
  // The sign-up trigger never grants admin, so promote explicitly. Also mark as welcomed.
  const { error: pErr } = await db.from("profiles").update({ role, name, welcomed_at: new Date().toISOString() }).eq("id", data.user.id);
  if (pErr) throw new Error(`profile ${email}: ${pErr.message}`);
  return data.user.id;
}

/** A time on a given local day offset from today, e.g. (-3, 8, 15) = 8:15am three days ago. */
function localTime(daysAgo: number, hour: number, minute: number): Date {
  const p = zonedParts(new Date(), TZ);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day - daysAgo));
  return zonedTimeToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), hour, minute, TZ);
}

async function main() {
  console.log("Removing old demo data…");
  await removeDemoUsers();

  console.log("Creating users, shops and menus…");
  await createUser(ADMIN.email, ADMIN.name, "admin");
  const shops: { id: string; menu: { id: string; name: string; size: string; price: number }[] }[] = [];
  for (const s of SHOPS) {
    const ownerId = await createUser(s.owner.email, s.owner.name, "shop_owner");
    const shop = await must(
      db
        .from("shops")
        .insert({ owner_id: ownerId, name: s.name, address: s.address, lat: s.lat, lng: s.lng, hours: HOURS, story: s.story, status: "active", spotlight: s.spotlight, payouts_enabled: false })
        .select("id")
        .single(),
      "shop",
    );
    const menu = await must(
      db
        .from("menu_items")
        .insert(s.menu.map(([name, size, price, category], i) => ({ shop_id: shop.id, name, size, price, category, sort_order: i })))
        .select("id, name, size, price"),
      "menu",
    );
    shops.push({ id: shop.id, menu });
  }
  // One item sold out today, to show the flag.
  await db.from("menu_items").update({ sold_out_on: dayKey(new Date(), TZ) }).eq("id", shops[1]!.menu[5]!.id);

  console.log("Creating members, subscriptions and Daily Passes…");
  const periodStart = localTime(13, 6, 0);
  const periodEnd = new Date(periodStart.getTime() + 30 * 864e5);
  const prevStart = new Date(periodStart.getTime() - 30 * 864e5);

  for (const [mi, m] of MEMBERS.entries()) {
    const memberId = await createUser(m.email, m.name, "member");
    const tier = getTier(m.tier);
    const sub = await must(
      db
        .from("subscriptions")
        .insert({
          member_id: memberId,
          tier: m.tier,
          status: "active",
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          period_passes: tier.passesPerMonth,
          period_max_pass_value: tier.maxPassValueCents,
          stripe_subscription_id: `sub_demo_${m.tier}`,
        })
        .select("id")
        .single(),
      "subscription",
    );
    // Last period: granted, 3 used, the rest expired at renewal (shows no rollover in the ledger).
    const prevUsed = 3;
    const renewal = planRenewal({
      previousEntries: [
        { type: "grant", passes: tier.passesPerMonth, periodStart: prevStart },
        { type: "use", passes: -prevUsed, periodStart: prevStart },
      ],
      previousPeriodStart: prevStart,
      newPeriodStart: periodStart,
      tier,
    });
    await mustOk(
      db.from("pass_ledger").insert([
        { member_id: memberId, subscription_id: sub.id, period_start: prevStart.toISOString(), passes: tier.passesPerMonth, type: "grant", note: "Demo: last month", created_at: prevStart.toISOString() },
        ...Array.from({ length: prevUsed }, (_, k) => ({
          member_id: memberId, subscription_id: sub.id, period_start: prevStart.toISOString(), passes: -1, type: "use", note: "Demo: last month", created_at: new Date(prevStart.getTime() + (k + 2) * 864e5).toISOString(),
        })),
        ...renewal.map((e) => ({ member_id: memberId, subscription_id: sub.id, period_start: new Date(e.periodStart).toISOString(), passes: e.passes, type: e.type, note: e.note, created_at: periodStart.toISOString() })),
      ]),
      "ledger",
    );

    // Saved areas and regulars.
    await db.from("member_areas").insert([
      { member_id: memberId, kind: "home", label: "Home", lat: 40.744, lng: -74.0324, radius_miles: 1.5 },
      { member_id: memberId, kind: "work", label: "Work", lat: 40.7178, lng: -74.0431, radius_miles: 1 },
    ]);
    await db.from("saved_shops").insert([{ member_id: memberId, shop_id: shops[mi % 3]!.id }, { member_id: memberId, shop_id: shops[(mi + 1) % 3]!.id }]);

    // Sample orders: one pass per day, leaving at least one pass for today. Every third visit
    // adds a second drink, so some orders go over $8.00 and show a confirmed overage.
    const visitsBy: Record<TierGroupId, number[]> = { affogato: [11, 8, 4], macchiato: [11, 9, 7, 5, 3, 1], double_espresso: [12, 11, 10, 9, 8, 6, 5, 3, 2, 1] };
    for (const [vi, daysAgo] of visitsBy[tier.group].entries()) {
      const shop = shops[(mi + vi) % 3]!;
      const byPrice = [...shop.menu].sort((a, b) => a.price - b.price);
      const item = tier.subTier === "decaf" ? byPrice[vi % 2]! : shop.menu[(vi * 2 + mi) % shop.menu.length]!;
      const items = vi % 3 === 1 ? [item, shop.menu[(vi + 3) % shop.menu.length]!] : [item];
      await insertOrder({ memberId, subId: sub.id, periodStart, shopId: shop.id, items, at: localTime(daysAgo, 7 + ((vi + mi) % 4), 10 + vi * 3), redeemed: true, maxPassValue: tier.maxPassValueCents });
    }
    if (m.tier === "double_espresso_double_shot") {
      const shop = shops[0]!;
      await insertOrder({ memberId, subId: sub.id, periodStart, shopId: shop.id, items: [shop.menu[2]!], at: new Date(Date.now() - 4 * 60_000), redeemed: false, maxPassValue: tier.maxPassValueCents });
    }
  }

  console.log("Creating a past payout and posts…");
  const week = previousWeekBounds(new Date(), TZ);
  for (const shop of shops) {
    const orders = await must(
      db.from("orders").select("id, pass_covered_amount, overage_amount, overage_fee").eq("shop_id", shop.id).eq("status", "picked_up").is("payout_id", null).gte("redeemed_at", week.start.toISOString()).lt("redeemed_at", week.end.toISOString()),
      "payout orders",
    );
    if (!orders.length) continue;
    type Row = { id: string; pass_covered_amount: number; overage_amount: number; overage_fee: number };
    const sum = summarizePayout((orders as Row[]).map((o) => ({ passCoveredCents: o.pass_covered_amount, overageCents: o.overage_amount, overageFeeCents: o.overage_fee })));
    const payoutId = await must(
      db.rpc("create_payout", { p_shop: shop.id, p_start: week.start.toISOString(), p_end: week.end.toISOString(), p_order_ids: orders.map((o: { id: string }) => o.id), p_gross: sum.grossCents, p_commission: sum.commissionCents, p_net: sum.netCents, p_overage_total: sum.overageTotalCents, p_processing_fees: sum.processingFeesCents }),
      "payout",
    );
    await db.from("payouts").update({ status: "paid", paid_at: new Date(week.end.getTime() + 10 * 3600_000).toISOString(), stripe_transfer_id: "tr_demo" }).eq("id", payoutId);
  }
  const posts = ["Pumpkin cold foam is back today only. ☕🎃", "New Ethiopian Guji on pour-over this week. Bright, berry-forward.", "Cardamom latte, half the sugar, all the warmth."];
  for (const [i, shop] of shops.entries()) {
    await db.from("posts").insert({ shop_id: shop.id, body: posts[i]!, post_day: dayKey(localTime(i, 7, 0), TZ), created_at: localTime(i, 7, 0).toISOString() });
  }

  console.log(`\nDone. Log in with any of these (password: ${PASSWORD}):`);
  for (const m of MEMBERS) console.log(`  member  ${m.tier.padEnd(8)} ${m.email}`);
  for (const s of SHOPS) console.log(`  shop             ${s.owner.email}  (${s.name})`);
  console.log(`  admin            ${ADMIN.email}`);
}

async function insertOrder(o: {
  memberId: string;
  subId: string;
  periodStart: Date;
  shopId: string;
  items: { id: string; name: string; size: string; price: number }[];
  at: Date;
  redeemed: boolean;
  maxPassValue: number;
}) {
  const total = o.items.reduce((s, i) => s + i.price, 0);
  const pass = splitPassValue(total, o.maxPassValue);
  const split = splitOrder(pass.passCoveredCents); // commission on pass-covered value only
  const order = await must(
    db
      .from("orders")
      .insert({
        member_id: o.memberId,
        shop_id: o.shopId,
        subscription_id: o.subId,
        period_start: o.periodStart.toISOString(),
        status: o.redeemed ? "picked_up" : "received",
        total,
        pass_covered_amount: pass.passCoveredCents,
        overage_amount: pass.overageCents,
        // Demo overages are confirmed and marked captured; real ones go through Stripe.
        overage_confirmed_at: pass.overageCents > 0 ? o.at.toISOString() : null,
        overage_status: pass.overageCents > 0 ? (o.redeemed ? "captured" : "authorized") : "none",
        overage_fee: o.redeemed ? overageProcessingFee(pass.overageCents) : 0,
        pass_day: dayKey(o.at, TZ),
        commission: o.redeemed ? split.commissionCents : null,
        net: o.redeemed ? split.netCents : null,
        pickup_time: new Date(o.at.getTime() + 10 * 60_000).toISOString(),
        redeemed_at: o.redeemed ? new Date(o.at.getTime() + 12 * 60_000).toISOString() : null,
        created_at: o.at.toISOString(),
      })
      .select("id")
      .single(),
    "order",
  );
  await mustOk(db.from("order_items").insert(o.items.map((i) => ({ order_id: order.id, menu_item_id: i.id, name: i.name, size: i.size, quantity: 1, unit_price: i.price }))), "order items");
  await mustOk(
    db.from("pass_ledger").insert({ member_id: o.memberId, subscription_id: o.subId, period_start: o.periodStart.toISOString(), passes: -1, type: "use", order_id: order.id, note: "Daily Pass", created_at: o.at.toISOString() }),
    "pass use",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
