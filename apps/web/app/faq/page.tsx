import { FAQ, FAQ_FOOTNOTE } from "@sippy/core";
import Link from "next/link";
import { FaqList } from "@/components/FaqList";
import { PageTitle } from "@/components/ui";

export const metadata = { title: "FAQ" };

/** Member FAQ. Copy lives in packages/core/src/faq.ts. */
export default function FaqPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pt-2 sm:pt-6">
      <PageTitle sub="Tap a question to see the answer.">FAQ</PageTitle>
      <FaqList sections={FAQ} />
      <p className="px-1 text-sm text-pecan">
        {FAQ_FOOTNOTE}{" "}
        <Link href="/terms" className="font-bold text-burnt-sugar-ink underline underline-offset-4">Read the Terms</Link>
      </p>
    </div>
  );
}
