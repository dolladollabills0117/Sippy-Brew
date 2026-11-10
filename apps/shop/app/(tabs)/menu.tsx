import { CATEGORY_LABELS, formatCents, validateMenuItem, type MenuItem, type MenuItemInput } from "@sippy/core";
import { api, Button, Card, colors, EmptyState, ErrorNote, errorMessage, Loading, Row, Screen, spacing, Text, useLoad } from "@sippy/mobile-ui";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { RefreshControl, Switch, TextInput, View } from "react-native";

type ScanRow = MenuItemInput & { keep: boolean; price: string };

/**
 * Add items from a photo: take or pick a photo of the menu, we read the coffee drinks and
 * prices, and the shop checks them before anything is added.
 */
function MenuPhotoImport({ onAdded }: { onAdded: () => void }) {
  const [rows, setRows] = useState<ScanRow[] | null>(null);
  const [skipped, setSkipped] = useState<{ name: string; reason: string }[]>([]);
  const [busy, setBusy] = useState<"reading" | "adding" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(source: "camera" | "library") {
    setError(null);
    const perm = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError(source === "camera" ? "Camera access is needed to photograph your menu." : "Photo access is needed to pick your menu photo.");
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], base64: true, quality: 0.6 };
    const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const asset = res.canceled ? null : res.assets[0];
    if (!asset?.base64) return;
    setBusy("reading");
    try {
      const out = await api.scanMenu(asset.base64, asset.mimeType ?? "image/jpeg");
      setRows(out.items.map((i) => ({ ...i, keep: true, price: (i.priceCents / 100).toFixed(2) })));
      setSkipped(out.skipped);
      if (!out.items.length) setError("We didn't find any coffee drinks with prices in that photo. Try a clearer, straight-on photo.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function addAll() {
    if (!rows) return;
    const chosen = rows.filter((r) => r.keep).map((r) => ({ name: r.name, size: r.size, category: r.category, priceCents: Math.round(Number(r.price) * 100) }));
    const bad = chosen.map((c) => [c, validateMenuItem(c)] as const).find(([, v]) => !v.ok);
    if (bad) return setError(`${bad[0].name || "An item"}: ${(bad[1] as { message: string }).message}`);
    setBusy("adding");
    setError(null);
    try {
      for (const c of chosen) await api.addMenuItem(c);
      setRows(null);
      setSkipped([]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
      onAdded();
    }
  }

  const set = (i: number, p: Partial<ScanRow>) => setRows((r) => r!.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const input = { borderWidth: 2, borderColor: colors.latte, borderRadius: 10, paddingHorizontal: 10, minHeight: 44, color: colors.espresso, backgroundColor: colors.creamSwirl } as const;

  return (
    <Card style={{ gap: spacing.sm, borderWidth: 2, borderColor: colors.honey }}>
      <Text variant="h2">📸 Add items from a photo</Text>
      <Text color={colors.pecan}>Snap your menu board or printed menu. We fill in the coffee drinks and prices for you to check.</Text>
      {error && <ErrorNote message={error} />}
      {!rows && (
        <Row style={{ flexWrap: "wrap" }}>
          <Button label={busy === "reading" ? "Reading your menu…" : "Take a photo"} loading={busy === "reading"} onPress={() => pick("camera")} />
          <Button label="Choose a photo" variant="secondary" disabled={busy !== null} onPress={() => pick("library")} />
        </Row>
      )}
      {rows && rows.length > 0 && (
        <>
          <Text variant="bodyBold">Check these before adding. Untick anything you don&apos;t want.</Text>
          {rows.map((r, i) => (
            <View key={i} style={{ gap: 6, backgroundColor: colors.vanillaBean, borderRadius: 12, padding: spacing.sm }}>
              <Row style={{ justifyContent: "space-between" }}>
                <Text variant="bodyBold" style={{ flex: 1 }}>
                  {CATEGORY_LABELS[r.category as keyof typeof CATEGORY_LABELS] ?? r.category}
                </Text>
                <Switch accessibilityLabel={`Add ${r.name}`} value={r.keep} onValueChange={(v) => set(i, { keep: v })} trackColor={{ false: colors.latte, true: colors.skyBlue }} thumbColor={colors.espresso} />
              </Row>
              <TextInput accessibilityLabel="Name" style={input} value={r.name} onChangeText={(t) => set(i, { name: t })} />
              <Row>
                <TextInput accessibilityLabel="Size" style={[input, { flex: 1 }]} value={r.size} onChangeText={(t) => set(i, { size: t })} />
                <TextInput accessibilityLabel="Price in dollars" keyboardType="decimal-pad" style={[input, { flex: 1 }]} value={r.price} onChangeText={(t) => set(i, { price: t })} />
              </Row>
            </View>
          ))}
          {skipped.length > 0 && (
            <Text variant="small" color={colors.pecan}>
              Left out: {skipped.map((s) => `${s.name} (${s.reason.toLowerCase()})`).join(", ")}.
            </Text>
          )}
          <Button label={busy === "adding" ? "Adding…" : `Add ${rows.filter((r) => r.keep).length} items to my menu`} loading={busy === "adding"} onPress={addAll} />
          <Button label="Discard" variant="ghost" onPress={() => { setRows(null); setSkipped([]); }} />
        </>
      )}
    </Card>
  );
}

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

/** Add items from a photo, and quick availability toggles. Editing items and customizations lives in the web portal. */
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
      <MenuPhotoImport onAdded={menu.reload} />
      <Text color={colors.espresso}>
        <Text variant="bodyBold">Drinks only, no food whatsoever.</Text> Name add-ons for what they are, like &quot;Cookie syrup&quot; or &quot;Dragonfruit topping&quot;. Shops caught
        selling food are removed.
      </Text>
      <Text color={colors.espresso}>
        <Text variant="bodyBold">Changed a price?</Text> Update your Sippy Brew menu right away: that&apos;s how members are told.
      </Text>
      <Text color={colors.pecan}>“Sold out today” clears itself tomorrow. Edit items and set up customizations (milk, shots, syrups) on the web portal.</Text>
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
