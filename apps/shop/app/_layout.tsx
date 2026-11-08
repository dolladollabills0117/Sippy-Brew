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
  usePushRegistration("shop", Boolean(session));

  useEffect(() => {
    if (fontsReady && ready) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady, ready]);

  if (!fontsReady || !ready) return null;
  if (!session) return <SignInScreen subtitle="Orders, scanning and your menu, behind the counter." role="shop_owner" />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.vanillaBean } }}>
      <Stack.Screen name="(tabs)" />
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
