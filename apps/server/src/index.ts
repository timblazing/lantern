import { createApp } from "./app"
import { createDb } from "./db/client"
import { SqliteHostStore } from "./store/sqlite-host-store"
import { DemoScanner } from "./scanner/demo-scanner"

const port = Number(process.env.PORT ?? 3000)
const databasePath = process.env.LANTERN_DB_PATH ?? "./data/lantern.db"

const db = createDb(databasePath)
const app = createApp({
  store: new SqliteHostStore(db),
  scanner: new DemoScanner(),
})

const server = Bun.serve({ port, fetch: app.fetch })

console.log(`Lantern server on http://localhost:${server.port} (db: ${databasePath})`)
