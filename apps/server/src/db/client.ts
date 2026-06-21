import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import * as schema from "./schema"

export type Db = ReturnType<typeof drizzle<typeof schema>>

export function createDb(databasePath: string): Db {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true })
  }
  const sqlite = new Database(databasePath)
  sqlite.exec("PRAGMA foreign_keys = ON;")
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname })
  return db
}
