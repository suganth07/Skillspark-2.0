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
    console.log("[DB] Database path:", expoDb.databaseName);
    console.log("[DB] Running migrations...");
    
    // Run migrations synchronously to ensure tables exist before any queries
    await migrate(db, migrations);
    
    console.log("[DB] ✅ Database migrations completed successfully");
    
    // Verify tables exist by running a simple query
    try {
      await db.query.users.findMany({ limit: 1 });
      console.log("[DB] ✅ Database schema verified - tables exist");
    } catch (verifyError: any) {
      console.error("[DB] ❌ Schema verification failed:", verifyError?.message);
      throw new Error(`Database schema verification failed: ${verifyError?.message}`);
    }
    
    return { db, migrationSuccess: true };
  } catch (error: any) {
    console.error("[DB] ❌ Database initialization FAILED");
    console.error("[DB] Error:", error);
    console.error("[DB] Error message:", error?.message);
    console.error("[DB] Error stack:", error?.stack);
    
    // Check if error is due to tables already existing (safe to ignore)
    const errorMsg = error?.message || '';
    const causeMsg = error?.cause?.message || '';
    
    if (errorMsg.includes("already exists") || causeMsg.includes("already exists")) {
      console.log("[DB] ⚠️  Tables already exist, this is safe - continuing");
      return { db, migrationSuccess: true };
    }
    
    // For production, we MUST NOT continue with a broken database
    // This will show the error screen instead of causing random query failures
    console.error("[DB] 🛑 CRITICAL: Cannot continue without database initialization");
    throw error; // Re-throw to prevent app from running with broken DB
  }
};

export const useMigrationHelper = () => {
  return useMigrations(db, migrations);
};
