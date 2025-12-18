import { Platform } from "react-native";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { expoDb } from "@/db/drizzle";

export function DrizzleStudioDevPlugin() {
  // This plugin is not for web; keep this component native-only
  useDrizzleStudio(expoDb);
  return null;
}
