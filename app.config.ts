import type { ConfigContext, ExpoConfig } from "@expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Expo Starter",
  slug: "expostarter",
  newArchEnabled: true,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "ltstarter",
  userInterfaceStyle: "dark",
  runtimeVersion: {
    policy: "appVersion",
  },
  splash: {
    image: "./assets/images/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    newArchEnabled: true,
    supportsTablet: true,
    bundleIdentifier: "com.expostarter.base",
    infoPlist: {
      NSCameraUsageDescription: "This app uses the camera to detect your emotions and engagement while learning.",
    },
  },
  android: {
    newArchEnabled: true,
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    package: "com.expostarter.base",
    permissions: ["CAMERA"],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router", 
    "expo-sqlite", 
    "expo-font", 
    "expo-web-browser",
    "expo-secure-store",
    "react-native-fast-tflite",
    [
      "expo-camera",
      {
        cameraPermission: "Allow $(PRODUCT_NAME) to access your camera for emotion detection during learning.",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    baseUrl: "/expo-local-first-template",
  },
  extra: {
    eas: {
      projectId: "",
    },
  },
  owner: "*",
});
