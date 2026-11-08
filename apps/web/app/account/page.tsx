import { PassSummary } from "@/components/PassSummary";
import { AreasForm } from "@/components/AreasForm";
import { ManagePlanButton } from "@/components/ManagePlanButton";
import { OrderList } from "@/components/OrderList";
import { Alert, Badge, ButtonLink, Card, PageTitle, SectionTitle } from "@/components/ui";
import { requirePageSession } from "@/lib/auth";
import { getMemberSummary, memberOrders } from "@/lib/member";
import { formatCents, getTier, RULES } from "@sippy/core";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account" };

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: RULES.timeZone });

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const s = await requirePageSession("member", "/account");
  const [{ checkout }, summary, orders] = await Promise.all([searchParams, getMemberSummary(s), memberOrders(s.userId, 25)]);
  const sub = summary.subscription;
  const tier = sub ? getTier(sub.tier) : null;

  return (
    <>
      <PageTitle>Account</PageTitle>
      {checkout === "success" && !sub && <Alert tone="success">Payment received. Your plan will appear in a few seconds — refresh if it doesn&apos;t.</Alert>}
      {checkout === "success" && sub && <Alert tone="success">You&apos;re all set. Your Daily Passes are ready.</Alert>}

      <SectionTitle>Plan</SectionTitle>
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {sub && tier ? (
          <div>
            <p className="flex items-center gap-2 text-2xl text-espresso">
              <span className="font-heading">{tier.name}</span>
              {sub.status !== "active" && <Badge tone="danger">{sub.status.replace("_", " ")}</Badge>}
              {sub.cancelAtPeriodEnd && <Badge tone="latte">Ends {dateFmt.format(new Date(sub.currentPeriodEnd))}</Badge>}
            </p>
            <p className="text-pecan">
              {formatCents(tier.priceCents)}/month · {tier.passesPerMonth} Daily Passes up to {formatCents(tier.maxPassValueCents, { showZeroCents: true })} · renews {dateFmt.format(new Date(sub.currentPeriodEnd))}
            </p>
            {sub.status === "past_due" && <p className="mt-1 font-bold text-danger">Your last payment failed. Update your card to keep ordering.</p>}
          </div>
        ) : (
          <p className="text-espresso">No plan yet.</p>
        )}
        {sub ? <ManagePlanButton /> : <ButtonLink href="/plans">Choose a plan</ButtonLink>}
      </Card>

      {sub && (
        <>
          <SectionTitle>This month</SectionTitle>
          <PassSummary summary={summary} />
        </>
      )}

      <SectionTitle>
        <span id="areas">Saved areas</span>
      </SectionTitle>
      <AreasForm initial={summary.areas} />

      <SectionTitle>Order history</SectionTitle>
      <OrderList orders={orders} />
    </>
  );
}
