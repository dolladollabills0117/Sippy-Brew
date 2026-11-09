import { CATEGORY_LABELS, formatCents, type MenuItem } from "@sippy/core";
import { api, Card, colors, EmptyState, ErrorNote, errorMessage, Loading, Row, Screen, spacing, Text, useLoad } from "@sippy/mobile-ui";
import { useState } from "react";
import { RefreshControl, Switch, View } from "react-native";

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row style={{ justifyContent: "space-between", minHeight: 48 }}>
      <Text variant="bodyBold">{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.latte, true: colors.skyBlue }}
        thumbColor={colors.espresso}
        ios_backgroundColor={colors.latte}
      />
    </Row>
  );
}

/** Quick availability toggles. Adding and editing items lives in the web portal. */
export default function MenuScreen() {
  const menu = useLoad(() => api.shopMenu(), []);
  const [error, setError] = useState<string | null>(null);

  async function patch(item: MenuItem, p: { available?: boolean; soldOutToday?: boolean }) {
    menu.setData((d) => (d ? { items: d.items.map((m) => (m.id === item.id ? { ...m, ...p } : m)) } : d));
    try {
      await api.updateMenuItem(item.id, p);
    } catch (e) {
      setError(errorMessage(e));
      menu.reload();
    }
  }

  const items = menu.data?.items ?? [];
  return (
    <Screen refreshControl={<RefreshControl refreshing={menu.refreshing} onRefresh={menu.refresh} tintColor={colors.burntSugar} />}>
      <Text variant="display" accessibilityRole="header">
        Menu
      </Text>
      <Text color={colors.pecan}>“Sold out today” clears itself tomorrow. Add items and set up customizations (milk, shots, syrups) on the web portal.</Text>
      {error && <ErrorNote message={error} />}
      {menu.loading ? (
        <Loading label="Loading menu" />
      ) : menu.error ? (
        <ErrorNote message={menu.error} onRetry={menu.refresh} />
      ) : items.length === 0 ? (
        <EmptyState title="No menu items yet" body="Add your coffee menu from the web portal." />
      ) : (
        <View style={{ gap: spacing.md }}>
          {items.map((m) => (
            <Card key={m.id} style={{ gap: spacing.xs }}>
              <Text variant="h2">{m.name}</Text>
              <Text variant="small" color={colors.pecan}>
                {CATEGORY_LABELS[m.category]} · {m.size} · {formatCents(m.priceCents, { showZeroCents: true })}
              </Text>
              {m.modifierGroups.length > 0 && (
                <Text variant="small">
                  {m.modifierGroups.map((g) => `${g.name}: ${g.options.map((o) => o.name + (o.priceCents ? ` +${formatCents(o.priceCents, { showZeroCents: true })}` : "")).join(", ")}`).join(" · ")}
                </Text>
              )}
              <Toggle label="Available" value={m.available} onChange={(v) => patch(m, { available: v })} />
              <Toggle label="Sold out today" value={m.soldOutToday} onChange={(v) => patch(m, { soldOutToday: v })} />
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
