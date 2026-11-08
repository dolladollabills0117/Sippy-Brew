"use client";
import { CATEGORY_LABELS, COFFEE_CATEGORIES, validateMenuItem, type CoffeeCategory, type MenuItem } from "@sippy/core";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Card, EmptyState, Field, Money, inputClass } from "./ui";

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold text-espresso">
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="relative h-7 w-12 rounded-full border-2 border-pecan bg-latte transition-colors peer-checked:bg-sky-blue peer-focus-visible:shadow-[var(--brand-focus-ring)] after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-espresso after:transition-transform peer-checked:after:translate-x-5" />
      {label}
    </label>
  );
}

export function MenuManager({ initial }: { initial: MenuItem[] }) {
  const [items, setItems] = useState(initial);
  const [form, setForm] = useState({ name: "", size: "12 oz", price: "", category: "espresso" as CoffeeCategory });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function patch(id: string, p: Parameters<typeof api.updateMenuItem>[1]) {
    const prev = items;
    setItems((l) => l.map((m) => (m.id === id ? { ...m, ...p } : m)));
    try {
      const { item } = await api.updateMenuItem(id, p);
      setItems((l) => l.map((m) => (m.id === id ? item : m)));
    } catch (e) {
      setItems(prev);
      setError(e instanceof ApiError ? e.message : "Couldn't save.");
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input = { name: form.name, size: form.size, priceCents: Math.round(Number(form.price) * 100), category: form.category };
    const v = validateMenuItem(input);
    if (!v.ok) return setError(v.message);
    setBusy(true);
    try {
      const { item } = await api.addMenuItem(input);
      setItems((l) => [...l, item]);
      setForm({ ...form, name: "", price: "" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't add item.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: MenuItem) {
    if (!window.confirm(`Remove ${m.name} from your menu?`)) return;
    await api.deleteMenuItem(m.id);
    setItems((l) => l.filter((x) => x.id !== m.id));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="flex flex-col gap-3">
        {error && <Alert tone="error">{error}</Alert>}
        {items.length === 0 ? (
          <EmptyState title="No menu items yet">Add your first coffee with the form.</EmptyState>
        ) : (
          <ul className="card divide-y divide-latte">
            {items.map((m) => (
              <li key={m.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-espresso">
                    {m.name} <span className="font-normal text-pecan">· {m.size}</span>
                  </p>
                  <p className="text-sm text-pecan">
                    {CATEGORY_LABELS[m.category]} · <Money cents={m.priceCents} />
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Toggle label="Available" checked={m.available} onChange={(v) => patch(m.id, { available: v })} />
                  <Toggle label="Sold out today" checked={m.soldOutToday} onChange={(v) => patch(m.id, { soldOutToday: v })} />
                  <Button size="sm" variant="ghost" onClick={() => remove(m)} aria-label={`Remove ${m.name}`}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Card>
        <h2 className="text-2xl text-espresso">Add a coffee</h2>
        <form onSubmit={add} className="mt-4 flex flex-col gap-4">
          <Field id="m-name" label="Name">
            <input id="m-name" className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field id="m-cat" label="Category" hint="Coffee categories only.">
            <select id="m-cat" className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as CoffeeCategory })}>
              {COFFEE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="m-size" label="Size">
              <input id="m-size" className={inputClass} value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} required />
            </Field>
            <Field id="m-price" label="Price ($)">
              <input id="m-price" className={inputClass} inputMode="decimal" type="number" min="1" max="20" step="0.05" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </Field>
          </div>
          <Button type="submit" disabled={busy}>
            Add to menu
          </Button>
        </form>
      </Card>
    </div>
  );
}
