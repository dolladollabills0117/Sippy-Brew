import { ORDER_STATUS_LABELS, qrSecondsRemaining, RULES, type QrTicket } from "@sippy/core";
import { api, Badge, Button, colors, ErrorNote, errorMessage, Loading, spacing, Text, useLoad } from "@sippy/mobile-ui";
import * as Brightness from "expo-brightness";
import { useKeepAwake } from "expo-keep-awake";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, ScrollView, useWindowDimensions, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: RULES.timeZone });

/**
 * The pickup QR. Full brightness while visible, screen kept awake, and the code is as wide as
 * the screen allows. Codes expire after 30 seconds, so a fresh one is fetched just before.
 */
export default function PickupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useKeepAwake();
  const { width } = useWindowDimensions();
  const size = Math.min(width - 48, 420);
  const order = useLoad(() => api.getOrder(id), [id], 8000);
  const [ticket, setTicket] = useState<QrTicket | null>(null);
  const [left, setLeft] = useState(0);
  const [qrError, setQrError] = useState<string | null>(null);
  const status = order.data?.order.status;
  const open = status !== undefined && status !== "picked_up" && status !== "cancelled" && status !== "no_show";
  const fetching = useRef(false);

  // Max brightness while this screen is focused; restore afterwards.
  useFocusEffect(
    useCallback(() => {
      let previous: number | null = null;
      (async () => {
        try {
          const { status: perm } = await Brightness.requestPermissionsAsync();
          if (perm !== "granted") return;
          previous = await Brightness.getBrightnessAsync();
          await Brightness.setBrightnessAsync(1);
        } catch {
          /* brightness not available (simulator) */
        }
      })();
      return () => {
        if (previous !== null) void Brightness.setBrightnessAsync(previous).catch(() => {});
        void Brightness.restoreSystemBrightnessAsync?.().catch(() => {});
      };
    }, []),
  );

  const refresh = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      setTicket(await api.issueQr(id));
      setQrError(null);
    } catch (e) {
      setQrError(errorMessage(e));
    } finally {
      fetching.current = false;
    }
  }, [id]);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const sub = AppState.addEventListener("change", (s) => s === "active" && refresh());
    return () => sub.remove();
  }, [open, refresh]);

  useEffect(() => {
    if (!ticket || !open) return;
    const t = setInterval(() => {
      const s = qrSecondsRemaining(ticket.expiresAt, new Date());
      setLeft(s);
      if (s <= 4) void refresh();
    }, 500);
    return () => clearInterval(t);
  }, [ticket, open, refresh]);

  if (order.loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.creamSwirl, padding: 24 }}><Loading /></SafeAreaView>;
  if (!order.data) return <SafeAreaView style={{ flex: 1, padding: 24 }}><ErrorNote message={order.error ?? "Order not found."} onRetry={order.refresh} /></SafeAreaView>;
  const o = order.data.order;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.creamSwirl }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, alignItems: "center" }}>
        <Text variant="small" color={colors.pecan} style={{ textTransform: "uppercase", letterSpacing: 1 }}>
          {o.shopName}
        </Text>
        <Text variant="h1" style={{ textAlign: "center" }} accessibilityRole="header">
          {o.status === "ready" ? "Ready for pickup!" : o.status === "picked_up" ? "Enjoy!" : o.status === "cancelled" ? "Order cancelled" : o.status === "no_show" ? "Not picked up" : "Show this at the counter"}
        </Text>
        <Badge label={ORDER_STATUS_LABELS[o.status]} tone={o.status === "ready" ? "sky" : o.status === "cancelled" ? "danger" : "latte"} />
        {o.status === "no_show" && (
          <Text color={colors.pecan} style={{ textAlign: "center" }}>
            This order wasn&apos;t picked up, so the shop marked it as missed. No-shows aren&apos;t refunded: the pass was used and the shop was paid for the drink.
            Questions go to {o.shopName}.
          </Text>
        )}
        {o.allergyNote ? (
          <Text variant="bodyBold" color={colors.danger} style={{ textAlign: "center" }}>
            Allergy you listed: {o.allergyNote}. Remind the barista at pickup.
          </Text>
        ) : null}

        {open && (
          <>
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={`Pickup QR code. Code ${ticket?.shortCode.split("").join(" ") ?? "loading"}`}
              style={{ backgroundColor: "#FFFFFF", padding: 16, borderRadius: 24 }}
            >
              {ticket ? <QRCode value={ticket.payload} size={size - 32} color={colors.espresso} backgroundColor="#FFFFFF" ecl="M" quietZone={8} /> : <View style={{ width: size - 32, height: size - 32 }} />}
            </View>
            {ticket && (
              <View style={{ alignItems: "center" }}>
                <Text variant="small" color={colors.pecan}>
                  Or tell the barista
                </Text>
                <Text variant="display" style={{ letterSpacing: 6, fontFamily: "Nunito_800ExtraBold" }} selectable>
                  {ticket.shortCode}
                </Text>
                <Text variant="small" color={colors.pecan} accessibilityLiveRegion="polite">
                  Refreshes in {left}s
                </Text>
              </View>
            )}
            {qrError && <ErrorNote message={qrError} onRetry={refresh} />}
          </>
        )}

        <View style={{ alignSelf: "stretch", gap: 4 }}>
          <Text variant="small" color={colors.pecan}>
            Pickup {timeFmt.format(new Date(o.pickupTime))}
          </Text>
          {o.items.map((i) => (
            <Text key={i.id}>
              {i.quantity}× {i.name} ({i.size})
            </Text>
          ))}
        </View>
        <Button label="Done" variant="secondary" style={{ alignSelf: "stretch" }} onPress={() => (router.canGoBack() ? router.back() : router.replace("/orders"))} />
      </ScrollView>
    </SafeAreaView>
  );
}
