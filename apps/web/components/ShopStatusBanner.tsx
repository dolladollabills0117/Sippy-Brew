import type { Shop } from "@sippy/core";
import Link from "next/link";
import { AppealForm } from "./AppealForm";
import { Alert } from "./ui";

export function ShopStatusBanner({ shop }: { shop: Shop }) {
  if (shop.status === "pending")
    return <Alert>Your shop is waiting for approval. Members can&apos;t see it yet. We&apos;ll email you when you&apos;re live.</Alert>;
  if (shop.removalReason === "food")
    return (
      <div role="alert" className="rounded-[18px] border-2 border-danger bg-cream-swirl p-5 text-espresso">
        <p className="text-xl font-extrabold text-danger">Your shop was removed for selling food</p>
        <p className="mt-1">
          Sippy Brew is drinks only, with no exceptions. Your shop is hidden from members and can&apos;t take orders. If this happened by genuine error rather than
          misrepresentation, you can appeal once.
        </p>
        {shop.appealedAt ? (
          <p className="mt-3 font-bold">We have your appeal and will email you our decision.</p>
        ) : (
          <AppealForm />
        )}
      </div>
    );
  if (shop.status === "paused") return <Alert tone="error">Your shop is paused and hidden from members. Contact support.</Alert>;
  if (!shop.payoutsEnabled)
    return (
      <Alert>
        Finish{" "}
        <Link href="/shop/onboarding#payouts" className="underline underline-offset-4">
          Stripe payout setup
        </Link>{" "}
        so we can send your weekly payouts.
      </Alert>
    );
  return null;
}
