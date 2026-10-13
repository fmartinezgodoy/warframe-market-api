# Repository instructions

Read README.md, docs/architecture.md, docs/api-contract.md, and docs/operations.md
before changing architecture, behavior, or configuration. Keep repository content
in English; retain the existing Spanish API messages for contract compatibility.

## Architecture and ownership

Keep TypeScript, one HTTP process, and the catalog/orders verticals. Each vertical
has domain, application, and infrastructure layers. Domain owns business types,
Repository and Service interfaces; application implements Service through domain
contracts; infrastructure owns concrete controllers and technical adapters.
Composition belongs in src/app and process signals in src/main.ts. Domain and
application cannot import platform, app, infrastructure, or third-party packages.
Platform cannot import verticals. Cross-slice collaboration uses narrow domain
contracts wired by composition. Run the architecture guard rather than weakening
it for a forbidden import. Use ordinary constructors and create abstractions only
for actual boundaries.

## Runtime invariants

The Redis catalog belongs to an external writer. This API only reads wf:id_map
and wf:item:<slug> hashes; never seed, flush, mutate, migrate, or reconfigure a
shared store. Never start or manipulate another application's bot. Preserve
response envelopes, default rank rules, fuzzy search weights, and existing error
messages unless a requested contract change explicitly updates docs and tests.
The mixed-order sort is sell-first ascending, then buy descending. Platform and
crossplay form part of the upstream cache key. Keep cache capacity, queue length,
timeouts, response size, and retry counts bounded. Respect upstream cooldowns
and retain the descriptive User-Agent. The process limiter is not a fleet-wide
quota: coordinate other writers/clients sharing an egress address before real use.

Use fixtures and fake dependencies for routine verification. Do not contact
production Redis, upstream marketplace endpoints, or deployed applications during
tests. HTTP tests may use ephemeral loopback listeners. Never log config values,
Redis URLs, queries, slugs, traders, headers, response bodies, or raw exceptions.

## Workflow

1. Inspect Git status and relevant instructions, owning slice, contract and tests.
2. Extend the owning slice with minimal changes; keep existing unrelated work.
3. Update contract, configuration examples and operational docs together with
   behavior. Use .agents/skills/change-api/SKILL.md for API/adapter changes.
4. Run pnpm check. For dependency changes, run pnpm audit --audit-level=moderate.
   For image/lifecycle changes, also build and run scripts/smoke-container.sh.
   Report skipped or failed checks accurately.
5. Before publication run the source/history audit and inspect the complete diff
   manually; automation is not a guarantee of privacy. Use a clean source history.
   Exclude secrets, real dotenv/config, data, private hosts, operational inventories,
   compiled output, dependency directories, and unrelated source archives.
6. Use codex/<change-name> branches and draft pull requests for subsequent changes.
   Enable the local hook with git config --local core.hooksPath .githooks. Never
   bypass it or force-push. The hook is a local guard, not server protection.

## Authorization boundaries

Source work does not authorize deployment, network exposure, registry publication,
cluster installation, production mutations, account actions, or messages to third
parties. Follow the user's actual authorizations in the session. Prepare concrete,
reviewable artifacts before asking for an approval that is still required.
No license is selected: do not add one without explicit user authorization.
The pilot starts with fixtures and no public route. Read docs/upstream-policy.md
before enabling real traffic or proposing new marketplace endpoints. Public runtime
exposure requires upstream policy coordination and separate infrastructure approval.
