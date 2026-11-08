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
