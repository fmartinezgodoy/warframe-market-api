# Upstream contract and policy

Reviewed on 2026-10-13 against the provider's official
[API overview](https://docs.warframe.market/docs/api/overview/),
[item orders](https://docs.warframe.market/docs/api/orders/),
[models](https://docs.warframe.market/docs/data-models/),
[client rules](https://docs.warframe.market/docs/rules/overview/), and
[terms](https://warframe.market/tos).

The wrapper continues to use the documented unauthenticated GET
https://api.warframe.market/v2/orders/item/{slug}. data is an array of orders with
embedded public user fields. Platform and Crossplay are request headers; Language
is preserved as es. API v2 is still evolving, so field validation and controlled
failure handling are required. No live marketplace request was used as a test.

Provider rules ask for an identifiable User-Agent, efficient caching, restrained
requests, and added value rather than a website clone. The public rate limit is
currently 3 requests/second and access can be restricted. This implementation
identifies its source project, serializes requests with at least 340 ms spacing,
caches/coalesces reads, limits retry attempts and respects Retry-After.

Terms section 11 also asks developers to contact staff before making API-using
applications public. The personal/educational exception and the added-value rule
must be considered for a public runtime. Publishing reviewed source does not claim
staff endorsement or approval to expose a live service. Keep the pilot private;
coordinate staff contact and intended use before public runtime exposure. This task
has not sent messages to staff or obtained such approval.

Do not add account credentials, order creation/updates, trade automation, persistent
subscriptions, bulk scraping or new endpoint families through this rescue. Possible
future read-only features include explicit online-status filtering, rank-aware top
orders and item details from an approved catalog source. Agree frontend needs,
provider policy and traffic budget before implementing or activating those features.
OAuth is not assumed available. No new upstream endpoint was added in this iteration.
