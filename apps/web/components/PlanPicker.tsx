"use client";
import { DEFAULT_TIER, formatCents, getTier, isTierId, type TierId } from "@sippy/core";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { PlanCards } from "./PlanCards";
import { Alert, Button, Card } from "./ui";

/** Pick a tier and sub-tier, then go to Stripe Checkout. Card details never touch the app. */
export function PlanPicker({ preselect }: { preselect?: string }) {
  const [plan, setPlan] = useState<TierId>(isTierId(preselect) ? preselect : DEFAULT_TIER);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = getTier(plan);

  async function checkout() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.checkout(plan, `${window.location.origin}/account`);
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't start checkout. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert tone="error">{error}</Alert>}
      <PlanCards mode="select" selected={plan} onSelect={setPlan} />
      <Card className="flex flex-col gap-4">
        <p className="text-espresso">
          <strong>{t.name}</strong>: {t.passesPerMonth} Daily Passes a month. Each pass covers the first{" "}
          {formatCents(t.maxPassValueCents, { showZeroCents: true })} of that day&apos;s order; anything more is an overage you confirm before paying.
          Unused passes expire at renewal.
        </p>
        <Button onClick={checkout} disabled={busy} aria-busy={busy}>
          {busy ? "Opening checkout…" : `Continue · ${formatCents(t.priceCents)}/month`}
        </Button>
      </Card>
    </div>
  );
}
