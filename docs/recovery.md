# Recovery provenance and validation

The starting point was the owner's existing TypeScript wrapper. A pre-existing
source backup was inspected on its source host before transfer. Only package.json,
pnpm-lock.yaml, tsconfig.json and the five src modules were retained for development.
The transferred archive checksum matched the inspected backup. Original services,
files, configuration and shared persistence were not changed by this task.

Dependency resolutions are unchanged: Fuse 7.5.0, ioredis 5.11.1, TypeScript 5.9.3
and Node types 22.20.4, as recorded in the original lockfile. Source was reviewed for
embedded credentials, operational identifiers and private addresses. Existing
compiled files were excluded; new output is rebuilt locally. The publication uses
a fresh Git history. Original runtime configuration, backups, data, dotenv files,
remote Git metadata, bots, inventories and host identifiers are excluded.

The original source contained no license file or package license declaration. None
has been added; publication does not grant a software license. The owner must choose
one explicitly if desired. No Warframe artwork, actual market data or trader fixtures
were copied. Third-party dependencies retain their own licenses.

Validation uses synthetic repositories, injected fetch and pipeline fakes, complete
loopback HTTP flow tests, configuration checks, the architecture guard, dependency
vulnerability audit, source/history audit and ARM64 image smoke testing. The smoke
runs with network disabled, read-only rootfs and UID 10001; it includes clean shutdown.
See the repository CI checks for the exact published revision. These checks do not
prove live Redis access, provider schema stability, aggregate quota compliance,
cluster networking, public access controls, performance under real load or production
cutover safety. Those are explicit pilot preparation items.
