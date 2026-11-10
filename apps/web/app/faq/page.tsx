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
      <p className="-mt-2 px-1 text-pecan">
        Can&apos;t find it? <Link href="/contact" className="font-bold text-burnt-sugar-ink underline underline-offset-4">Contact us</Link>.
      </p>
      <FaqList sections={FAQ} />
      <p className="px-1 text-sm text-pecan">
        {FAQ_FOOTNOTE}{" "}
        <Link href="/terms" className="font-bold text-burnt-sugar-ink underline underline-offset-4">Read the Terms</Link>
      </p>
    </div>
  );
}
