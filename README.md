# Warframe Market API

A read-only TypeScript wrapper for bilingual fuzzy catalog search and item orders.
Recovered source has been reorganized into simple hexagonal vertical slices while
preserving the existing HTTP response shapes and Spanish error messages.

This repository contains code and synthetic fixtures. The ImageHarbor pilot is
private and has not been deployed. No Warframe account, bot token, or production
catalog is required for local development. No license has been selected or granted.

## Run safely

Use Node 24 LTS and pnpm 10.18.3. The container and CI pin Node 24.21.0.

```sh
npm install --global pnpm@10.18.3 --ignore-scripts
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
pnpm dev:fixtures
```

The fixture server listens on `127.0.0.1:6002`. Stop it with Ctrl-C.

```sh
curl 'http://127.0.0.1:6002/readyz'
curl 'http://127.0.0.1:6002/search?q=Demo%20Mod'
curl 'http://127.0.0.1:6002/orders/demo_mod?type=sell&rank=5&crossplay=true'
```

The process reads environment variables and does not load dotenv automatically.
[.env.example](.env.example) is a non-secret reference. `DATA_SOURCE=fixtures`
selects synthetic catalog and orders adapters; neither Redis nor the public API
is contacted. The normal process default is `DATA_SOURCE=redis`; the image default
is fixtures to make the pilot safe to start.

## Build and verify the container

```sh
docker build --platform linux/arm64 -t warframe-market-api:local .
sh scripts/smoke-container.sh warframe-market-api:local
```

The smoke test runs its own disposable container without network or published
ports, with UID 10001, a read-only root filesystem, and synthetic data. It checks
search, orders, cache behavior, readiness, and clean SIGTERM shutdown. The image
supports ARM64 and AMD64; CI builds and tests the ARM64 image without publishing it.

## Structure

```text
src/catalog/{domain,application,infrastructure}/
src/orders/{domain,application,infrastructure}/
src/platform/       Validated config and technical HTTP support
src/app/            Composition, fixtures and runtime lifecycle
src/main.ts         Process entry point
```

Domain owns repository/service contracts. Application implements services through
those contracts. Infrastructure contains concrete controllers and Redis, Fuse,
HTTP, and memory-cache adapters. Ordinary constructors provide dependency injection.
The architectural lint checks inward imports and prevents cross-slice concrete
coupling. The original pnpm lockfile and dependency resolutions were preserved.

## Contract and operation

| Endpoint | Purpose |
| --- | --- |
| `GET /search?q=...&rank=maxed&limit=10` | Bilingual fuzzy search; up to 50 results. |
| `GET /orders/{slug}` | Orders with optional type/rank/platform/crossplay filters. |
| `GET /health` | Compatible legacy health response, including `indexReady`. |
| `GET /livez` | Process liveness; no dependency calls. |
| `GET /readyz` | A recent nonempty catalog snapshot and a process accepting traffic. |

Orders use a bounded memory cache, independent cancellation for callers sharing a
fetch, serialized upstream requests, bounded timeouts/retries, payload validation,
and `Retry-After` handling. Structured logs contain route templates, status,
duration, and generated request IDs; they exclude queries, item slugs, traders,
IP addresses, credentials, and response payloads.

- [Repository instructions](AGENTS.md)
- [Architecture and decisions](docs/architecture.md)
- [HTTP and frontend contract](docs/api-contract.md)
- [OpenAPI](docs/openapi.json)
- [Development](docs/development.md)
- [Configuration and operations](docs/operations.md)
- [Upstream policy](docs/upstream-policy.md)
- [ImageHarbor private pilot](docs/imageharbor-pilot.md)
- [Recovery provenance and validation](docs/recovery.md)
