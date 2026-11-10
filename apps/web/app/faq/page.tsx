import { FAQ, FAQ_FOOTNOTE } from "@sippy/core";
import Link from "next/link";
import { PageTitle } from "@/components/ui";

export const metadata = { title: "FAQ" };

/** Tap a question to reveal the answer. Copy lives in packages/core/src/faq.ts. */
export default function FaqPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pt-2 sm:pt-6">
      <PageTitle sub="Tap a question to see the answer.">FAQ</PageTitle>
      {FAQ.map((sec) => (
        <section key={sec.title} aria-labelledby={`faq-${sec.title}`} className="flex flex-col gap-2">
          <h2 id={`faq-${sec.title}`} className="px-1 text-2xl text-espresso">{sec.title}</h2>
          <div className="rounded-[22px] bg-cream-swirl px-5 py-1 shadow-card">
            {sec.items.map((it) => (
              <details key={it.q} className="group border-b border-latte last:border-b-0">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3 font-extrabold text-espresso [&::-webkit-details-marker]:hidden">
                  {it.q}
                  <span aria-hidden="true" className="shrink-0 text-2xl text-burnt-sugar-ink transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="pb-4 leading-relaxed text-espresso">{it.a}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
      <p className="px-1 text-sm text-pecan">
        {FAQ_FOOTNOTE}{" "}
        <Link href="/terms" className="font-bold text-burnt-sugar-ink underline underline-offset-4">Read the Terms</Link>
      </p>
    </div>
  );
}
