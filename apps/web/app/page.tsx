import { SITE } from "@sippy/core";
import Link from "next/link";
import { PlanCards } from "@/components/PlanCards";

const STEPS = ["Pick a pass", "Order ahead from a shop near you", "Scan at the counter. Sip."];

/** Three dancing beans, verbatim from the brand spec. Decorative. */
function HeroBeans() {
  return (
    <svg className="hero-beans" viewBox="0 0 120 80" aria-hidden="true">
      <g className="drop" style={{ "--d": "0s" } as React.CSSProperties}>
        <g className="dance">
          <ellipse cx="30" cy="40" rx="14" ry="9" fill="#A8642F" />
          <path d="M22 40 Q30 36 38 40" fill="none" stroke="#FBF6EC" strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>
      <g className="drop" style={{ "--d": "0.15s" } as React.CSSProperties}>
        <g className="dance">
          <ellipse cx="60" cy="30" rx="14" ry="9" fill="#6B4F3A" />
          <path d="M52 30 Q60 26 68 30" fill="none" stroke="#FBF6EC" strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>
      <g className="drop" style={{ "--d": "0.3s" } as React.CSSProperties}>
        <g className="dance">
          <ellipse cx="90" cy="46" rx="14" ry="9" fill="#E0A847" />
          <path d="M82 46 Q90 42 98 46" fill="none" stroke="#FBF6EC" strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}

export default function Landing() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 pt-2 sm:pt-6">
      <section className="rounded-[28px] bg-cream-swirl px-6 pb-7 pt-7 shadow-card sm:px-10 sm:pb-10 sm:pt-10">
        <p className="inline-block rounded-full bg-sky-blue px-4 py-1.5 font-bold text-espresso">New in {SITE.launchCity}</p>
        <h1 className="mt-5 text-[2.25rem] leading-[1.1] text-espresso [text-wrap:balance] sm:text-6xl">Your neighborhood, <span className="text-burnt-sugar">brewed daily.</span></h1>
        <p className="mt-4 text-[1.0625rem] text-pecan sm:text-xl">One monthly pass. Any local coffee shop.</p>
        {/* Beans sit beside the button, clear of the headline and the button itself. */}
        <div className="mt-6 flex items-center justify-between gap-4">
          <Link
            href="/match"
            className="inline-flex min-h-14 items-center whitespace-nowrap rounded-full bg-honey px-9 text-[1.1875rem] font-extrabold text-espresso shadow-card transition-colors hover:bg-caramel sm:px-12"
          >
            Get my pass
          </Link>
          <div className="pointer-events-none w-20 shrink-0 sm:w-36">
            <HeroBeans />
          </div>
        </div>
      </section>

      <section aria-labelledby="passes-title" id="passes" className="scroll-mt-20">
        <h2 id="passes-title" className="mb-4 px-1 text-[1.75rem] text-espresso sm:text-3xl">
          Pick your pass
        </h2>
        <Link href="/match" className="mb-4 flex items-center gap-3 rounded-[22px] border-2 border-honey bg-cream-swirl px-4 py-3.5 shadow-card hover:shadow-lift">
          <span aria-hidden="true" className="text-3xl">☕️</span>
          <span className="flex flex-1 flex-col">
            <b className="text-espresso">Not sure which pass?</b>
            <span className="text-sm text-pecan">Get matched in two taps.</span>
          </span>
          <span className="whitespace-nowrap rounded-full bg-espresso px-4 py-2 text-sm font-bold text-cream-swirl">Take the quiz</span>
        </Link>
        <PlanCards mode="link" />
      </section>

      <section aria-labelledby="how-title">
        <h2 id="how-title" className="mb-4 px-1 text-[1.75rem] text-espresso sm:text-3xl">
          How it works
        </h2>
        <ol className="flex flex-col gap-2.5">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-3 rounded-[18px] bg-cream-swirl px-4 py-3.5 text-lg text-espresso">
              <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-blue text-sm font-bold text-espresso">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <p className="px-1 text-sm text-pecan">
        Own a coffee shop?{" "}
        <Link href="/for-shops" className="font-bold text-burnt-sugar-ink underline underline-offset-4">
          See how it works for shops
        </Link>
      </p>
    </div>
  );
}
