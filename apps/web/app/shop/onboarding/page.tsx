import { OnboardingForm } from "@/components/OnboardingForm";
import { Alert, PageTitle } from "@/components/ui";
import { requirePageSession } from "@/lib/auth";
import { mapShop } from "@/lib/db";
import { getOwnerShopRow } from "@/lib/shop";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shop setup" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ stripe?: string }> }) {
  const s = await requirePageSession(undefined, "/shop/onboarding");
  const row = await getOwnerShopRow(s, { allowMissing: true });
  const { stripe } = await searchParams;
  return (
    <>
      <PageTitle sub="Tell members about your shop, set your hours, connect payouts, and add your menu.">Shop setup</PageTitle>
      {stripe === "done" && <Alert tone="success">Thanks! Stripe will confirm your account shortly.</Alert>}
      <OnboardingForm shop={row ? mapShop(row) : null} userId={s.userId} />
    </>
  );
}
