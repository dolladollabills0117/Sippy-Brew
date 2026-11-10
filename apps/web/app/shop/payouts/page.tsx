import { commissionBpsFor, effectiveBps, payoutLines, RULES } from "@sippy/core";
import { PayoutLines, SettledOrderList } from "@/components/PayoutLines";
import { Badge, Money, PageTitle } from "@/components/ui";
import { requireOwnerShop } from "@/lib/shopPage";
import { shopPayoutHistory } from "@/lib/shop";
import { summarize } from "@/lib/settled";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payouts" };

const d = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: RULES.timeZone });
const range = (start: Date | string, end: Date | string) => `${d.format(new Date(start))} – ${d.format(new Date(new Date(end).getTime() - 1))}`;

export default async function PayoutsPage() {
  const { session, shop } = await requireOwnerShop("/shop/payouts");
  const { thisWeek, payouts } = await shopPayoutHistory(session);
  const bps = commissionBpsFor(shop);
  const rate = bps / 100;
  const current = summarize(thisWeek.orders);
  return (
    <>
      <PageTitle
        sub={`Paid weekly to your bank through Stripe: ${100 - rate}% of pass-covered sales${shop.founding ? " (founding rate)" : ""}, plus overages less a ${RULES.overageCommissionBps / 100}% fee and card processing. Tap a week to see its orders.`}
      >
        Payouts
      </PageTitle>
      <div className="flex flex-col gap-3">
        <details open className="card group p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span>
              <strong className="text-lg text-espresso">This week so far</strong>
              <span className="block text-sm text-pecan">
                {range(thisWeek.start, thisWeek.end)} · {current.orderCount} {current.orderCount === 1 ? "order" : "orders"} · pays Monday
              </span>
            </span>
            <span className="flex items-center gap-3">
              <strong className="text-xl tabular-nums">
                <Money cents={current.transferCents} />
              </strong>
              <span aria-hidden="true" className="transition group-open:rotate-180">▾</span>
            </span>
          </summary>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <PayoutLines lines={payoutLines(current, bps)} />
            <SettledOrderList orders={thisWeek.orders} />
          </div>
        </details>

        <h2 className="mt-4 text-2xl text-espresso">Past weeks</h2>
        {payouts.length === 0 ? (
          <p className="text-pecan">No payouts yet. Your first payout is sent the Monday after your first redemption.</p>
        ) : (
          payouts.map((p) => (
            <details key={p.id} className="card group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span>
                  <strong className="text-espresso">{range(p.periodStart, p.periodEnd)}</strong>
                  <span className="block text-sm text-pecan">
                    {p.orderCount} {p.orderCount === 1 ? "order" : "orders"}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <Badge tone={p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "latte"}>{p.status}</Badge>
                  <strong className="tabular-nums">
                    <Money cents={p.transferCents} />
                  </strong>
                  <span aria-hidden="true" className="transition group-open:rotate-180">▾</span>
                </span>
              </summary>
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                <PayoutLines
                  lines={payoutLines(
                    {
                      grossCents: p.grossCents,
                      commissionCents: p.commissionCents,
                      overageTotalCents: p.overageTotalCents,
                      overageCommissionCents: p.overageCommissionCents,
                      processingFeesCents: p.processingFeesCents,
                      transferCents: p.transferCents,
                      orderCount: p.orderCount,
                    },
                    // The rate that week, from what was actually charged.
                    effectiveBps(p, bps),
                  )}
                />
                <SettledOrderList orders={p.orders} />
              </div>
            </details>
          ))
        )}
      </div>
    </>
  );
}
