import { formatCents, MAX_QUANTITY_PER_LINE, resolveOptions, type MenuItem } from "@sippy/core";
import { Button, colors, ErrorNote, radii, Row, spacing, Text } from "@sippy/mobile-ui";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Customize a drink before adding it: the shop's options (milk, shots, syrups) with its prices.
 * The price updates as options change. Pass covers the order up to the daily max; the rest is
 * an overage confirmed at checkout.
 */
export function CustomizeSheet({ item, onAdd, onClose }: { item: MenuItem; onAdd: (optionIds: string[], quantity: number) => void; onClose: () => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const extra = picked.reduce((sum, id) => {
    for (const g of item.modifierGroups) {
      const o = g.options.find((x) => x.id === id);
      if (o) return sum + o.priceCents;
    }
    return sum;
  }, 0);
  const unit = item.priceCents + extra;
  const money = (c: number) => formatCents(c, { showZeroCents: true });

  function toggle(groupId: string, optionId: string) {
    setError(null);
    void Haptics.selectionAsync();
    const g = item.modifierGroups.find((x) => x.id === groupId)!;
    const inGroup = new Set(g.options.map((o) => o.id));
    setPicked((cur) => {
      if (cur.includes(optionId)) return cur.filter((x) => x !== optionId);
      if (g.maxSelect === 1) return [...cur.filter((x) => !inGroup.has(x)), optionId];
      if (cur.filter((x) => inGroup.has(x)).length >= g.maxSelect) return cur;
      return [...cur, optionId];
    });
  }

  function add() {
    const r = resolveOptions(item.name, item.modifierGroups, picked);
    if (!r.ok) return setError(r.message);
    onAdd(picked, quantity);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.creamSwirl }}>
        <Row style={{ justifyContent: "space-between", padding: spacing.lg, borderBottomWidth: 1, borderColor: colors.latte }}>
          <View style={{ flex: 1 }}>
            <Text variant="h2" accessibilityRole="header">
              {item.name}
            </Text>
            <Text variant="small" color={colors.pecan}>
              {item.size} · {money(item.priceCents)}
            </Text>
          </View>
          <Button label="Close" variant="ghost" onPress={onClose} />
        </Row>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
          {item.modifierGroups.map((g) => (
            <View key={g.id} style={{ gap: spacing.sm }} accessibilityRole={g.maxSelect === 1 ? "radiogroup" : undefined}>
              <Row style={{ justifyContent: "space-between" }}>
                <Text variant="bodyBold">{g.name}</Text>
                <Text variant="small" color={colors.pecan}>
                  {g.required ? "Required · " : ""}
                  {g.maxSelect === 1 ? "Pick one" : `Pick up to ${g.maxSelect}`}
                </Text>
              </Row>
              {g.options.map((o) => {
                const on = picked.includes(o.id);
                return (
                  <Pressable
                    key={o.id}
                    accessibilityRole={g.maxSelect === 1 ? "radio" : "checkbox"}
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${o.name}${o.priceCents ? `, adds ${money(o.priceCents)}` : ", free"}`}
                    onPress={() => toggle(g.id, o.id)}
                    style={{
                      minHeight: 52,
                      borderRadius: radii.md,
                      borderWidth: 2,
                      borderColor: on ? colors.espresso : colors.latte,
                      backgroundColor: on ? colors.vanillaBean : colors.creamSwirl,
                      paddingHorizontal: spacing.lg,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text variant={on ? "bodyBold" : "body"}>
                      {on ? "✓ " : ""}
                      {o.name}
                    </Text>
                    <Text variant="small" color={colors.pecan}>
                      {o.priceCents ? `+${money(o.priceCents)}` : "Free"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
          <Text variant="small" color={colors.pecan}>
            Customizations are priced by the shop. Your pass covers your order up to its daily max; anything more is an overage you confirm.
          </Text>
        </ScrollView>
        <View style={{ padding: spacing.lg, gap: spacing.md, borderTopWidth: 1, borderColor: colors.latte }}>
          {error && <ErrorNote message={error} />}
          <Row style={{ justifyContent: "space-between" }}>
            <Row>
              <Button label="−" variant="secondary" disabled={quantity <= 1} onPress={() => setQuantity((q) => q - 1)} accessibilityHint="One fewer" />
              <Text variant="bodyBold" style={{ minWidth: 28, textAlign: "center" }} accessibilityLiveRegion="polite">
                {quantity}
              </Text>
              <Button label="+" variant="secondary" disabled={quantity >= MAX_QUANTITY_PER_LINE} onPress={() => setQuantity((q) => q + 1)} accessibilityHint="One more" />
            </Row>
            <Text variant="small" color={colors.pecan}>
              {money(unit)} each
            </Text>
          </Row>
          <Button label={`Add to order · ${money(unit * quantity)}`} onPress={add} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
