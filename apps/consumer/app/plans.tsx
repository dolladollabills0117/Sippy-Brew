import { DEFAULT_TIER, formatCents, TIERS, type TierId } from "@sippy/core";
import { api, Badge, Button, Card, colors, ErrorNote, errorMessage, Screen, spacing, Text } from "@sippy/mobile-ui";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";

/**
 * Plans. Stripe Checkout opens in an in-app browser session; card numbers are entered on
 * Stripe's page and never handled by the app.
 */
export default function PlansScreen() {
  const [busy, setBusy] = useState<TierId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(tier: TierId) {
    setBusy(tier);
    setError(null);
    try {
      const { url } = await api.checkout(tier, "sippybrew://account");
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
        Choose your plan
      </Text>
      <Text color={colors.pecan}>One Daily Pass per day at any participating shop. Passes reset monthly.</Text>
      {error && <ErrorNote message={error} />}
      {TIERS.map((t) => {
        const hl = t.id === DEFAULT_TIER;
        return (
          <Card key={t.id} accent={hl} style={{ gap: spacing.sm }}>
            {hl && <Badge label="Most popular" />}
            <Text variant="h2">{t.name}</Text>
            <Text variant="stat">
              {formatCents(t.priceCents)}
              <Text color={colors.pecan}> / month</Text>
            </Text>
            <Text>
              {t.passesPerMonth} Daily Passes · {formatCents(t.maxPassValueCents, { showZeroCents: true })} max per pass
            </Text>
            <Text variant="small" color={colors.pecan}>
              {t.blurb} Unused passes don’t roll over.
            </Text>
            <Button label="Choose this plan" variant={hl ? "primary" : "secondary"} loading={busy === t.id} disabled={busy !== null} onPress={() => choose(t.id)} />
          </Card>
        );
      })}
    </Screen>
  );
}
