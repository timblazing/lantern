# Plan 004: Replace the in-memory store with SQLite persistence via Drizzle

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat da4b4cb..HEAD -- apps/server`
> This plan assumes Plan 003 has landed. If `apps/server/src/store/host-store.ts`
> does not define a `HostStore` interface, STOP — Plan 003 is a prerequisite.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (introduces migrations and a real data file; bugs here lose data)
- **Depends on**: plans/003-hono-server-demo-scanner.md
- **Category**: tech-debt (foundational persistence)
- **Planned at**: commit `da4b4cb`, 2026-06-19

## Why this matters

CONTEXT.md (lines 38, 162) commits to "SQLite for v1, accessed through Bun SQLite
with Drizzle for schema and migrations." The in-memory store from Plan 003 loses
all hosts and history on restart, which makes online/offline history (a core
feature, CONTEXT line 112) meaningless. This plan adds a Drizzle schema, a
migration, and a `SqliteHostStore` that implements the **same `HostStore`
interface** Plan 003 defined — so routes and tests are unaffected. The demo
scanner and routes don't change; only the store implementation and its wiring do.

## Current state

After Plan 003:

- `apps/server/src/store/host-store.ts` — exports `HostStore` interface and
  `InMemoryHostStore` class. The interface methods are:
  `listHosts`, `getHost`, `getHistory`, `createHost`, `updateHost`,
  `deleteHosts`, `applyScan`. **Match this interface exactly** — the new store
  must be a drop-in.
- `apps/server/src/app.ts` — `createApp(deps)` defaults `store` to
  `new InMemoryHostStore()`. Wiring the SQLite store is a change in
  `src/index.ts` (the entry point), not in `app.ts` (which stays test-friendly
  with injectable deps).
- `apps/server/src/index.ts` — constructs `createApp()` with defaults.
- `packages/shared/src/host.ts` — `Host` and `HostHistoryEntry` shapes (camelCase
  fields, ISO-string timestamps). The DB columns map to these.
- `apps/server/package.json` — has `hono`, `@hono/zod-validator`, `@lantern/shared`.

`Host` fields (from `packages/shared/src/host.ts`): `id, mac, ip, hostname,
vendor, name, isKnown, isOnline, firstSeen, lastSeen`.
`HostHistoryEntry` fields: `id, hostId, isOnline, observedAt`.

**Conventions**: no semicolons, double quotes, 2-space indent. Bun's native
SQLite driver is `bun:sqlite`; Drizzle's adapter is `drizzle-orm/bun-sqlite`.
Timestamps stay ISO strings in the domain layer; store them as TEXT columns so
the mapping is identity (no epoch conversion).

## Commands you will need

| Purpose            | Command                                            | Expected on success        |
|--------------------|----------------------------------------------------|----------------------------|
| Install            | `bun install`                                      | exit 0                     |
| Generate migration | `bun run --cwd apps/server db:generate`            | writes SQL to drizzle dir  |
| Typecheck          | `bun run --cwd apps/server typecheck`              | exit 0                     |
| Test               | `bun test apps/server`                             | all pass                   |

## Suggested executor toolkit

- If `context7` docs are available, consult `drizzle-orm` docs for
  `drizzle-orm/bun-sqlite`, `sqliteTable`, and `drizzle-kit generate`. The
  excerpts below are sufficient otherwise.

## Scope

**In scope** (create/modify only these):
- `apps/server/package.json` (add `drizzle-orm`, dev-dep `drizzle-kit`; add `db:generate` script)
- `apps/server/drizzle.config.ts` (create)
- `apps/server/src/db/schema.ts` (create — Drizzle tables)
- `apps/server/src/db/client.ts` (create — open DB, run migrations)
- `apps/server/src/store/sqlite-host-store.ts` (create — `SqliteHostStore`)
- `apps/server/src/store/sqlite-host-store.test.ts` (create)
- `apps/server/src/index.ts` (modify — wire `SqliteHostStore` from config/env)
- `apps/server/drizzle/` (generated migration output — committed)

**Out of scope** (do NOT touch):
- `apps/server/src/store/host-store.ts` — the `HostStore` interface and
  `InMemoryHostStore` stay (the latter is still used by route tests in Plan 003).
- `apps/server/src/app.ts`, `src/routes/*`, `src/scanner/*` — no changes; the
  store swap is transparent to them.
- `packages/shared` — the `Host`/`HostHistoryEntry` shapes are fixed.
- PostgreSQL — CONTEXT line 38 is "SQLite for v1." Do NOT add a Postgres path.

## Git workflow

- Branch: `advisor/004-sqlite-drizzle-persistence`.
- Commit the generated migration SQL alongside the schema that produced it.
- Short imperative commit subjects.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add Drizzle dependencies and a generate script

```
bun add --cwd apps/server drizzle-orm
bun add --cwd apps/server --dev drizzle-kit
```

Add to `apps/server/package.json` scripts:
`"db:generate": "drizzle-kit generate"`.

**Verify**: `grep -E 'drizzle-orm|drizzle-kit|db:generate' apps/server/package.json`
→ all present; `bun install` exit 0.

### Step 2: Define the Drizzle schema

Create `apps/server/src/db/schema.ts`. Columns map 1:1 to the domain shapes;
booleans are stored as integers (Drizzle `mode: "boolean"`), timestamps as TEXT:

```ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

export const hosts = sqliteTable("hosts", {
  id: text("id").primaryKey(),
  mac: text("mac").notNull().unique(),
  ip: text("ip"),
  hostname: text("hostname"),
  vendor: text("vendor"),
  name: text("name").notNull(),
  isKnown: integer("is_known", { mode: "boolean" }).notNull().default(false),
  isOnline: integer("is_online", { mode: "boolean" }).notNull().default(false),
  firstSeen: text("first_seen").notNull(),
  lastSeen: text("last_seen").notNull(),
})

export const hostHistory = sqliteTable("host_history", {
  id: text("id").primaryKey(),
  hostId: text("host_id")
    .notNull()
    .references(() => hosts.id, { onDelete: "cascade" }),
  isOnline: integer("is_online", { mode: "boolean" }).notNull(),
  observedAt: text("observed_at").notNull(),
})

export type HostRow = typeof hosts.$inferSelect
export type HostHistoryRow = typeof hostHistory.$inferSelect
```

**Verify**: `bun run --cwd apps/server typecheck` → exit 0.

### Step 3: Add the drizzle-kit config and generate the first migration

Create `apps/server/drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
})
```

Generate the migration:

```
bun run --cwd apps/server db:generate
```

**Verify**: `ls apps/server/drizzle/*.sql` → at least one `.sql` file exists
containing `CREATE TABLE \`hosts\`` and `CREATE TABLE \`host_history\``.

### Step 4: Create the DB client that opens the file and runs migrations

Create `apps/server/src/db/client.ts`. Use `bun:sqlite` + `drizzle-orm/bun-sqlite`
and apply migrations on startup with the Bun-sqlite migrator. Support `:memory:`
for tests:

```ts
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
```

> If the migrations-folder URL resolution fails at runtime (path not found),
> fall back to a relative `"./drizzle"` from the server working directory and
> note the change. Do not skip running migrations.

**Verify**: `bun run --cwd apps/server typecheck` → exit 0.

### Step 5: Implement `SqliteHostStore` against the `HostStore` interface

Create `apps/server/src/store/sqlite-host-store.ts`. It must implement the exact
`HostStore` interface from `host-store.ts`. Map rows ↔ domain objects (the
column/field shapes already align thanks to Drizzle `mode: "boolean"`). Port the
`applyScan` merge logic from `InMemoryHostStore` (Plan 003) to SQL operations:
upsert observed hosts, append history on state change, flip unseen online hosts
offline. Target shape (abbreviated — implement all interface methods):

```ts
import { randomUUID } from "node:crypto"
import { eq, inArray } from "drizzle-orm"
import type { Host, HostHistoryEntry } from "@lantern/shared"
import type { HostStore } from "./host-store"
import type { ScanObservation } from "../scanner/scanner"
import type { Db } from "../db/client"
import { hosts, hostHistory, type HostRow } from "../db/schema"

function toHost(row: HostRow): Host {
  return {
    id: row.id,
    mac: row.mac,
    ip: row.ip,
    hostname: row.hostname,
    vendor: row.vendor,
    name: row.name,
    isKnown: row.isKnown,
    isOnline: row.isOnline,
    firstSeen: row.firstSeen,
    lastSeen: row.lastSeen,
  }
}

export class SqliteHostStore implements HostStore {
  constructor(private db: Db) {}

  async listHosts(): Promise<Host[]> {
    return (await this.db.select().from(hosts)).map(toHost)
  }

  async getHost(id: string): Promise<Host | null> {
    const row = (await this.db.select().from(hosts).where(eq(hosts.id, id)))[0]
    return row ? toHost(row) : null
  }

  async getHistory(hostId: string): Promise<HostHistoryEntry[]> {
    const rows = await this.db
      .select()
      .from(hostHistory)
      .where(eq(hostHistory.hostId, hostId))
    return rows.map((r) => ({
      id: r.id,
      hostId: r.hostId,
      isOnline: r.isOnline,
      observedAt: r.observedAt,
    }))
  }

  async createHost(input: { mac: string; name?: string; ip?: string }): Promise<Host> {
    const now = new Date().toISOString()
    const row = {
      id: randomUUID(),
      mac: input.mac,
      ip: input.ip ?? null,
      hostname: null,
      vendor: null,
      name: input.name ?? input.mac,
      isKnown: true,
      isOnline: false,
      firstSeen: now,
      lastSeen: now,
    }
    await this.db.insert(hosts).values(row)
    return toHost(row as HostRow)
  }

  async updateHost(id: string, patch: { name?: string; isKnown?: boolean }): Promise<Host | null> {
    const existing = await this.getHost(id)
    if (!existing) return null
    await this.db.update(hosts).set(patch).where(eq(hosts.id, id))
    return { ...existing, ...patch }
  }

  async deleteHosts(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0
    const result = await this.db.delete(hosts).where(inArray(hosts.id, ids))
    // bun-sqlite returns { changes }; fall back to ids.length if unavailable.
    return (result as unknown as { changes?: number }).changes ?? ids.length
  }

  async applyScan(observations: ScanObservation[]): Promise<Host[]> {
    const now = new Date().toISOString()
    const seen = new Set(observations.map((o) => o.mac))
    const current = await this.listHosts()
    const byMac = new Map(current.map((h) => [h.mac, h]))

    for (const obs of observations) {
      const existing = byMac.get(obs.mac)
      if (existing) {
        if (!existing.isOnline) await this.appendHistory(existing.id, true, now)
        await this.db
          .update(hosts)
          .set({
            ip: obs.ip,
            hostname: obs.hostname ?? existing.hostname,
            vendor: obs.vendor ?? existing.vendor,
            isOnline: true,
            lastSeen: now,
          })
          .where(eq(hosts.id, existing.id))
      } else {
        const id = randomUUID()
        await this.db.insert(hosts).values({
          id,
          mac: obs.mac,
          ip: obs.ip,
          hostname: obs.hostname,
          vendor: obs.vendor,
          name: obs.hostname ?? obs.mac,
          isKnown: false,
          isOnline: true,
          firstSeen: now,
          lastSeen: now,
        })
        await this.appendHistory(id, true, now)
      }
    }

    for (const host of current) {
      if (!seen.has(host.mac) && host.isOnline) {
        await this.db.update(hosts).set({ isOnline: false }).where(eq(hosts.id, host.id))
        await this.appendHistory(host.id, false, now)
      }
    }

    return this.listHosts()
  }

  private async appendHistory(hostId: string, isOnline: boolean, observedAt: string) {
    await this.db.insert(hostHistory).values({ id: randomUUID(), hostId, isOnline, observedAt })
  }
}
```

**Verify**: `bun run --cwd apps/server typecheck` → exit 0.

### Step 6: Wire the SQLite store into the entry point

Modify `apps/server/src/index.ts` to build a `SqliteHostStore` from a configurable
DB path (env override `LANTERN_DB_PATH`, default `./data/lantern.db`) and pass it
into `createApp`. Keep the demo scanner default (real scanner is Plan 007):

```ts
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
```

**Verify**: `bun run --cwd apps/server typecheck` → exit 0.

### Step 7: Smoke-test persistence (manual, recommended)

```
LANTERN_DB_PATH=./data/lantern.db bun run --cwd apps/server dev &
sleep 1
curl -s -X POST localhost:3000/api/scan > /dev/null
curl -s localhost:3000/api/hosts | head -c 120
kill %1
# Restart and confirm hosts persisted:
LANTERN_DB_PATH=./data/lantern.db bun run --cwd apps/server dev &
sleep 1
curl -s localhost:3000/api/hosts | head -c 120   # should still list hosts
kill %1
```

Expected: hosts listed after the second start (proves persistence). The `./data`
dir is gitignored (Plan 001); delete `./data/lantern.db` after the smoke test if
you want a clean tree.

## Test plan

Create `apps/server/src/store/sqlite-host-store.test.ts` using an in-memory DB so
tests are isolated and leave no files. Model on the Plan 003 test style
(`bun:test`). A helper builds a migrated `:memory:` store:

```ts
import { test, expect } from "bun:test"
import { createDb } from "../db/client"
import { SqliteHostStore } from "./sqlite-host-store"

function freshStore() {
  return new SqliteHostStore(createDb(":memory:"))
}

test("applyScan inserts new hosts as unknown+online", async () => {
  const store = freshStore()
  const hosts = await store.applyScan([
    { mac: "a1:b2:c3:d4:e5:01", ip: "10.0.0.1", hostname: "r", vendor: "v" },
  ])
  expect(hosts).toHaveLength(1)
  expect(hosts[0].isOnline).toBe(true)
  expect(hosts[0].isKnown).toBe(false)
})

test("a host unseen in the next scan goes offline and records history", async () => {
  const store = freshStore()
  await store.applyScan([{ mac: "a1:b2:c3:d4:e5:01", ip: null, hostname: null, vendor: null }])
  const [host] = await store.listHosts()
  await store.applyScan([]) // nothing seen
  const after = await store.getHost(host.id)
  expect(after?.isOnline).toBe(false)
  const history = await store.getHistory(host.id)
  expect(history.length).toBeGreaterThanOrEqual(2) // online then offline
})

test("createHost then deleteHosts removes it", async () => {
  const store = freshStore()
  const host = await store.createHost({ mac: "a1:b2:c3:d4:e5:09", name: "x" })
  expect(await store.deleteHosts([host.id])).toBe(1)
  expect(await store.getHost(host.id)).toBeNull()
})
```

Cases to cover: insert-new, re-scan-updates, unseen-goes-offline + history,
create/update/delete, cascade delete of history (deleting a host removes its
history rows — assert `getHistory` is empty after delete).

Verification: `bun test apps/server` → all pass (Plan 003 route tests + these
new store tests).

## Done criteria

ALL must hold:

- [ ] `drizzle-orm` (dep) and `drizzle-kit` (dev-dep) in `apps/server/package.json`; `bun install` exit 0.
- [ ] `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`, `src/store/sqlite-host-store.ts` exist.
- [ ] `apps/server/drizzle/` contains a generated `.sql` migration creating both tables (committed).
- [ ] `src/index.ts` constructs a `SqliteHostStore`; `LANTERN_DB_PATH` env override works.
- [ ] `bun run --cwd apps/server typecheck` exits 0.
- [ ] `bun test apps/server` passes, including ≥4 new store tests and the existing route tests.
- [ ] `SqliteHostStore` implements the unchanged `HostStore` interface (`grep -n "implements HostStore" apps/server/src/store/sqlite-host-store.ts`).
- [ ] `host-store.ts`, `app.ts`, `routes/`, `scanner/` are unchanged (`git diff --stat` shows only in-scope files).
- [ ] `plans/README.md` status row for 004 updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The `HostStore` interface in `host-store.ts` differs from the methods listed in
  "Current state" (Plan 003 drifted) — reconcile before implementing, do not
  guess method signatures.
- `drizzle-kit generate` produces no migration or errors on the schema — report
  the exact output; do not hand-write the migration SQL as a workaround unless
  you confirm the generated file is simply missing a table.
- `migrate()` fails at runtime with a path error you cannot resolve with the
  documented fallback — report it; do not disable migrations.
- bun-sqlite's delete result shape makes `deleteHosts` return wrong counts and a
  test fails — report it rather than loosening the assertion.

## Maintenance notes

- History retention/trimming (CONTEXT line 112, `historyRetentionDays` in the
  shared `storageConfig`) is **not** implemented here — it's a follow-up: a
  periodic delete of `host_history` rows older than N days. Note it in the index.
- When Plan 007 adds the real scanner, only `src/index.ts` changes (swap
  `DemoScanner`); the store is untouched.
- Reviewers should confirm migrations are committed and that `:memory:` is used
  in tests (no stray `.db` files in the diff).
- Future schema changes go through `db:generate` → new migration file; never
  edit an already-committed migration.
- If/when scheduled scanning lands, it calls `store.applyScan` on an interval;
  the merge logic here is the single source of online/offline truth.
