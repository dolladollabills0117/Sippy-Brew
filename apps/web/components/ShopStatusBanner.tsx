import type { Shop } from "@sippy/core";
import Link from "next/link";
import { Alert } from "./ui";

export function ShopStatusBanner({ shop }: { shop: Shop }) {
  if (shop.status === "pending")
    return <Alert>Your shop is waiting for approval. Members can&apos;t see it yet. We&apos;ll email you when you&apos;re live.</Alert>;
  if (shop.status === "paused") return <Alert tone="error">Your shop is paused and hidden from members. Contact Sippy Brew support.</Alert>;
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
