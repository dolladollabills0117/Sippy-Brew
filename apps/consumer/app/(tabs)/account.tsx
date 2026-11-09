import { formatCents, getTier, RULES } from "@sippy/core";
import { api, API_URL, Badge, Button, Card, colors, ErrorNote, errorMessage, Loading, Meter, Row, Screen, spacing, supabase, Text, UpgradeCard, useLoad } from "@sippy/mobile-ui";
import * as Location from "expo-location";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { RefreshControl, View } from "react-native";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: RULES.timeZone });

export default function AccountTab() {
  const me = useLoad(() => api.me(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function manage() {
    setBusy("portal");
    try {
      // Stripe's billing portal runs in the system browser; no card data touches the app.
      const { url } = await api.billingPortal("sippybrew://account");
      await WebBrowser.openAuthSessionAsync(url, "sippybrew://account");
      me.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function saveArea(kind: "home" | "work") {
    setBusy(kind);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Location permission is needed to save an area.");
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const others = (me.data?.areas ?? []).filter((a) => a.kind !== kind);
      await api.setAreas([...others, { kind, label: kind === "home" ? "Home" : "Work", lat: pos.coords.latitude, lng: pos.coords.longitude, radiusMiles: RULES.defaultRadiusMiles }]);
      me.reload();
    } catch (e) {
      setError(e instanceof Error && !("status" in e) ? e.message : errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (me.loading) return <Screen><Loading /></Screen>;
  if (!me.data) return <Screen><ErrorNote message={me.error ?? "Couldn't load your account."} onRetry={me.refresh} /></Screen>;
  const s = me.data;
  const sub = s.subscription;
  const tier = sub ? getTier(sub.tier) : null;

  return (
    <Screen refreshControl={<RefreshControl refreshing={me.refreshing} onRefresh={me.refresh} tintColor={colors.burntSugar} />}>
      <Text variant="display" accessibilityRole="header">
        Account
      </Text>
      <Text color={colors.pecan}>{s.profile.email}</Text>

      <Card style={{ gap: spacing.sm }}>
        <Text variant="small" color={colors.pecan}>
          Plan
        </Text>
        {sub && tier ? (
          <>
            <Row style={{ flexWrap: "wrap" }}>
              <Text variant="h2">{tier.name}</Text>
              {sub.status !== "active" && <Badge label={sub.status.replace("_", " ")} tone="danger" />}
              {sub.cancelAtPeriodEnd && <Badge label={`Ends ${dateFmt.format(new Date(sub.currentPeriodEnd))}`} tone="latte" />}
            </Row>
            <Text color={colors.pecan}>
              {formatCents(tier.priceCents)}/month · {tier.passesPerMonth} passes, {formatCents(tier.maxPassValueCents, { showZeroCents: true })} max per pass · renews{" "}
              {dateFmt.format(new Date(sub.currentPeriodEnd))}
            </Text>
            {sub.pendingTier && (
              <Text variant="bodyBold">
                Switching to {getTier(sub.pendingTier).name} on {dateFmt.format(new Date(sub.currentPeriodEnd))}.
              </Text>
            )}
            <Text variant="small" color={colors.pecan}>
              Change your pass any time. Changes start with your next month.
            </Text>
            <Button label="Change plan" variant="secondary" onPress={() => router.push("/plans?change=1")} />
            <Button label="Billing and cancellation" variant="ghost" onPress={manage} loading={busy === "portal"} />
          </>
        ) : (
          <>
            <Text>No plan yet.</Text>
            <Button label="Choose a plan" onPress={() => router.push("/plans")} />
          </>
        )}
      </Card>

      {s.upgrade && <UpgradeCard upgrade={s.upgrade} passesLeft={s.passesLeft} nudge={s.upgrade.suggested} onDone={me.reload} />}

      {sub && (
        <Card style={{ gap: spacing.sm }}>
          <Text variant="small" color={colors.pecan}>
            Daily Passes this month
          </Text>
          <Text variant="stat">
            {s.passesLeft}
            <Text variant="body" color={colors.pecan}>
              {" "}
              of {s.passesPerMonth} left
            </Text>
          </Text>
          <Meter value={s.passesLeft} max={s.passesPerMonth} label="Daily Passes remaining" />
          <Badge label={s.passUsedToday ? "Today's pass used" : s.passesLeft > 0 ? "Today's pass ready" : "No passes left"} tone={s.passUsedToday || s.passesLeft === 0 ? "latte" : "sky"} />
          <Text variant="small" color={colors.pecan}>
            Unused passes expire at renewal. Your pass covers the first {formatCents(s.maxPassValueCents, { showZeroCents: true })} of each day’s order. If it’s more, you’ll confirm the overage before paying.
          </Text>
        </Card>
      )}

      <Card style={{ gap: spacing.sm }}>
        <Text variant="h2">Saved areas</Text>
        <Text variant="small" color={colors.pecan}>
          Used for the “Near home” and “Near work” filters. Stand at the spot and tap below.
        </Text>
        {(["home", "work"] as const).map((k) => {
          const a = s.areas.find((x) => x.kind === k);
          return (
            <View key={k} style={{ gap: 6 }}>
              <Text variant="bodyBold">{k === "home" ? "Home" : "Work"}: {a ? `saved (${a.radiusMiles} mi radius)` : "not set"}</Text>
              <Button variant="secondary" label={`Use my location as ${k}`} onPress={() => saveArea(k)} loading={busy === k} />
            </View>
          );
        })}
      </Card>

      {error && <ErrorNote message={error} />}
      <Button
        variant="ghost"
        label="Order history and receipts on the web"
        onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/account`)}
      />
      <Button variant="danger" label="Sign out" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}
