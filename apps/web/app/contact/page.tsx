import { SITE } from "@sippy/core";
import Link from "next/link";
import { ContactForm } from "@/components/ContactForm";
import { Card, PageTitle } from "@/components/ui";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Contact us" };
export const dynamic = "force-dynamic";

/** Members and shops can reach Sippy Brew here. */
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const [{ topic }, s] = await Promise.all([searchParams, getSession().catch(() => null)]);
  const t = topic === "shop" || s?.profile.role === "shop_owner" ? "shop" : topic === "other" ? "other" : "member";
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 pt-2 sm:pt-6">
      <PageTitle sub="Members and coffee shops: we read every message.">Contact us</PageTitle>
      <Card className="flex flex-col gap-2">
        <p className="font-bold text-espresso">Email us directly</p>
        <a href={`mailto:${SITE.supportEmail}`} className="text-xl font-extrabold text-burnt-sugar-ink underline underline-offset-4">
          {SITE.supportEmail}
        </a>
        <p className="text-sm text-pecan">
          About an order (a drink, a mistake, a wait)? The shop that made it can fix it fastest. For anything about your pass, billing, your shop listing or payouts,
          write to us.{" "}
          <Link href={t === "shop" ? "/shop/faq" : "/faq"} className="font-bold underline underline-offset-4">
            The FAQ
          </Link>{" "}
          may have your answer already.
        </p>
      </Card>
      <Card>
        <ContactForm defaultTopic={t} defaultEmail={s?.profile.email ?? ""} defaultName={s?.profile.name ?? ""} />
      </Card>
    </div>
  );
}
