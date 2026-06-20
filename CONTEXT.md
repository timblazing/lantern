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

Lantern is a good candidate for a split rewrite: keep network scanning in a small privileged service, then rebuild the product surface in React, TypeScript, Tailwind, and shadcn/ui.

My recommendation is Vite first, not Next.js. Lantern is an authenticated local-network operations tool, not a public content app, and it does not need SSR, static generation, image optimization, or Next route caching. Vite keeps the Docker image smaller, avoids framework-specific server behavior, and fits a single-page dashboard that talks to an API. Use Next.js only if the app server should also own API routes, auth middleware, server actions, or a larger hosted SaaS-style deployment later.

## Proposed Architecture

- `apps/web`: React + Vite + TypeScript + Tailwind + shadcn/ui.
- `apps/agent`: scanner/runtime service that runs near the network interface and owns ARP/NDP scanning, Wake-on-LAN, port checks, notifications, metrics, and database writes.
- `packages/api`: shared TypeScript types, OpenAPI client, Zod schemas, and API contracts.
- `packages/ui`: optional shared shadcn/ui wrapper package if this becomes a monorepo with multiple surfaces.
- `data`: SQLite by default, PostgreSQL optional for larger installs.

The hard part is not the frontend. Browser JavaScript cannot safely replace `arp-scan` because raw ARP/NDP access requires host-level privileges. The rewrite should replace the Go implementation only after choosing a runtime that can do network scanning reliably.

## Backend Runtime Options

- Bun/Node service: best for the preferred stack. Use child processes for `arp-scan`, native Node sockets where possible, and explicit Docker capabilities/host networking. This is viable, but raw network edge cases need careful testing on Linux.
- Rust service: best long-term scanner reliability and tiny binaries. More unfamiliar than TypeScript, but it cleanly fits a local agent.
- Keep Go temporarily: fastest path. Replace the UI and API contract first, then swap the scanner service behind the same API.

Recommended path: React/Vite UI first, then TypeScript service extraction, then scanner internals.

## Bun Project Management

Use Bun as the only JavaScript package manager and task runner.

Suggested root scripts:

```json
{
  "scripts": {
    "dev": "bun run --cwd apps/web dev",
    "build": "bun run --cwd apps/web build",
    "check-types": "bun run --cwd apps/web tsc --noEmit",
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
- Built-in auth option for home users, while still supporting reverse proxies.
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
- Prometheus metrics that expose host counts, online state, scan duration, scan errors, and notification failures.
- Grafana dashboard JSON checked into the repo.
- API tokens and OpenAPI docs for integrations.
- Demo mode with seeded data so the UI can be developed without a live network scan.

## Planned Deployment Model

Lantern should eventually be deployable by self-hosted users in the same broad style as WatchYourLAN:

- Publish a Docker image to GitHub Container Registry.
- Document `docker run` and Docker Compose examples after the image and config format are stable.
- Use a mounted `config.yaml` as the primary user-editable configuration file.
- Use a mounted data directory for SQLite and persistent app state.
- Support explicit interface, network mode, and Linux capability guidance for scanner access.
- Keep environment variables available for container-friendly overrides where useful, but avoid making env vars the only configuration surface.

Do not publish example commands in README until the image name, ports, volume paths, and config schema are stable enough for users to copy.

## Migration Plan

1. Freeze the target feature set in README and OpenAPI docs.
2. Build a React/Vite shell against demo data or the existing WatchYourLAN API shape.
3. Replace inherited UI assumptions with React + shadcn/ui screens.
4. Add a typed API client generated from OpenAPI or backed by Zod schemas.
5. Move Docker and Bun scripts to the repo root.
6. Add demo fixtures and browser tests for the dashboard, host detail page, config, and history.
7. Extract or rewrite the scanner service once the frontend is stable.
8. Preserve existing config names where practical so current users can migrate.

## Early Decisions To Make

- Vite-only local dashboard or Next.js app with API/server ownership.
- Keep Go scanner for one release or rewrite scanner immediately.
- SQLite-only for v1 rewrite or preserve PostgreSQL from the start.
- Built-in auth scope: none, basic local login, or full OIDC/reverse-proxy first.
- Whether the project remains a single container or becomes web plus agent containers.
- Final license for the open source project.

## Suggested First Milestone

Ship a modern UI and typed API contract before rewriting all scanner internals:

- Bun-managed React/Vite app.
- Tailwind and shadcn/ui Radix components.
- Host table with search, filters, sort, row selection, bulk delete, and host detail drawer.
- Config screens for scan settings, notifications, InfluxDB, and Prometheus.
- Manual rescan, Wake-on-LAN, port check, and notification test flows.
- Demo mode for local development without `arp-scan`.

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
- Prefer Bun for package management and scripts.
- Prefer React/Vite/Tailwind/shadcn/ui for the initial web app unless the project direction changes explicitly.
- Treat upstream WatchYourLAN behavior as reference material, not code to preserve by default.
