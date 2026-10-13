#!/bin/sh
set -eu
image=${1:-warframe-market-api:local}
container="warframe-api-smoke-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
docker run --detach --name "$container" --network none --read-only   --cap-drop ALL --security-opt no-new-privileges --pids-limit 64   --memory 256m --cpus 0.5 --tmpfs /tmp:rw,noexec,nosuid,size=64m   --env DATA_SOURCE=fixtures "$image" >/dev/null
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if docker exec "$container" node -e 'fetch("http://127.0.0.1:6002/readyz").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'; then break; fi
  sleep 1
done
docker exec "$container" node --input-type=module -e '
import assert from "node:assert/strict";
assert.equal(process.getuid(), 10001);
const base = "http://127.0.0.1:6002";
assert.equal((await fetch(base + "/readyz")).status, 200);
const search = await (await fetch(base + "/search?q=Demo%20Mod")).json();
assert.equal(search.results[0].slug, "demo_mod");
const path = base + "/orders/demo_mod?type=sell&rank=5&crossplay=true";
assert.equal((await (await fetch(path)).json()).orders[0].user.ingameName, "SyntheticTrader");
assert.equal((await (await fetch(path)).json()).cached, true);
console.log("Container smoke passed: UID 10001, read-only rootfs, no network, search and orders");'
docker stop --time 10 "$container" >/dev/null
exit_code=$(docker inspect --format '{{.State.ExitCode}}' "$container")
[ "$exit_code" = 0 ]
