import { formatCents, RULES, splitOrder, TIERS } from "@sippy/core";
import { ButtonLink, Card, PageTitle, SectionTitle } from "@/components/ui";

export const metadata = { title: "For coffee shops" };

const SHOP_PCT = 100 - RULES.commissionBps / 100;

export default function ForShopsPage() {
  const example = splitOrder(675);
  return (
    <>
      <PageTitle kicker="For coffee shops" sub="Bring in neighborhood regulars without changing how you run your counter.">
        How Sippy Brew pays you
      </PageTitle>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="text-2xl text-espresso">You keep {SHOP_PCT}%</h2>
          <p className="mt-2 text-pecan">
            Of every order a member redeems with a Daily Pass, including any upgrade they pay for. Sippy Brew keeps {RULES.commissionBps / 100}%.
          </p>
        </Card>
        <Card>
          <h2 className="text-2xl text-espresso">Paid weekly</h2>
          <p className="mt-2 text-pecan">Every Monday to your bank through Stripe, with gross sales, commission and net payout itemized.</p>
        </Card>
        <Card>
          <h2 className="text-2xl text-espresso">Your menu prices</h2>
          <p className="mt-2 text-pecan">Members order from your coffee menu at your prices. Upgrades above a pass are charged at your price too.</p>
        </Card>
      </div>

      <SectionTitle>An example order</SectionTitle>
      <Card className="max-w-xl">
        <p className="text-espresso">
          A Casual Brew member orders a {formatCents(675, { showZeroCents: true })} oat latte. Their pass covers{" "}
          {formatCents(TIERS[0]!.maxPassValueCents, { showZeroCents: true })} and they pay the {formatCents(675 - TIERS[0]!.maxPassValueCents, { showZeroCents: true })} difference in the app.
        </p>
        <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-1">
          <dt className="text-pecan">Order value</dt>
          <dd className="text-right font-bold tabular-nums">{formatCents(example.grossCents, { showZeroCents: true })}</dd>
          <dt className="text-pecan">Sippy Brew ({RULES.commissionBps / 100}%)</dt>
          <dd className="text-right tabular-nums">−{formatCents(example.commissionCents, { showZeroCents: true })}</dd>
          <dt className="border-t border-latte pt-1 font-extrabold">Your payout</dt>
          <dd className="border-t border-latte pt-1 text-right font-extrabold tabular-nums">{formatCents(example.netCents, { showZeroCents: true })}</dd>
        </dl>
      </Card>

      <SectionTitle>What we ask</SectionTitle>
      <Card className="max-w-2xl">
        <ul className="list-disc space-y-2 pl-5 text-espresso">
          <li>List coffee drinks only. Food isn&apos;t sold through Sippy Brew.</li>
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
