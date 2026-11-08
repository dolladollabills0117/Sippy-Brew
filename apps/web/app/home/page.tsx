import Link from "next/link";
import { PassSummary } from "@/components/PassSummary";
import { ShopCard } from "@/components/ShopCard";
import { Badge, ButtonLink, Card, EmptyState, PageTitle, SectionTitle } from "@/components/ui";
import { requirePageSession } from "@/lib/auth";
import { getMemberSummary, listShops, memberOrders } from "@/lib/member";
import { firstName } from "@sippy/core";

export const dynamic = "force-dynamic";
export const metadata = { title: "Home" };

export default async function MemberHome() {
  const s = await requirePageSession("member", "/home");
  const [summary, { shops, spotlights, posts }, orders] = await Promise.all([getMemberSummary(s), listShops(s), memberOrders(s.userId, 10)]);
  const regulars = shops.filter((x) => x.saved);
  const active = orders.find((o) => ["received", "preparing", "ready"].includes(o.status));

  return (
    <>
      <PageTitle kicker="Good morning" sub={summary.tierName ? `${summary.tierName} member` : undefined}>
        Hi, {firstName(s.profile.name)}
      </PageTitle>

      {!summary.subscription ? (
        <Card className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-lg text-espresso">Pick a plan to get your Daily Passes.</p>
          <ButtonLink href="/plans">Choose a plan</ButtonLink>
        </Card>
      ) : (
        <PassSummary summary={summary} />
      )}

      {active && (
        <Link href={`/orders/${active.id}`} className="card mt-4 flex items-center justify-between gap-4 border-2 border-sky-blue p-5">
          <div>
            <Badge>{active.status === "ready" ? "Ready" : "In progress"}</Badge>
            <p className="mt-1 text-lg font-bold text-espresso">Your order at {active.shopName}</p>
          </div>
          <span className="font-extrabold text-burnt-sugar-ink">Show QR →</span>
        </Link>
      )}

      <SectionTitle action={<Link href="/shops" className="font-bold text-burnt-sugar-ink underline underline-offset-4">All shops</Link>}>
        My regulars
      </SectionTitle>
      {regulars.length === 0 ? (
        <EmptyState title="No regulars yet">Tap “Save as a regular” on any shop page to keep it here.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {regulars.map((x) => (
            <li key={x.id}>
              <ShopCard shop={x} />
            </li>
          ))}
        </ul>
      )}

      <SectionTitle>Shop spotlights</SectionTitle>
      {spotlights.length === 0 ? (
        <EmptyState title="No spotlights this week" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {spotlights.map((x) => (
            <li key={x.id}>
              <ShopCard shop={x} />
            </li>
          ))}
        </ul>
      )}

      <SectionTitle>From the shops</SectionTitle>
      {posts.length === 0 ? (
        <EmptyState title="No specials today">When shops post a daily special, it shows up here.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/shops/${p.shopId}`} className="card block p-5 hover:shadow-lift">
                <p className="font-heading text-lg text-espresso">{p.shopName}</p>
                <p className="mt-1 text-espresso">{p.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
