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

  useEffect(() => {
    if (isInitialized) return;
    
    console.log("[DatabaseProvider] Initializing database...");
    initialize()
      .then((result) => {
        console.log("[DatabaseProvider] Database initialized, migrations:", result.migrationSuccess ? "SUCCESS" : "FAILED");
        setDb(result.db);
        setIsInitialized(true);
      })
      .catch((error) => {
        console.error("[DatabaseProvider] Failed to initialize database:", error);
        setIsInitialized(true); // Still mark as initialized to prevent infinite retry
      });
  }, [isInitialized]);

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

