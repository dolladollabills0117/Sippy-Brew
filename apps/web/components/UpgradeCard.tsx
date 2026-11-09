"use client";
import { formatCents, type MemberSummary } from "@sippy/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Card } from "./ui";

type Upgrade = NonNullable<MemberSummary["upgrade"]>;

/**
 * Move up to the higher sub-tier (e.g. Affogato · Decaf → Affogato · Double Shot). Shown as a
 * nudge when the member keeps paying overages, and as an option on the account page. Two taps:
 * the first shows exactly what they'll pay, the second confirms it.
 */
export function UpgradeCard({ upgrade, passesLeft, nudge }: { upgrade: Upgrade; passesLeft: number; nudge?: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const money = (c: number) => formatCents(c, { showZeroCents: true });

  async function upgradeNow() {
    setBusy(true);
    setError(null);
    try {
      await api.upgradePlan(upgrade.toPlan, upgrade.upgradeNowCents);
      setDone(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't upgrade. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <Alert tone="success">You&apos;re on {upgrade.toName}. Your passes now cover up to {money(upgrade.toMaxPassValueCents)}.</Alert>;

  return (
    <Card className={nudge ? "flex flex-col gap-3 border-2 border-honey" : "flex flex-col gap-3"}>
      <div id="upgrade">
        {nudge ? (
          <>
            <p className="text-lg font-extrabold text-espresso">You&apos;ve paid {money(upgrade.overagePaidCents)} in overages this month</p>
            <p className="mt-1 text-pecan">
              {upgrade.overageOrders} of your orders went over your pass. On <strong>{upgrade.toName}</strong>, each pass covers up to{" "}
              {money(upgrade.toMaxPassValueCents)}.
            </p>
          </>
        ) : (
          <>
            <p className="text-lg font-extrabold text-espresso">Move up to {upgrade.toName}</p>
            <p className="mt-1 text-pecan">Each pass covers up to {money(upgrade.toMaxPassValueCents)}, so lattes and specialty drinks are covered.</p>
          </>
        )}
      </div>
      <p className="text-sm text-espresso">
        Pay the monthly difference, <strong>{money(upgrade.upgradeNowCents)}</strong>, now. Your {passesLeft} remaining {passesLeft === 1 ? "pass covers" : "passes cover"} up to{" "}
        {money(upgrade.toMaxPassValueCents)} right away, and from your next renewal it&apos;s {formatCents(upgrade.newMonthlyPriceCents)}/month.
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      {confirming ? (
        <div className="flex flex-col gap-2">
          <Button onClick={upgradeNow} disabled={busy} aria-busy={busy}>
            {busy ? "Upgrading…" : `Confirm and pay ${money(upgrade.upgradeNowCents)}`}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
            Not now
          </Button>
        </div>
      ) : (
        <Button variant={nudge ? "honey" : "secondary"} onClick={() => setConfirming(true)}>
          Upgrade to {upgrade.toName}
        </Button>
      )}
    </Card>
  );
}
