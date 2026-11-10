import { formatCents, getTier, RULES, SITE } from "@sippy/core";
import { api, API_URL, Badge, Button, Card, colors, ErrorNote, errorMessage, Loading, Meter, Row, Screen, spacing, supabase, Text, UpgradeCard, useLoad } from "@sippy/mobile-ui";
import * as Location from "expo-location";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Linking, RefreshControl, Share, View } from "react-native";

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

      {s.rewards && sub && (
        <>
          <Card style={{ gap: spacing.sm }}>
            <Text variant="h2">Neighborhood Passport</Text>
            <Text>
              {s.rewards.passport.passportEarned
                ? `You've visited ${s.rewards.passport.goal} local shops and earned a free day pass. Keep exploring!`
                : `Pick up at ${s.rewards.passport.goal} different shops and get a free day pass.`}
            </Text>
            <Meter value={Math.min(s.rewards.passport.visited, s.rewards.passport.goal)} max={s.rewards.passport.goal} label="Shops visited" />
            <Text variant="small" color={colors.pecan}>
              {Math.min(s.rewards.passport.visited, s.rewards.passport.goal)} of {s.rewards.passport.goal} shops ·{" "}
              {s.rewards.passport.grandTour.earned
                ? `Grand Tour done: ${RULES.grandTourFreeMonths} months free!`
                : s.rewards.passport.grandTour.unlocked
                  ? `Grand Tour: visit every shop for ${RULES.grandTourFreeMonths} months free (${s.rewards.passport.grandTour.visitedCounting} of ${s.rewards.passport.grandTour.countingShops}).`
                  : `Grand Tour (${RULES.grandTourFreeMonths} months free) unlocks once more than ${s.rewards.passport.grandTour.minShops - 1} shops join.`}
            </Text>
          </Card>
          <Card style={{ gap: spacing.sm }}>
            <Text variant="h2">
              Bring {RULES.referralFriendsNeeded} friends, get {s.rewards.referral.passesPerReward} passes
            </Text>
            <Text>
              When {RULES.referralFriendsNeeded} friends join with your link and start their pass, you get {s.rewards.referral.passesPerReward} bonus passes. They roll over
              for a year.
            </Text>
            <Text variant="small" color={colors.pecan}>
              {RULES.referralFriendsNeeded - s.rewards.referral.friendsToNext} of {RULES.referralFriendsNeeded} friends joined
              {s.rewards.referral.code ? ` · Your code: ${s.rewards.referral.code}` : ""}
            </Text>
            {s.rewards.referral.link && (
              <Button
                label="Share my link"
                variant="secondary"
                onPress={() => Share.share({ message: `I get my coffee at local shops with Sippy Brew. Join with my link: ${s.rewards!.referral.link}` })}
              />
            )}
          </Card>
        </>
      )}

      <Card style={{ gap: spacing.sm }}>
        <Text variant="h2">Questions?</Text>
        <Text color={colors.pecan}>About an order? The shop that made it can fix it fastest. For your pass or billing, email us.</Text>
        <Button label={`Email ${SITE.supportEmail}`} variant="secondary" onPress={() => Linking.openURL(`mailto:${SITE.supportEmail}`)} />
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
          {s.bonusPassesLeft > 0 && (
            <Text variant="bodyBold">
              + {s.bonusPassesLeft} bonus pass{s.bonusPassesLeft === 1 ? "" : "es"}
              {s.bonusExpiresAt ? <Text color={colors.pecan}> · roll over until {dateFmt.format(new Date(s.bonusExpiresAt))}</Text> : null}
            </Text>
          )}
          <Badge
            label={s.passUsedToday ? "Today's pass used" : s.passesLeft + s.bonusPassesLeft > 0 ? "Today's pass ready" : "No passes left"}
            tone={s.passUsedToday || s.passesLeft + s.bonusPassesLeft === 0 ? "latte" : "sky"}
          />
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
