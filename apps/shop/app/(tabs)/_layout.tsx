import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@sippy/mobile-ui";
import { Tabs } from "expo-router";
import { View } from "react-native";

/** Bottom tabs: Orders, Scan, Menu, Dashboard. Big targets in thumb reach. */
function TabIcon({ name, focused }: { name: keyof typeof Ionicons.glyphMap; focused: boolean }) {
  return (
    <View style={{ backgroundColor: focused ? colors.skyBlue : "transparent", borderRadius: 999, paddingHorizontal: 18, paddingVertical: 5 }}>
      <Ionicons name={name} size={26} color={colors.espresso} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.espresso,
        tabBarInactiveTintColor: colors.pecan,
        tabBarStyle: { backgroundColor: colors.creamSwirl, borderTopColor: colors.latte, minHeight: 72 },
        tabBarLabelStyle: { fontFamily: fonts.native.bodyExtraBold, fontSize: 13 },
        tabBarAllowFontScaling: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Orders", tabBarIcon: ({ focused }) => <TabIcon name="list" focused={focused} /> }} />
      <Tabs.Screen name="scan" options={{ title: "Scan", tabBarIcon: ({ focused }) => <TabIcon name="qr-code" focused={focused} /> }} />
      <Tabs.Screen name="menu" options={{ title: "Menu", tabBarIcon: ({ focused }) => <TabIcon name="cafe" focused={focused} /> }} />
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: ({ focused }) => <TabIcon name="stats-chart" focused={focused} /> }} />
    </Tabs>
  );
}
