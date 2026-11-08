"use client";
import { colors } from "@sippy/core/brand";
import type { LatLng } from "@sippy/core";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

type Pin = LatLng & { id: string; label: string; href?: string };

/**
 * OpenStreetMap via Leaflet. Pins are Burnt Sugar dots; the selected pin and saved areas get
 * the Sky Blue accent. Pass onPick to let the user click to choose a location.
 */
export function ShopMap({
  pins,
  areas = [],
  selectedId,
  onPick,
  height = 360,
  label = "Map of participating shops",
}: {
  pins: Pin[];
  areas?: (LatLng & { radiusMiles: number; label: string })[];
  selectedId?: string | null;
  onPick?: (p: LatLng) => void;
  height?: number;
  label?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const layer = useRef<import("leaflet").LayerGroup | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { scrollWheelZoom: false, attributionControl: true }).setView([40.735, -74.03], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      m.on("click", (e) => pickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
      map.current = m;
      layer.current = L.layerGroup().addTo(m);
      draw(L);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      if (!map.current) return;
      draw((await import("leaflet")).default);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, areas, selectedId]);

  function draw(L: typeof import("leaflet")) {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    for (const a of areas) {
      L.circle([a.lat, a.lng], { radius: a.radiusMiles * 1609, color: colors.espresso, weight: 1.5, fillColor: colors.skyBlue, fillOpacity: 0.18 })
        .bindTooltip(a.label)
        .addTo(g);
    }
    for (const p of pins) {
      const selected = p.id === selectedId;
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: selected ? 11 : 8,
        color: selected ? colors.espresso : colors.creamSwirl,
        weight: 3,
        fillColor: selected ? colors.skyBlue : colors.burntSugar,
        fillOpacity: 1,
      }).addTo(g);
      marker.bindTooltip(p.label);
      if (p.href) marker.on("click", () => (window.location.href = p.href!));
    }
    const pts = [...pins, ...areas].map((p) => [p.lat, p.lng] as [number, number]);
    if (pts.length > 1) m.fitBounds(pts, { padding: [32, 32], maxZoom: 15 });
    else if (pts.length === 1) m.setView(pts[0]!, 14);
  }

  return <div ref={el} role="region" aria-label={label} style={{ height }} className="w-full overflow-hidden rounded-2xl border border-latte bg-latte/40" />;
}
