import { type SQLJsDatabase, drizzle } from "drizzle-orm/sql-js";
import initSqlJs, { SqlValue } from "sql.js";
import fs from "node:fs";
import path from "node:path";

import { migrate } from "drizzle-orm/sql-js/migrator";

export let db: SQLJsDatabase;

const run = async () => {
  const dbPath = path.resolve(".", "public/database.sqlite");
  let filebuffer: Buffer | undefined;
  
  // Safe filesystem access with proper error handling
  try {
    const stats = fs.statSync(dbPath);
    if (!stats.isFile()) {
      throw new Error(`EISDIR: Path exists but is not a file: ${dbPath}`);
    }
    filebuffer = fs.readFileSync(dbPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist - this is expected for first run
      console.log(`Database file not found at ${dbPath}, creating new database`);
    } else if ((error as NodeJS.ErrnoException).code === 'EACCES') {
      console.error(`Permission denied accessing database file: ${dbPath}`);
      throw error;
    } else if ((error as NodeJS.ErrnoException).code === 'EISDIR') {
      console.error(`Path is a directory, not a file: ${dbPath}`);
      throw error;
    } else {
      console.error(`Unexpected error reading database file: ${error}`);
      throw error;
    }
  }
  
  const SQL = await initSqlJs();
  const sqldb = filebuffer ? new SQL.Database(filebuffer) : new SQL.Database();
  const database = drizzle(sqldb);
  db = database;

  migrate(db, { migrationsFolder: path.resolve(".", "db/migrations") });

  const data = sqldb.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(path.resolve(".", "public/database.sqlite"), buffer);
};
run().catch(console.log);
