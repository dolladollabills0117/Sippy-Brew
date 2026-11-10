import { FOOD_POLICY, PLATFORM_ROLE_TERMS } from "@sippy/core";
import { PageTitle } from "@/components/ui";

export const metadata = { title: "Terms of Service" };

/**
 * Terms of Service. The "Our role" section is the plain-language summary shared with the apps
 * (packages/core/src/legal.ts). Draft copy: have a lawyer review the full terms before launch.
 */
export default function TermsPage() {
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-4 pt-2 sm:pt-6">
      <PageTitle sub="The short version of how Sippy Brew works and who's responsible for what.">Terms of Service</PageTitle>
      <section aria-labelledby="role" className="flex flex-col gap-3 rounded-[22px] bg-cream-swirl p-6 shadow-card">
        <h2 id="role" className="text-2xl text-espresso">Our role: we&apos;re not the coffee shop</h2>
        {PLATFORM_ROLE_TERMS.map((p) => (
          <p key={p} className="leading-relaxed text-espresso">{p}</p>
        ))}
      </section>
      <section aria-labelledby="food" className="flex flex-col gap-3 rounded-[22px] bg-cream-swirl p-6 shadow-card">
        <h2 id="food" className="text-2xl text-espresso">Drinks only</h2>
        <p className="leading-relaxed text-espresso">{FOOD_POLICY}</p>
      </section>
      <section aria-labelledby="plans" className="flex flex-col gap-3 rounded-[22px] bg-cream-swirl p-6 shadow-card">
        <h2 id="plans" className="text-2xl text-espresso">Your pass</h2>
        <p className="leading-relaxed text-espresso">
          Your pass renews monthly on the day you joined. Each Daily Pass covers one order on one day, up to your plan&apos;s daily amount; anything above that is an overage
          you confirm and pay at checkout. Unused passes expire at renewal and don&apos;t roll over.
        </p>
        <p className="leading-relaxed text-espresso">
          You can change your pass any time. A change takes effect at the start of your next month; this month stays as it is. Moving up to the higher daily amount within
          the same pass is the one exception: you pay the monthly difference and it applies right away. You can cancel any time and keep your passes until the month ends.
        </p>
      </section>
    </article>
  );
}
