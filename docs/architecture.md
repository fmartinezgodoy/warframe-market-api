# Architecture and decisions

The rescued implementation was a five-module TypeScript HTTP API. The language,
Node HTTP transport, Fuse search configuration, Redis hash layout and endpoint
shapes are retained. The organization follows the established reference backend criteria,
adapted to TypeScript: vertical slices, domain contracts, concrete controllers,
ordinary constructor injection, and inward dependency rules.

| Area | Domain | Application | Infrastructure |
| --- | --- | --- | --- |
| Catalog | Item, Repository, SearchIndex, Service | Refresh and rank projection | Redis reader, Fuse index, HTTP controller |
| Orders | Order, Filters, Context, Repository, Service, errors | Local filtering and deterministic sorting | HTTP upstream, bounded cache, HTTP controller |

`src/app/bootstrap.ts` wires adapters and owns refresh/shutdown. `src/app/application.ts`
composes HTTP routing, process rate limiting and safe request logs. `src/platform`
contains validated configuration and shared technical HTTP helpers. No DI framework,
generic repository, event bus, account model, database schema or background writer
was introduced. `scripts/check-architecture.mjs` reads TypeScript's syntax tree,
including type-only and dynamic imports, and enforces the production import rules.

## Decisions and behavior changes

- Keep the original dependency lock and TypeScript source language; runtime is a
  supported Node 24 LTS patch pinned by version and multiarch image digest.
- Preserve global 100/minute HTTP limiting and legacy /health. Dedicated probes
  bypass the quota; readiness requires a nonempty recent catalog and no drain.
- Preserve bilingual weighted fuzzy search, defaults and Spanish errors. Reject
  partially numeric values instead of accepting malformed input via parseInt.
- Define mixed-order sorting as sells ascending followed by buys descending;
  the previous asymmetric comparator did not define a consistent mixed order.
- Preserve all original order response fields, omitting optional rank/status when
  absent. Validate fields used by the wrapper and ignore unexposed upstream fields.
- Map platform context to current upstream headers. Accept the legacy xb1/swi
  filters as aliases, add xbox/switch/mobile, and partition cache by that context.
- Store unfiltered results in a capacity-bounded memory cache. Coalesce a key's
  misses; callers cancel independently. A shared fetch has its own total timeout.
  Failed or not-found responses are never cached; no stale fallback hides failure.
- One upstream call at a time, start spacing at least 340 ms, at most 32 queued
  calls, and at most one retry by default. A shared cooldown respects Retry-After.
  There is no distributed quota or coordinated budget with other clients.
- Fixtures are composed as alternate adapters, not injected into live storage.
  No production catalog, user responses, credentials or remote Git history is included.

No public runtime, cluster installation or real dependency migration has occurred.
Registry image publication and isolated real-catalog testing remain subsequent
explicitly authorized operations. The source has no selected license.
