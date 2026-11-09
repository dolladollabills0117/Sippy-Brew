"use client";
import { getTier, RULES, type TierId } from "@sippy/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { PlanCards } from "./PlanCards";
import { Alert, Button } from "./ui";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: RULES.timeZone });

/**
 * Switch to any plan, any time. The switch starts with the member's next month; this month's
 * passes and daily max stay as they are. A pending switch can be undone until then.
 */
export function ChangePlanCard({ current, pending, periodEnd }: { current: TierId; pending: TierId | null; periodEnd: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<TierId>(pending ?? current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const when = dateFmt.format(new Date(periodEnd));

  async function save(to: TierId) {
    setBusy(true);
    setError(null);
    try {
      await api.changePlan(to);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't change your plan. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {pending && (
        <Alert tone="info">
          Switching to <b>{getTier(pending).name}</b> on {when}.{" "}
          <button type="button" disabled={busy} onClick={() => save(current)} className="font-bold underline underline-offset-4">
            Keep my current plan
          </button>
        </Alert>
      )}
      <p className="text-sm text-pecan">Change your pass any time. Changes start with your next month, on {when}.</p>
      {open ? (
        <>
          <PlanCards mode="select" selected={pick} onSelect={setPick} />
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || pick === (pending ?? current)} onClick={() => save(pick)}>
              {pick === current ? "Keep my current plan" : `Switch to ${getTier(pick).name} on ${when}`}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
          <p className="text-sm text-pecan">No charge today. Your new price starts with your next month.</p>
        </>
      ) : (
        <Button variant="secondary" className="self-start" onClick={() => setOpen(true)}>
          Change plan
        </Button>
      )}
      {error && <p role="alert" className="text-sm font-bold text-danger">{error}</p>}
    </div>
  );
}
