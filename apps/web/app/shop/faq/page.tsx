import { MERCHANT_FAQ, MERCHANT_FAQ_FOOTNOTE } from "@sippy/core";
import { FaqList } from "@/components/FaqList";
import { PageTitle } from "@/components/ui";
import { requirePageSession } from "@/lib/auth";

export const metadata = { title: "Shop FAQ" };

/** Merchant FAQ. Copy lives in packages/core/src/faq.ts. */
export default async function ShopFaqPage() {
  await requirePageSession("shop_owner", "/shop/faq");
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageTitle sub="Tap a question to see the answer.">Shop FAQ</PageTitle>
      <FaqList sections={MERCHANT_FAQ} />
      <p className="px-1 text-sm text-pecan">{MERCHANT_FAQ_FOOTNOTE}</p>
    </div>
  );
}
