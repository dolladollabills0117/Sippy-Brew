import { formatCents, type MemberSummary } from "@sippy/core";
import { useState } from "react";
import { Button, Card, ErrorNote, Text } from "./components";
import { errorMessage } from "./hooks";
import { api } from "./session";
import { colors, spacing } from "./theme";

type Upgrade = NonNullable<MemberSummary["upgrade"]>;

/**
 * Move up to the higher sub-tier. A nudge when the member keeps paying overages, an option
 * otherwise. First tap shows exactly what they'll pay; second tap confirms.
 */
export function UpgradeCard({ upgrade, passesLeft, nudge, onDone }: { upgrade: Upgrade; passesLeft: number; nudge?: boolean; onDone?: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const money = (c: number) => formatCents(c, { showZeroCents: true });

  async function upgradeNow() {
    setBusy(true);
    setError(null);
    try {
      await api.upgradePlan(upgrade.toPlan, upgrade.upgradeNowCents);
      onDone?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ gap: spacing.sm, borderWidth: nudge ? 2 : 1, borderColor: nudge ? colors.honey : colors.latte }}>
      <Text variant="bodyBold">
        {nudge ? `You've paid ${money(upgrade.overagePaidCents)} in overages this month` : `Move up to ${upgrade.toName}`}
      </Text>
      <Text variant="small" color={colors.pecan}>
        {nudge
          ? `${upgrade.overageOrders} of your orders went over your pass. On ${upgrade.toName}, each pass covers up to ${money(upgrade.toMaxPassValueCents)}.`
          : `Each pass covers up to ${money(upgrade.toMaxPassValueCents)}, so lattes and specialty drinks are covered.`}
      </Text>
      <Text variant="small">
        Pay the difference for your {passesLeft} remaining {passesLeft === 1 ? "pass" : "passes"}: {money(upgrade.upgradeNowCents)} now. From your next renewal it’s{" "}
        {formatCents(upgrade.newMonthlyPriceCents)}/month.
      </Text>
      {error && <ErrorNote message={error} />}
      {confirming ? (
        <>
          <Button label={`Confirm and pay ${money(upgrade.upgradeNowCents)}`} onPress={upgradeNow} loading={busy} />
          <Button label="Not now" variant="ghost" onPress={() => setConfirming(false)} disabled={busy} />
        </>
      ) : (
        <Button label={`Upgrade to ${upgrade.toName}`} variant={nudge ? "primary" : "secondary"} onPress={() => setConfirming(true)} />
      )}
    </Card>
  );
}
