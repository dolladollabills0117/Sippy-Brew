import { commissionBpsFor, RULES } from "@sippy/core";
import { Badge, EmptyState, Money, PageTitle } from "@/components/ui";
import { requireOwnerShop } from "@/lib/shopPage";
import { shopPayouts } from "@/lib/shop";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payouts" };

const d = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: RULES.timeZone });

export default async function PayoutsPage() {
  const { session, shop } = await requireOwnerShop("/shop/payouts");
  const payouts = await shopPayouts(session);
  const rate = commissionBpsFor(shop) / 100;
  return (
    <>
      <PageTitle
        sub={`Paid weekly to your bank through Stripe: ${100 - rate}% of pass-covered sales${shop.founding ? " (founding rate)" : ""}, plus overages less a ${RULES.overageCommissionBps / 100}% fee and card processing.`}
      >
        Payouts
      </PageTitle>
      {payouts.length === 0 ? (
        <EmptyState title="No payouts yet">Your first payout is sent the Monday after your first redemption.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <caption className="sr-only">Weekly payouts</caption>
            <thead className="border-b border-latte text-sm text-pecan">
              <tr>
                <th scope="col" className="px-5 py-3">Week</th>
                <th scope="col" className="px-5 py-3 text-right">Orders</th>
                <th scope="col" className="px-5 py-3 text-right">Pass sales</th>
                <th scope="col" className="px-5 py-3 text-right">{rate}% commission</th>
                <th scope="col" className="px-5 py-3 text-right">Overages</th>
                <th scope="col" className="px-5 py-3 text-right">{RULES.overageCommissionBps / 100}% on overages</th>
                <th scope="col" className="px-5 py-3 text-right">Card processing</th>
                <th scope="col" className="px-5 py-3 text-right">Net payout</th>
                <th scope="col" className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-latte">
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3 font-bold">
                    {d.format(new Date(p.periodStart))} – {d.format(new Date(new Date(p.periodEnd).getTime() - 1))}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{p.orderCount}</td>
                  <td className="px-5 py-3 text-right"><Money cents={p.grossCents} /></td>
                  <td className="px-5 py-3 text-right text-pecan">−<Money cents={p.commissionCents} /></td>
                  <td className="px-5 py-3 text-right">+<Money cents={p.overageTotalCents} /></td>
                  <td className="px-5 py-3 text-right text-pecan">−<Money cents={p.overageCommissionCents} /></td>
                  <td className="px-5 py-3 text-right text-pecan">−<Money cents={p.processingFeesCents} /></td>
                  <td className="px-5 py-3 text-right font-extrabold"><Money cents={p.transferCents} /></td>
                  <td className="px-5 py-3">
                    <Badge tone={p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "latte"}>{p.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
