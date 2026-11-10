import { canFlagNoShow, describeOptions, formatCents, nextStatus, ORDER_STATUS_LABELS, prepUrgency, RULES, startMakingAt, type Order } from "@sippy/core";
import { api, Badge, Button, Card, colors, EmptyState, ErrorNote, errorMessage, Loading, Row, Screen, spacing, Text, useLoad } from "@sippy/mobile-ui";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Alert, Animated, Easing, RefreshControl, View } from "react-native";

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: RULES.timeZone });

/**
 * Live pickup queue. Polls every 8 seconds; one big button per order moves it along. Each order
 * shows when to start it (just before pickup), a red ALLERGY NOTICE when the member listed one,
 * and "Not picked up" once the pickup time is 30 minutes past.
 */
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

  function noShow(o: Order) {
    Alert.alert(
      `Mark ${o.memberFirstName}'s order as not picked up?`,
      "It isn't refunded: their pass stays used and you're paid for it. We'll let them and Sippy Brew know.",
      [
        { text: "Not yet", style: "cancel" },
        {
          text: "Not picked up",
          style: "destructive",
          onPress: async () => {
            setBusy(o.id);
            setError(null);
            try {
              await api.flagNoShow(o.id);
              q.reload();
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={colors.burntSugar} />}>
      <Text variant="display" accessibilityRole="header">
        Orders
      </Text>
      {error && <ErrorNote message={error} />}
      <Text variant="small" color={colors.espresso}>
        Make Sippy Brew orders close to pickup: each one shows when to start ({RULES.prepLeadMinutes} minutes before), so drinks are fresh and fewer are wasted on
        no-shows.
      </Text>
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
              <Card key={o.id} accent={o.status === "ready"} style={[{ gap: spacing.sm }, o.allergyNote ? { borderWidth: 4, borderColor: colors.danger } : null]}>
                {o.allergyNote && (
                  <View accessibilityRole="alert" style={{ backgroundColor: colors.danger, borderRadius: 12, padding: spacing.md }}>
                    <Text variant="h2" color={colors.creamSwirl}>
                      ⚠️ ALLERGY NOTICE
                    </Text>
                    <Text variant="bodyBold" color={colors.creamSwirl} style={{ fontSize: 20, lineHeight: 26 }}>
                      {o.allergyNote}
                    </Text>
                  </View>
                )}
                <Row style={{ justifyContent: "space-between" }}>
                  <Text variant="h1" style={{ flex: 1 }}>
                    {o.memberFirstName}
                  </Text>
                  <Badge label={ORDER_STATUS_LABELS[o.status]} tone={o.status === "ready" ? "sky" : "latte"} />
                </Row>
                <Text variant="bodyBold" color={colors.pecan}>
                  Pickup {timeFmt.format(new Date(o.pickupTime))}
                </Text>
                <StartAt order={o} />
                {o.note ? (
                  <Text style={{ backgroundColor: colors.vanillaBean, borderRadius: 10, padding: spacing.sm }}>
                    <Text variant="bodyBold">Note: </Text>
                    {o.note}
                  </Text>
                ) : null}
                {o.items.map((i) => (
                  <View key={i.id}>
                    <Text style={{ fontSize: 20, lineHeight: 26 }}>
                      {i.quantity}× {i.name} ({i.size})
                    </Text>
                    {i.options.length > 0 && (
                      <Text variant="bodyBold" color={colors.burntSugarInk}>
                        {describeOptions(i.options)}
                      </Text>
                    )}
                  </View>
                ))}
                <Text variant="small" color={colors.pecan}>
                  {formatCents(o.totalCents, { showZeroCents: true })} · Daily Pass
                  {o.overageCents > 0 ? ` + ${formatCents(o.overageCents, { showZeroCents: true })} overage (paid in app, 100% yours)` : ""}
                </Text>
                {next && next !== "picked_up" && (
                  <Button
                    big
                    label={`Mark ${ORDER_STATUS_LABELS[next].toLowerCase()}`}
                    loading={busy === o.id}
                    onPress={() =>
                      next === "preparing" && o.allergyNote
                        ? Alert.alert(`ALLERGY NOTICE: ${o.allergyNote}`, "Once you mark this order as preparing it can't be cancelled. Can you make it safely?", [
                            { text: "Not yet", style: "cancel" },
                            { text: "Yes, start it", onPress: () => move(o, next) },
                          ])
                        : move(o, next)
                    }
                  />
                )}
                {o.status === "ready" && <Button big label="Scan to hand off" onPress={() => router.push("/scan")} />}
                {canFlagNoShow({ status: o.status, pickupAt: o.pickupTime }, new Date()).ok && (
                  <Button variant="secondary" label="Not picked up" onPress={() => noShow(o)} disabled={busy === o.id} />
                )}
                {o.status === "received" && <Button variant="ghost" label="Cancel order" onPress={() => cancel(o)} disabled={busy === o.id} />}
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

/**
 * "Start at" for orders not started yet. It glows and slowly "breathes" as the start time gets
 * close, then says "Start now" with a stronger, faster pulse so the barista notices it.
 */
function StartAt({ order }: { order: Order }) {
  const urgency = order.status === "received" ? prepUrgency(order.pickupTime, new Date()) : "later";
  const glow = useRef(new Animated.Value(0)).current;
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
  }, []);
  useEffect(() => {
    if (urgency === "later" || reduce) return;
    const ms = urgency === "soon" ? 1400 : 800;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [urgency, reduce, glow]);

  const label = urgency === "now" ? "Start now" : urgency === "late" ? "Due now: start it" : `Start at ${timeFmt.format(startMakingAt(order.pickupTime))}`;
  if (urgency === "later") {
    return (
      <Text variant="bodyBold" color={colors.burntSugarInk}>
        {label}
      </Text>
    );
  }
  const strong = urgency !== "soon";
  return (
    <View accessibilityLiveRegion="polite" style={{ alignSelf: "flex-start" }}>
      <Animated.View
        style={{
          position: "absolute",
          top: -6,
          bottom: -6,
          left: -8,
          right: -8,
          borderRadius: 999,
          backgroundColor: colors.honey,
          opacity: reduce ? 0.6 : glow.interpolate({ inputRange: [0, 1], outputRange: [0.15, strong ? 0.95 : 0.7] }),
          transform: [{ scale: reduce ? 1 : glow.interpolate({ inputRange: [0, 1], outputRange: [1, strong ? 1.12 : 1.06] }) }],
        }}
      />
      <View style={{ backgroundColor: colors.honey, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
        <Text variant="bodyBold" style={{ fontSize: 18 }}>
          ● {label}
        </Text>
      </View>
    </View>
  );
}
