import type { FaqSection } from "@sippy/core";

/** Tap a question to reveal the answer. */
export function FaqList({ sections }: { sections: readonly FaqSection[] }) {
  return (
    <>
      {sections.map((sec) => (
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
    </>
  );
}
