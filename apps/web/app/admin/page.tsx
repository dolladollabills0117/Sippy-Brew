import { effectiveBps, formatCents, getTier, platformTake, monthBounds, payoutLines, recentWeeks, RULES, TIERS } from "@sippy/core";
import { AdminShopActions } from "@/components/AdminShopActions";
import { ExpandableStats } from "@/components/ExpandableStats";
import { PayoutLines } from "@/components/PayoutLines";
import { byWeek, mapSettled, SETTLED_SELECT, summarize, weekLabel } from "@/lib/settled";
import { Badge, Card, EmptyState, PageTitle, SectionTitle, Stat } from "@/components/ui";
import { requirePageSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

const d = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: RULES.timeZone });

export default async function AdminPage() {
  const s = await requirePageSession("admin", "/admin");
  if (s.profile.role !== "admin") redirect("/");
  const db = supabaseAdmin();
  const now = new Date();
  const month = monthBounds(now, RULES.timeZone);
  const weeksBack = recentWeeks(now, 8, RULES.timeZone);
  const since = new Date(Math.min(month.start.getTime(), weeksBack[weeksBack.length - 1].start.getTime()));
  const [{ data: shops }, { data: subs }, { data: members }, { data: settledRows }, { data: failures }, { data: alerts }] = await Promise.all([
    db.from("shops").select("id, name, address, status, spotlight, payouts_enabled, created_at, removal_reason, appeal_note, appealed_at, founding, profiles:owner_id(email)").order("created_at", { ascending: false }),
    db.from("subscriptions").select("tier, status, member_id"),
    db.from("profiles").select("id, name, email, created_at").eq("role", "member").order("created_at", { ascending: false }).limit(200),
    db.from("orders").select(SETTLED_SELECT).in("status", ["picked_up", "no_show"]).gte("redeemed_at", since.toISOString()).limit(20000),
    db.from("payment_failures").select("id, amount, reason, created_at, profiles:member_id(email)").order("created_at", { ascending: false }).limit(25),
    db.from("platform_alerts").select("id, kind, message, created_at, order_id, shops:shop_id(name), profiles:member_id(name, email)").is("resolved_at", null).order("created_at", { ascending: false }).limit(25),
  ]);
  type AlertRow = { id: string; kind: string; message: string; created_at: string; order_id: string | null; shops: { name: string } | null; profiles: { name: string; email: string } | null };

  const settled = (settledRows ?? []).map(mapSettled);
  const monthSettled = settled.filter((o) => new Date(o.redeemedAt) >= month.start);
  const monthOrders = monthSettled.map((o) => ({ commission: o.commissionCents, net: o.netCents, overage_commission: o.overageCommissionCents }));
  const shopName = new Map((shops ?? []).map((x) => [x.id, x.name as string]));
  const foundingShop = new Map((shops ?? []).map((x) => [x.id, !!x.founding]));
  const perShop = (list: typeof settled) =>
    [...new Set(list.map((o) => o.shopId))].map((id) => ({ id, name: shopName.get(id) ?? "Shop", sum: summarize(list.filter((o) => o.shopId === id)) })).sort((a, b) => b.sum.grossCents - a.sum.grossCents);
  const weeks = byWeek(settled, 8, now);
  const money = (c: number) => formatCents(c, { showZeroCents: true });
  const live = (subs ?? []).filter((x) => x.status === "active" || x.status === "trialing");
  const tierCounts = TIERS.map((t) => `${t.name} ${live.filter((x) => x.tier === t.id).length}`).join(" · ");
  const mrr = live.reduce((sum, x) => sum + getTier(x.tier).priceCents, 0);
  const commission = (monthOrders ?? []).reduce((sum, o) => sum + (o.commission ?? 0), 0);
  // What Sippy Brew actually keeps: revenue − shop payouts − card fees (commission + unused passes).
  const take = platformTake({ planPricesCents: live.map((x) => getTier(x.tier).priceCents), shopNetCents: (monthOrders ?? []).reduce((sum, o) => sum + (o.net ?? 0), 0),
    overageCommissionCents: (monthOrders ?? []).reduce((sum, o) => sum + (o.overage_commission ?? 0), 0),
  });
  const subByMember = new Map((subs ?? []).map((x) => [x.member_id, x]));

  return (
    <>
      <PageTitle kicker="Platform">Admin</PageTitle>
      <ExpandableStats
        className="lg:grid-cols-5"
        tiles={[
          {
            id: "subs",
            label: "Active subscriptions",
            value: live.length,
            sub: tierCounts,
            detailTitle: "Members by pass",
            detail: (
              <ul className="flex flex-col gap-1.5">
                {TIERS.map((t) => (
                  <li key={t.id} className="flex justify-between">
                    <span>{t.name}</span>
                    <strong className="tabular-nums">{live.filter((x) => x.tier === t.id).length}</strong>
                  </li>
                ))}
              </ul>
            ),
          },
          {
            id: "revenue",
            label: "Monthly revenue",
            value: formatCents(mrr),
            sub: "From active plans",
            detailTitle: "Revenue by pass",
            detail: (
              <ul className="flex flex-col gap-1.5">
                {TIERS.map((t) => {
                  const n = live.filter((x) => x.tier === t.id).length;
                  return (
                    <li key={t.id} className="flex justify-between">
                      <span>
                        {t.name} × {n}
                      </span>
                      <strong className="tabular-nums">{money(n * t.priceCents)}</strong>
                    </li>
                  );
                })}
              </ul>
            ),
          },
          {
            id: "commission",
            label: "Commission this month",
            value: money(commission + take.overageCommissionCents),
            sub: `${monthSettled.length} redemptions`,
            detailTitle: "Commission by shop this month",
            detail: perShop(monthSettled).length ? (
              <ul className="divide-y divide-latte">
                {perShop(monthSettled).map((r) => (
                  <li key={r.id} className="py-2">
                    <div className="flex justify-between gap-3">
                      <strong>{r.name}</strong>
                      <Badge tone={foundingShop.get(r.id) ? "sky" : "latte"}>{foundingShop.get(r.id) ? "Founding" : "Standard"}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{r.sum.orderCount} orders · pass commission</span>
                      <span className="tabular-nums text-success">{money(r.sum.commissionCents)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{RULES.overageCommissionBps / 100}% overage fees</span>
                      <span className="tabular-nums text-success">{money(r.sum.overageCommissionCents)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-pecan">No redemptions this month.</p>
            ),
          },
          {
            id: "keep",
            label: "You keep (so far)",
            value: money(take.keepCents),
            detailTitle: "What you keep this month (so far)",
            detail: (
              <>
                <PayoutLines
                  lines={[
                    { label: "Members' monthly payments", cents: take.revenueCents, kind: "base" },
                    { label: `${RULES.overageCommissionBps / 100}% overage fees`, cents: take.overageCommissionCents, kind: "plus" },
                    { label: "Paid to shops for passes used", cents: take.shopPayoutCents, kind: "minus" },
                    { label: "Card processing on monthly payments", cents: take.cardFeesCents, kind: "minus" },
                    { label: "You keep", cents: take.keepCents, kind: "total" },
                  ]}
                />
                <p className="mt-3 text-sm text-pecan">This goes down as members use passes and settles when the month renews.</p>
              </>
            ),
          },
          {
            id: "failed",
            label: "Failed payments",
            value: failures?.length ?? 0,
            sub: "Most recent 25",
            detailTitle: "Failed payments",
            detail: (failures ?? []).length ? (
              <ul className="divide-y divide-latte">
                {((failures ?? []) as unknown as { id: string; amount: number; reason: string | null; created_at: string; profiles: { email: string } | null }[]).map((f) => (
                  <li key={f.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>
                      <strong>{f.profiles?.email ?? "Member"}</strong> · {f.reason ?? "Card declined"}
                    </span>
                    <span className="tabular-nums text-danger">{money(f.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-pecan">None.</p>
            ),
          },
        ]}
      />

      <section aria-labelledby="weeks-title" className="mt-6">
        <h2 id="weeks-title" className="mb-1 text-2xl text-espresso">Weekly payouts</h2>
        <p className="mb-2 text-sm text-pecan">Tap a week to see each shop. Green is what Sippy Brew earned that week.</p>
        <div className="flex flex-col gap-2">
          {weeks.map((w, i) => {
            const sum = summarize(w.orders);
            return (
              <details key={w.start.toISOString()} className="card group p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span>
                    <strong className="text-espresso">{weekLabel(w, i)}</strong>
                    <span className="block text-sm text-pecan">
                      {sum.orderCount} orders · shops get {money(sum.transferCents)}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <strong className="tabular-nums text-success">{money(sum.commissionCents + sum.overageCommissionCents)}</strong>
                    <span aria-hidden="true" className="transition group-open:rotate-180">▾</span>
                  </span>
                </summary>
                {perShop(w.orders).length ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {perShop(w.orders).map((r) => (
                      <div key={r.id} className="rounded-2xl border border-latte p-4">
                        <h3 className="mb-2 font-extrabold text-espresso">{r.name}</h3>
                        <PayoutLines lines={payoutLines(r.sum, effectiveBps(r.sum, RULES.standardCommissionBps))} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-pecan">No orders that week.</p>
                )}
              </details>
            );
          })}
        </div>
      </section>

      {(alerts ?? []).length > 0 && (
        <section aria-labelledby="alerts-title" className="mt-6">
          <h2 id="alerts-title" className="mb-2 text-2xl text-espresso">Alerts: no-shows and appeals</h2>
          <ul className="flex flex-col gap-2">
            {((alerts ?? []) as unknown as AlertRow[]).map((a) => (
              <li key={a.id} className="card flex flex-wrap items-center justify-between gap-2 p-4 text-espresso">
                <span>
                  {a.kind === "appeal" ? (
                    <>
                      <strong>{a.shops?.name ?? "A shop"}</strong> appealed its removal for selling food. Review it under Shops.
                    </>
                  ) : (
                    <>
                      <strong>{a.shops?.name ?? "A shop"}</strong> marked {a.profiles?.name || a.profiles?.email || "a member"}&apos;s order as not picked up
                    </>
                  )}
                </span>
                <span className="text-sm text-pecan">{new Date(a.created_at).toLocaleString("en-US", { timeZone: RULES.timeZone })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SectionTitle>Shops</SectionTitle>
      {!shops?.length ? (
        <EmptyState title="No shops yet" />
      ) : (
        <ul className="card divide-y divide-latte">
          {shops.map((shop) => (
            <li key={shop.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-espresso">
                  {shop.name}{" "}
                  <Badge tone={shop.status === "active" ? "success" : shop.status === "paused" ? "danger" : "latte"}>{shop.status}</Badge>{" "}
                  {!shop.payouts_enabled && <Badge tone="latte">No payouts</Badge>}{" "}
                  {shop.removal_reason === "food" && <Badge tone="danger">Removed: selling food</Badge>}{" "}
                  {shop.removal_reason === "food" && shop.appealed_at && <Badge tone="sky">Appeal to review</Badge>}
                </p>
                {shop.removal_reason === "food" && shop.appeal_note && (
                  <p className="mt-1 rounded-lg bg-vanilla-bean px-3 py-2 text-sm text-espresso">
                    <strong>Appeal:</strong> {shop.appeal_note}
                  </p>
                )}
                <p className="text-sm text-pecan">
                  {shop.address} · {(shop.profiles as unknown as { email: string } | null)?.email}
                </p>
              </div>
              <AdminShopActions id={shop.id} status={shop.status} spotlight={shop.spotlight} removedForFood={shop.removal_reason === "food"} founding={shop.founding} />
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionTitle>Members</SectionTitle>
          {!members?.length ? (
            <EmptyState title="No members yet" />
          ) : (
            <ul className="card max-h-[480px] divide-y divide-latte overflow-y-auto">
              {members.map((m) => {
                const sub = subByMember.get(m.id);
                return (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-espresso">{m.name || m.email}</p>
                      <p className="truncate text-sm text-pecan">{m.email}</p>
                    </div>
                    {sub ? <Badge tone={sub.status === "active" ? "sky" : "danger"}>{`${getTier(sub.tier).name} · ${sub.status}`}</Badge> : <Badge tone="latte">No plan</Badge>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          <SectionTitle>Failed payments</SectionTitle>
          {!failures?.length ? (
            <EmptyState title="No failed payments" />
          ) : (
            <Card>
              <ul className="divide-y divide-latte">
                {failures.map((f) => (
                  <li key={f.id} className="py-2">
                    <p className="font-bold text-espresso">
                      {(f.profiles as unknown as { email: string } | null)?.email ?? "Unknown member"} · {formatCents(f.amount, { showZeroCents: true })}
                    </p>
                    <p className="text-sm text-pecan">
                      {d.format(new Date(f.created_at))} · {f.reason}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
