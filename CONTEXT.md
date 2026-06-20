# Lantern Project Context

## Project Intent

Lantern is a clean, modern rewrite inspired by `aceberg/WatchYourLAN`, not a long-lived downstream fork. The upstream project remains the source-reference for current behavior, but new development should favor Lantern's own TypeScript/Bun/React architecture and preserve only the product ideas that still make sense.

The public README should stay minimal and project-facing. Agent workflow notes, architecture rationale, upstream feature inventory, and milestone planning belong in this file.

Use `opensrc` to inspect upstream source when behavior needs to be verified:

```sh
opensrc path aceberg/WatchYourLAN#main
rg "Wake-on-LAN|Prometheus|Influx" $(opensrc path aceberg/WatchYourLAN#main)
```

If `opensrc` is not on PATH, install or expose the CLI first. The project-local skill instructions are stored in `.agents/skills/opensrc/SKILL.md`.

## Direction

Lantern is a good candidate for a single-container rewrite: keep privileged network scanning behind a small backend service, then rebuild the product surface in React, TypeScript, Tailwind, and shadcn/ui.

Use Vite first, not Next.js. Lantern is a local-network operations tool, not a public content app, and it does not need SSR, static generation, image optimization, or Next route caching. Vite keeps the Docker image smaller, avoids framework-specific server behavior, and fits a single-page dashboard that talks to an API. Add auth later by inserting middleware into the API server instead of choosing a heavier frontend framework now.

## Proposed Architecture

- `apps/web`: React + Vite + TypeScript + Tailwind + shadcn/ui.
- `apps/server`: Bun + Hono API server that serves the built web app, owns scan scheduling, reads configuration, writes SQLite, and calls scanner adapters.
- `packages/shared`: shared TypeScript types, Zod schemas, API contracts, and domain models.
- `packages/ui`: optional shared shadcn/ui wrapper package if this becomes a monorepo with multiple surfaces.
- `data`: SQLite persistence, with the database stored under the mounted container data directory.

The hard part is not the frontend. Browser JavaScript cannot safely replace `arp-scan` because raw ARP/NDP access requires host-level privileges. Replace the Go scanner instead of carrying it forward, but keep scanning behind an adapter so the first implementation can shell out to proven Linux tools and later implementations can improve internals without changing the API.

## Current Technical Decisions

- Frontend: Vite, React, TypeScript, Tailwind, and shadcn/ui.
- Backend: Bun with Hono.
- Database: SQLite for v1, accessed through Bun SQLite with Drizzle for schema and migrations.
- API contracts: Zod-first shared schemas in `packages/shared`; generate OpenAPI later if the route surface stabilizes enough to justify it.
- Scanner: no Go scanner in Lantern. Start with a TypeScript scanner adapter that can call `arp-scan` on Linux Docker, plus a demo scanner for local UI development.
- Auth: no built-in auth for now. Leave route organization compatible with future Hono middleware.
- Deployment: one container serving the web app and API, with SQLite data stored in a mounted directory.
- Configuration: mounted `config.yaml` as the primary user-editable config, with environment variable overrides for container use.
- Scanner support target: Linux Docker first; macOS and Windows later.
- License: decide later before release.

## Backend Runtime Options

- Bun/Hono service: chosen path for the preferred stack. Use child processes for `arp-scan`, native sockets where useful, Drizzle-backed SQLite persistence, and explicit Docker capabilities/host networking. This is viable, but raw network edge cases need careful testing on Linux.
- Rust service: best long-term scanner reliability and tiny binaries. More unfamiliar than TypeScript, but it cleanly fits a local agent.
- Keep Go temporarily: not preferred. Only revisit if TypeScript scanner reliability becomes a blocker.

Recommended path: React/Vite UI plus Bun/Hono API first, demo scanner second, SQLite persistence third, Linux `arp-scan` adapter fourth.

## Bun Project Management

Use Bun as the only JavaScript package manager and task runner.

Suggested root scripts:

```json
{
  "scripts": {
    "dev": "bun run --cwd apps/web dev",
    "dev:server": "bun run --cwd apps/server dev",
    "build": "bun run --cwd apps/web build",
    "build:server": "bun run --cwd apps/server build",
    "check-types": "bun run --cwd apps/web tsc --noEmit && bun run --cwd apps/server tsc --noEmit",
    "lint": "bun run --cwd apps/web lint",
    "format": "bun run --cwd apps/web format"
  }
}
```

Use `bun.lock`, avoid `package-lock.json`, and keep task names consistent across workspaces.

## shadcn/ui Plan

Use shadcn/ui with the Radix base, installed with Bun commands from the shadcn CLI.

For a new Vite app:

```sh
bunx shadcn@latest init -t vite -b radix
```

For components:

```sh
bunx shadcn@latest add button card table tabs dialog dropdown-menu sheet badge input select switch checkbox tooltip sonner chart
```

Primary replacements:

- Bootstrap tables -> shadcn `Table` plus TanStack Table for sorting, filtering, column visibility, and row selection.
- Bootstrap forms -> `Field`, `Input`, `Select`, `Switch`, `Checkbox`, `Textarea`, and form validation with Zod.
- Config cards -> `Tabs`, `Card`, `Separator`, `Alert`, and `Sonner` toasts.
- Host actions -> `DropdownMenu`, `Dialog`, `AlertDialog`, and `Tooltip`.
- History views -> `Chart`, `Table`, and date filters.

## Upstream Feature Inventory

