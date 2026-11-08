"use client";
import type { TierId } from "@sippy/core";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { TierCards } from "./TierCards";
import { Alert, Button } from "./ui";

/** Sends the member to Stripe Checkout. Card details never touch Sippy Brew. */
export function PlanPicker({ preselect }: { preselect?: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(tier: string) {
    setBusy(tier);
    setError(null);
    try {
      const { url } = await api.checkout(tier as TierId, `${window.location.origin}/account`);
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't start checkout. Please try again.");
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="error">{error}</Alert>}
      <TierCards
        action={(id, hl) => (
          <Button
            className="w-full"
            variant={hl || preselect === id ? "primary" : "secondary"}
            disabled={busy !== null}
            aria-busy={busy === id}
            onClick={() => choose(id)}
          >
            {busy === id ? "Opening checkout…" : "Choose this plan"}
          </Button>
        )}
      />
    </div>
  );
}
