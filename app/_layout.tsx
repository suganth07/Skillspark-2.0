import "./global.css";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { type Theme, ThemeProvider } from "@react-navigation/native";
import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PortalHost } from "@/components/primitives/portal";
import { DatabaseProvider, useDatabase } from "@/db/provider";
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

// Component to handle user initialization inside DatabaseProvider
function AppInitializer({ children, onReady }: { children: React.ReactNode; onReady: () => void }) {
  const { db } = useDatabase();
  const { initialize, isLoading: userLoading, isInitialized } = useUserStore();

  useEffect(() => {
    if (db && !isInitialized) {
      console.log("Database ready, initializing user store...");
      initialize().then(() => {
        console.log("User store initialized, calling onReady");
        onReady();
      }).catch((error) => {
        console.error("Failed to initialize user store:", error);
        onReady(); // Still hide splash on error
      });
    } else if (isInitialized) {
      onReady();
    }
  }, [db, isInitialized, initialize, onReady]);

  return <>{children}</>;
}



export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [appReady, setAppReady] = React.useState(false);

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

  // Hide splash screen only when both fonts and app are ready
  useEffect(() => {
    if (loaded && appReady) {
      console.log("App ready: fonts and user loaded, hiding splash screen");
      SplashScreen.hideAsync();
    }
  }, [loaded, appReady]);


  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <AppInitializer onReady={() => setAppReady(true)}>
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
        </AppInitializer>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}