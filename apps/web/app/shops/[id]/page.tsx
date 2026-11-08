import { CATEGORY_LABELS, COFFEE_CATEGORIES, formatHours, WEEKDAYS } from "@sippy/core";
import { SaveShopButton } from "@/components/SaveShopButton";
import { Badge, ButtonLink, Card, EmptyState, Money, SectionTitle } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { getShopDetail } from "@/lib/member";

export const dynamic = "force-dynamic";

const DAY_NAMES = { sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" } as const;

export default async function ShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  const { shop, menu, post, saved } = await getShopDetail(id, s);
  const orderable = menu.some((m) => m.available && !m.soldOutToday);

  return (
    <>
      <section className="hero-gradient -mx-4 mt-0 px-4 pb-10 pt-10 sm:mx-0 sm:mt-6 sm:rounded-[28px] sm:px-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="glow text-4xl text-espresso sm:text-6xl">{shop.name}</h1>
            <p className="mt-2 font-bold text-espresso">{shop.address}</p>
            <p className="mt-3 max-w-xl text-espresso">{shop.story}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {s?.profile.role === "member" && <SaveShopButton shopId={shop.id} initial={saved} />}
            {orderable && (
              <ButtonLink href={s ? `/order/${shop.id}` : `/login?next=/order/${shop.id}`}>Order for pickup</ButtonLink>
            )}
          </div>
        </div>
      </section>

      {post && (
        <Card className="mt-6 border-2 border-sky-blue">
          <Badge>Today&apos;s special</Badge>
          <p className="mt-2 text-lg text-espresso">{post.body}</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <SectionTitle>Menu</SectionTitle>
          {menu.length === 0 ? (
            <EmptyState title="Menu coming soon">This shop is still adding its coffee menu.</EmptyState>
          ) : (
            COFFEE_CATEGORIES.filter((c) => menu.some((m) => m.category === c)).map((c) => (
              <div key={c} className="mb-6">
                <h3 className="mb-2 text-xl text-pecan">{CATEGORY_LABELS[c]}</h3>
                <ul className="card divide-y divide-latte">
                  {menu
                    .filter((m) => m.category === c)
                    .map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-4 px-5 py-3">
                        <div>
                          <p className="font-bold text-espresso">{m.name}</p>
                          <p className="text-sm text-pecan">{m.size}</p>
                        </div>
                        <div className="text-right">
                          <Money cents={m.priceCents} className="font-extrabold text-espresso" />
                          {(!m.available || m.soldOutToday) && <p className="text-sm font-bold text-danger">Sold out</p>}
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            ))
          )}
        </div>
        <div>
          <SectionTitle>Hours</SectionTitle>
          <Card>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
              {[...WEEKDAYS.slice(1), WEEKDAYS[0]!].map((d) => (
                <div key={d} className="contents">
                  <dt className="font-bold text-espresso">{DAY_NAMES[d]}</dt>
                  <dd className="text-pecan">{formatHours(shop.hours[d])}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
