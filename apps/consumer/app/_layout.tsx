import { colors, HomeLogo, SessionProvider, SignInScreen, useBrandFonts, usePushRegistration, useSession } from "@sippy/mobile-ui";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const fontsReady = useBrandFonts();
  const { session, ready } = useSession();
  usePushRegistration("consumer", Boolean(session));

  useEffect(() => {
    if (fontsReady && ready) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady, ready]);

  if (!fontsReady || !ready) return null;
  if (!session) return <SignInScreen subtitle="Your neighborhood, brewed daily." role="member" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.vanillaBean },
        headerTintColor: colors.espresso,
        headerTitleStyle: { fontFamily: "Caprasimo_400Regular" },
        // The logo sits in every header and always goes home (the Shops tab).
        headerTitle: () => <HomeLogo onPress={() => router.navigate("/")} />,
        headerTitleAlign: "center",
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.vanillaBean },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="shop/[id]" options={{ title: "Shop" }} />
      <Stack.Screen name="order/[id]" options={{ title: "Pickup", presentation: "fullScreenModal" }} />
      <Stack.Screen name="plans" options={{ title: "Choose a plan", presentation: "modal" }} />
    </Stack>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Root />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
