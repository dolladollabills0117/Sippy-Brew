import { formatCents, RULES, type MemberSummary } from "@sippy/core";
import { Badge, Card, Meter } from "./ui";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: RULES.timeZone });

/** Passes left this month and whether today's pass is still available. */
export function PassSummary({ summary }: { summary: MemberSummary }) {
  const sub = summary.subscription;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <p className="text-sm font-bold text-pecan">Daily Passes left this month</p>
        <p className="mt-1 text-4xl font-extrabold tabular-nums text-espresso">
          {summary.passesLeft}
          <span className="text-lg text-pecan"> of {summary.passesPerMonth}</span>
        </p>
        <div className="mt-3">
          <Meter value={summary.passesLeft} max={summary.passesPerMonth} label="Daily Passes remaining this month" />
        </div>
        {sub && <p className="mt-2 text-sm text-pecan">Resets {dateFmt.format(new Date(sub.currentPeriodEnd))}. Unused passes don&apos;t roll over.</p>}
      </Card>
      <Card>
        <p className="text-sm font-bold text-pecan">Today</p>
        <div className="mt-2">
          {summary.passUsedToday ? <Badge tone="latte">Today&apos;s pass used</Badge> : summary.passesLeft > 0 ? <Badge>Pass ready</Badge> : <Badge tone="latte">No passes left</Badge>}
        </div>
        <p className="mt-3 text-espresso">
          Your pass covers up to <strong>{formatCents(summary.maxPassValueCents, { showZeroCents: true })}</strong>. Anything above that is an upgrade you pay
          for in the app.
        </p>
      </Card>
    </div>
  );
}
