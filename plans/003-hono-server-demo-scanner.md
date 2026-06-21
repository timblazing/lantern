# Plan 003: Stand up the Bun/Hono API server with a scanner adapter interface and demo scanner

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat da4b4cb..HEAD -- apps/server packages/shared`
> This plan assumes Plans 001 and 002 have landed. If `apps/server/package.json`
> or `packages/shared/src/api.ts` does not exist, STOP — those are prerequisites.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (new server package; nothing depends on it yet)
- **Depends on**: plans/001-monorepo-restructure.md, plans/002-shared-zod-schemas.md
- **Category**: tech-debt (foundational backend)
- **Planned at**: commit `da4b4cb`, 2026-06-19

## Why this matters

CONTEXT.md's recommended path (line 53) is "React/Vite UI plus Bun/Hono API
first, demo scanner second." The UI (Plan 005) needs a real API to call, and the
scanner must sit **behind an adapter** (CONTEXT line 32: "keep scanning behind an
adapter so the first implementation can shell out to proven Linux tools and later
implementations can improve internals without changing the API"). This plan
delivers the Hono server, the `Scanner` interface, a `DemoScanner` that returns
seeded fixtures (CONTEXT line 141: "Demo mode with seeded data so the UI can be
developed without a live network scan"), and an in-memory host store. SQLite
(Plan 004) and the real `arp-scan` adapter (Plan 007) slot in behind the same
interfaces without changing routes.

## Current state

After Plans 001–002:

- `apps/server/package.json` — name `@lantern/server`, depends `@lantern/shared` (`workspace:*`), `type: module`. Scripts: `dev` (`bun run --watch src/index.ts`), `build`, `typecheck`. **Hono is not yet a dependency.**
- `apps/server/src/index.ts` — minimal `Bun.serve` placeholder returning a string.
- `apps/server/tsconfig.json` — `moduleResolution: bundler`, `types: ["bun"]`, strict.
- `packages/shared/src/api.ts` — exports `listHostsResponseSchema`, `hostDetailResponseSchema`, `deleteHostsInputSchema`, `scanResultSchema`, `wakeResponseSchema`, `portCheckInputSchema`/`portCheckResponseSchema`, `apiErrorSchema`.
- `packages/shared/src/host.ts` — exports `Host`, `HostHistoryEntry`, `createHostInputSchema`, `updateHostInputSchema`, `macAddressSchema`.

Existing placeholder `apps/server/src/index.ts` (verbatim):

```ts
const port = Number(process.env.PORT ?? 3000)

const server = Bun.serve({
  port,
  fetch() {
    return new Response("Lantern server placeholder — see Plan 003")
  },
})

