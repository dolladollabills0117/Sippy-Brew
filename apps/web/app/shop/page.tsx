import { commissionBpsFor, dayBounds, formatHour, formatCents, isWithin, monthBounds, payoutLines, RULES, weekBounds } from "@sippy/core";
import Link from "next/link";
import { ExpandableStats } from "@/components/ExpandableStats";
import { PayoutLines, SettledOrderList } from "@/components/PayoutLines";
import { ShopStatusBanner } from "@/components/ShopStatusBanner";
import { Card, EmptyState, PageTitle, SectionTitle, Stat } from "@/components/ui";
import { requireOwnerShop } from "@/lib/shopPage";
import { getShopStats, shopSettledOrders } from "@/lib/shop";
import { summarize } from "@/lib/settled";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function ShopDashboard() {
  const { session, shop } = await requireOwnerShop("/shop");
  const now = new Date();
  const month = monthBounds(now, RULES.timeZone);
  const [{ stats }, settled] = await Promise.all([getShopStats(session), shopSettledOrders(session, new Date(month.start.getTime() - 7 * 864e5))]);
  const rate = commissionBpsFor(shop);
  const inRange = (r: { start: Date; end: Date }) => settled.filter((o) => isWithin(new Date(o.redeemedAt), r));
  const today = inRange(dayBounds(now, RULES.timeZone));
  const week = inRange(weekBounds(now, RULES.timeZone));
  const thisMonth = inRange(month);
  const money = (c: number) => formatCents(c, { showZeroCents: true });
  const maxHour = Math.max(1, ...stats.busiestHours.map((h) => h.count));
  const hoursByTime = [...stats.busiestHours].sort((a, b) => a.hour - b.hour);

  return (
    <>
      <PageTitle kicker={shop.name}>Dashboard</PageTitle>
      <ShopStatusBanner shop={shop} />
      <ExpandableStats
        tiles={[
          { id: "today", label: "Redemptions today", value: stats.redemptions.today, sub: money(stats.grossCents.today), detailTitle: "Today's orders", detail: <SettledOrderList orders={today} /> },
          { id: "week", label: "This week", value: stats.redemptions.week, sub: money(stats.grossCents.week), detailTitle: "This week's orders", detail: <SettledOrderList orders={week} /> },
          {
            id: "month",
            label: "This month",
            value: stats.redemptions.month,
            sub: money(stats.grossCents.month),
            detailTitle: "This month",
            detail: (
              <div className="grid gap-6 lg:grid-cols-2">
                <PayoutLines lines={payoutLines(summarize(thisMonth), rate)} />
                <SettledOrderList orders={thisMonth} />
              </div>
            ),
          },
          {
            id: "payout",
            label: "Est. payout this week",
            value: money(stats.estimatedWeeklyPayoutCents),
            detailTitle: "This week's payout so far",
            detail: (
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <PayoutLines lines={payoutLines(summarize(week), rate)} />
                  <Link href="/shop/payouts" className="mt-3 inline-block font-bold text-burnt-sugar-ink underline">
                    See past weeks
                  </Link>
                </div>
                <SettledOrderList orders={week} />
              </div>
            ),
          },
        ]}
      />

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
