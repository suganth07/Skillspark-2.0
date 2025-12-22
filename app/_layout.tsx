import "./global.css";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { type Theme, ThemeProvider } from "@react-navigation/native";
import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PortalHost } from "@/components/primitives/portal";
import { DatabaseProvider } from "@/db/provider";
import { setAndroidNavigationBar } from "@/lib/android-navigation-bar";
import { DARK_THEME, LIGHT_THEME } from "@/lib/constants";
import { useColorScheme } from "@/lib/useColorScheme";
import { getItem, setItem } from "@/lib/storage";
import { useFrameworkReady } from "@/hooks/useFrameworkReady";
import { Inter_400Regular, Inter_600SemiBold, useFonts } from '@expo-google-fonts/inter';
import { useEffect } from "react";
import { Platform } from "react-native";
import { DrizzleStudioDevPlugin } from "@/components/DrizzleStudioDevPlugin";
import { useUserStore } from "@/hooks/stores/useUserStore";
import { useDatabase } from "@/db/provider";



export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before getting the color scheme.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const { db } = useDatabase();
  const initialize = useUserStore((state) => state.initialize);

  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
  });

  useFrameworkReady();

  // Initialize theme from storage on mount
  useEffect(() => {
    const storedTheme = getItem<"light" | "dark">("theme");
    if (storedTheme && storedTheme !== colorScheme) {
      setColorScheme(storedTheme);
      setAndroidNavigationBar(storedTheme);
    } else if (!storedTheme) {
      // If no theme is stored, save the current one
      setItem("theme", colorScheme);
      setAndroidNavigationBar(colorScheme);
    }
  }, []);

  // Persist theme changes to storage
  useEffect(() => {
    const storedTheme = getItem<"light" | "dark">("theme");
    if (storedTheme !== colorScheme) {
      setItem("theme", colorScheme);
      setAndroidNavigationBar(colorScheme);
    }
  }, [colorScheme]);

  // Initialize user store when database is ready
  useEffect(() => {
    if (db) {
      console.log("Database ready, initializing user store...");
      initialize();
    }
  }, [db, initialize]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);


  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        {__DEV__ && Platform.OS !== "web" ? <DrizzleStudioDevPlugin /> : null}
        <ThemeProvider value={colorScheme === "dark" ? DARK_THEME : LIGHT_THEME}>
          <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
          <GestureHandlerRootView style={{ flex: 1 }}>
            <BottomSheetModalProvider>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ title: "SkillSpark", headerShown: false }} />
              </Stack>
            </BottomSheetModalProvider>
          </GestureHandlerRootView>
        </ThemeProvider>
        <PortalHost />
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}