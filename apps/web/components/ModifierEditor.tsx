"use client";
import { starterModifierGroups, validateModifierGroups, type ModifierGroup } from "@sippy/core";
import { useState } from "react";
import { Alert, Button, inputClass } from "./ui";

const newId = () => Math.random().toString(36).slice(2, 9);

/**
 * Edit a drink's customizations: groups like Milk or Syrups, each with options and the shop's
 * own prices. Members pick these when ordering; the price adds to the drink, the pass covers
 * the first $4/$8 of the day and the rest is an overage paid to the shop (less card processing and 5%).
 */
export function ModifierEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: ModifierGroup[];
  onSave: (groups: ModifierGroup[]) => Promise<void>;
  onCancel: () => void;
}) {
  // Prices are edited as dollar strings, converted to cents on save.
  type Draft = { id: string; name: string; required: boolean; maxSelect: number; options: { id: string; name: string; price: string }[] };
  const toDraft = (gs: ModifierGroup[]): Draft[] =>
    gs.map((g) => ({ ...g, options: g.options.map((o) => ({ id: o.id, name: o.name, price: (o.priceCents / 100).toFixed(2) })) }));
  const [groups, setGroups] = useState<Draft[]>(toDraft(initial));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (gi: number, patch: Partial<Draft>) => setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const updateOption = (gi: number, oi: number, patch: Partial<Draft["options"][number]>) =>
    setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, options: g.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) } : g)));

  async function save() {
    const out: ModifierGroup[] = groups.map((g) => ({
      id: g.id,
      name: g.name.trim(),
      required: g.required,
      maxSelect: Math.min(Math.max(1, g.maxSelect), Math.max(1, g.options.length)),
      options: g.options.filter((o) => o.name.trim()).map((o) => ({ id: o.id, name: o.name.trim(), priceCents: Math.round(Number(o.price || 0) * 100) })),
    }));
    const v = validateModifierGroups(out);
    if (!v.ok) return setError(v.message);
    setBusy(true);
    setError(null);
    try {
      await onSave(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-[16px] border-2 border-latte bg-vanilla-bean/60 p-4">
      <p className="text-sm text-pecan">
        Price options at your normal menu prices. If a member&apos;s drink goes over what their pass covers, they pay the difference and you get 100% of it.
      </p>
      {groups.length === 0 && (
        <Button size="sm" variant="secondary" onClick={() => setGroups(toDraft(starterModifierGroups()))}>
          Start with milk, extra shot and syrups
        </Button>
      )}
      {groups.map((g, gi) => (
        <fieldset key={g.id} className="flex flex-col gap-2 rounded-[14px] bg-cream-swirl p-3">
          <legend className="sr-only">Customization group {gi + 1}</legend>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <label className="flex flex-col gap-1 text-sm font-bold text-espresso">
              Group name
              <input className={inputClass} value={g.name} placeholder="Milk" onChange={(e) => update(gi, { name: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold text-espresso">
              Members can pick
              <select className={inputClass} value={g.maxSelect} onChange={(e) => update(gi, { maxSelect: Number(e.target.value) })}>
                {Array.from({ length: Math.max(1, g.options.length) }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "One" : `Up to ${n}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-espresso">
            <input type="checkbox" className="h-5 w-5 accent-burnt-sugar" checked={g.required} onChange={(e) => update(gi, { required: e.target.checked })} />
            Required (members must choose one)
          </label>
          <ul className="flex flex-col gap-2">
            {g.options.map((o, oi) => (
              <li key={o.id} className="grid grid-cols-[1fr_6.5rem_auto] items-end gap-2">
                <label className="flex flex-col gap-1 text-xs font-bold text-pecan">
                  Option
                  <input className={inputClass} value={o.name} placeholder="Oat milk" onChange={(e) => updateOption(gi, oi, { name: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold text-pecan">
                  Adds ($)
                  <input className={inputClass} inputMode="decimal" value={o.price} onChange={(e) => updateOption(gi, oi, { price: e.target.value })} />
                </label>
                <button
                  type="button"
                  className="mb-1 grid h-11 w-11 place-items-center rounded-full text-xl text-pecan hover:bg-latte"
                  aria-label={`Remove ${o.name || "option"}`}
                  onClick={() => update(gi, { options: g.options.filter((_, j) => j !== oi) })}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => update(gi, { options: [...g.options, { id: newId(), name: "", price: "0.00" }] })}>
              Add option
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setGroups((gs) => gs.filter((_, i) => i !== gi))}>
              Remove group
            </Button>
          </div>
        </fieldset>
      ))}
      <Button size="sm" variant="secondary" onClick={() => setGroups((gs) => [...gs, { id: newId(), name: "", required: false, maxSelect: 1, options: [{ id: newId(), name: "", price: "0.00" }] }])}>
        Add a customization group
      </Button>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save} disabled={busy}>
          Save customizations
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
