import Link from "next/link";
import { formatHours, formatMiles, zonedParts, RULES, type ShopListItem } from "@sippy/core";
import { Badge } from "./ui";

export function ShopCard({ shop }: { shop: ShopListItem }) {
  const today = zonedParts(new Date(), RULES.timeZone).weekday;
  return (
    <Link href={`/shops/${shop.id}`} className="card group flex gap-4 p-4 transition-shadow hover:shadow-lift">
      <div
        className="hero-gradient h-24 w-24 shrink-0 rounded-[14px] bg-cover bg-center"
        style={shop.photoUrl ? { backgroundImage: `url(${shop.photoUrl})` } : undefined}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl text-espresso group-hover:underline">{shop.name}</h3>
          {shop.saved && <Badge>My regular</Badge>}
        </div>
        <p className="truncate text-sm text-pecan">{shop.address}</p>
        <p className="mt-1 text-sm font-bold text-espresso">
          {shop.openNow ? "Open now" : "Closed"} · {formatHours(shop.hours[today])}
          {shop.distanceMiles !== null && <> · {formatMiles(shop.distanceMiles)}</>}
        </p>
        <p className="mt-1 line-clamp-2 text-sm text-pecan">{shop.story}</p>
      </div>
    </Link>
  );
}
