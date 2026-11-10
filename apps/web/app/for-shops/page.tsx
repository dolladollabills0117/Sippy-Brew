import { DEFAULT_TIER, formatCents, getTier, orderPayout, RULES, splitPassValue, SUB_TIERS } from "@sippy/core";
import { ButtonLink, Card, PageTitle, SectionTitle } from "@/components/ui";

export const metadata = { title: "For coffee shops" };

const STANDARD = RULES.standardCommissionBps / 100;
const FOUNDING = RULES.foundingCommissionBps / 100;
const OVERAGE = RULES.overageCommissionBps / 100;
const FEE = `${RULES.overageProcessingFeeBps / 100}% + ${RULES.overageProcessingFeeFixedCents}¢`;

export default function ForShopsPage() {
  const max = getTier(DEFAULT_TIER).maxPassValueCents;
  const maxes = SUB_TIERS.map((s) => formatCents(s.maxPassValueCents, { showZeroCents: true })).join(" or ");
  const split = splitPassValue(950, max);
  const pay = orderPayout({ passCoveredCents: split.passCoveredCents, overageCents: split.overageCents }, RULES.standardCommissionBps);
  const money = (c: number) => formatCents(c, { showZeroCents: true });
  return (
    <>
      <PageTitle kicker="For coffee shops" sub="Bring in neighborhood regulars without changing how you run your counter.">
        How payouts work
      </PageTitle>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="text-2xl text-espresso">You keep {100 - STANDARD}%</h2>
          <p className="mt-2 text-pecan">
            Of what a member&apos;s Daily Pass covers ({maxes} per order, depending on their plan). We keep {STANDARD}%.
            {RULES.foundingProgramOpen && (
              <>
                {" "}
                <strong className="text-espresso">Founding shops keep {100 - FOUNDING}%</strong>, locked in for as long as you&apos;re with us.
              </>
            )}
          </p>
        </Card>
        <Card>
          <h2 className="text-2xl text-espresso">Overages: you keep {100 - OVERAGE}%</h2>
          <p className="mt-2 text-pecan">
            When an order is over what the pass covers, the member confirms and pays the difference at your menu prices. You get it, less a {OVERAGE}% fee and card
            processing ({FEE}).
          </p>
        </Card>
        <Card>
          <h2 className="text-2xl text-espresso">Paid weekly</h2>
          <p className="mt-2 text-pecan">Every Monday to your bank through Stripe, itemized: pass sales, commission, overages, processing and net payout.</p>
        </Card>
      </div>

      <SectionTitle>An example order</SectionTitle>
      <Card className="max-w-xl">
        <p className="text-espresso">
          Example at the standard rate. A Specialty member orders {money(split.totalCents)} of coffee. Their pass covers {money(split.passCoveredCents)} and they confirm a{" "}
          {money(split.overageCents)} overage.
        </p>
        <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-1">
          <dt className="text-pecan">Pass-covered value</dt>
          <dd className="text-right tabular-nums">{money(pay.passCoveredCents)}</dd>
          <dt className="text-pecan">Commission ({STANDARD}% of pass value)</dt>
          <dd className="text-right tabular-nums">−{money(pay.commissionCents)}</dd>
          <dt className="text-pecan">Overage</dt>
          <dd className="text-right tabular-nums">+{money(pay.overageCents)}</dd>
          <dt className="text-pecan">{OVERAGE}% fee on overage</dt>
          <dd className="text-right tabular-nums">−{money(pay.overageCommissionCents)}</dd>
          <dt className="text-pecan">Card processing on overage (estimate)</dt>
          <dd className="text-right tabular-nums">−{money(pay.processingFeeCents)}</dd>
          <dt className="border-t border-latte pt-1 font-extrabold">Your payout</dt>
          <dd className="border-t border-latte pt-1 text-right font-extrabold tabular-nums">{money(pay.shopCents)}</dd>
        </dl>
      </Card>

      <SectionTitle>What we ask</SectionTitle>
      <Card className="max-w-2xl">
        <ul className="list-disc space-y-2 pl-5 text-espresso">
          <li>List drinks only. No food, whatsoever: shops caught selling food are removed.</li>
          <li>Scan the member&apos;s QR code (or type their 6-character code) when you hand over the drink.</li>
          <li>Keep your hours and &ldquo;sold out today&rdquo; flags current so members can order with confidence.</li>
        </ul>
      </Card>
      <div className="mt-8">
        <ButtonLink href="/signup?role=shop">List your shop</ButtonLink>
      </div>
    </>
  );
}
