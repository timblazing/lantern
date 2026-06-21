# Plan 002: Define the shared Zod domain schemas and API contract in packages/shared

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat da4b4cb..HEAD -- packages/shared`
> This plan assumes Plan 001 has landed (the `packages/shared` workspace
> exists). If `packages/shared/package.json` does not exist, STOP — Plan 001 is
> a prerequisite.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (new package, nothing consumes it yet)
- **Depends on**: plans/001-monorepo-restructure.md
- **Category**: tech-debt (foundational contract)
- **Planned at**: commit `da4b4cb`, 2026-06-19

## Why this matters

CONTEXT.md (lines 39, 159) makes Zod-first shared schemas the **single source of
truth** for domain models and API contracts: "Freeze the target feature set in
README and Zod shared schemas." Both `apps/server` (validation, persistence
mapping) and `apps/web` (typed client, forms) consume these types. Defining them
once here prevents the server and UI from drifting into two incompatible idea of
what a "Host" is. This plan produces no behavior — it produces the vocabulary
every later plan is written against.

## Current state

After Plan 001, `packages/shared` is a minimal workspace package:

- `packages/shared/package.json` — name `@lantern/shared`, `main`/`types`/`exports` all point at `./src/index.ts`, `type: module`.
- `packages/shared/src/index.ts` — contains only `export {}`.
- `packages/shared/tsconfig.json` — `moduleResolution: bundler`, `strict: true`.

**Zod is not yet a dependency.** This plan adds it.

**Domain vocabulary to model** — derived directly from CONTEXT.md's "Upstream
Feature Inventory" (lines 101–121) and "Feature Recommendations" (124–141). The
fields below map to real WatchYourLAN host concepts modernized for Lantern:

- A **Host** is a device seen on the network, keyed by MAC address. It tracks
  current online state (`isOnline`), known/unknown status, an editable display
  name, vendor, hostname/DNS, IP, and first/last-seen timestamps.
- **Host history** records online/offline transitions over time (CONTEXT line 112: "Store host online/offline history").
- **Config** covers scan settings, storage, and notifications (CONTEXT lines 191–192).
- **Actions**: manual rescan, Wake-on-LAN, TCP port check, notification test (CONTEXT line 192).

**Repo conventions** (from `.prettierrc`): no semicolons, double quotes,
2-space indent, `printWidth` 80, ES5 trailing commas. Match exactly.

**Naming convention**: use `camelCase` field names in TypeScript/JSON (the UI and
API speak JSON). The SQLite column mapping to snake_case is Plan 004's concern,
not this package's.

## Commands you will need

| Purpose         | Command                                              | Expected on success |
|-----------------|------------------------------------------------------|---------------------|
| Install         | `bun install`                                        | exit 0              |
| Typecheck       | `bun run --cwd packages/shared typecheck`            | exit 0, no errors   |
| Run shared test | `bun test packages/shared`                           | all pass            |

Lantern uses **Bun's built-in test runner** (`bun test`) — there is no Jest or
Vitest. Tests are `*.test.ts` files colocated in `src`.

## Suggested executor toolkit

- If a `context7` documentation tool is available, you may consult current Zod
  docs for `z.infer`, `z.iso.datetime()`, and `.brand()` usage. Otherwise the
  excerpts in this plan are sufficient — do not block on docs.

## Scope

**In scope** (create/modify only these):
- `packages/shared/package.json` (add `zod` dependency).
- `packages/shared/src/host.ts` (create)
- `packages/shared/src/config.ts` (create)
- `packages/shared/src/api.ts` (create)
- `packages/shared/src/index.ts` (replace placeholder with re-exports)
- `packages/shared/src/host.test.ts` (create)
- `packages/shared/src/config.test.ts` (create)

**Out of scope** (do NOT touch):
- `apps/server` and `apps/web` — they start consuming these types in Plans 003/005, not here.
- Any database/Drizzle code — Plan 004 maps these schemas to columns; this package stays persistence-agnostic.
- Do NOT add OpenAPI generation — CONTEXT.md line 39 explicitly defers it ("generate OpenAPI later").

## Git workflow

- Branch: `advisor/002-shared-zod-schemas`.
- One commit is fine (single cohesive package); or commit per file group.
- Commit message style: short imperative subject.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add Zod to the shared package

Add `zod` to `packages/shared/package.json` dependencies (use Zod v4):

```
bun add --cwd packages/shared zod
```

**Verify**: `grep zod packages/shared/package.json` → shows a `"zod"` entry;
`bun install` exit 0.

### Step 2: Define host schemas in `src/host.ts`

Create `packages/shared/src/host.ts`. Use ISO 8601 strings for timestamps (JSON-
friendly; the DB layer converts). Target shape:

```ts
import { z } from "zod"

// A MAC address, normalized lower-case colon-separated, e.g. "a1:b2:c3:d4:e5:f6".
export const macAddressSchema = z
  .string()
  .regex(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/, "must be a lower-case MAC address")

