import {
  CATEGORY_LABELS,
  checkPassAvailable,
  COFFEE_CATEGORIES,
  formatCents,
  MAX_QUANTITY_PER_LINE,
  pickupSlots,
  RULES,
  splitPassValue,
} from "@sippy/core";
import { api, Badge, Button, Card, colors, EmptyState, ErrorNote, errorMessage, Loading, Row, Screen, spacing, Text, useLoad } from "@sippy/mobile-ui";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: RULES.timeZone });

function Stepper({ name, value, onChange }: { name: string; value: number; onChange: (n: number) => void }) {
  const btn = (label: string, delta: number, disabled: boolean, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      disabled={disabled}
      onPress={() => {
        void Haptics.selectionAsync();
        onChange(value + delta);
      }}
      style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: colors.pecan, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 }}
    >
      <Text variant="button">{label}</Text>
    </Pressable>
  );
  return (
    <Row accessibilityLabel={`Quantity of ${name}`}>
      {btn("−", -1, value === 0, `Remove one ${name}`)}
      <Text variant="bodyBold" style={{ minWidth: 24, textAlign: "center" }} accessibilityLiveRegion="polite">
        {value}
      </Text>
      {btn("+", 1, value >= MAX_QUANTITY_PER_LINE, `Add one ${name}`)}
    </Row>
  );
}

/** Shop page + order flow: menu, today's pass and any upgrade, pickup time, confirm. */
export default function ShopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useLoad(() => api.getShop(id), [id]);
  const me = useLoad(() => api.me(), []);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [slot, setSlot] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean | null>(null);

  const shop = detail.data?.shop;
  const slots = useMemo(() => (shop ? pickupSlots(new Date(), shop.hours) : []), [shop]);

  if (detail.loading || me.loading) return <Screen><Loading /></Screen>;
  if (detail.error || !detail.data || !shop) return <Screen><ErrorNote message={detail.error ?? "Shop not found."} onRetry={detail.refresh} /></Screen>;

  const summary = me.data;
  const menu = detail.data.menu;
  const available = menu.filter((m) => m.available && !m.soldOutToday);
  const total = available.reduce((s, m) => s + (qty[m.id] ?? 0) * m.priceCents, 0);
  const pass = summary ? checkPassAvailable({ passesLeft: summary.passesLeft, passDaysUsed: summary.passDaysUsed, now: new Date() }) : null;
  const split = splitPassValue(total, summary?.maxPassValueCents ?? 0);
  const blocker = pass && !pass.ok ? pass.message : null;
  const hasPlan = summary?.subscription && ["active", "trialing"].includes(summary.subscription.status);
  const isSaved = saved ?? detail.data.saved;

  async function place() {
    setBusy(true);
    setError(null);
    try {
      const items = Object.entries(qty).filter(([, n]) => n > 0).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
      const { order } = await api.placeOrder({ shopId: id, items, pickupAt: slots[slot]!.toISOString() });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/order/${order.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: shop.name }} />
      <View style={{ gap: spacing.sm }}>
        <Text variant="h1" accessibilityRole="header">
          {shop.name}
        </Text>
        <Text variant="small" color={colors.pecan}>
          {shop.address}
        </Text>
        <Text>{shop.story}</Text>
        <Button
          variant="secondary"
          label={isSaved ? "★ My regular" : "☆ Save as a regular"}
          onPress={async () => setSaved((await api.setSaved(id, !isSaved)).saved)}
        />
      </View>

      {detail.data.post && (
        <Card accent style={{ gap: spacing.xs }}>
          <Badge label="Today's special" />
          <Text>{detail.data.post.body}</Text>
        </Card>
      )}

      {menu.length === 0 ? (
        <EmptyState title="Menu coming soon" />
      ) : (
        COFFEE_CATEGORIES.filter((c) => menu.some((m) => m.category === c)).map((c) => (
          <View key={c} style={{ gap: spacing.sm }}>
            <Text variant="h2" color={colors.pecan} accessibilityRole="header">
              {CATEGORY_LABELS[c]}
            </Text>
            <Card style={{ gap: spacing.md }}>
              {menu
                .filter((m) => m.category === c)
                .map((m) => {
                  const out = !m.available || m.soldOutToday;
                  return (
                    <Row key={m.id} style={{ justifyContent: "space-between" }}>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyBold">{m.name}</Text>
                        <Text variant="small" color={out ? colors.danger : colors.pecan}>
                          {m.size} · {formatCents(m.priceCents, { showZeroCents: true })}
                          {out ? " · Sold out" : ""}
                        </Text>
                      </View>
                      {hasPlan && !out && <Stepper name={m.name} value={qty[m.id] ?? 0} onChange={(n) => setQty({ ...qty, [m.id]: n })} />}
                    </Row>
                  );
                })}
            </Card>
          </View>
        ))
      )}

      {!hasPlan ? (
        <Card style={{ gap: spacing.md }}>
          <Text variant="bodyBold">Choose a plan to order for pickup.</Text>
          <Button label="See plans" onPress={() => router.push("/plans")} />
        </Card>
      ) : (
        available.length > 0 && (
          <Card style={{ gap: spacing.md }}>
            <Text variant="h2">Order for pickup</Text>
            <Row style={{ justifyContent: "space-between" }}>
              <Text color={colors.pecan}>Order value</Text>
              <Text variant="bodyBold">{formatCents(total, { showZeroCents: true })}</Text>
            </Row>
            <Row style={{ justifyContent: "space-between" }}>
              <Text color={colors.pecan} style={{ flex: 1 }}>
                Today’s pass covers (up to {formatCents(summary!.maxPassValueCents, { showZeroCents: true })})
              </Text>
              <Text variant="bodyBold">{formatCents(split.passValueCents, { showZeroCents: true })}</Text>
            </Row>
            <Row style={{ justifyContent: "space-between" }}>
              <Text variant="bodyBold">You pay (upgrade)</Text>
              <Text variant="stat">{formatCents(split.upgradeCents, { showZeroCents: true })}</Text>
            </Row>
            {split.upgradeCents > 0 && (
              <Text variant="small" color={colors.pecan}>
                Charged to your card on file at pickup, at the shop’s menu price.
              </Text>
            )}
            <Text variant="small">
              {summary!.passesLeft} of {summary!.passesPerMonth} passes left · one pass per day
            </Text>

            <Text variant="bodyBold">Pickup time</Text>
            {slots.length === 0 ? (
              <Text color={colors.pecan}>Not open for pickup in the next two hours.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {slots.slice(0, 24).map((d, i) => (
                  <Pressable
                    key={d.toISOString()}
                    accessibilityRole="button"
                    accessibilityState={{ selected: i === slot }}
                    onPress={() => setSlot(i)}
                    style={{
                      minHeight: 48,
                      paddingHorizontal: spacing.lg,
                      justifyContent: "center",
                      borderRadius: 999,
                      borderWidth: 2,
                      borderColor: i === slot ? colors.espresso : colors.latte,
                      backgroundColor: i === slot ? colors.skyBlue : colors.creamSwirl,
                    }}
                  >
                    <Text variant="bodyBold">{timeFmt.format(d)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {blocker && total > 0 && <ErrorNote message={blocker} />}
            {error && <ErrorNote message={error} />}
            <Button
              label={split.upgradeCents > 0 ? `Use pass + pay ${formatCents(split.upgradeCents, { showZeroCents: true })}` : "Use today's pass"}
              onPress={place}
              loading={busy}
              disabled={total === 0 || Boolean(blocker) || slots.length === 0}
            />
          </Card>
        )
      )}
    </Screen>
  );
}
