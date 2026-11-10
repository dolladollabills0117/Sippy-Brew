"use client";
import { CATEGORY_LABELS, COFFEE_CATEGORIES, validateMenuItem, type MenuItem, type MenuItemInput } from "@sippy/core";
import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Card, inputClass } from "./ui";

type Row = MenuItemInput & { keep: boolean; price: string };

/** Shrink the photo before upload (long side 1600px, JPEG) so it's quick and under the size limit. */
async function toJpegBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1]!;
}

/**
 * Take or upload a photo of the menu; we read the coffee items and prices and fill them in for
 * review. Nothing is added until the shop checks the list and taps Add.
 */
export function MenuPhotoImport({ onAdded }: { onAdded: (items: MenuItem[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [skipped, setSkipped] = useState<{ name: string; reason: string }[]>([]);
  const [busy, setBusy] = useState<"reading" | "adding" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function read(file: File) {
    setBusy("reading");
    setError(null);
    try {
      const res = await api.scanMenu(await toJpegBase64(file), "image/jpeg");
      setRows(res.items.map((i) => ({ ...i, keep: true, price: (i.priceCents / 100).toFixed(2) })));
      setSkipped(res.skipped);
      if (!res.items.length) setError("We didn't find any coffee drinks with prices in that photo. Try a clearer, straight-on photo.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't read that photo. Try again.");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  async function addAll() {
    if (!rows) return;
    const chosen = rows.filter((r) => r.keep).map((r) => ({ name: r.name, size: r.size, category: r.category, priceCents: Math.round(Number(r.price) * 100) }));
    const bad = chosen.map((c) => [c, validateMenuItem(c)] as const).find(([, v]) => !v.ok);
    if (bad) return setError(`${bad[0].name || "An item"}: ${(bad[1] as { message: string }).message}`);
    setBusy("adding");
    setError(null);
    const added: MenuItem[] = [];
    try {
      for (const c of chosen) added.push((await api.addMenuItem(c)).item);
      onAdded(added);
      setRows(null);
      setSkipped([]);
    } catch (e) {
      onAdded(added);
      setError(e instanceof ApiError ? e.message : "Some items couldn't be added. Check them and try again.");
    } finally {
      setBusy(null);
    }
  }

  const set = (i: number, p: Partial<Row>) => setRows((r) => r!.map((x, j) => (j === i ? { ...x, ...p } : x)));

  return (
    <Card className="flex flex-col gap-3 border-2 border-honey">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl text-espresso">📸 Add items from a photo</h2>
          <p className="text-pecan">Snap your menu board or printed menu. We&apos;ll fill in the coffee drinks and prices for you to check.</p>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          id="menu-photo"
          onChange={(e) => e.target.files?.[0] && read(e.target.files[0])}
        />
        <label htmlFor="menu-photo" className="inline-flex min-h-12 cursor-pointer items-center rounded-full bg-espresso px-6 font-bold text-cream-swirl hover:bg-pecan">
          {busy === "reading" ? "Reading your menu…" : "Take or upload a photo"}
        </label>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {rows && rows.length > 0 && (
        <>
          <p className="font-bold text-espresso">Check these before adding. Untick anything you don&apos;t want.</p>
          <ul className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <li key={i} className="grid grid-cols-[auto_1fr] items-center gap-2 rounded-xl bg-vanilla-bean p-3 sm:grid-cols-[auto_2fr_1fr_1fr_1.4fr]">
                <input type="checkbox" aria-label={`Add ${r.name}`} className="h-5 w-5 accent-burnt-sugar" checked={r.keep} onChange={(e) => set(i, { keep: e.target.checked })} />
                <input aria-label="Name" className={inputClass} value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
                <input aria-label="Size" className={inputClass} value={r.size} onChange={(e) => set(i, { size: e.target.value })} />
                <input aria-label="Price in dollars" inputMode="decimal" className={inputClass} value={r.price} onChange={(e) => set(i, { price: e.target.value })} />
                <select aria-label="Category" className={inputClass} value={r.category} onChange={(e) => set(i, { category: e.target.value })}>
                  {COFFEE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          {skipped.length > 0 && (
            <p className="text-sm text-pecan">Left out: {skipped.map((s) => `${s.name} (${s.reason.toLowerCase()})`).join(", ")}.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy !== null || !rows.some((r) => r.keep)} onClick={addAll}>
              {busy === "adding" ? "Adding…" : `Add ${rows.filter((r) => r.keep).length} items to my menu`}
            </Button>
            <Button variant="ghost" onClick={() => { setRows(null); setSkipped([]); }}>Discard</Button>
          </div>
        </>
      )}
    </Card>
  );
}
