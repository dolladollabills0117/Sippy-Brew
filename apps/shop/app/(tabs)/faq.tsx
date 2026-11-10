import { MERCHANT_FAQ, MERCHANT_FAQ_FOOTNOTE } from "@sippy/core";
import { Card, colors, Screen, spacing, Text } from "@sippy/mobile-ui";
import { useState } from "react";
import { Pressable, View } from "react-native";

/** Merchant FAQ: tap a question to reveal the answer. Copy lives in packages/core/src/faq.ts. */
export default function FaqScreen() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Screen>
      <Text variant="display" accessibilityRole="header">
        FAQ
      </Text>
      <Text color={colors.pecan}>Tap a question to see the answer.</Text>
      {MERCHANT_FAQ.map((sec) => (
        <View key={sec.title} style={{ gap: spacing.sm }}>
          <Text variant="h2" accessibilityRole="header">
            {sec.title}
          </Text>
          <Card style={{ paddingVertical: spacing.xs }}>
            {sec.items.map((it, i) => {
              const isOpen = open === it.q;
              return (
                <View key={it.q} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colors.latte }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                    onPress={() => setOpen(isOpen ? null : it.q)}
                    style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm }}
                  >
                    <Text variant="bodyBold" style={{ flex: 1 }}>
                      {it.q}
                    </Text>
                    <Text variant="h2" color={colors.burntSugarInk} accessibilityElementsHidden importantForAccessibility="no">
                      {isOpen ? "−" : "+"}
                    </Text>
                  </Pressable>
                  {isOpen && <Text style={{ paddingBottom: spacing.md }}>{it.a}</Text>}
                </View>
              );
            })}
          </Card>
        </View>
      ))}
      <Text variant="small" color={colors.pecan}>
        {MERCHANT_FAQ_FOOTNOTE}
      </Text>
    </Screen>
  );
}
