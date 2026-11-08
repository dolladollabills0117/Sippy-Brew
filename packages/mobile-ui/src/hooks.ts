import { Caprasimo_400Regular } from "@expo-google-fonts/caprasimo";
import { CherryBombOne_400Regular } from "@expo-google-fonts/cherry-bomb-one";
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from "@expo-google-fonts/nunito";
import { ApiError } from "@sippy/core/api";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { api } from "./session";

/** Cherry Bomb One for headings, Nunito for everything else, Caprasimo for the logo. Same as the web app. */
export function useBrandFonts() {
  const [loaded, error] = useFonts({
    Caprasimo_400Regular,
    CherryBombOne_400Regular,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  return loaded || Boolean(error);
}

/** Load data with loading, error and refresh states. Optional polling interval in ms. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = [], pollMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const load = useCallback(async (mode: "initial" | "refresh" | "silent" = "initial") => {
    if (mode === "refresh") setRefreshing(true);
    try {
      setData(await fnRef.current());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load("initial");
    if (!pollMs) return;
    const id = setInterval(() => load("silent"), pollMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, error, loading, refreshing, refresh: () => load("refresh"), reload: () => load("silent") };
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return "Something went wrong. Check your connection and try again.";
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

/**
 * Ask for notification permission and register this device's Expo push token with the API.
 * Used for order updates, renewal reminders, shop specials (consumer) and new orders (shop).
 */
export function usePushRegistration(app: "consumer" | "shop", signedIn: boolean) {
  useEffect(() => {
    if (!signedIn || !Device.isDevice) return;
    (async () => {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", { name: "Orders and updates", importance: Notifications.AndroidImportance.HIGH });
      }
      let { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
      if (status !== "granted") return;
      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
      await api.registerPush(token, app, Platform.OS);
    })().catch((e) => console.warn("push registration failed", e));
  }, [app, signedIn]);
}
