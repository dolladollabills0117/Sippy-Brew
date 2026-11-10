import type { ExpoConfig } from "expo/config";
// Mirrors packages/core/src/brand.ts (the config loader can't import TS from outside the app).
const colors = { vanillaBean: "#F3E5C7", burntSugar: "#A8642F" } as const;

/**
 * Public config only. Secrets never go here: the Supabase anon key and API URL are read from
 * EAS environment variables (EXPO_PUBLIC_*) at build time, and Stripe / service-role keys
 * never reach the app at all. See README → Mobile apps.
 */
const config: ExpoConfig = {
  name: "Sippy Brew Shop",
  slug: "sippy-brew-shop",
  scheme: "sippybrewshop",
  version: "0.1.0",
  orientation: "default",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  ios: {
    bundleIdentifier: "com.sippybrew.shop",
    supportsTablet: true,
    buildNumber: "1",
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: "com.sippybrew.shop",
    versionCode: 1,
    adaptiveIcon: { foregroundImage: "./assets/icon.png", backgroundColor: colors.vanillaBean },
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
      { cameraPermission: "Sippy Brew Shop uses the camera to scan member pickup QR codes and to photograph your menu.", recordAudioAndroid: false },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Sippy Brew Shop uses your photos so you can add your menu from a picture.",
        cameraPermission: "Sippy Brew Shop uses the camera to photograph your menu.",
        microphonePermission: false,
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
