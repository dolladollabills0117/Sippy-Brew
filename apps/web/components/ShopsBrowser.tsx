"use client";
import type { SavedArea, ShopListItem } from "@sippy/core";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { ShopCard } from "./ShopCard";
import { cx, EmptyState, SkeletonList } from "./ui";

const ShopMap = dynamic(() => import("./ShopMap").then((m) => m.ShopMap), { ssr: false, loading: () => <div className="skeleton h-[360px]" /> });

type Filter = "all" | "home" | "work";

export function ShopsBrowser({ initial, areas, signedIn }: { initial: ShopListItem[]; areas: SavedArea[]; signedIn: boolean }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [shops, setShops] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(f: Filter) {
    setFilter(f);
    setLoading(true);
    setError(null);
    try {
      const res = await api.listShops(f === "all" ? {} : { near: f });
      setShops(res.shops);
    } catch {
      setError("Couldn't load shops. Pull to refresh or try again.");
    } finally {
      setLoading(false);
    }
  }

  const has = (k: "home" | "work") => areas.some((a) => a.kind === k);
  const tabs: { id: Filter; label: string; enabled: boolean }[] = [
    { id: "all", label: "All shops", enabled: true },
    { id: "home", label: "Near home", enabled: has("home") },
    { id: "work", label: "Near work", enabled: has("work") },
  ];
  const shownAreas = filter === "all" ? [] : areas.filter((a) => a.kind === filter);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="order-2 flex flex-col gap-4 lg:order-1">
        <div role="group" aria-label="Filter shops" className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={!t.enabled}
              aria-pressed={filter === t.id}
              onClick={() => choose(t.id)}
              className={cx(
                "min-h-11 rounded-full border-2 px-4 font-bold transition-colors disabled:opacity-50",
                filter === t.id ? "border-espresso bg-sky-blue text-espresso" : "border-latte bg-cream-swirl text-espresso hover:bg-latte",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {signedIn && areas.length < 2 && (
          <p className="text-sm text-pecan">
            <Link href="/account#areas" className="font-bold text-burnt-sugar-ink underline underline-offset-4">
              Save your home and work areas
            </Link>{" "}
            to filter by neighborhood.
          </p>
        )}
        {error && <p role="alert" className="font-bold text-danger">{error}</p>}
        {loading ? (
          <SkeletonList rows={4} label="Loading shops" />
        ) : shops.length === 0 ? (
          <EmptyState title="No shops here yet">
            {filter === "all" ? "We're signing up shops in your area. Check back soon." : "No participating shops in this area. Try a bigger radius on your account page."}
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3" aria-live="polite">
            {shops.map((s) => (
              <li key={s.id}>
                <ShopCard shop={s} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="order-1 lg:sticky lg:top-24 lg:order-2 lg:self-start">
        <ShopMap pins={shops.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, label: s.name, href: `/shops/${s.id}` }))} areas={shownAreas} />
      </div>
    </div>
  );
}
