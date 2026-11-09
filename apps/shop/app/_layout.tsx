import {
  api,
  Button,
  Card,
  colors,
  ErrorNote,
  Loading,
  Logo,
  Screen,
  SessionProvider,
  SignInScreen,
  spacing,
  supabase,
  Text,
  useBrandFonts,
  useLoad,
  usePushRegistration,
  useSession,
} from "@sippy/mobile-ui";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const fontsReady = useBrandFonts();
  const { session, ready } = useSession();
  // Only shop accounts get into this app. Subscribers (members) never see the shop side; the
  // server enforces the same rule on every shop route.
  const me = useLoad(() => (session ? api.me() : Promise.resolve(null)), [session?.user.id]);
  const role = me.data?.profile.role;
  const isShop = role === "shop_owner" || role === "admin";
  usePushRegistration("shop", Boolean(session) && isShop);

  useEffect(() => {
    if (fontsReady && ready) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady, ready]);

  if (!fontsReady || !ready) return null;
  if (!session) return <SignInScreen subtitle="Orders, scanning and your menu, behind the counter." role="shop_owner" />;
  if (me.loading && !me.data) return <Screen><Loading label="Checking your account" /></Screen>;
  if (me.error && !me.data) return <Screen><ErrorNote message={me.error} onRetry={me.refresh} /></Screen>;

  if (!isShop) {
    return (
      <Screen>
        <Card style={{ gap: spacing.md, marginTop: spacing.xxl, alignItems: "flex-start" }}>
          <Logo size={72} />
          <Text variant="h2" accessibilityRole="header">
            This app is for coffee shops
          </Text>
          <Text color={colors.pecan}>
            You're signed in with a member account. Use the member app to order coffee. Shops sign in here with their own shop account.
          </Text>
          <Button label="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
        </Card>
      </Screen>
    );
  }

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
