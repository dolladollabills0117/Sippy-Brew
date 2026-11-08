import { formatCents, ORDER_STATUS_LABELS, RULES, type Order } from "@sippy/core";
import { api, Badge, Button, Card, colors, EmptyState, ErrorNote, Loading, Row, Screen, spacing, Text, useLoad } from "@sippy/mobile-ui";
import { router } from "expo-router";
import { Pressable, RefreshControl, View } from "react-native";

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: RULES.timeZone });
const OPEN = ["received", "preparing", "ready"];

function OrderRow({ o }: { o: Order }) {
  const open = OPEN.includes(o.status);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${o.shopName}, ${ORDER_STATUS_LABELS[o.status]}${open ? ", show pickup code" : ""}`} onPress={() => router.push(`/order/${o.id}`)}>
      <Card accent={o.status === "ready"} style={{ gap: 4 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Text variant="bodyBold" style={{ flex: 1 }}>
            {o.shopName}
          </Text>
          <Badge label={ORDER_STATUS_LABELS[o.status]} tone={o.status === "ready" ? "sky" : o.status === "cancelled" ? "danger" : "latte"} />
        </Row>
        <Text variant="small" color={colors.pecan}>
          {dateFmt.format(new Date(o.createdAt))} · {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
        </Text>
        <Text variant="small">
          Daily Pass{o.upgradeCents > 0 ? ` + ${formatCents(o.upgradeCents, { showZeroCents: true })} upgrade` : ""}
        </Text>
        {open && (
          <Text variant="bodyBold" color={colors.burntSugarInk}>
            Show pickup QR →
          </Text>
        )}
      </Card>
    </Pressable>
  );
}

/** The "Order" tab: anything waiting for pickup, then history. */
export default function OrdersTab() {
  const orders = useLoad(() => api.myOrders(), [], 15000);
  const list = orders.data?.orders ?? [];
  const open = list.filter((o) => OPEN.includes(o.status));
  const past = list.filter((o) => !OPEN.includes(o.status));

  return (
    <Screen refreshControl={<RefreshControl refreshing={orders.refreshing} onRefresh={orders.refresh} tintColor={colors.burntSugar} />}>
      <Text variant="display" accessibilityRole="header">
        Order
      </Text>
      <Button label="Find a shop and order" onPress={() => router.push("/")} />
      {orders.loading ? (
        <Loading label="Loading orders" />
      ) : orders.error ? (
        <ErrorNote message={orders.error} onRetry={orders.refresh} />
      ) : (
        <>
          <Text variant="h2" accessibilityRole="header">
            Waiting for pickup
          </Text>
          {open.length === 0 ? <EmptyState title="Nothing waiting" body="Order from any shop and your pickup QR shows up here." /> : <View style={{ gap: spacing.md }}>{open.map((o) => <OrderRow key={o.id} o={o} />)}</View>}
          <Text variant="h2" accessibilityRole="header">
            History
          </Text>
          {past.length === 0 ? <EmptyState title="No orders yet" /> : <View style={{ gap: spacing.md }}>{past.map((o) => <OrderRow key={o.id} o={o} />)}</View>}
        </>
      )}
    </Screen>
  );
}
