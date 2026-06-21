# Plan 001: Restructure the repo into a Bun-workspace monorepo (apps/web, apps/server, packages/shared)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat da4b4cb..HEAD -- package.json vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json components.json eslint.config.js .prettierrc index.html src public`
> If any of those changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (moves the working app; a wrong path breaks dev/build)
- **Depends on**: none
- **Category**: tech-debt (foundational restructure)
- **Planned at**: commit `da4b4cb`, 2026-06-19

## Why this matters

Lantern's decided architecture (CONTEXT.md) is a Bun-workspace monorepo with
`apps/web` (Vite UI), `apps/server` (Bun/Hono API), and `packages/shared` (Zod
contracts). Today the Vite app lives at the **repo root**, so there is nowhere
for the server or shared package to go without colliding with the web app's
config. Every later plan (002–007) assumes this layout. Doing the move first,
once, keeps all subsequent plans simple and avoids path churn later.

## Current state

The repo root currently **is** the web app. Relevant files:

- `package.json` — web app manifest (name `lantern`, React 19 + Vite 8 + Tailwind 4 + shadcn deps). Scripts: `dev`, `build`, `lint`, `format`, `typecheck`, `preview`.
- `vite.config.ts` — Vite config with `@` alias → `./src`.
- `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` — TS project references; `@/*` → `./src/*`.
- `components.json` — shadcn config (style `radix-mira`, css `src/index.css`).
- `eslint.config.js` — React-oriented flat config (react-hooks, react-refresh).
- `.prettierrc` — **references `src/index.css`** in `tailwindStylesheet` (this path must be updated when `src` moves).
- `index.html` — Vite entry, loads `/src/main.tsx`.
- `src/` — `main.tsx`, `App.tsx`, `index.css`, `lib/utils.ts`, `components/theme-provider.tsx`, `components/ui/button.tsx`, `assets/`.
- `public/` — `vite.svg`.
- `bun.lock` — Bun lockfile (Bun 1.3.14 is installed; confirmed on PATH).
- `.gitignore`, `.prettierignore`, `CONTEXT.md`, `README.md`, `.agents/` — repo-level, stay at root.

Current root `package.json` (verbatim, abbreviated to scripts):

```jsonc
// package.json
{
  "name": "lantern",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "format": "prettier --write \"**/*.{ts,tsx}\"",
    "typecheck": "tsc --noEmit",
    "preview": "vite preview"
  }
}
```

Current `.prettierrc` (the path that must change is `tailwindStylesheet`):

```jsonc
// .prettierrc
{
  "endOfLine": "lf",
  "semi": false,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80,
  "plugins": ["prettier-plugin-tailwindcss"],
  "tailwindStylesheet": "src/index.css",
  "tailwindFunctions": ["cn", "cva"]
}
```

**Repo conventions to preserve** (from `.prettierrc` / existing source):
- Prettier: no semicolons, double quotes, 2-space indent, `printWidth` 80, ES5 trailing commas. Match this in every file you create.
- The `@` import alias maps to the **web app's** `src` and must keep working after the move.
- Bun is the only package manager (`bun.lock`, no `package-lock.json`/`yarn.lock`). Never run `npm`/`yarn`/`pnpm`.

**Target vocabulary** (CONTEXT.md, lines 26–30): `apps/web`, `apps/server`,
`packages/shared`, `data`. Use these exact directory names.

## Commands you will need

| Purpose          | Command                              | Expected on success            |
|------------------|--------------------------------------|--------------------------------|
| Install (root)   | `bun install`                        | exit 0, resolves workspaces    |
| Web typecheck    | `bun run --cwd apps/web typecheck`   | exit 0, no errors              |
| Web build        | `bun run --cwd apps/web build`       | exit 0, emits `apps/web/dist`  |
| Web lint         | `bun run --cwd apps/web lint`        | exit 0                         |
| Web dev (manual) | `bun run --cwd apps/web dev`         | Vite serves on localhost       |
| Root delegates   | `bun run dev` / `bun run build`      | forwards to `apps/web`         |

Verify Bun is present first: `bun --version` → prints `1.3.x`.

## Scope

