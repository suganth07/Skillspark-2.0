import type {ExpoSQLiteDatabase} from "drizzle-orm/expo-sqlite";
import type {SQLJsDatabase} from "drizzle-orm/sql-js";
import React, {type PropsWithChildren, useContext, useEffect, useState} from "react";
import {initialize} from "./drizzle";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContextType = {db: any | SQLJsDatabase | ExpoSQLiteDatabase | null}

export const DatabaseContext = React.createContext<ContextType>({db: null});

export const useDatabase = () => useContext(DatabaseContext);


export function DatabaseProvider({children}: PropsWithChildren) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [db, setDb] = useState<any | SQLJsDatabase | ExpoSQLiteDatabase | null>(null);

  useEffect(() => {
    if (db) return
    initialize().then((newDb) => {
      setDb(newDb);
    })

  }, []);

  return (
    <DatabaseContext.Provider value={{db}}>
      {children}
    </DatabaseContext.Provider>
  );
}

