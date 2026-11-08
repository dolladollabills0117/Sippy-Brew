import { formatCents, nextStatus, ORDER_STATUS_LABELS, RULES, type Order } from "@sippy/core";
import { api, Badge, Button, Card, colors, EmptyState, ErrorNote, errorMessage, Loading, Row, Screen, spacing, Text, useLoad } from "@sippy/mobile-ui";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, RefreshControl, View } from "react-native";

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: RULES.timeZone });

/** Live pickup queue. Polls every 8 seconds; one big button per order moves it along. */
export default function OrdersScreen() {
  const q = useLoad(() => api.shopOrders("active"), [], 8000);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const orders = q.data?.orders ?? [];

  // Buzz when a new order arrives.
  useEffect(() => {
    const ids = orders.map((o) => o.id);
    if (seen.current.size && ids.some((id) => !seen.current.has(id))) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    seen.current = new Set(ids);
  }, [orders]);

  async function move(o: Order, to: Order["status"]) {
    setBusy(o.id);
    setError(null);
    try {
      await api.setOrderStatus(o.id, to);
      q.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  function cancel(o: Order) {
    Alert.alert(`Cancel ${o.memberFirstName}'s order?`, "Their Daily Pass will be returned and any overage hold released.", [
      { text: "Keep order", style: "cancel" },
      { text: "Cancel order", style: "destructive", onPress: () => move(o, "cancelled") },
    ]);
  }

  return (
    <Screen refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.burntSugar} />}>
      <Text variant="display" accessibilityRole="header">
        Orders
      </Text>
      {error && <ErrorNote message={error} />}
      {q.loading ? (
        <Loading label="Loading orders" />
      ) : q.error && !q.data ? (
        <ErrorNote message={q.error} onRetry={q.refresh} />
      ) : orders.length === 0 ? (
        <EmptyState title="No orders right now" body="New pickup orders appear here automatically." />
      ) : (
        <View style={{ gap: spacing.md }} accessibilityLiveRegion="polite">
          {orders.map((o) => {
            const next = nextStatus(o.status);
            return (
              <Card key={o.id} accent={o.status === "ready"} style={{ gap: spacing.sm }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Text variant="h1" style={{ flex: 1 }}>
                    {o.memberFirstName}
                  </Text>
                  <Badge label={ORDER_STATUS_LABELS[o.status]} tone={o.status === "ready" ? "sky" : "latte"} />
                </Row>
                <Text variant="bodyBold" color={colors.pecan}>
                  Pickup {timeFmt.format(new Date(o.pickupTime))}
                </Text>
                {o.items.map((i) => (
                  <Text key={i.id} style={{ fontSize: 20, lineHeight: 26 }}>
                    {i.quantity}× {i.name} ({i.size})
                  </Text>
                ))}
                <Text variant="small" color={colors.pecan}>
                  {formatCents(o.totalCents, { showZeroCents: true })} · Daily Pass
                  {o.overageCents > 0 ? ` + ${formatCents(o.overageCents, { showZeroCents: true })} overage (paid in app, 100% yours)` : ""}
                </Text>
                {next && next !== "picked_up" && (
                  <Button big label={`Mark ${ORDER_STATUS_LABELS[next].toLowerCase()}`} loading={busy === o.id} onPress={() => move(o, next)} />
                )}
                {o.status === "ready" && <Button big label="Scan to hand off" onPress={() => router.push("/scan")} />}
                <Button variant="ghost" label="Cancel order" onPress={() => cancel(o)} disabled={busy === o.id} />
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
