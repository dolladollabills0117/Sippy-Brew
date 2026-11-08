import { logoSvg } from "@sippy/core/logo";
import { View } from "react-native";
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
