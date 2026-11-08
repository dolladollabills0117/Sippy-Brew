import type { ExpoConfig } from "expo/config";
// Mirrors packages/core/src/brand.ts (the config loader can't import TS from outside the app).
const colors = { vanillaBean: "#F3E5C7", burntSugar: "#A8642F" } as const;

/**
 * Public config only. Secrets never go here: the Supabase anon key and API URL are read from
 * EAS environment variables (EXPO_PUBLIC_*) at build time, and Stripe / service-role keys
 * never reach the app at all. See README → Mobile apps.
 */
const config: ExpoConfig = {
  name: "Sippy Brew",
  slug: "sippy-brew",
  scheme: "sippybrew",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  ios: {
    bundleIdentifier: "com.sippybrew.app",
    supportsTablet: true,
    buildNumber: "1",
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: "com.sippybrew.app",
    versionCode: 1,
    adaptiveIcon: { foregroundImage: "./assets/icon.png", backgroundColor: colors.vanillaBean },
    config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY } },
  },
  plugins: [
    "expo-router",
    ["expo-splash-screen", { image: "./assets/splash.png", imageWidth: 200, backgroundColor: colors.vanillaBean }],
    "expo-font",
    "expo-web-browser",
    [
      "expo-notifications",
      { color: colors.burntSugar },
    ],
    [
      "expo-camera",
      { cameraPermission: false, recordAudioAndroid: false },
    ],
    [
      "expo-location",
      { locationWhenInUsePermission: "Sippy Brew uses your location to show coffee shops near you and to save your home and work areas." },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
