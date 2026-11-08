"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "./ui";

/** Change or cancel through Stripe's customer portal. Changes take effect at renewal. */
export function ManagePlanButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            window.location.assign((await api.billingPortal(window.location.href)).url);
          } catch {
            setError("Couldn't open billing. Try again.");
            setBusy(false);
          }
        }}
      >
        Change or cancel plan
      </Button>
      {error && <p role="alert" className="text-sm font-bold text-danger">{error}</p>}
    </div>
  );
}
