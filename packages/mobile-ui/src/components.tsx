import type { ComponentRef, ReactNode, Ref } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, type ScrollViewProps } from "react-native";
import { colors, radii, shadows, spacing, touchTarget, type, type TypeVariant } from "./theme";

export function Text({ variant = "body", color = colors.espresso, style, ...props }: TextProps & { variant?: TypeVariant; color?: string }) {
  const t = type[variant];
  return (
    <RNText
      {...props}
      allowFontScaling
      maxFontSizeMultiplier={t.maxScale}
      style={[{ fontFamily: t.fontFamily, fontSize: t.fontSize, lineHeight: t.lineHeight, color }, style]}
    />
  );
}

/** What `Screen`'s scrollRef points at (for scrollTo). */
export type ScrollHandle = ComponentRef<typeof ScrollView>;

export function Screen({
  children,
  scroll = true,
  refreshControl,
  contentStyle,
  scrollRef,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshControl?: ScrollViewProps["refreshControl"];
  contentStyle?: StyleProp<ViewStyle>;
  scrollRef?: Ref<ScrollHandle>;
  /** Pinned below the scrolling content, e.g. a "View cart" bar. */
  footer?: ReactNode;
}) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.vanillaBean }}>
      {scroll ? (
        <ScrollView ref={scrollRef} contentContainerStyle={[{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg }, contentStyle]} refreshControl={refreshControl}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: spacing.lg, gap: spacing.lg }, contentStyle]}>{children}</View>
      )}
      {footer ? <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Card({ children, style, accent, ...rest }: ViewProps & { accent?: boolean }) {
  return (
    <View {...rest} style={[styles.card, accent && { borderColor: colors.skyBlue, borderWidth: 3 }, style]}>
      {children}
    </View>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

/**
 * Burnt Sugar button, Cream Swirl label, at least 48pt tall. Pressed state is Caramel with an
 * Espresso label. Designed to be hit easily with one thumb.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  accessibilityHint,
  style,
  big,
}: {
  label: string;
  onPress?: PressableProps["onPress"];
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  /** Extra-tall for behind-the-counter use. */
  big?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        big && { minHeight: 64 },
        variant === "primary" && { backgroundColor: pressed ? colors.caramel : colors.burntSugar },
        variant === "secondary" && { backgroundColor: pressed ? colors.latte : colors.creamSwirl, borderWidth: 2, borderColor: colors.pecan },
        variant === "ghost" && { backgroundColor: pressed ? colors.latte : "transparent" },
        variant === "danger" && { backgroundColor: pressed ? colors.latte : colors.creamSwirl, borderWidth: 2, borderColor: colors.danger },
        (disabled || loading) && { opacity: 0.55 },
        style,
      ]}
    >
      {({ pressed }) =>
        loading ? (
          <ActivityIndicator color={variant === "primary" ? colors.creamSwirl : colors.espresso} />
        ) : (
          <Text
            variant="button"
            color={
              variant === "primary"
                ? pressed
                  ? colors.espresso
                  : colors.creamSwirl
                : variant === "danger"
                  ? colors.danger
                  : variant === "ghost"
                    ? colors.burntSugarInk
                    : colors.espresso
            }
            style={{ textAlign: "center" }}
          >
            {label}
          </Text>
        )
      }
    </Pressable>
  );
}

/** Sky Blue badge with Espresso text — accent only. */
export function Badge({ label, tone = "sky" }: { label: string; tone?: "sky" | "latte" | "danger" | "success" }) {
  const bg = { sky: colors.skyBlue, latte: colors.latte, danger: colors.danger, success: colors.success }[tone];
  const fg = tone === "sky" || tone === "latte" ? colors.espresso : colors.creamSwirl;
  return (
    <View style={{ backgroundColor: bg, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" }}>
      <Text variant="small" color={fg} style={{ fontFamily: type.button.fontFamily, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: "center", paddingVertical: spacing.xxl, gap: spacing.sm }}>
      <Text variant="h2" style={{ textAlign: "center" }}>
        {title}
      </Text>
      {body && (
        <Text color={colors.pecan} style={{ textAlign: "center" }}>
          {body}
        </Text>
      )}
      {action}
    </Card>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={{ gap: spacing.md }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ height: 76, borderRadius: radii.md, backgroundColor: colors.latte, opacity: 0.55 - i * 0.12 }} />
      ))}
    </View>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card style={{ borderColor: colors.danger, borderWidth: 2, gap: spacing.sm }}>
      <Text variant="bodyBold" color={colors.danger} accessibilityRole="alert">
        {message}
      </Text>
      {onRetry && <Button label="Try again" variant="secondary" onPress={onRetry} />}
    </Card>
  );
}

export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: value }}
      style={{ height: 12, borderRadius: 6, backgroundColor: colors.latte, overflow: "hidden" }}
    >
      <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: colors.burntSugar, borderRadius: 6 }} />
    </View>
  );
}

export function Row({ children, style, ...rest }: ViewProps) {
  return (
    <View {...rest} style={[{ flexDirection: "row", alignItems: "center", gap: spacing.sm }, style]}>
      {children}
    </View>
  );
}

/** Pill toggle for filters (Sky Blue when on, with an Espresso outline). */
export function Chip({ label, selected, onPress, disabled }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={{
        minHeight: touchTarget.min - 4,
        paddingHorizontal: spacing.lg,
        justifyContent: "center",
        borderRadius: radii.pill,
        borderWidth: 2,
        borderColor: selected ? colors.espresso : colors.latte,
        backgroundColor: selected ? colors.skyBlue : colors.creamSwirl,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text variant="bodyBold">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.creamSwirl,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.latte,
    ...shadows.native.card,
  },
  button: {
    minHeight: touchTarget.min,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
