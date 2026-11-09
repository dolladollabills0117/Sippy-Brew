import type { Order } from "@sippy/core";
import { api, Button, Card, colors, errorMessage, radii, Screen, spacing, Text, type as typeScale } from "@sippy/mobile-ui";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useIsFocused } from "expo-router";
import { useRef, useState } from "react";
import { TextInput, View } from "react-native";

type Result = { ok: true; order: Order } | { ok: false; message: string };

/** QR scanner for member redemptions, with manual code entry as a fallback. */
export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const focused = useIsFocused();
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const last = useRef<{ text: string; at: number } | null>(null);

  async function redeem(input: { qr?: string; shortCode?: string }) {
    setBusy(true);
    try {
      const { order } = await api.redeem(input);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult({ ok: true, order });
      setCode("");
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setResult({ ok: false, message: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  function onScan(text: string) {
    const now = Date.now();
    if (busy || (last.current && last.current.text === text && now - last.current.at < 3000)) return;
    last.current = { text, at: now };
    void redeem({ qr: text });
  }

  return (
    <Screen>
      <Text variant="display" accessibilityRole="header">
        Scan
      </Text>

      <View style={{ aspectRatio: 1, borderRadius: radii.lg, overflow: "hidden", backgroundColor: colors.espresso }}>
        {permission?.granted && focused ? (
          <>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => onScan(data)}
              accessibilityLabel="Camera. Point at the member's QR code."
            />
            <View pointerEvents="none" style={{ position: "absolute", top: "18%", left: "18%", right: "18%", bottom: "18%", borderWidth: 4, borderColor: colors.skyBlue, borderRadius: 24 }} />
          </>
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md }}>
            <Text color={colors.creamSwirl} style={{ textAlign: "center" }}>
              {permission?.canAskAgain === false ? "Camera access is off. Turn it on in Settings, or enter the code below." : "Allow the camera to scan member QR codes."}
            </Text>
            {permission?.canAskAgain !== false && <Button label="Allow camera" onPress={requestPermission} />}
          </View>
        )}
      </View>

      {result && (
        <Card style={{ borderWidth: 3, borderColor: result.ok ? colors.success : colors.danger, gap: spacing.xs }} accessibilityLiveRegion="assertive">
          {result.ok ? (
            <>
              <Text variant="h1" color={colors.success}>
                ✓ {result.order.memberFirstName}
              </Text>
              {result.order.items.map((i) => (
                <Text key={i.id} style={{ fontSize: 20, lineHeight: 26 }}>
                  {i.quantity}× {i.name} ({i.size}){i.options.length ? ` · ${i.options.map((o) => o.name).join(", ")}` : ""}
                </Text>
              ))}
            </>
          ) : (
            <Text variant="h2" color={colors.danger} accessibilityRole="alert">
              {result.message}
            </Text>
          )}
        </Card>
      )}

      <Card style={{ gap: spacing.md }}>
        <Text variant="bodyBold" nativeID="code-label">
          Or enter the 6-character code
        </Text>
        <TextInput
          accessibilityLabelledBy="code-label"
          accessibilityLabel="Member code"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          allowFontScaling
          placeholder="ABC234"
          placeholderTextColor={colors.pecan}
          style={{
            minHeight: 60,
            borderWidth: 2,
            borderColor: colors.pecan,
            borderRadius: radii.sm,
            backgroundColor: colors.creamSwirl,
            paddingHorizontal: spacing.lg,
            color: colors.espresso,
            fontFamily: typeScale.stat.fontFamily,
            fontSize: 28,
            letterSpacing: 6,
          }}
        />
        <Button big label="Redeem code" loading={busy} disabled={code.replace(/\W/g, "").length !== 6} onPress={() => redeem({ shortCode: code })} />
      </Card>
    </Screen>
  );
}
