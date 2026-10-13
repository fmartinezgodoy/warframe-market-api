# Configuration and operations

All settings come from the process environment. Invalid configuration fails startup
with a safe event; values are never logged. No dotenv, PM2, host configuration or
account credentials are bundled.

| Variable | Default | Meaning |
| --- | --- | --- |
| HTTP_HOST | 127.0.0.1 | Literal listener IP; image sets 0.0.0.0. |
| HTTP_PORT | 6002 | Unprivileged HTTP port, 1024–65535. |
| DATA_SOURCE | redis | redis or fixtures; image uses fixtures. |
| REDIS_URL | redis://127.0.0.1:6379/0 | Explicit Redis/Valkey URL; rediss uses certificate validation. Keep credentials outside version control. |
| REDIS_TIMEOUT_MS | 1500 | Connect and per-command timeout, 100–10000 ms. |
| CATALOG_REFRESH_MS | 900000 | Successful refresh interval; never writes catalog. |
| CATALOG_MAX_AGE_MS | 1800000 | Readiness expiry; must exceed refresh interval. |
| UPSTREAM_INTERVAL_MS | 340 | Minimum spacing, 340–60000 ms; single active request. |
| UPSTREAM_TIMEOUT_MS | 8000 | Shared fetch budget including queue, retries and body. |
| UPSTREAM_RETRIES | 1 | Additional safe GET attempts, 0–2. |
| REQUEST_TIMEOUT_MS | 10000 | Caller/HTTP budget; must exceed upstream budget. |
| ORDERS_CACHE_TTL_MS | 60000 | Result TTL, 100–300000 ms. |
| ORDERS_CACHE_CAPACITY | 200 | Maximum successful keys, 1–10000. |
| HTTP_RATE_LIMIT | 100 | Process-wide requests per sliding minute. |
| CORS_ORIGIN | * | One exact HTTP(S) origin or wildcard; no credentials mode. |
| SHUTDOWN_TIMEOUT_MS | 5000 | Graceful HTTP drain deadline. |

Redis reads are limited to HVALS wf:id_map and batched HGETALL wf:item:<slug>.
Pipelines propagate errors; malformed optional tags/ranks are sanitized. A complete
nonempty refresh replaces the in-memory index atomically; failures retain the last
good snapshot. Failed initial loads retry after 5 seconds. Recent snapshots remain
searchable during temporary store failure; readiness expires after the age budget.
No ping is sent on each readiness request and upstream availability is not part of
readiness, so an upstream outage does not cause repeated process restarts.

Use /livez for liveness and /readyz for functional readiness. Legacy /health stays
200 with `indexReady`, subject to its original global quota. SIGTERM/SIGINT marks
the process draining, stops refresh scheduling, closes HTTP, then disconnects Redis.
The shutdown deadline closes remaining sockets. Memory cache/index vanish on restart.
The API has no PVC or local persistent data requirement.

Orders cache keys contain slug, platform and crossplay. Filters operate locally on
that upstream result. The queue has 32 slots and response bodies are capped at
2 MiB. HTTP 404 maps to a controlled missing-item error; transport/timeout, invalid
payload and upstream failure map to the compatible 502 response. GET transport
failures, 429 and 502/503/504 may retry within the budget. A 429 cooldown is shared
with subsequent keys. Long Retry-After values lead to timeout, not an early request.
No redirects or account authentication are followed.

JSON logs record generated request ID, route template, method, status and duration.
Lifecycle logs record only safe event names, source mode, port and catalog counts.
Use 502 rates and duration to diagnose upstream faults; use catalog_refresh_failed
and readiness to diagnose catalog age. Logs never contain traders, queries, real
slugs, IPs, credentials, headers or raw exceptions.

One replica and process-local limiting are intended for the first pilot. All other
clients sharing an egress IP also consume the provider's budget. Before live use,
coordinate the aggregate request rate or provide a dedicated controlled egress path.
CORS is browser policy, not authentication. Keep the service private behind the
approved network/access controls. Do not point the pilot at a production shared
Valkey instance; use approved isolated fixtures or a separately reviewed clone.
