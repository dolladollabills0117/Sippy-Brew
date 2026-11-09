import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, HomeLogo } from "@sippy/mobile-ui";
import { router, Tabs } from "expo-router";
import { View } from "react-native";

/** Bottom tabs: Shops, Order, Account. Active tab = Sky Blue pill behind an Espresso icon. */
function TabIcon({ name, focused }: { name: keyof typeof Ionicons.glyphMap; focused: boolean }) {
  return (
    <View style={{ backgroundColor: focused ? colors.skyBlue : "transparent", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 4 }}>
      <Ionicons name={name} size={22} color={colors.espresso} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        // Logo header on every tab; tapping it goes home (the Shops tab).
        headerTitle: () => <HomeLogo onPress={() => router.navigate("/")} />,
        headerTitleAlign: "center",
        headerStyle: { backgroundColor: colors.vanillaBean },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.espresso,
        tabBarInactiveTintColor: colors.pecan,
        tabBarStyle: { backgroundColor: colors.creamSwirl, borderTopColor: colors.latte, minHeight: 64 },
        tabBarLabelStyle: { fontFamily: fonts.native.bodyExtraBold, fontSize: 12 },
        tabBarAllowFontScaling: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Shops", tabBarIcon: ({ focused }) => <TabIcon name="map" focused={focused} /> }} />
      <Tabs.Screen name="orders" options={{ title: "Order", tabBarIcon: ({ focused }) => <TabIcon name="cafe" focused={focused} /> }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} /> }} />
    </Tabs>
  );
}
