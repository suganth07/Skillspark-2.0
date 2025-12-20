import { type ExpoSQLiteDatabase, drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import type { SQLJsDatabase } from "drizzle-orm/sql-js";

import migrations from "./migrations/migrations";

import * as schema from "./schema";

export const expoDb = openDatabaseSync("database.db", { enableChangeListener: true });
export const db = drizzle(expoDb, { schema });

// Run migrations automatically when initializing
export const initialize = async (): Promise<{ db: typeof db; migrationSuccess: boolean }> => {
  try {
    console.log("Running database migrations...");
    await migrate(db, migrations);
    console.log("Database migrations completed successfully");
    return { db, migrationSuccess: true };
  } catch (error) {
    console.error("Database migration failed:", error);
    // Still return db even if migrations fail (they might already be applied)
     return { db, migrationSuccess: false };
  }
};

export const useMigrationHelper = () => {
  return useMigrations(db, migrations);
};
