import { formatHour, formatCents } from "@sippy/core";
import Link from "next/link";
import { ShopStatusBanner } from "@/components/ShopStatusBanner";
import { Card, EmptyState, PageTitle, SectionTitle, Stat } from "@/components/ui";
import { requireOwnerShop } from "@/lib/shopPage";
import { getShopStats } from "@/lib/shop";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function ShopDashboard() {
  const { session, shop } = await requireOwnerShop("/shop");
  const { stats } = await getShopStats(session);
  const maxHour = Math.max(1, ...stats.busiestHours.map((h) => h.count));
  const hoursByTime = [...stats.busiestHours].sort((a, b) => a.hour - b.hour);

  return (
    <>
      <PageTitle kicker={shop.name}>Dashboard</PageTitle>
      <ShopStatusBanner shop={shop} />
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Redemptions today" value={stats.redemptions.today} sub={formatCents(stats.grossCents.today, { showZeroCents: true })} />
        <Stat label="This week" value={stats.redemptions.week} sub={formatCents(stats.grossCents.week, { showZeroCents: true })} />
        <Stat label="This month" value={stats.redemptions.month} sub={formatCents(stats.grossCents.month, { showZeroCents: true })} />
        <Stat
          label="Est. payout this week"
          value={formatCents(stats.estimatedWeeklyPayoutCents, { showZeroCents: true })}
          sub={<Link href="/shop/payouts" className="font-bold text-burnt-sugar-ink underline">See payouts</Link>}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div>
          <SectionTitle>Top items</SectionTitle>
          {stats.topItems.length === 0 ? (
            <EmptyState title="No redemptions this month yet" />
          ) : (
            <Card>
              <ol className="space-y-2">
                {stats.topItems.map((i, n) => (
                  <li key={i.name} className="flex justify-between">
                    <span className="text-espresso">
                      <span className="mr-2 font-extrabold text-pecan">{n + 1}.</span>
                      {i.name}
                    </span>
                    <span className="font-bold tabular-nums">{i.quantity}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
        <div>
          <SectionTitle>Busiest hours</SectionTitle>
          {hoursByTime.length === 0 ? (
            <EmptyState title="Not enough data yet" />
          ) : (
            <Card>
              <ul className="space-y-1.5" aria-label="Redemptions by hour this month">
                {hoursByTime.map((h) => (
                  <li key={h.hour} className="grid grid-cols-[3rem_1fr_2rem] items-center gap-2 text-sm">
                    <span className="font-bold text-pecan">{formatHour(h.hour)}</span>
                    <span className="h-3 rounded-full bg-burnt-sugar" style={{ width: `${(h.count / maxHour) * 100}%` }} />
                    <span className="text-right tabular-nums">{h.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <div>
          <SectionTitle>Members this month</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="New" value={stats.members.new} />
            <Stat label="Returning" value={stats.members.returning} />
          </div>
        </div>
      </div>
    </>
  );
}