console.log(`Lantern server listening on http://localhost:${server.port}`)
```

**Conventions**: no semicolons, double quotes, 2-space indent, `printWidth` 80
(`.prettierrc`). Import shared types from `@lantern/shared` (the workspace
package), never by relative path into `packages/shared`. Tests use `bun:test`.

**Architecture intent to honor** (CONTEXT lines 31–32, 40–41):
- Scanner is an adapter; the demo scanner is the first implementation.
- Routes must be organized to accept future Hono middleware (auth later, line 41).

## Commands you will need

| Purpose         | Command                                   | Expected on success            |
|-----------------|-------------------------------------------|--------------------------------|
| Install         | `bun install`                             | exit 0                         |
| Typecheck       | `bun run --cwd apps/server typecheck`     | exit 0                         |
| Run server      | `bun run --cwd apps/server dev`           | logs "listening on ..."        |
| Test            | `bun test apps/server`                    | all pass                       |

## Suggested executor toolkit

- If `context7` docs are available, consult Hono's docs for `Hono`, `app.route`,
  `c.json`, and the `@hono/zod-validator` middleware. The excerpts below are
  sufficient otherwise.

## Scope

**In scope** (create/modify only these):
- `apps/server/package.json` (add `hono`, `@hono/zod-validator`)
- `apps/server/src/index.ts` (replace placeholder; wire Hono app + serve)
- `apps/server/src/app.ts` (create — the Hono app, exported for tests)
- `apps/server/src/scanner/scanner.ts` (create — `Scanner` interface)
- `apps/server/src/scanner/demo-scanner.ts` (create — seeded demo impl)
- `apps/server/src/store/host-store.ts` (create — in-memory store + interface)
- `apps/server/src/routes/hosts.ts` (create — host + scan + action routes)
- `apps/server/src/app.test.ts` (create — route tests)

**Out of scope** (do NOT touch):
- `apps/web` — it consumes this API in Plan 005, not here.
- `packages/shared` — schemas are already defined in Plan 002; if you find one
  genuinely missing, STOP and report rather than adding it here.
- Drizzle/SQLite — Plan 004 replaces the in-memory store behind the same
  `HostStore` interface. Do NOT add a database here.
- Real `arp-scan` / child-process scanning — Plan 007. Only the demo scanner here.
- Static-file serving of the web build — keep a stub (Step 6); production wiring
  is refined when the web build path is finalized.

## Git workflow

- Branch: `advisor/003-hono-server-demo-scanner`.
- Commit per logical unit (scanner, store, routes, wiring, tests).
- Short imperative commit subjects.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add Hono dependencies

```
bun add --cwd apps/server hono @hono/zod-validator
```

**Verify**: `grep -E '"hono"|zod-validator' apps/server/package.json` → both
present; `bun install` exit 0.

### Step 2: Define the `Scanner` adapter interface

Create `apps/server/src/scanner/scanner.ts`:

```ts
import type { Host } from "@lantern/shared"

// A point-in-time observation from a scan, before merge into the store.
export interface ScanObservation {
  mac: string
  ip: string | null
  hostname: string | null
  vendor: string | null
}

// All scanner implementations (demo now, arp-scan later) satisfy this.
export interface Scanner {
  readonly name: string
  scan(): Promise<ScanObservation[]>
}

// Helper consumers may use to know whether a host appeared in a scan.
export type ObservedMacSet = ReadonlySet<string>

export type { Host }
```

**Verify**: `bun run --cwd apps/server typecheck` → exit 0 (will pass fully after
later steps; no syntax errors now).

### Step 3: Implement the demo scanner with seeded fixtures

Create `apps/server/src/scanner/demo-scanner.ts`. It returns a stable set of fake
devices, with a couple randomly toggled offline so the UI shows online/offline
variety on rescan:

```ts
import type { Scanner, ScanObservation } from "./scanner"

const FIXTURES: ScanObservation[] = [
  { mac: "a1:b2:c3:d4:e5:01", ip: "192.168.1.1", hostname: "router.local", vendor: "Ubiquiti" },
  { mac: "a1:b2:c3:d4:e5:02", ip: "192.168.1.10", hostname: "nas.local", vendor: "Synology" },
  { mac: "a1:b2:c3:d4:e5:03", ip: "192.168.1.20", hostname: "desktop.local", vendor: "Intel" },
  { mac: "a1:b2:c3:d4:e5:04", ip: "192.168.1.30", hostname: null, vendor: "Espressif" },
  { mac: "a1:b2:c3:d4:e5:05", ip: "192.168.1.40", hostname: "tv.local", vendor: "Samsung" },
]

export class DemoScanner implements Scanner {
  readonly name = "demo"

  async scan(): Promise<ScanObservation[]> {
    // Always-on devices plus a random subset of the rest, to simulate churn.
    const [router, ...rest] = FIXTURES
    const present = rest.filter(() => Math.random() > 0.25)
    return [router, ...present]
  }
}
```

**Verify**: `bun run --cwd apps/server typecheck` → exit 0.

### Step 4: Implement the in-memory host store behind an interface

Create `apps/server/src/store/host-store.ts`. The interface is what Plan 004 will
re-implement with SQLite. Map `ScanObservation[]` → `Host[]` (assign ids, set
first/last seen, online flags, default `name` to hostname or MAC, `isKnown:
false` for new). Target shape:

```ts
import { randomUUID } from "node:crypto"
import type { Host, HostHistoryEntry } from "@lantern/shared"
import type { ScanObservation } from "../scanner/scanner"

