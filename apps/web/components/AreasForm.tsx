"use client";
import type { LatLng, SavedArea } from "@sippy/core";
import dynamic from "next/dynamic";
import { useState } from "react";
import { api } from "@/lib/api";
import { Alert, Button, Card, cx, inputClass } from "./ui";

const ShopMap = dynamic(() => import("./ShopMap").then((m) => m.ShopMap), { ssr: false, loading: () => <div className="skeleton h-[280px]" /> });

type Kind = "home" | "work";

/** Members save up to two areas ("near home", "near work") by tapping the map or using their location. */
export function AreasForm({ initial }: { initial: SavedArea[] }) {
  const [areas, setAreas] = useState<SavedArea[]>(initial);
  const [editing, setEditing] = useState<Kind>("home");
  const [status, setStatus] = useState<{ tone: "success" | "error"; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const current = areas.find((a) => a.kind === editing);

  function setPoint(p: LatLng) {
    setAreas((list) => {
      const rest = list.filter((a) => a.kind !== editing);
      const prev = list.find((a) => a.kind === editing);
      return [...rest, { kind: editing, label: prev?.label ?? (editing === "home" ? "Home" : "Work"), radiusMiles: prev?.radiusMiles ?? 2, ...p }];
    });
  }

  function update(patch: Partial<SavedArea>) {
    setAreas((list) => list.map((a) => (a.kind === editing ? { ...a, ...patch } : a)));
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setStatus({ tone: "error", msg: "Couldn't get your location. Tap the map instead." }),
    );
  }

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      setAreas((await api.setAreas(areas)).areas);
      setStatus({ tone: "success", msg: "Saved." });
    } catch {
      setStatus({ tone: "error", msg: "Couldn't save. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div role="tablist" aria-label="Which area" className="flex gap-2">
        {(["home", "work"] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={editing === k}
            onClick={() => setEditing(k)}
            className={cx(
              "min-h-11 rounded-full border-2 px-4 font-bold capitalize",
              editing === k ? "border-espresso bg-sky-blue text-espresso" : "border-latte bg-cream-swirl text-espresso",
            )}
          >
            Near {k} {areas.some((a) => a.kind === k) ? "✓" : ""}
          </button>
        ))}
      </div>
      <p className="text-pecan">Tap the map to set your {editing} area, or use your current location.</p>
      <ShopMap pins={[]} areas={areas.filter((a) => a.kind === editing)} onPick={setPoint} height={280} label={`Map to choose your ${editing} area`} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="flex flex-col gap-1.5 font-bold text-espresso">
          Label
          <input className={inputClass} value={current?.label ?? ""} disabled={!current} onChange={(e) => update({ label: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1.5 font-bold text-espresso">
          Radius
          <select
            className={inputClass}
            disabled={!current}
            value={current?.radiusMiles ?? 2}
            onChange={(e) => update({ radiusMiles: Number(e.target.value) })}
          >
            {[0.5, 1, 2, 3, 5, 10].map((r) => (
              <option key={r} value={r}>
                {r} mi
              </option>
            ))}
          </select>
        </label>
        <Button type="button" size="sm" variant="secondary" onClick={locate}>
          Use my location
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={busy}>
          Save areas
        </Button>
        {current && (
          <Button variant="ghost" size="sm" onClick={() => setAreas((l) => l.filter((a) => a.kind !== editing))}>
            Remove {editing}
          </Button>
        )}
      </div>
      {status && <Alert tone={status.tone}>{status.msg}</Alert>}
    </Card>
  );
}
