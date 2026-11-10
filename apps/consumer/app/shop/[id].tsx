import {
  CATEGORY_LABELS,
  checkPassAvailable,
  COFFEE_CATEGORIES,
  formatCents,
  MAX_QUANTITY_PER_LINE,
  pickupSlots,
  RULES,
  splitPassValue,
  overageIsCharged,
  overageCoveredByUpgrade,
  getTier,
  describeOptions,
  priceOrder,
  bonusForOverageAvailable,
  bonusOverageCover,
  type MenuItem,
} from "@sippy/core";
import { api, Badge, Button, Card, colors, EmptyState, ErrorNote, errorMessage, Loading, Row, Screen, spacing, Text, useLoad } from "@sippy/mobile-ui";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Switch, View } from "react-native";
import { CustomizeSheet } from "../../components/CustomizeSheet";

interface CartLine {
  key: string;
  menuItemId: string;
  optionIds: string[];
  quantity: number;
}

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: RULES.timeZone });

/**
 * Shop page + order flow: menu, today's pass, pickup time. If the order is over the pass, the
 * member sees the pass amount, overage and total and must confirm the exact overage first.
 */
export default function ShopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = useLoad(() => api.getShop(id), [id]);
  const me = useLoad(() => api.me(), []);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customizing, setCustomizing] = useState<MenuItem | null>(null);
  const [slot, setSlot] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean | null>(null);
  // The overage amount the member confirmed. A changed cart needs a new confirmation.
  const [confirmedOverage, setConfirmedOverage] = useState<number | null>(null);
  // The member's choice to put a bonus pass toward the overage.
  const [useBonus, setUseBonus] = useState(false);

  const shop = detail.data?.shop;
  const slots = useMemo(() => (shop ? pickupSlots(new Date(), shop.hours) : []), [shop]);

  if (detail.loading || me.loading) return <Screen><Loading /></Screen>;
  if (detail.error || !detail.data || !shop) return <Screen><ErrorNote message={detail.error ?? "Shop not found."} onRetry={detail.refresh} /></Screen>;

  const summary = me.data;
  const menu = detail.data.menu;
  const available = menu.filter((m) => m.available && !m.soldOutToday);
  // Price the cart with the same rules the server uses (drink + customizations).
  const priced = cart.length ? priceOrder(cart, available, shop.id) : null;
  const pricedLines = priced && priced.ok ? priced.lines : [];
  const total = priced && priced.ok ? priced.totalCents : 0;
  const lineFor = (l: CartLine) =>
    pricedLines.find((p) => p.menuItemId === l.menuItemId && p.options.map((o) => o.optionId).sort().join(",") === [...l.optionIds].sort().join(","));
  const addLine = (menuItemId: string, optionIds: string[], quantity: number) => {
    void Haptics.selectionAsync();
    const key = `${menuItemId}|${[...optionIds].sort().join(",")}`;
    setCart((c) =>
      c.some((l) => l.key === key)
        ? c.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QUANTITY_PER_LINE, l.quantity + quantity) } : l))
        : [...c, { key, menuItemId, optionIds, quantity }],
    );
  };
  const bumpLine = (key: string, delta: number) =>
    setCart((c) => c.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QUANTITY_PER_LINE, l.quantity + delta) } : l)).filter((l) => l.quantity > 0));
  const allPasses = summary ? summary.passesLeft + summary.bonusPassesLeft : 0;
  const pass = summary ? checkPassAvailable({ passesLeft: allPasses, passDaysUsed: summary.passDaysUsed, now: new Date() }) : null;
  const base = splitPassValue(total, summary?.maxPassValueCents ?? 0);
  const spareBonus = summary ? bonusForOverageAvailable(allPasses, summary.bonusPassesLeft) : 0;
  const bonusCover = useBonus && spareBonus > 0 ? bonusOverageCover(base.overageCents, summary?.maxPassValueCents ?? 0) : 0;
  // What the member pays after any bonus pass they chose to use.
  const split = { passCoveredCents: base.passCoveredCents + bonusCover, overageCents: base.overageCents - bonusCover };
  const blocker = pass && !pass.ok ? pass.message : null;
  const hasOverage = split.overageCents > 0;
  const overageConfirmed = !hasOverage || confirmedOverage === split.overageCents;
  const money = (c: number) => formatCents(c, { showZeroCents: true });
  const hasPlan = summary?.subscription && ["active", "trialing"].includes(summary.subscription.status);
  const isSaved = saved ?? detail.data.saved;

  async function place() {
    setBusy(true);
    setError(null);
    try {
      const items = cart.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, optionIds: l.optionIds }));
      const { order } = await api.placeOrder({
        shopId: id,
        items,
        pickupAt: slots[slot]!.toISOString(),
        confirmedOverageCents: hasOverage ? confirmedOverage : null,
        useBonusForOverage: bonusCover > 0,
      });
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
      {customizing && (
        <CustomizeSheet
          item={customizing}
          onClose={() => setCustomizing(null)}
          onAdd={(optionIds, quantity) => {
            addLine(customizing.id, optionIds, quantity);
            setCustomizing(null);
          }}
        />
      )}
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
                          {out ? " · Sold out" : m.modifierGroups.length ? " · Customizable" : ""}
                        </Text>
                      </View>
                      {hasPlan && !out && (
                        <Button
                          label={m.modifierGroups.length ? "Customize" : "Add"}
                          variant="secondary"
                          onPress={() => (m.modifierGroups.length ? setCustomizing(m) : addLine(m.id, [], 1))}
                          accessibilityHint={m.modifierGroups.length ? `Choose options for ${m.name}` : `Add ${m.name} to your order`}
                        />
                      )}
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
            {cart.length === 0 ? (
              <Text color={colors.pecan}>Add a coffee from the menu.</Text>
            ) : (
              cart.map((l) => {
                const p = lineFor(l);
                const item = available.find((m) => m.id === l.menuItemId);
                return (
                  <Row key={l.key} style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text variant="bodyBold">
                        {l.quantity}× {item?.name ?? "Unavailable"}
                      </Text>
                      {p && p.options.length > 0 && (
                        <Text variant="small" color={colors.pecan}>
                          {describeOptions(p.options)}
                        </Text>
                      )}
                      <Row>
                        <Button label="−" variant="secondary" onPress={() => bumpLine(l.key, -1)} accessibilityHint="One fewer" />
                        <Button label="+" variant="secondary" disabled={l.quantity >= MAX_QUANTITY_PER_LINE} onPress={() => bumpLine(l.key, 1)} accessibilityHint="One more" />
                      </Row>
                    </View>
                    <Text variant="bodyBold">{p ? money(p.lineTotalCents) : ""}</Text>
                  </Row>
                );
              })
            )}
            {priced && !priced.ok && <ErrorNote message={priced.message} />}
            <Row style={{ justifyContent: "space-between" }}>
              <Text color={colors.pecan} style={{ flex: 1 }}>
                Pass covers (first {money(summary!.maxPassValueCents)})
              </Text>
              <Text variant="bodyBold">{money(base.passCoveredCents)}</Text>
            </Row>
            {bonusCover > 0 && (
              <Row style={{ justifyContent: "space-between" }}>
                <Text color={colors.pecan} style={{ flex: 1 }}>
                  Bonus pass toward the overage
                </Text>
                <Text variant="bodyBold">{money(bonusCover)}</Text>
              </Row>
            )}
            <Row style={{ justifyContent: "space-between" }}>
              <Text color={colors.pecan}>Overage</Text>
              <Text variant="bodyBold">{money(split.overageCents)}</Text>
            </Row>
            <Row style={{ justifyContent: "space-between" }}>
              <Text variant="bodyBold">Order total</Text>
              <Text variant="stat">{money(total)}</Text>
            </Row>
            {base.overageCents > 0 && spareBonus > 0 && (
              <Card style={{ borderWidth: 2, borderColor: colors.honey, gap: spacing.sm }}>
                <Row style={{ justifyContent: "space-between", minHeight: 48 }}>
                  <Text variant="bodyBold" style={{ flex: 1 }} nativeID="use-bonus-label">
                    Use a bonus pass toward the overage
                  </Text>
                  <Switch
                    accessibilityLabelledBy="use-bonus-label"
                    value={useBonus}
                    onValueChange={(v) => {
                      setUseBonus(v);
                      setConfirmedOverage(null);
                    }}
                    trackColor={{ true: colors.burntSugar, false: colors.latte }}
                  />
                </Row>
                <Text variant="small" color={colors.pecan}>
                  It covers up to {money(Math.min(base.overageCents, summary!.maxPassValueCents))} of the {money(base.overageCents)} overage. You have {spareBonus} bonus pass
                  {spareBonus === 1 ? "" : "es"} to use.
                </Text>
              </Card>
            )}
            {hasOverage && (
              <Card style={{ borderWidth: 2, borderColor: colors.espresso, backgroundColor: colors.vanillaBean, gap: spacing.sm }}>
                <Text variant="bodyBold">This order is {money(split.overageCents)} over your pass.</Text>
                <Text variant="small" color={colors.pecan}>
                  {overageIsCharged(split.overageCents)
                    ? "The overage is charged to your card on file when the shop hands over your order, at the shop’s menu prices. It’s released if the order is cancelled."
                    : `Overages under ${money(RULES.minOverageChargeCents)} are waived, so you won’t be charged for this one.`}
                </Text>
                <Row style={{ justifyContent: "space-between", minHeight: 48 }}>
                  <Text variant="bodyBold" style={{ flex: 1 }} nativeID="confirm-overage-label">
                    I confirm the {money(split.overageCents)} overage. My pass covers {money(split.passCoveredCents)} of the {money(total)} total.
                  </Text>
                  <Switch
                    accessibilityLabelledBy="confirm-overage-label"
                    accessibilityLabel={`Confirm the ${money(split.overageCents)} overage`}
                    value={overageConfirmed}
                    onValueChange={(v) => setConfirmedOverage(v ? split.overageCents : null)}
                    trackColor={{ false: colors.latte, true: colors.skyBlue }}
                    thumbColor={colors.espresso}
                    ios_backgroundColor={colors.latte}
                  />
                </Row>
                {summary?.upgrade && summary.subscription && overageCoveredByUpgrade(getTier(summary.subscription.tier), total) > 0 && (
                  <Pressable accessibilityRole="link" onPress={() => router.push("/account")}>
                    <Text variant="small">
                      Tip: on {summary.upgrade.toName}, {money(overageCoveredByUpgrade(getTier(summary.subscription.tier), total))} of this overage would be covered by your pass.{" "}
                      <Text variant="small" color={colors.burntSugarInk} style={{ textDecorationLine: "underline", fontFamily: "Nunito_800ExtraBold" }}>
                        See upgrade
                      </Text>
                    </Text>
                  </Pressable>
                )}
              </Card>
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
              label={hasOverage ? `Use pass + pay ${money(split.overageCents)} overage` : "Use today's pass"}
              onPress={place}
              loading={busy}
              disabled={total === 0 || Boolean(blocker) || slots.length === 0 || !overageConfirmed || Boolean(priced && !priced.ok)}
            />
          </Card>
        )
      )}
    </Screen>
  );
}
