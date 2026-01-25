import { type ExpoSQLiteDatabase, drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import type { SQLJsDatabase } from "drizzle-orm/sql-js";

import migrations from "./migrations/migrations.js";

import * as schema from "./schema";

export const expoDb = openDatabaseSync("database.db", { enableChangeListener: true });
export const db = drizzle(expoDb, { schema });

// Run migrations automatically when initializing
export const initialize = async (): Promise<{ db: typeof db; migrationSuccess: boolean }> => {
  try {
    console.log("[DB] Starting database initialization...");
    console.log("[DB] Running migrations...");
    
    await migrate(db, migrations);
    
    console.log("[DB] Database migrations completed successfully");
    return { db, migrationSuccess: true };
  } catch (error: any) {
    console.error("[DB] Database migration error:", error);
    console.error("[DB] Error message:", error?.message);
    console.error("[DB] Error cause:", error?.cause?.message);
    
    // Check if error is due to tables already existing
    if (error?.message?.includes("already exists") || error?.cause?.message?.includes("already exists")) {
      console.log("[DB] Tables already exist, migrations previously applied");
      return { db, migrationSuccess: true };
    }
    
    // For other errors, still return db but mark migrations as failed
    console.warn("[DB] Continuing with database despite migration error");
    return { db, migrationSuccess: false };
  }
};

export const useMigrationHelper = () => {
  return useMigrations(db, migrations);
};
