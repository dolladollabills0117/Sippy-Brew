import { formatCents, RULES, type MemberSummary } from "@sippy/core";
import { Card, Meter } from "./ui";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: RULES.timeZone });

export function CreditSummary({ summary }: { summary: MemberSummary }) {
  const sub = summary.subscription;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <p className="text-sm font-bold text-pecan">Credit left this month</p>
        <p className="mt-1 text-4xl font-extrabold tabular-nums text-espresso">{formatCents(summary.creditBalanceCents, { showZeroCents: true })}</p>
        <div className="mt-3">
          <Meter value={summary.creditBalanceCents} max={summary.monthlyCreditCents} label="Monthly credit remaining" />
        </div>
        {sub && <p className="mt-2 text-sm text-pecan">Resets {dateFmt.format(new Date(sub.currentPeriodEnd))}. Unused credit doesn&apos;t roll over.</p>}
      </Card>
      <Card>
        <p className="text-sm font-bold text-pecan">Today</p>
        <p className="mt-1 text-4xl font-extrabold tabular-nums text-espresso">
          {formatCents(summary.spentTodayCents, { showZeroCents: true })}
          <span className="text-lg text-pecan"> of {formatCents(summary.dailyLimitCents)}</span>
        </p>
        <div className="mt-3">
          <Meter value={summary.spentTodayCents} max={summary.dailyLimitCents} label="Spent today against the daily limit" />
        </div>
        <p className="mt-2 text-sm text-pecan">{formatCents(summary.dailyRemainingCents, { showZeroCents: true })} left to spend today.</p>
      </Card>
    </div>
  );
}
