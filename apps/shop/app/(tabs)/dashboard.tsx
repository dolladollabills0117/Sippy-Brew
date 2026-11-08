import { formatCents, formatHour } from "@sippy/core";
import { api, Badge, Button, Card, colors, ErrorNote, Loading, Row, Screen, spacing, supabase, Text, useLoad } from "@sippy/mobile-ui";
import { RefreshControl, View } from "react-native";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card style={{ flexBasis: "47%", flexGrow: 1, gap: 2 }}>
      <Text variant="small" color={colors.pecan}>
        {label}
      </Text>
      <Text variant="stat">{value}</Text>
      {sub && (
        <Text variant="small" color={colors.pecan}>
          {sub}
        </Text>
      )}
    </Card>
  );
}

export default function DashboardScreen() {
  const d = useLoad(() => api.shopStats(), [], 60000);
  if (d.loading) return <Screen><Loading /></Screen>;
  if (!d.data) return <Screen><ErrorNote message={d.error ?? "Couldn't load your dashboard."} onRetry={d.refresh} /></Screen>;
  const { stats, shop } = d.data;
  const money = (c: number) => formatCents(c, { showZeroCents: true });

  return (
    <Screen refreshControl={<RefreshControl refreshing={d.refreshing} onRefresh={d.refresh} tintColor={colors.burntSugar} />}>
      <Text variant="small" color={colors.pecan}>
        {shop.name}
      </Text>
      <Text variant="display" accessibilityRole="header">
        Today
      </Text>
      {shop.status !== "active" && <Badge label={shop.status === "pending" ? "Waiting for approval" : "Paused"} tone="danger" />}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
        <Stat label="Redemptions today" value={String(stats.redemptions.today)} sub={money(stats.grossCents.today)} />
        <Stat label="This week" value={String(stats.redemptions.week)} sub={money(stats.grossCents.week)} />
        <Stat label="This month" value={String(stats.redemptions.month)} sub={money(stats.grossCents.month)} />
        <Stat label="Est. payout this week" value={money(stats.estimatedWeeklyPayoutCents)} />
      </View>

      <Card style={{ gap: spacing.sm }}>
        <Text variant="h2">Top items</Text>
        {stats.topItems.length === 0 ? (
          <Text color={colors.pecan}>No redemptions this month yet.</Text>
        ) : (
          stats.topItems.map((i, n) => (
            <Row key={i.name} style={{ justifyContent: "space-between" }}>
              <Text>
                {n + 1}. {i.name}
              </Text>
              <Text variant="bodyBold">{i.quantity}</Text>
            </Row>
          ))
        )}
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Text variant="h2">Busiest hours</Text>
        {stats.busiestHours.length === 0 ? (
          <Text color={colors.pecan}>Not enough data yet.</Text>
        ) : (
          stats.busiestHours.slice(0, 4).map((h) => (
            <Row key={h.hour} style={{ justifyContent: "space-between" }}>
              <Text>{formatHour(h.hour)}</Text>
              <Text variant="bodyBold">{h.count}</Text>
            </Row>
          ))
        )}
      </Card>

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Stat label="New members" value={String(stats.members.new)} sub="this month" />
        <Stat label="Returning" value={String(stats.members.returning)} sub="this month" />
      </View>

      <Text variant="small" color={colors.pecan}>
        Payout history, onboarding, posts and full reports are on the web portal.
      </Text>
      <Button variant="danger" label="Sign out" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}
