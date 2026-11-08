import { colors, SessionProvider, SignInScreen, useBrandFonts, usePushRegistration, useSession } from "@sippy/mobile-ui";
import { Stack } from "expo-router";
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
  if (!session) return <SignInScreen title="Sippy Brew" subtitle="Your neighborhood, every morning." role="member" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.vanillaBean },
        headerTintColor: colors.espresso,
        headerTitleStyle: { fontFamily: "CherryBombOne_400Regular" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.vanillaBean },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="shop/[id]" options={{ title: "" }} />
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
