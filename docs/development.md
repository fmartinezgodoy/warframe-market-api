# Development

Requirements: Node 24 LTS, pnpm 10.18.3, Git; Docker only for image validation.
Use `pnpm install --frozen-lockfile --ignore-scripts`, then `pnpm check`.
`pnpm lint` runs strict TypeScript checking and the architecture import guard.
`pnpm test` builds first and runs Node's test runner. Tests assemble services and
controllers with synthetic dependencies and ephemeral loopback HTTP servers.
`pnpm audit:publication` checks working files and reachable Git blobs/commits.
`pnpm audit --audit-level=moderate` asks the registry for known vulnerability findings.

Use `pnpm dev:fixtures` for an offline development server. Fixture orders are
synthetic and are not sample market prices. Environment examples are not loaded
automatically; explicitly export individual variables as needed. Normal runtime
can read an explicitly configured local test Redis catalog but never seeds it.
Live upstream testing requires a separate, scoped traffic authorization.

Build with `pnpm build`; run the artifact with `DATA_SOURCE=fixtures pnpm start`.
The API itself does not write files. Dependencies, build output, local config and
state stay ignored. Container build uses the existing lockfile and pinned Node
image; no download or compile occurs at application startup.

Install the local main-push guard once per clone:

```sh
git config --local core.hooksPath .githooks
git switch -c codex/change-name
```

CI runs strict checking, architecture and behavior tests, build, privacy/history
audit, dependency audit, and an ARM64 container smoke test. It has read-only
repository permissions, fixed action SHAs and bounded runtimes. It neither deploys
nor pushes images. Future changes use draft PRs; inspect their diff and CI before
merging. The initial source import uses a fresh history rather than importing an
unreviewed remote history.
