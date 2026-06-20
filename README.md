# Lantern

Lantern is an early-stage, open source rewrite inspired by [`aceberg/WatchYourLAN`](https://github.com/aceberg/WatchYourLAN).

The goal is to build a modern self-hosted network inventory and monitoring app for discovering devices on a local network, tracking when hosts appear or disappear, and surfacing useful network state through a clean web UI and typed API.

Lantern is not a traditional fork of WatchYourLAN. The upstream project is an important behavioral reference, but Lantern is intended to become its own project with a fresh architecture, modern frontend, clearer configuration, and a deployment workflow designed for long-term maintainability.

## Status

Lantern is currently in early development. No release or supported Docker image is available yet.

The repository is still being shaped around the core product direction, architecture, and first milestone. Expect breaking changes until the first tagged release.

## Planned Features

- Local network host discovery and inventory.
- Online/offline host tracking and history.
- Host search, filtering, sorting, tagging, and details.
- Manual host management.
- Wake-on-LAN and port check workflows.
- Notifications for newly discovered or state-changing devices.
- SQLite-backed persistence.
- Future Prometheus metrics and optional time-series integrations.
- Typed API contracts and integration-friendly documentation.
- Demo mode for development without live network scanning.

## Planned Deployment

The intended production deployment will be similar in spirit to WatchYourLAN:

- A published container image on GitHub Container Registry.
- `docker run` and Docker Compose examples.
- A user-managed `config.yaml` mounted into the container.
- Environment variable overrides for container-friendly deployment.
- A mounted data directory for SQLite and persistent app state.
- Clear configuration for interfaces, scan intervals, notifications, and storage.

Example deployment commands are intentionally omitted until Lantern has a release-ready image and stable configuration format.

## Development

Lantern is expected to use Bun, TypeScript, React, Vite, Tailwind, and shadcn/ui for the web surface, with a lightweight Bun/Hono backend, SQLite persistence, and a host-level scanner runtime for privileged network operations.

Project planning, architecture notes, upstream feature inventory, and agent workflow guidance live in [CONTEXT.md](CONTEXT.md).

## License

The license has not been finalized yet.
