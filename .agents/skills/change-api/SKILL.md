---
name: change-api
description: Change Warframe Market API contracts or adapters while preserving the catalog writer boundary, upstream quotas, and frontend compatibility. Use for behavior or dependency changes in this repository.
---

Read the repository AGENTS.md and the owning slice. Use docs/api-contract.md for
HTTP changes, docs/upstream-policy.md for upstream changes, and docs/operations.md
for configuration/lifecycle changes. The original contract is the baseline;
additive changes must document defaults and avoid altering existing envelopes.

The catalog is supplied by an external writer. Fake Repository interfaces in
application tests and fake Redis pipelines/fetch in infrastructure tests. Do not
copy a real catalog or trader response into fixtures. Use DATA_SOURCE=fixtures
for local HTTP work and scripts/smoke-container.sh for image changes.

When changing order context, verify platform/crossplay cache partitioning,
coalesced cancellation, mixed-side sorting, bounded queue/retries, and failure
mapping. When changing catalog refresh, verify that failed reads retain the last
good index and readiness expires instead of publishing an empty or partial index.

Run pnpm check, then the relevant additional checks listed in AGENTS.md. Report
observable behavior and remaining limitations. A successful fixture run does not
prove live connectivity. Propose credential-dependent or deployment changes as
concrete reviewable follow-ups; do not activate them through this workflow.