export interface HostStore {
  listHosts(): Promise<Host[]>
  getHost(id: string): Promise<Host | null>
  getHistory(hostId: string): Promise<HostHistoryEntry[]>
  createHost(input: { mac: string; name?: string; ip?: string }): Promise<Host>
  updateHost(id: string, patch: { name?: string; isKnown?: boolean }): Promise<Host | null>
  deleteHosts(ids: string[]): Promise<number>
  // Merge a scan: upsert observed hosts, flip unseen known hosts offline,
  // append history rows on state change. Returns the full host list after merge.
  applyScan(observations: ScanObservation[]): Promise<Host[]>
}

export class InMemoryHostStore implements HostStore {
  private hosts = new Map<string, Host>()
  private history: HostHistoryEntry[] = []

  async listHosts() {
    return [...this.hosts.values()]
  }

  async getHost(id: string) {
    return this.hosts.get(id) ?? null
  }

  async getHistory(hostId: string) {
    return this.history.filter((h) => h.hostId === hostId)
  }

  async createHost(input: { mac: string; name?: string; ip?: string }) {
    const now = new Date().toISOString()
    const host: Host = {
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
    this.hosts.set(host.id, host)
    return host
  }

  async updateHost(id: string, patch: { name?: string; isKnown?: boolean }) {
    const host = this.hosts.get(id)
    if (!host) return null
    const updated = { ...host, ...patch }
    this.hosts.set(id, updated)
    return updated
  }

  async deleteHosts(ids: string[]) {
    let removed = 0
    for (const id of ids) if (this.hosts.delete(id)) removed++
    return removed
  }

  async applyScan(observations: ScanObservation[]) {
    const now = new Date().toISOString()
    const seen = new Set(observations.map((o) => o.mac))
    const byMac = new Map([...this.hosts.values()].map((h) => [h.mac, h]))

    for (const obs of observations) {
      const existing = byMac.get(obs.mac)
      if (existing) {
        if (!existing.isOnline) this.appendHistory(existing.id, true, now)
        this.hosts.set(existing.id, {
          ...existing,
          ip: obs.ip,
          hostname: obs.hostname ?? existing.hostname,
          vendor: obs.vendor ?? existing.vendor,
          isOnline: true,
          lastSeen: now,
        })
      } else {
        const id = randomUUID()
        this.hosts.set(id, {
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
        this.appendHistory(id, true, now)
      }
    }

    for (const host of this.hosts.values()) {
      if (!seen.has(host.mac) && host.isOnline) {
        this.hosts.set(host.id, { ...host, isOnline: false })
        this.appendHistory(host.id, false, now)
      }
    }

    return [...this.hosts.values()]
  }

  private appendHistory(hostId: string, isOnline: boolean, observedAt: string) {
    this.history.push({ id: randomUUID(), hostId, isOnline, observedAt })
  }
}
```

**Verify**: `bun run --cwd apps/server typecheck` → exit 0.

### Step 5: Define the host/scan/action routes

Create `apps/server/src/routes/hosts.ts`. Use Hono + `@hono/zod-validator` with
the shared schemas. Routes (CONTEXT feature inventory + line 192 actions):

- `GET /` → `{ hosts }` (`listHostsResponseSchema`)
- `POST /` → create host (`createHostInputSchema` body)
- `GET /:id` → `{ host, history }` (`hostDetailResponseSchema`), 404 if missing
- `PATCH /:id` → update (`updateHostInputSchema` body)
- `DELETE /` → bulk delete (`deleteHostsInputSchema` body)
- `POST /:id/wake` → `{ sent }` (demo: always `true`; real WoL is later)
- `POST /:id/port-check` → `{ port, open }` (`portCheckInputSchema` body; demo: deterministic stub)

Target shape (abbreviated — implement all routes above following this pattern):

```ts
import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import {
  createHostInputSchema,
  updateHostInputSchema,
  deleteHostsInputSchema,
  portCheckInputSchema,
} from "@lantern/shared"
import type { HostStore } from "../store/host-store"
import type { Scanner } from "../scanner/scanner"

export function createHostRoutes(store: HostStore, scanner: Scanner) {
  const app = new Hono()

  app.get("/", async (c) => c.json({ hosts: await store.listHosts() }))

  app.post("/", zValidator("json", createHostInputSchema), async (c) => {
    const host = await store.createHost(c.req.valid("json"))
    return c.json({ host }, 201)
  })

  app.get("/:id", async (c) => {
    const id = c.req.param("id")
    const host = await store.getHost(id)
    if (!host) return c.json({ error: "host not found" }, 404)
    return c.json({ host, history: await store.getHistory(id) })
  })

  app.patch("/:id", zValidator("json", updateHostInputSchema), async (c) => {
    const host = await store.updateHost(c.req.param("id"), c.req.valid("json"))
    if (!host) return c.json({ error: "host not found" }, 404)
    return c.json({ host })
  })

  app.delete("/", zValidator("json", deleteHostsInputSchema), async (c) => {
    const removed = await store.deleteHosts(c.req.valid("json").ids)
    return c.json({ removed })
  })

  app.post("/:id/wake", async (c) => {
    const host = await store.getHost(c.req.param("id"))
    if (!host) return c.json({ error: "host not found" }, 404)
    return c.json({ sent: true })
  })

  app.post(
    "/:id/port-check",
    zValidator("json", portCheckInputSchema),
    async (c) => {
      const host = await store.getHost(c.req.param("id"))
      if (!host) return c.json({ error: "host not found" }, 404)
      const { port } = c.req.valid("json")
      // Demo stub: pretend common ports are open. Real TCP check is later.
      const open = host.isOnline && [22, 80, 443, 445, 3000].includes(port)
      return c.json({ port, open })
    }
  )

  return app
}
```

**Verify**: `bun run --cwd apps/server typecheck` → exit 0.

### Step 6: Compose the Hono app in `src/app.ts`

Create `apps/server/src/app.ts` — builds the app with `/api` mounting, a health
route, a scan route, and a placeholder for serving the web build. Export it so
tests can import without binding a port:

```ts
import { Hono } from "hono"
import { createHostRoutes } from "./routes/hosts"
import { DemoScanner } from "./scanner/demo-scanner"
import { InMemoryHostStore } from "./store/host-store"
import type { HostStore } from "./store/host-store"
import type { Scanner } from "./scanner/scanner"

export interface AppDeps {
  store: HostStore
  scanner: Scanner
}

export function createApp(deps: AppDeps = {
  store: new InMemoryHostStore(),
  scanner: new DemoScanner(),
}) {
  const { store, scanner } = deps
  const app = new Hono()

  app.get("/api/health", (c) => c.json({ status: "ok", scanner: scanner.name }))

  app.post("/api/scan", async (c) => {
    const observations = await scanner.scan()
    const hosts = await store.applyScan(observations)
    return c.json({ scannedAt: new Date().toISOString(), hosts })
  })

  app.route("/api/hosts", createHostRoutes(store, scanner))

  // Web build is served in production; refined when the build path is finalized.
  app.get("/", (c) => c.text("Lantern API. UI is served from apps/web build."))

  return app
}
```

**Verify**: `bun run --cwd apps/server typecheck` → exit 0.

### Step 7: Wire the entry point in `src/index.ts`

Replace the placeholder `apps/server/src/index.ts`:

```ts
import { createApp } from "./app"

const port = Number(process.env.PORT ?? 3000)
const app = createApp()

const server = Bun.serve({ port, fetch: app.fetch })

console.log(`Lantern server listening on http://localhost:${server.port}`)
```

**Verify**: `bun run --cwd apps/server typecheck` → exit 0.

### Step 8: Smoke-test the running server (manual, optional but recommended)

Start it in the background, hit a couple routes, stop it:

```
bun run --cwd apps/server dev &
sleep 1
curl -s localhost:3000/api/health
curl -s -X POST localhost:3000/api/scan | head -c 200
curl -s localhost:3000/api/hosts | head -c 200
kill %1
```

Expected: health returns `{"status":"ok","scanner":"demo"}`; scan returns a
`scannedAt` + `hosts` array; hosts returns the merged list.

## Test plan

Create `apps/server/src/app.test.ts` using `bun:test` and Hono's
`app.request()` (no port binding). Inject a fresh `InMemoryHostStore` and
`DemoScanner` per test for isolation. Cases:

- `GET /api/health` → 200, body `status: "ok"`.
- `POST /api/scan` → 200, `hosts` non-empty (router fixture is always present).
- `GET /api/hosts` after a scan → 200, returns hosts.
- `POST /api/hosts` with a valid MAC → 201, returns the created host.
- `POST /api/hosts` with an invalid body (`{}`) → 400 (zod-validator rejects).
- `GET /api/hosts/:id` for an unknown id → 404.
- `DELETE /api/hosts` with `{ ids: [createdId] }` → 200, `removed: 1`.

Pattern (model new route tests on this):

```ts
import { test, expect } from "bun:test"
import { createApp } from "./app"
import { InMemoryHostStore } from "./store/host-store"
import { DemoScanner } from "./scanner/demo-scanner"

function appFor() {
  return createApp({ store: new InMemoryHostStore(), scanner: new DemoScanner() })
}

test("health returns ok", async () => {
  const res = await appFor().request("/api/health")
  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ status: "ok" })
})

test("scan then list returns hosts", async () => {
  const app = appFor()
  await app.request("/api/scan", { method: "POST" })
  const res = await app.request("/api/hosts")
  const body = await res.json()
  expect(body.hosts.length).toBeGreaterThan(0)
})

test("creating a host with invalid body is rejected", async () => {
  const res = await appFor().request("/api/hosts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  })
  expect(res.status).toBe(400)
})
```

Verification: `bun test apps/server` → all pass.

## Done criteria

ALL must hold:

- [ ] `hono` and `@hono/zod-validator` are deps in `apps/server/package.json`; `bun install` exit 0.
- [ ] `src/scanner/scanner.ts`, `src/scanner/demo-scanner.ts`, `src/store/host-store.ts`, `src/routes/hosts.ts`, `src/app.ts` exist as specified.
- [ ] `src/index.ts` serves the Hono app via `Bun.serve`.
- [ ] `bun run --cwd apps/server typecheck` exits 0.
- [ ] `bun test apps/server` passes (≥6 test cases green).
- [ ] All host types are imported from `@lantern/shared`, not by relative path into `packages/shared` (`grep -rn "packages/shared" apps/server/src` → no matches).
- [ ] No files outside `apps/server/` were modified (`git status`).
- [ ] `plans/README.md` status row for 003 updated.

## STOP conditions

Stop and report back (do not improvise) if:

- `@lantern/shared` does not resolve (Plan 001/002 incomplete) — do not inline
  the schemas into the server.
- A route needs a shared schema that does not exist in `packages/shared` — STOP
  and report which schema; do not add it to `packages/shared` from this plan.
- `@hono/zod-validator` rejects the Zod v4 schemas with a version-incompatibility
  error — report the versions; do not work around it by removing validation.
- You feel the need to add a database or child-process call to make something
  pass — that is out of scope (Plans 004/007); stop and report.

## Maintenance notes

- The `HostStore` and `Scanner` interfaces are the seams: Plan 004 swaps
  `InMemoryHostStore` for a SQLite-backed store, Plan 007 swaps `DemoScanner`
  for an `ArpScanScanner`. `createApp(deps)` already takes injected deps so
  those swaps are one-line wiring changes in `index.ts`.
- Routes are mounted under `/api/*`, leaving room to insert Hono auth middleware
  later (CONTEXT line 41) without touching route handlers.
- The `wake` and `port-check` routes are demo stubs returning canned results;
  reviewers should not mistake them for working WoL/TCP — real implementations
  are deferred (note them in the index as follow-ups).
- A scheduled-scan loop (CONTEXT line 192 "manual rescan" exists here; scheduled
  scanning per `scanConfig.intervalSeconds`) is intentionally **not** in this
  plan — add it when persistence (Plan 004) exists so history survives restarts.
