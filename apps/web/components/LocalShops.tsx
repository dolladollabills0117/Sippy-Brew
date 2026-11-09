"use client";
import { formatCents, formatMiles, getTier, isTierId, RULES, SITE, splitByRadius, clampRadius, DEFAULT_TIER, type LatLng } from "@sippy/core";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

const ShopMap = dynamic(() => import("./ShopMap").then((m) => m.ShopMap), { ssr: false });

type ShopPin = LatLng & { id: string; name: string; address: string };
type Here = LatLng & { label: string; mine: boolean };

/**
 * After the quiz: ask for location, then show participating shops within the member's radius
 * (capped at 15 miles to keep it local), plus a list of participating shops elsewhere.
 */
export function LocalShops({ shops, plan }: { shops: ShopPin[]; plan?: string }) {
  const t = getTier(isTierId(plan) ? plan : DEFAULT_TIER);
  const [here, setHere] = useState<Here | null>(null);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [radius, setRadius] = useState(RULES.defaultRadiusMiles);
  const [draft, setDraft] = useState(RULES.defaultRadiusMiles);
  const [showBeyond, setShowBeyond] = useState(false);

  const center: Here = here ?? { ...SITE.launchCenter, mine: false };
  const split = useMemo(() => splitByRadius(shops, center, radius), [shops, center.lat, center.lng, radius]); // eslint-disable-line react-hooks/exhaustive-deps

  function useMyLocation() {
    setAsking(true);
    setNote(null);
    if (!("geolocation" in navigator)) {
      setHere({ ...SITE.launchCenter, mine: false });
      setNote("Location isn't available in this browser, so we're showing West Orange.");
      setAsking(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "you", mine: true });
        setAsking(false);
      },
      () => {
        setHere({ ...SITE.launchCenter, mine: false });
        setNote("No location access, so we're showing West Orange. You can turn it on any time.");
        setAsking(false);
      },
      { timeout: 8000, maximumAge: 600_000 },
    );
  }

  const cta = (
    <div className="sticky bottom-[calc(12px+env(safe-area-inset-bottom))] z-10 mt-2">
      <Link
        href={`/signup?plan=${t.id}`}
        aria-label={`Get my pass: ${t.name}, ${formatCents(t.priceCents)} a month`}
        className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-burnt-sugar px-4 text-[1.1875rem] font-extrabold text-cream-swirl shadow-card hover:bg-caramel hover:text-espresso"
      >
        Get my pass · {formatCents(t.priceCents)}/mo
      </Link>
    </div>
  );

  if (!here) {
    return (
      <div className="flex flex-col gap-4">
        <section className="flex flex-col items-center gap-3 rounded-[28px] bg-cream-swirl px-6 py-8 text-center shadow-card">
          <span aria-hidden="true" className="text-5xl leading-none">📍</span>
          <h2 className="text-2xl text-espresso">See the coffee shops around you</h2>
          <p className="text-pecan">
            Turn on location and we&apos;ll show every participating shop within {RULES.defaultRadiusMiles} miles. We only use it to find shops near you.
          </p>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={asking}
            className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-honey px-8 text-[1.1875rem] font-extrabold text-espresso shadow-card hover:bg-caramel disabled:opacity-60"
          >
            {asking ? "Finding coffee near you…" : "Use my location"}
          </button>
          <button type="button" onClick={() => setHere({ ...SITE.launchCenter, mine: false })} className="min-h-11 font-bold text-burnt-sugar-ink">
            Not now, show me {SITE.launchCity}
          </button>
        </section>
        {cta}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {note && <p role="status" className="rounded-xl bg-cream-swirl px-4 py-3 text-sm font-bold text-espresso">{note}</p>}
      <section className="flex flex-col gap-3 rounded-[28px] bg-cream-swirl p-4 shadow-card sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-espresso">Near {center.label}</span>
          {center.mine ? (
            <span className="rounded-full bg-sky-blue px-2.5 py-0.5 text-xs font-extrabold text-espresso">Your location</span>
          ) : (
            <button type="button" onClick={useMyLocation} className="min-h-11 font-bold text-burnt-sugar-ink underline underline-offset-4">
              Use my location
            </button>
          )}
        </div>
        <ShopMap
          height={300}
          label={`Map: ${split.nearby.length} coffee shops within ${radius} miles`}
          pins={split.nearby.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, label: `${s.name} · ${formatMiles(s.distanceMiles)}` }))}
          areas={[{ lat: center.lat, lng: center.lng, radiusMiles: radius, label: `${radius} mi around ${center.label}` }]}
        />
        <label htmlFor="radius" className="flex flex-col gap-1 font-bold text-espresso">
          <span className="flex justify-between">
            <span>Search radius</span>
            <output htmlFor="radius" className="tabular-nums">{draft} mi</output>
          </span>
          <input
            id="radius"
            type="range"
            min={1}
            max={RULES.maxRadiusMiles}
            step={1}
            value={draft}
            aria-describedby="radius-help"
            onChange={(e) => setDraft(Number(e.target.value))}
            onPointerUp={() => setRadius(clampRadius(draft))}
            onKeyUp={() => setRadius(clampRadius(draft))}
            onBlur={() => setRadius(clampRadius(draft))}
            className="min-h-8 w-full accent-burnt-sugar"
          />
        </label>
        <p id="radius-help" className="text-sm text-pecan">
          Up to {RULES.maxRadiusMiles} miles. We keep it local, so your coffee supports the shops around you.
        </p>
      </section>

      {split.nearby.length ? (
        <>
          <h2 className="px-1 text-2xl text-espresso">
            {split.nearby.length} local shop{split.nearby.length === 1 ? "" : "s"}
          </h2>
          <ul className="rounded-[22px] bg-cream-swirl px-4 py-1 shadow-card">
            {split.nearby.map((s, i) => (
              <li key={s.id} className="flex min-h-14 items-center gap-3 border-b border-latte py-2 last:border-b-0">
                <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-burnt-sugar text-sm font-extrabold text-cream-swirl">{i + 1}</span>
                <span className="flex flex-col">
                  <Link href={`/shops/${s.id}`} className="font-bold text-espresso hover:underline">{s.name}</Link>
                  <span className="text-sm text-pecan">{s.address} · {formatMiles(s.distanceMiles)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <section className="rounded-[22px] bg-cream-swirl p-5 shadow-card">
          <p className="font-bold text-espresso">No shops within {radius} miles yet</p>
          <p className="text-sm text-pecan">
            {center.mine ? `Sippy Brew is live in ${SITE.launchCity} for now, and we're signing up shops near you.` : "Try a bigger radius."}
          </p>
          {center.mine && (
            <button type="button" onClick={() => setHere({ ...SITE.launchCenter, mine: false })} className="mt-2 min-h-11 font-bold text-burnt-sugar-ink underline underline-offset-4">
              Preview {SITE.launchCity}
            </button>
          )}
        </section>
      )}

      {split.beyond.length > 0 && (
        <>
          <button type="button" aria-expanded={showBeyond} onClick={() => setShowBeyond(!showBeyond)} className="min-h-11 font-bold text-burnt-sugar-ink">
            {showBeyond ? "Hide" : "See"} other participating shops ({split.beyond.length})
          </button>
          {showBeyond && (
            <section className="rounded-[22px] bg-cream-swirl px-4 py-3 shadow-card">
              <p className="text-sm text-pecan">Outside your {radius}-mile area. Visiting? These shops take Sippy Brew passes too.</p>
              <ul>
                {split.beyond.map((s) => (
                  <li key={s.id} className="flex min-h-14 flex-col justify-center border-b border-latte py-2 last:border-b-0">
                    <span className="font-bold text-espresso">{s.name}</span>
                    <span className="text-sm text-pecan">{s.address} · {formatMiles(s.distanceMiles)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {cta}
    </div>
  );
}
