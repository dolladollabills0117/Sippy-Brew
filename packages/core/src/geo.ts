import { RULES } from "./config";

export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance in miles. */
export function distanceMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatMiles(mi: number): string {
  if (mi < 0.1) return "Right here";
  return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
}

export interface SavedArea extends LatLng {
  kind: "home" | "work";
  label: string;
  radiusMiles: number;
}

/** Shops within a saved area's radius, nearest first. */
export function shopsNear<T extends LatLng>(shops: readonly T[], area: LatLng & { radiusMiles: number }): (T & { distanceMiles: number })[] {
  return shops
    .map((s) => ({ ...s, distanceMiles: distanceMiles(area, s) }))
    .filter((s) => s.distanceMiles <= area.radiusMiles)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
}

/** Keep a chosen radius between half a mile and the local cap (15 miles). */
export function clampRadius(miles: unknown): number {
  const n = Number(miles);
  if (!Number.isFinite(n) || n <= 0) return RULES.defaultRadiusMiles;
  return Math.min(RULES.maxRadiusMiles, Math.max(0.5, n));
}

/**
 * Shops split by distance from where the member is: `nearby` within the radius (nearest first),
 * `beyond` the rest of the participating shops, so members can still see who takes part elsewhere.
 */
export function splitByRadius<T extends LatLng>(
  shops: readonly T[],
  center: LatLng,
  radiusMiles: number,
): { nearby: (T & { distanceMiles: number })[]; beyond: (T & { distanceMiles: number })[] } {
  const r = clampRadius(radiusMiles);
  const all = shops.map((x) => ({ ...x, distanceMiles: distanceMiles(center, x) })).sort((a, b) => a.distanceMiles - b.distanceMiles);
  return { nearby: all.filter((x) => x.distanceMiles <= r), beyond: all.filter((x) => x.distanceMiles > r) };
}
