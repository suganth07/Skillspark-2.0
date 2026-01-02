import * as NavigationBar from "expo-navigation-bar";
import { Platform } from "react-native";

export async function setAndroidNavigationBar(theme: "light" | "dark") {
  if (Platform.OS !== "android") return;
  
  try {
    await NavigationBar.setButtonStyleAsync(theme === "dark" ? "light" : "dark");
  } catch (error) {
    // Silently fail if activity is not ready yet (e.g., during hot reload)
    console.warn("Navigation bar update failed:", error);
  }
}
