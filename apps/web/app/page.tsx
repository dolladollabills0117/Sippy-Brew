import { formatCents, RULES } from "@sippy/core";
import { TierCards } from "@/components/TierCards";
import { ButtonLink, Card, SectionTitle } from "@/components/ui";

const STEPS = [
  { n: "1", title: "Pick a plan", body: "Choose Sip, Regular, or Daily. Your coffee credit loads right away." },
  { n: "2", title: "Order ahead", body: "Find a neighborhood shop, choose your coffee, and pick a pickup time." },
  { n: "3", title: "Scan and sip", body: "Show your QR code at the counter. The shop scans it and hands you your cup." },
];

export default function Landing() {
  return (
    <>
      <section className="hero-gradient relative -mx-4 overflow-hidden px-4 pb-16 pt-16 sm:-mx-6 sm:mt-6 sm:rounded-[28px] sm:px-12 sm:pt-20">
        <div className="max-w-2xl">
          <p className="mb-4 inline-block rounded-full bg-cream-swirl/90 px-3 py-1 text-sm font-extrabold text-espresso">
            One membership · Independent coffee shops
          </p>
          <h1 className="glow text-5xl leading-[1.05] text-espresso sm:text-7xl">Your neighborhood, every morning</h1>
          <p className="mt-5 max-w-xl text-lg font-semibold text-espresso sm:text-xl">
            A monthly coffee credit you can spend at any participating local shop. Order ahead, skip the line, and keep your
            favorite baristas in business.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/signup">Get started</ButtonLink>
            <ButtonLink href="/shops" variant="secondary">
              See the shops
            </ButtonLink>
          </div>
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
          <ButtonLink href={`/signup?plan=${id}`} variant={hl ? "primary" : "secondary"} className="w-full">
            Get started
          </ButtonLink>
        )}
      />
      <p className="mt-6 text-sm text-pecan">
        Coffee only — food isn&apos;t sold through the app. Spend up to {formatCents(RULES.dailyLimitCents)} a day. Unused credit
        expires at renewal.
      </p>

      <SectionTitle>Own a coffee shop?</SectionTitle>
      <Card className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-espresso">
          Get new regulars, pickup orders and weekly payouts. You keep {100 - RULES.commissionBps / 100}% of every order members pay
          for with credit.
        </p>
        <ButtonLink href="/signup?role=shop" variant="secondary">
          List your shop
        </ButtonLink>
      </Card>
    </>
  );
}
