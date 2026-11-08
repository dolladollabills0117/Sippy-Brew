import { formatCents, getTier, monthBounds, RULES, TIERS } from "@sippy/core";
import { AdminShopActions } from "@/components/AdminShopActions";
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
  const month = monthBounds(new Date(), RULES.timeZone);
  const [{ data: shops }, { data: subs }, { data: members }, { data: monthOrders }, { data: failures }] = await Promise.all([
    db.from("shops").select("id, name, address, status, spotlight, payouts_enabled, created_at, profiles:owner_id(email)").order("created_at", { ascending: false }),
    db.from("subscriptions").select("tier, status, member_id"),
    db.from("profiles").select("id, name, email, created_at").eq("role", "member").order("created_at", { ascending: false }).limit(200),
    db.from("orders").select("commission, total").eq("status", "picked_up").gte("redeemed_at", month.start.toISOString()),
    db.from("payment_failures").select("id, amount, reason, created_at, profiles:member_id(email)").order("created_at", { ascending: false }).limit(25),
  ]);

  const live = (subs ?? []).filter((x) => x.status === "active" || x.status === "trialing");
  const tierCounts = TIERS.map((t) => `${t.name} ${live.filter((x) => x.tier === t.id).length}`).join(" · ");
  const mrr = live.reduce((sum, x) => sum + getTier(x.tier).priceCents, 0);
  const commission = (monthOrders ?? []).reduce((sum, o) => sum + (o.commission ?? 0), 0);
  const subByMember = new Map((subs ?? []).map((x) => [x.member_id, x]));

  return (
    <>
      <PageTitle kicker="Platform">Admin</PageTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active subscriptions" value={live.length} sub={tierCounts} />
        <Stat label="Monthly revenue" value={formatCents(mrr)} sub="From active plans" />
        <Stat label="Commission this month" value={formatCents(commission, { showZeroCents: true })} sub={`${monthOrders?.length ?? 0} redemptions`} />
        <Stat label="Failed payments" value={failures?.length ?? 0} sub="Most recent 25" />
      </div>

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
                  {!shop.payouts_enabled && <Badge tone="latte">No payouts</Badge>}
                </p>
                <p className="text-sm text-pecan">
                  {shop.address} · {(shop.profiles as unknown as { email: string } | null)?.email}
                </p>
              </div>
              <AdminShopActions id={shop.id} status={shop.status} spotlight={shop.spotlight} />
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
