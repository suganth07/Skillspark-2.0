import type {ExpoSQLiteDatabase} from "drizzle-orm/expo-sqlite";
import type {SQLJsDatabase} from "drizzle-orm/sql-js";
import React, {type PropsWithChildren, useContext, useEffect, useState} from "react";
import {View, ActivityIndicator, Text} from "react-native";
import {initialize} from "./drizzle";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContextType = {db: any | SQLJsDatabase | ExpoSQLiteDatabase | null}

export const DatabaseContext = React.createContext<ContextType>({db: null});

export const useDatabase = () => useContext(DatabaseContext);


export function DatabaseProvider({children}: PropsWithChildren) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [db, setDb] = useState<any | SQLJsDatabase | ExpoSQLiteDatabase | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    if (isInitialized) return;
    
    console.log("[DatabaseProvider] Initializing database...");
    initialize()
      .then((result) => {
        console.log("[DatabaseProvider] Database initialized successfully");
        console.log("[DatabaseProvider] Migration status:", result.migrationSuccess ? "✅ SUCCESS" : "❌ FAILED");
        
        if (!result.migrationSuccess) {
          setInitError("Database migrations failed. Please reinstall the app.");
          setIsInitialized(true);
          return;
        }
        
        setDb(result.db);
        setIsInitialized(true);
      })
      .catch((error) => {
        console.error("[DatabaseProvider] ❌ CRITICAL: Database initialization failed:", error);
        setInitError(error?.message || "Failed to initialize database");
        setIsInitialized(true);
      });
  }, [isInitialized]);

  // Show error screen if database initialization failed
  if (initError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', padding: 20 }}>
        <Text style={{ color: '#ef4444', fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>⚠️ Database Error</Text>
        <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 8 }}>
          Failed to initialize the database
        </Text>
        <Text style={{ color: '#999', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
          {initError}
        </Text>
        <Text style={{ color: '#666', fontSize: 12, textAlign: 'center' }}>
          Please uninstall and reinstall the app.
        </Text>
        <Text style={{ color: '#666', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
          If the problem persists, contact support.
        </Text>
      </View>
    );
  }
  
  // Show loading screen while database is initializing
  if (!isInitialized || !db) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{ color: '#fff', marginTop: 16, fontSize: 16 }}>
          Initializing database...
        </Text>
      </View>
    );
  }

  return (
    <DatabaseContext.Provider value={{db}}>
      {children}
    </DatabaseContext.Provider>
  );
}

