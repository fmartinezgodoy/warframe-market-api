# ImageHarbor private pilot

No Kubernetes installation, registry upload, network exposure, deployment or
production cutover is included. The checked-in source specification is a template:
its image tag is not a published artifact. Begin with DATA_SOURCE=fixtures, one
replica, no routes, no PVC and no non-DNS egress. The image listens on the Pod
interface and supports UID/GID 10001, read-only rootfs, dropped capabilities and
an ephemeral /tmp. The fixture adapters never contact dependencies.

## Offline preparation

From this repository, point PYTHONPATH at an existing ImageHarbor checkout and
render the reviewed spec. Rendering does not connect to a cluster:

```sh
PYTHONPATH=/path/to/imageharbor python3 -m imageharbor   --config deploy/imageharbor/instance.fake.json render deploy/imageharbor/app.fixtures.json
```

The fake backend may also exercise deploy/status in its own `.local/imageharbor`
directory. Its ready result is simulated, not proof that a container was deployed.
The template uses a tag solely for fake validation. A real instance should require
an immutable registry digest and an explicitly reviewed kubeconfig/context.

## Before a real pilot

1. Coordinate the separate infrastructure approval: registry destination, image
   publication, cluster ownership, source access, private networking and rollback.
2. Build/publish the validated ARM64 image to the agreed registry; record its digest,
   architecture, CI revision and pull authorization. Set that exact digest in a
   personal spec ignored by Git. No image has been uploaded by this source workflow.
3. Review render output: single replica, UID 10001, read-only rootfs, no host ports,
   no public route, no ServiceAccount token, resources 250m/256Mi and no app volume.
4. ImageHarbor currently emits TCP startup/readiness probes and no HTTP liveness
   probe. Do not claim it verifies the catalog. Check GET /readyz through an approved
   loopback port-forward. Functional probe support belongs to ImageHarbor's separate
   infrastructure change; /livez and /readyz are ready for that integration. Do not
   manually patch its managed Deployment and create reconciliation drift.
5. Exercise search and orders with synthetic data, compare the frontend contract,
   verify logs and shutdown, and confirm no dependency traffic before widening scope.

## Later real-catalog validation

Use a separately authorized isolated catalog fixture/clone, with credentials from
pre-existing Secret references and least-privilege read-only ACLs. Do not mount or
adopt the existing shared Valkey volume, start its writers, or point this pilot at
production. The API has no bootstrap writer or catalog migration. Before enabling
DATA_SOURCE=redis, approve Redis reachability and upstream egress together; the
same mode selects real upstream orders. ImageHarbor accepts egress CIDRs rather
than domain rules, so review an appropriate controlled path for the provider's
changing addresses. Never insert all-address egress as a shortcut. Do not publish
actual infrastructure addresses, credentials or policies in this repository.

Coordinate a shared provider request budget with every client sharing an egress
IP; this process's limiter is insufficient for an aggregate quota. Restrict private
access in network/proxy configuration; CORS supplies no authentication. Public
runtime use additionally requires the policy coordination described in
upstream-policy.md. The frontend owner should consume api-contract.md and choose
its base URL only when private routing is approved.

Rollback the pilot application using its own ImageHarbor revision/removal workflow;
keep the original service untouched until a separately approved cutover. No pilot
PVC exists, so no data deletion is needed. Metadata and image-cache retention follow
ImageHarbor's lifecycle and require separate cleanup decisions.