export const hostSchema = z.object({
  id: z.string(),
  mac: macAddressSchema,
  ip: z.string().nullable(),
  hostname: z.string().nullable(),
  vendor: z.string().nullable(),
  // User-editable display name / alias.
  name: z.string(),
  // Marked known by the user (vs newly-discovered unknown device).
  isKnown: z.boolean(),
  // Currently seen online by the latest scan.
  isOnline: z.boolean(),
  firstSeen: z.iso.datetime(),
  lastSeen: z.iso.datetime(),
})
export type Host = z.infer<typeof hostSchema>

// One online/offline transition for a host.
export const hostHistoryEntrySchema = z.object({
  id: z.string(),
  hostId: z.string(),
  isOnline: z.boolean(),
  observedAt: z.iso.datetime(),
})
export type HostHistoryEntry = z.infer<typeof hostHistoryEntrySchema>

// Payload to manually create a host (CONTEXT line 110: add hosts by MAC).
export const createHostInputSchema = z.object({
  mac: macAddressSchema,
  name: z.string().min(1).optional(),
  ip: z.string().optional(),
})
export type CreateHostInput = z.infer<typeof createHostInputSchema>

// Editable fields (CONTEXT line 109: edit display names / known status).
export const updateHostInputSchema = z.object({
  name: z.string().min(1).optional(),
  isKnown: z.boolean().optional(),
})
export type UpdateHostInput = z.infer<typeof updateHostInputSchema>
```

> Note on `z.iso.datetime()`: this is Zod v4 syntax. If `bun add zod` resolved a
> version where `z.iso` is undefined (you will see a typecheck error), use
> `z.string().datetime()` instead and record the substitution in your status
> note. Do not invent a different timestamp representation.

**Verify**: `bun run --cwd packages/shared typecheck` → exit 0 (after Step 5
wires the index; for now confirm no syntax errors with the same command — it may
report only the unused-export state, which is fine).

### Step 3: Define config schemas in `src/config.ts`

Create `packages/shared/src/config.ts`. This mirrors CONTEXT's config surface
(scan settings, storage, notifications). Target shape:

```ts
import { z } from "zod"

export const scanConfigSchema = z.object({
  // Network interfaces / arp-scan targets. Empty = demo mode (no real scan).
  interfaces: z.array(z.string()).default([]),
  // Seconds between scheduled scans.
  intervalSeconds: z.number().int().positive().default(300),
  // Optional raw arp-scan args (CONTEXT line 107: custom arp-scan arguments).
  arpScanArgs: z.array(z.string()).default([]),
})
export type ScanConfig = z.infer<typeof scanConfigSchema>

export const storageConfigSchema = z.object({
  // Path to the SQLite database file (mounted data dir in container).
  databasePath: z.string().default("./data/lantern.db"),
  // Days of host history to retain (CONTEXT line 112: trim old history by age).
  historyRetentionDays: z.number().int().positive().default(30),
})
export type StorageConfig = z.infer<typeof storageConfigSchema>

export const notificationConfigSchema = z.object({
  // Generic webhook / Shoutrrr-style URL; empty disables notifications.
  url: z.string().default(""),
  notifyOnNewHost: z.boolean().default(true),
  notifyOnHostOffline: z.boolean().default(false),
})
export type NotificationConfig = z.infer<typeof notificationConfigSchema>

export const appConfigSchema = z.object({
  scan: scanConfigSchema.default({}),
  storage: storageConfigSchema.default({}),
  notifications: notificationConfigSchema.default({}),
})
export type AppConfig = z.infer<typeof appConfigSchema>
```

**Verify**: `bun run --cwd packages/shared typecheck` → exit 0.

### Step 4: Define API request/response contracts in `src/api.ts`

Create `packages/shared/src/api.ts`. These wrap the domain schemas as the
HTTP contract the server (Plan 003) and client (Plan 005) share. Target shape:

```ts
import { z } from "zod"
import { hostSchema, hostHistoryEntrySchema } from "./host"

// GET /api/hosts
export const listHostsResponseSchema = z.object({
  hosts: z.array(hostSchema),
})
export type ListHostsResponse = z.infer<typeof listHostsResponseSchema>

// GET /api/hosts/:id
export const hostDetailResponseSchema = z.object({
  host: hostSchema,
  history: z.array(hostHistoryEntrySchema),
})
export type HostDetailResponse = z.infer<typeof hostDetailResponseSchema>

// DELETE /api/hosts (bulk) — body
export const deleteHostsInputSchema = z.object({
  ids: z.array(z.string()).min(1),
})
export type DeleteHostsInput = z.infer<typeof deleteHostsInputSchema>

// POST /api/scan — triggers a rescan; returns hosts seen.
export const scanResultSchema = z.object({
  scannedAt: z.iso.datetime(),
  hosts: z.array(hostSchema),
})
export type ScanResult = z.infer<typeof scanResultSchema>

// POST /api/hosts/:id/wake — Wake-on-LAN
export const wakeResponseSchema = z.object({ sent: z.boolean() })
export type WakeResponse = z.infer<typeof wakeResponseSchema>