**In scope** (create/move/modify only these):
- Create dirs: `apps/web/`, `apps/server/`, `packages/shared/`.
- Move into `apps/web/`: `src/`, `public/`, `index.html`, `vite.config.ts`,
  `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `components.json`,
  `eslint.config.js`, and the current root `package.json` (becomes the web manifest).
- New root `package.json` (workspace root, delegating scripts).
- New `apps/server/package.json` + `apps/server/src/index.ts` (minimal hello server — fuller server is Plan 003).
- New `packages/shared/package.json` + `packages/shared/src/index.ts` (empty placeholder export — real schemas are Plan 002).
- Modify `.prettierrc` (`tailwindStylesheet` path).
- Modify `.gitignore` (add monorepo build/data artifacts).

**Out of scope** (do NOT touch):
- `CONTEXT.md`, `README.md` — docs; no edits in this plan.
- `.agents/` — agent skills; leave as-is.
- The **contents** of any moved source file (`src/App.tsx`, `theme-provider.tsx`, etc.) except where a path inside it would break — and none should, because `src` moves as a unit and all its internal paths are relative to itself.
- Do NOT add Hono routes, Zod schemas, Drizzle, or scanner code — those are Plans 002–004.

## Git workflow

- Branch: `advisor/001-monorepo-restructure`.
- Use `git mv` for every move so history is preserved (not plain `mv`).
- Commit in logical units (e.g. "move web app into apps/web", "add workspace root", "scaffold server + shared").
- Commit message style: short imperative subject (match existing log: `updated docs to clarify architecture`). End the commit body with the repo's author trailer if one is configured; otherwise no trailer needed.
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Create the workspace directories

```
mkdir -p apps/web apps/server/src packages/shared/src
```

**Verify**: `ls -d apps/web apps/server packages/shared` → all three print.

### Step 2: Move the web app into `apps/web` (preserve history)

Move each tracked web file with `git mv`:

```
git mv src apps/web/src
git mv public apps/web/public
git mv index.html apps/web/index.html
git mv vite.config.ts apps/web/vite.config.ts
git mv tsconfig.json apps/web/tsconfig.json
git mv tsconfig.app.json apps/web/tsconfig.app.json
git mv tsconfig.node.json apps/web/tsconfig.node.json
git mv components.json apps/web/components.json
git mv eslint.config.js apps/web/eslint.config.js
git mv package.json apps/web/package.json
```

Then rename the moved manifest's package name so it is workspace-addressable.
Edit `apps/web/package.json`: change `"name": "lantern"` to `"name": "@lantern/web"`.
Leave its scripts and dependencies exactly as they are.

**Verify**:
- `ls apps/web` → shows `src public index.html vite.config.ts tsconfig*.json components.json eslint.config.js package.json`.
- `test ! -f vite.config.ts && echo "root cleaned"` → prints `root cleaned`.
- `grep '"name"' apps/web/package.json` → `"name": "@lantern/web"`.

### Step 3: Confirm web internal paths still resolve

`apps/web/vite.config.ts` uses `path.resolve(__dirname, "./src")` and the
tsconfigs map `@/*` → `./src/*`. Because `src` moved together with these
configs, these stay correct. Do **not** change them. Just confirm:

**Verify**: `grep -n 'resolve(__dirname' apps/web/vite.config.ts` → still
`./src`, and `grep -n '@/\*' apps/web/tsconfig.app.json` → still `./src/*`.

### Step 4: Write the new workspace-root `package.json`

Create `package.json` at the repo root with this content (delegating scripts,
no app dependencies of its own):

```jsonc
{
  "name": "lantern",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "bun run --cwd apps/web dev",
    "dev:server": "bun run --cwd apps/server dev",
    "build": "bun run --cwd apps/web build",
    "build:server": "bun run --cwd apps/server build",
    "typecheck": "bun run --cwd apps/web typecheck && bun run --cwd apps/server typecheck",
    "lint": "bun run --cwd apps/web lint",
    "format": "prettier --write \"**/*.{ts,tsx}\""
  }
}
```

Note: script names mirror CONTEXT.md lines 61–73. `typecheck` also runs the
server's typecheck (the server gets a `typecheck` script in Step 5).

**Verify**: `bun pm ls 2>/dev/null || cat package.json | grep workspaces` →
`workspaces` field present.

### Step 5: Scaffold a minimal `apps/server` package

This is a placeholder so the workspace resolves and `typecheck`/`dev:server`
exist; the real Hono app is Plan 003. Create:

`apps/server/package.json`:

```jsonc
{
  "name": "@lantern/server",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "build": "bun build src/index.ts --target=bun --outdir dist",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@lantern/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "~6"
  }
}
```

`apps/server/tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "target": "es2023",
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["bun"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

`apps/server/src/index.ts` (minimal — Bun's built-in server, no Hono yet):

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

**Verify**: `bun run --cwd apps/server typecheck` → exit 0.

### Step 6: Scaffold a minimal `packages/shared` package

Real schemas are Plan 002; this just makes the workspace importable.

`packages/shared/package.json`:

```jsonc
{
  "name": "@lantern/shared",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "~6"
  }
}
```

`packages/shared/tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "target": "es2023",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "declaration": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

`packages/shared/src/index.ts`:

```ts
// Shared Zod schemas and API contracts land here in Plan 002.
export {}
```

**Verify**: `bun run --cwd packages/shared typecheck` → exit 0.

### Step 7: Fix the Prettier Tailwind stylesheet path

Edit `.prettierrc`: change `"tailwindStylesheet": "src/index.css"` to
`"tailwindStylesheet": "apps/web/src/index.css"`. Leave everything else.

**Verify**: `grep tailwindStylesheet .prettierrc` → `apps/web/src/index.css`.

### Step 8: Update `.gitignore` for the monorepo

Append these lines to `.gitignore` (the existing `node_modules` and `dist`
lines already cover nested dirs, but add the data dir and per-app dist
explicitly for clarity):

```
# Monorepo build output
apps/*/dist
packages/*/dist

# Mounted SQLite data dir (Plan 004)
/data
```

**Verify**: `grep -q '/data' .gitignore && echo ok` → `ok`.

### Step 9: Reinstall and validate the whole workspace

```
bun install
```

This re-links workspace packages (`@lantern/web`, `@lantern/server`,
`@lantern/shared`) and regenerates `bun.lock`.

**Verify** (all must pass):
- `bun install` → exit 0.
- `bun run --cwd apps/web typecheck` → exit 0.
- `bun run --cwd apps/web build` → exit 0; `apps/web/dist/index.html` exists.
- `bun run --cwd apps/web lint` → exit 0.
- `bun run --cwd apps/server typecheck` → exit 0.
- `bun run --cwd packages/shared typecheck` → exit 0.
- `bun run typecheck` (root delegate) → exit 0.

## Test plan

This plan ships no application logic, so it adds no unit tests. Its verification
**is** the existing toolchain passing from the new locations:

- `bun run --cwd apps/web build` must still produce a working bundle (proves the
  move didn't break Vite/Tailwind/shadcn resolution).
- `bun run --cwd apps/web lint` must pass (proves ESLint config still resolves).
- A manual smoke check (optional, not required to pass): `bun run dev`, open the
  printed URL, confirm the "Project ready!" page renders and pressing `d`
  toggles dark mode (existing behavior from `App.tsx` / `theme-provider.tsx`).

## Done criteria

ALL must hold:

- [ ] `apps/web/`, `apps/server/`, `packages/shared/` exist with the files listed in Scope.
- [ ] No web app files remain at the repo root (`test ! -f vite.config.ts && test ! -d src` → both true).
- [ ] Root `package.json` has a `workspaces` field and delegating scripts; no React/Vite deps at root.
- [ ] `bun install` exits 0 and `bun.lock` is updated.
- [ ] `bun run --cwd apps/web build` exits 0 and emits `apps/web/dist/index.html`.
- [ ] `bun run --cwd apps/web typecheck`, `--cwd apps/server typecheck`, `--cwd packages/shared typecheck` all exit 0.
- [ ] `bun run --cwd apps/web lint` runs and reports **no new** errors beyond the
  pre-existing `react-refresh/only-export-components` error at
  `apps/web/src/components/ui/button.tsx:65` (present since commit `969f681`,
  a stock shadcn pattern — out of scope for this plan). Confirm the moved
  `button.tsx` is byte-identical to the original (`git log --follow` shows a pure
  rename). Do NOT "fix" it here.
- [ ] `.prettierrc` `tailwindStylesheet` points to `apps/web/src/index.css`.
- [ ] Only files in the Scope list were created/moved/modified (`git status` shows nothing unexpected; `CONTEXT.md`, `README.md`, `.agents/` unchanged).
- [ ] `plans/README.md` status row for 001 updated to DONE.

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows any in-scope config file changed since `da4b4cb` and no
  longer matches the "Current state" excerpts.
- `bun run --cwd apps/web build` fails after the move with a module-resolution
  error you cannot trace to a moved path (do not start rewriting Vite/Tailwind
  config — report the exact error).
- `bun install` cannot resolve `workspace:*` for `@lantern/shared` or
  `@lantern/server` (likely a `name`/path mismatch — report which package).
- You find yourself needing to edit the **contents** of a moved source file
  (other than the two manifest `name` fields and the configs named in Scope) to
  make things pass — that means an assumption here is wrong; stop and report.

## Maintenance notes

- Future plans add real deps to `apps/server` (Hono, Drizzle) and
  `packages/shared` (Zod). The skeletons here are intentionally minimal.
- If a contributor later wants `packages/ui` (CONTEXT.md line 29), it slots into
  the existing `workspaces: ["apps/*", "packages/*"]` glob with no root change.
- Reviewer should confirm `git mv` (not `mv`) was used, so `git log --follow`
  still traces `apps/web/src/App.tsx` history.
- The web app keeps its own `eslint.config.js` and tsconfigs; the server will
  get a separate lint setup later if desired (not in this plan).
