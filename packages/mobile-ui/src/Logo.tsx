import { logoSvg } from "@sippy/core/logo";
import { Pressable, View } from "react-native";
import { SvgXml } from "react-native-svg";

/**
 * The brand logo (same SVG as the web header). The app UI shows only the mark, never the name
 * as text; screen readers hear "Sippy Brew" from the accessibility label.
 */
export function Logo({ size = 48 }: { size?: number }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Sippy Brew" style={{ width: size, height: size }}>
      <SvgXml xml={logoSvg({ fontFamily: "Caprasimo_400Regular" })} width={size} height={size} />
    </View>
  );
}

/**
 * The logo as a home button, for screen headers. People expect tapping the logo to go home, so
 * every header that shows it uses this. The app passes where home is (it owns the router).
 */
export function HomeLogo({ onPress, size = 40 }: { onPress: () => void; size?: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Sippy Brew home"
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" })}
    >
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <SvgXml xml={logoSvg({ fontFamily: "Caprasimo_400Regular" })} width={size} height={size} />
      </View>
    </Pressable>
  );
}
