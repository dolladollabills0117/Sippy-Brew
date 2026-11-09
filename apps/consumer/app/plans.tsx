import { DEFAULT_SUB_TIER, DEFAULT_TIER_GROUP, formatCents, SUB_TIERS, TIER_GROUPS, type SubTierId, type TierId } from "@sippy/core";
import { api, Badge, Button, Card, Chip, colors, ErrorNote, errorMessage, Row, Screen, spacing, Text } from "@sippy/mobile-ui";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";

/**
 * Plans: pick Decaf or Double Shot, then a tier. Stripe Checkout opens in an in-app browser
 * session; card numbers are entered on Stripe's page and never handled by the app.
 */
export default function PlansScreen() {
  const [sub, setSub] = useState<SubTierId>(DEFAULT_SUB_TIER);
  const [busy, setBusy] = useState<TierId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = SUB_TIERS.find((s) => s.id === sub)!;

  async function choose(plan: TierId) {
    setBusy(plan);
    setError(null);
    try {
      const { url } = await api.checkout(plan, "sippybrew://account");
      const result = await WebBrowser.openAuthSessionAsync(url, "sippybrew://account");
      if (result.type === "success" && result.url.includes("checkout=success")) router.replace("/account");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Text variant="h1" accessibilityRole="header">
        Choose your pass
      </Text>
      <Row accessibilityRole="radiogroup" style={{ flexWrap: "wrap" }}>
        {SUB_TIERS.map((s) => (
          <Chip key={s.id} label={`${s.name} · ${formatCents(s.maxPassValueCents)}/day`} selected={sub === s.id} onPress={() => setSub(s.id)} />
        ))}
      </Row>
      <Text color={colors.pecan}>{current.blurb} One Daily Pass per day at any participating shop. Passes reset monthly.</Text>
      {error && <ErrorNote message={error} />}
      {TIER_GROUPS.map((g) => {
        const plan = g.plans[sub];
        const hl = g.id === DEFAULT_TIER_GROUP;
        return (
          <Card key={g.id} accent={hl} style={{ gap: spacing.sm }}>
            {hl && <Badge label="Most popular" />}
            <Text variant="h2">{g.name}</Text>
            <Text variant="stat">
              {formatCents(plan.priceCents)}
              <Text color={colors.pecan}> / month</Text>
            </Text>
            <Text>
              {plan.passesPerMonth} Daily Passes · {formatCents(plan.maxPassValueCents, { showZeroCents: true })} max per pass
            </Text>
            <Text variant="small" color={colors.pecan}>
              {plan.blurb} Unused passes don’t roll over.
            </Text>
            <Button label={`Choose ${plan.name}`} variant={hl ? "primary" : "secondary"} loading={busy === plan.id} disabled={busy !== null} onPress={() => choose(plan.id)} />
          </Card>
        );
      })}
    </Screen>
  );
}
