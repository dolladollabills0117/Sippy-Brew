import { redirect } from "next/navigation";
import { PlanPicker } from "@/components/PlanPicker";
import { PageTitle } from "@/components/ui";
import { requirePageSession } from "@/lib/auth";
import { getLiveSubscription } from "@/lib/member";

export const metadata = { title: "Choose a plan" };

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const s = await requirePageSession("member", "/plans");
  if (await getLiveSubscription(s.userId)) redirect("/account");
  const { plan } = await searchParams;
  return (
    <>
      <PageTitle sub="Every plan works at every participating shop. Change or cancel any time from your account.">Choose your plan</PageTitle>
      <PlanPicker preselect={plan} />
      <p className="mt-6 text-sm text-pecan">Payments are handled securely by Stripe. You&apos;ll be billed monthly on the day you join.</p>
    </>
  );
}
