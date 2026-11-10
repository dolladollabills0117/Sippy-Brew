"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Alert, Button } from "./ui";

/** One appeal for a shop removed for selling food, if it was a genuine error. */
export function AppealForm() {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.appealRemoval(note);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send your appeal. Try again.");
      setBusy(false);
    }
  }
  return (
    <form onSubmit={send} className="mt-3 flex flex-col gap-2">
      <label htmlFor="appeal" className="font-bold text-espresso">
        Appeal: tell us what happened
      </label>
      <textarea
        id="appeal"
        rows={4}
        maxLength={1000}
        required
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. We listed 'Dragonfruit' as a drink add-on but meant the dragonfruit topping for our refresher. We've renamed it."
        className="rounded-[12px] border-2 border-pecan/70 bg-cream-swirl p-3 text-espresso"
      />
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" disabled={busy || note.trim().length < 20} className="self-start">
        {busy ? "Sending…" : "Send appeal"}
      </Button>
    </form>
  );
}
