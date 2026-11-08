import { formatCents, SITE, TIERS } from "@sippy/core";
import { TierCards } from "@/components/TierCards";
import { ButtonLink, Card, SectionTitle } from "@/components/ui";

const MAX_PASS = TIERS[0]!.maxPassValueCents;

const STEPS = [
  { n: "1", title: "Pick a plan", body: "Affogato, Macchiato or Double Espresso. Your Daily Passes load right away." },
  { n: "2", title: "Order ahead", body: `One pass a day at any shop covers the first ${formatCents(MAX_PASS, { showZeroCents: true })} of your order.` },
  { n: "3", title: "Scan and sip", body: "Show your QR code at the counter. The shop scans it and hands you your cup." },
];

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
    <>
      <section className="hero-gradient relative -mx-4 mt-0 overflow-hidden px-6 pb-36 pt-12 sm:mx-0 sm:mt-6 sm:rounded-[28px] sm:px-12 sm:pb-16 sm:pt-16">
        <div className="relative z-10 max-w-xl">
          <p className="mb-5 inline-block -rotate-3 rounded-full border-2 border-espresso bg-cream-swirl px-4 py-1.5 text-sm font-extrabold uppercase tracking-wide text-espresso shadow-card">
            New in {SITE.launchCity}
          </p>
          <h1 className="glow text-5xl leading-[1.05] text-espresso sm:text-7xl">Your neighborhood, brewed daily.</h1>
          <p className="mt-5 text-xl font-bold text-espresso sm:text-2xl">One monthly pass. Any local coffee shop.</p>
          <div className="mt-8">
            <ButtonLink href="/signup" variant="honey">
              Get my pass
            </ButtonLink>
          </div>
        </div>
        {/* Lower right, in its own space below the button on phones and beside the copy on wider screens. */}
        <div className="pointer-events-none absolute bottom-4 right-4 w-40 sm:bottom-8 sm:right-10 sm:w-56">
          <HeroBeans />
        </div>
      </section>

      <SectionTitle>How it works</SectionTitle>
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n}>
            <Card className="h-full">
              <span aria-hidden="true" className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-sky-blue font-extrabold text-espresso">
                {s.n}
              </span>
              <h3 className="text-2xl text-espresso">{s.title}</h3>
              <p className="mt-2 text-pecan">{s.body}</p>
            </Card>
          </li>
        ))}
      </ol>

      <SectionTitle>Plans</SectionTitle>
      <TierCards
        action={(id, hl) => (
          <ButtonLink href={`/signup?plan=${id}`} variant={hl ? "honey" : "secondary"} className="w-full">
            Get my pass
          </ButtonLink>
        )}
      />
      <p className="mt-6 text-sm text-pecan">
        Coffee only. One pass per day. If your order is over {formatCents(MAX_PASS, { showZeroCents: true })}, you&apos;ll see the overage and
        confirm it before you pay. Unused passes expire at renewal.
      </p>

      <SectionTitle>Own a coffee shop?</SectionTitle>
      <Card className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-espresso">Get new regulars, pickup orders from members nearby, and weekly payouts to your bank.</p>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/for-shops" variant="secondary">
            How it works for shops
          </ButtonLink>
          <ButtonLink href="/signup?role=shop" variant="secondary">
            List your shop
          </ButtonLink>
        </div>
      </Card>
    </>
  );
}
