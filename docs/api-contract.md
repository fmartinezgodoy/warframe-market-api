# HTTP and frontend contract

The frontend is maintained separately. This document and openapi.json define the
wrapper contract; no frontend or Sites changes are included. All replies are JSON
except OPTIONS (204). Existing error messages remain Spanish; clients should branch
on HTTP status, show the error string, and treat unknown fields as additive.

## Search

GET /search?q=<text>&limit=<integer>&rank=0|maxed. q is trimmed, required, and at
most 200 characters. limit defaults to 10, clamps to 1–50, and rejects malformed
integers. rank defaults to maxed. Unknown query parameters remain ignored.

```json
{"query":"Demo Mod","rank":"maxed","count":1,"results":[{"slug":"demo_mod","nameEn":"Demo Mod","nameEs":"Mod de ejemplo","tags":["mod"],"maxRank":5,"rank":5}]}
```

rank is 0 or maxRank for mod/arcane tags; otherwise null. An unready catalog returns
503 with `{"error":"índice cargando"}`. Search uses the same Fuse configuration as
the recovered API: names weighted 0.4 each, slug/tags 0.1 each, threshold 0.4.

## Orders

GET /orders/{slug}?type=sell|buy&rank=<nonnegative integer>&platform=<platform>&crossplay=true|false.
slug matches lowercase ASCII letters, digits, underscores and hyphens, up to 200
characters. Optional filters default to null in the response. Platforms pc/ps4/xb1/swi
are retained; xbox/switch/mobile are also accepted. xb1 and swi map to xbox and
switch for upstream requests and local matching. Response user.platform retains
the upstream value. With no platform/crossplay filter, upstream defaults are pc/false.
A crossplay filter is both upstream context and an exact local boolean filter.

```json
{"slug":"demo_mod","count":1,"cached":false,"filters":{"type":"sell","rank":5,"platform":"pc","crossplay":"true"},"orders":[{"type":"sell","platinum":12,"quantity":1,"rank":5,"user":{"ingameName":"SyntheticTrader","reputation":0,"platform":"pc","crossplay":true,"status":"ingame"}}]}
```

cached is true only for a completed unexpired cache hit. Concurrent misses sharing
a fetch return false. Cache context includes platform/crossplay; type/rank filtering
reuses that entry. Orders are sells ascending by platinum then buys descending.
rank and user.status are optional and omitted when absent upstream. This is a
projection of orders, not the complete upstream model: IDs, visibility and other
unexposed fields are not returned. The provider can include offline users; this API
does not promise that a listed trader is currently available or that a trade occurs.

## Health and errors

/health returns `{"ok":true,"indexReady":false}` or true, always with status 200
before the global quota is exhausted. /livez returns `{"ok":true}` independently
of dependencies. /readyz returns ok/indexReady and HTTP 200 for a fresh catalog
while accepting traffic, otherwise 503. The new probes bypass the global quota.

| Status | Meaning |
| --- | --- |
| 400 | Invalid/missing query value. |
| 404 | Unknown route or upstream item not found. |
| 405 | Methods other than GET/OPTIONS. |
| 429 | Global sliding minute quota; Retry-After is seconds. |
| 500 | Controlled unexpected internal failure. |
| 502 | Upstream unavailable, timeout or invalid response. |
| 503 | Catalog unavailable for search, or graceful drain. |

All failures retain `{"error":"message"}`. Missing items use
`item no encontrado: <slug>` and unavailable upstream uses `upstream no disponible`.
GET business/legacy routes expose X-RateLimit-Limit and X-RateLimit-Remaining;
OPTIONS and the new probes do not consume quota. X-Request-ID is server-generated.
Responses expose these headers to the configured CORS origin. Browser callers
should debounce search, reuse results, handle 429/502/503 and avoid automatic tight
retries. Public deployment, authentication and frontend base URL remain coordination
items; no actual host or deployment URL is embedded in this contract.

## Intentional compatibility fixes

Malformed integers now fail with 400; valid search limits still clamp. Empty catalog
loads no longer make readiness true. Mixed-type sorting is deterministic. Current
platform header semantics are honored and old aliases retained. /health is unchanged;
use /readyz for deployment health. No existing success envelope was renamed.