// POST /api/hosts/:id/port-check — body + response
export const portCheckInputSchema = z.object({
  port: z.number().int().min(1).max(65535),
})
export type PortCheckInput = z.infer<typeof portCheckInputSchema>

export const portCheckResponseSchema = z.object({
  port: z.number().int(),
  open: z.boolean(),
})
export type PortCheckResponse = z.infer<typeof portCheckResponseSchema>

// Generic error envelope for non-2xx responses.
export const apiErrorSchema = z.object({
  error: z.string(),
  details: z.unknown().optional(),
})
export type ApiError = z.infer<typeof apiErrorSchema>
```

(If you substituted `z.string().datetime()` in Step 2, use the same form here.)

**Verify**: `bun run --cwd packages/shared typecheck` → exit 0.

### Step 5: Re-export everything from `src/index.ts`

Replace the placeholder `packages/shared/src/index.ts` with:

```ts
export * from "./host"
export * from "./config"
export * from "./api"
```

**Verify**: `bun run --cwd packages/shared typecheck` → exit 0.

### Step 6: Write schema tests

Create `packages/shared/src/host.test.ts` — model the structure on Bun's test
API (`import { test, expect } from "bun:test"`):

```ts
import { test, expect } from "bun:test"
import { hostSchema, macAddressSchema, createHostInputSchema } from "./host"

test("hostSchema accepts a valid host", () => {
  const result = hostSchema.safeParse({
    id: "h1",
    mac: "a1:b2:c3:d4:e5:f6",
    ip: "192.168.1.10",
    hostname: "nas.local",
    vendor: "Synology",
    name: "NAS",
    isKnown: true,
    isOnline: true,
    firstSeen: "2026-06-19T00:00:00.000Z",
    lastSeen: "2026-06-19T01:00:00.000Z",
  })
  expect(result.success).toBe(true)
})

test("macAddressSchema rejects upper-case and malformed MACs", () => {
  expect(macAddressSchema.safeParse("A1:B2:C3:D4:E5:F6").success).toBe(false)
  expect(macAddressSchema.safeParse("not-a-mac").success).toBe(false)
})

test("createHostInputSchema requires a MAC", () => {
  expect(createHostInputSchema.safeParse({}).success).toBe(false)
  expect(
    createHostInputSchema.safeParse({ mac: "a1:b2:c3:d4:e5:f6" }).success
  ).toBe(true)
})
```

Create `packages/shared/src/config.test.ts`:

```ts
import { test, expect } from "bun:test"
import { appConfigSchema } from "./config"

test("appConfigSchema fills defaults from an empty object", () => {
  const cfg = appConfigSchema.parse({})
  expect(cfg.scan.intervalSeconds).toBe(300)
  expect(cfg.storage.databasePath).toBe("./data/lantern.db")
  expect(cfg.notifications.notifyOnNewHost).toBe(true)
})
```

**Verify**: `bun test packages/shared` → all tests pass (5 assertions across
3+ test cases).

## Test plan

- New tests: `packages/shared/src/host.test.ts` (valid host, MAC validation,
  create-input requiredness) and `packages/shared/src/config.test.ts` (default
  filling). These are the first tests in the repo — they also prove `bun test`
  works in a workspace package.
- Pattern: Bun test runner (`bun:test`), colocated `*.test.ts`. There is no
  existing test to model on; this plan establishes the pattern for the repo.
- Verification: `bun test packages/shared` → all pass.

## Done criteria

ALL must hold:

- [ ] `zod` is a dependency in `packages/shared/package.json` and `bun install` exits 0.
- [ ] `src/host.ts`, `src/config.ts`, `src/api.ts` exist and export the schemas + inferred types listed above.
- [ ] `src/index.ts` re-exports all three modules.
- [ ] `bun run --cwd packages/shared typecheck` exits 0.
- [ ] `bun test packages/shared` passes (≥3 test cases, all green).
- [ ] No files outside `packages/shared/` were modified (`git status`).
- [ ] `plans/README.md` status row for 002 updated.

## STOP conditions

Stop and report back (do not improvise) if:

- `packages/shared` does not exist (Plan 001 has not landed) — do not recreate it here.
- `z.iso.datetime()` is unavailable AND `z.string().datetime()` also fails to
  typecheck (signals a Zod version far from v4 — report the installed version).
- A reasonable reading of CONTEXT.md suggests a domain field is missing that the
  server/UI will clearly need (e.g. tags, notes) — note it in your report rather
  than guessing the shape; this contract is meant to be reviewed before
  consumers depend on it.

## Maintenance notes

- This package is the contract. Any future field addition (tags, groups, notes —
  CONTEXT lines 129–130) should land here first, then in the server mapping
  (Plan 004) and UI (Plan 005).
- Keep these schemas **persistence-agnostic**: no Drizzle imports, no SQL types.
  The DB layer maps to/from these in Plan 004.
- Reviewer should sanity-check field names against CONTEXT.md's feature inventory
  and confirm timestamps are ISO strings (not numbers), since the JSON API and
  SQLite text columns both rely on that.
- When the route surface stabilizes, this is the package OpenAPI generation would
  hang off of (CONTEXT line 39) — deliberately deferred.