These are the verified features in the original WatchYourLAN project that should inform Lantern's rewrite scope:

- Scan one or more network interfaces with `arp-scan`.
- Support custom `arp-scan` arguments and raw scan command strings for VLAN/docker interface cases.
- Detect new hosts and send notifications through Shoutrrr.
- Keep a searchable/sortable/filterable list of hosts on the network.
- Track whether hosts are currently online or offline.
- Store host online/offline history and trim old history by age.
- Mark hosts as known or unknown and edit host display names.
- Manually add hosts by MAC address.
- Delete selected hosts.
- View host details, DNS lookup data, and per-host history.
- Check whether a TCP port is open on a host.
- Send Wake-on-LAN packets.
- Trigger a manual rescan from the web UI or API.
- Configure the service through environment variables, `config_v2.yaml`, or the web UI.
- Store data in SQLite or PostgreSQL.
- Send data to InfluxDB2 or expose Prometheus metrics for Grafana.
- Use the documented HTTP API and Swagger UI for integrations.

## Feature Recommendations

- First-run setup wizard for interface selection, scan interval, database mode, and notification test.
- Future built-in auth option for home users, while still supporting reverse proxies.
- IPv6/NDP discovery alongside ARP.
- Multi-subnet support with named network segments.
- Better host identity: vendor lookup, DNS names, mDNS names, manual aliases, tags, and notes.
- Device grouping by type, owner, room, VLAN, or trust level.
- Risk indicators for unknown hosts, open management ports, and newly observed devices.
- Saved views: unknown devices, currently online, recently offline, servers, IoT, network gear.
- Timeline view for each host with first seen, last seen, online intervals, name changes, and notification events.
- Notification rules instead of one global URL: new unknown host, known host offline, host online after downtime, watched port opened, watched port closed.
- Per-host watch settings and quiet hours.
- Import/export for hosts, tags, and settings.
- Webhook integration for Home Assistant, Ntfy, Gotify, Slack, Discord, and generic HTTP.
- Future Prometheus metrics that expose host counts, online state, scan duration, scan errors, and notification failures.
- Future Grafana dashboard JSON checked into the repo.
- API tokens and OpenAPI docs for integrations.
- Demo mode with seeded data so the UI can be developed without a live network scan.

## Planned Deployment Model

Lantern should eventually be deployable by self-hosted users in the same broad style as WatchYourLAN:

- Publish a Docker image to GitHub Container Registry.
- Document `docker run` and Docker Compose examples after the image and config format are stable.
- Keep the initial deployment as a single container that serves the Vite build, runs the Bun/Hono API, schedules scans, and writes SQLite.
- Use a mounted `config.yaml` as the primary user-editable configuration file.
- Use a mounted data directory for SQLite and persistent app state.
- Support explicit interface, network mode, and Linux capability guidance for scanner access.
- Keep environment variables available for container-friendly overrides where useful, but avoid making env vars the only configuration surface.

Do not publish example commands in README until the image name, ports, volume paths, and config schema are stable enough for users to copy.

## Migration Plan

1. Freeze the target feature set in README and Zod shared schemas.
2. Build a React/Vite shell against the Bun/Hono API and demo scanner.
3. Replace inherited UI assumptions with React + shadcn/ui screens.
4. Add SQLite persistence through Bun SQLite and Drizzle migrations.
5. Add a typed API client backed by shared Zod schemas.
6. Move Docker and Bun scripts to the repo root.
7. Add demo fixtures and browser tests for the dashboard, host detail page, config, and history.
8. Add the Linux Docker `arp-scan` adapter behind the scanner interface.
9. Preserve existing config names where practical so current users can migrate.

## Early Decisions

- Vite-only local dashboard, not Next.js.
- Bun/Hono backend inside the same deployable container.
- Replace the Go scanner instead of keeping it for a release.
- SQLite-only for v1, using Bun SQLite and Drizzle.
- No built-in auth until closer to release.
- Single-container deployment for the initial product.
- Mounted `config.yaml` plus environment variable overrides.
- Linux Docker scanner support first; macOS and Windows later.
- Final license remains undecided.

## Suggested First Milestone

Ship a modern UI and typed API contract before over-investing in scanner internals:

- Bun-managed React/Vite app.
- Bun/Hono API server.
- Zod-first shared schemas.
- SQLite persistence through Bun SQLite and Drizzle.
- Tailwind and shadcn/ui Radix components.
- Host table with search, filters, sort, row selection, bulk delete, and host detail drawer.
- Config screens for scan settings, storage, and notifications.
- Manual rescan, Wake-on-LAN, port check, and notification test flows.
- Demo mode for local development without `arp-scan`.
- Linux Docker `arp-scan` adapter behind a scanner interface.

## Agent Workflow

Project-specific skills live under `.agents/skills`.

- `.agents/skills/opensrc/SKILL.md`: fetch and inspect package or repository source code with `opensrc path`.

Typical source-reference workflow:

```sh
opensrc path aceberg/WatchYourLAN#main
rg "rescan|Wake-on-LAN|Prometheus|Influx" $(opensrc path aceberg/WatchYourLAN#main)
```

When editing this repo:

- Keep README public-facing and minimal until there is runnable software.
- Keep implementation plans, agent notes, and source-reference workflow in this file.
- Prefer Bun for package management, scripts, the Hono API server, and SQLite access.
- Prefer React/Vite/Tailwind/shadcn/ui for the initial web app unless the project direction changes explicitly.
- Treat upstream WatchYourLAN behavior as reference material, not code to preserve by default.
