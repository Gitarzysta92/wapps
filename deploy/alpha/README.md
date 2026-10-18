# Wapps alpha on Coolify

Alpha runs the API-mode aggregator and real backend services at
https://alpha.wapps.ai. Source development comes from `codex/full-operation`;
release snapshots use `codex/alpha-full-operation`. The original demo release is
`c965790e063139bcd5e6bacc759f289703e4ea9a` on `codex/coolify-alpha`.

## Current branch migration gate

The October 18 independent-authentication change requires separate credential
storage/grants, `AUTHENTICATION_URL`, `AUTH_ISSUER`, `AUTH_SERVICE_SECRET` and the
new `authentication-migrate.env` job. The historical config preparer and Kubernetes
workflows below have not been migrated or qualified for this contract. Do not
activate the new bundles using their previous shared Identity database credentials;
Authentication now refuses a database containing foreign tables. Firebase integration
remains deferred. See `docs/LOCAL-AUTHENTICATION.md` for local qualification and the
verified legacy-mapping prerequisite. The deployed alpha has not been changed.

## Release scope

The server runs Account Management, Authenticator, Editorial, Catalog BFF,
Discussion, both materializers, MySQL, MongoDB, RabbitMQ, MinIO and OPA. Identity,
Editorial and Discussion migrations must complete before their APIs start.
Application image storage is private and explicitly provisioned before Editorial.
Demo accounts, catalog providers, seeds and Firebase emulation are disabled.
New installations initially have an empty real catalog.

Alpha uses the existing Wapps development Firebase project for email/password
accounts, with isolated alpha SQL, projections, queues and object storage. Google,
GitHub and anonymous credential providers remain disabled. In-app reply, mention
and favorite-update workers and Explore are enabled. External scraping, AI agents,
Discord delivery and HTTP endpoint monitoring are outside this deployment.

This deployment does not close the operational-readiness gates. Profile and
notification classification integrations, full backup/restore qualification,
load/soak, real email-provider journeys and remaining product scope stay open.
See `docs/OPERATIONAL-READINESS.md` for those limitations.

## Build and configuration

`alpha-release.workflow.yml` invokes the reusable Workspace Quality workflow
before publishing any image. All eight application images are tagged with the
full source SHA; infrastructure and build images are pinned by digest. The portal
also serves `/release.json`, containing the baked source revision and `mode: api`.
The image runtime installs its locked production dependencies. Runtime locks are
pruned offline from the complete workspace lock and checked for unchanged
versions, registry locations and integrity hashes before `npm ci` installs them.

The `development` GitHub environment already supplies Firebase credentials.
The release workflow encrypts them to `deploy/alpha/host-transport.crt`; only the
alpha host retains the private key at `/data/wapps-alpha/secrets/transport.key`.
The encrypted transfer artifact expires after one day. Plaintext credentials
must never enter Git, container layers, public artifacts or deployment logs.

On the host, decrypt the transfer into a mode-0600 file within the mode-0700
secrets directory, then run:

```sh
sudo python3 deploy/alpha/prepare-config.py \
  --directory /data/wapps-alpha/secrets \
  --firebase-bundle /data/wapps-alpha/secrets/firebase-bundle.json
```

The preparer preserves generated credentials on reruns. It writes separate
service environment files, rejects emulator projects, and restricts the Firebase
credential file to the container's Node user. Do not regenerate `generated.json`
while persistent databases exist. Credential rotation requires a coordinated
provider/database update.

Create the four external volumes once: `wapps-alpha-mysql-data`,
`wapps-alpha-mongodb-data`, `wapps-alpha-rabbitmq-data` and
`wapps-alpha-minio-data`. These names remain stable across candidate and Coolify
Compose project names. Never run two database containers against these volumes.

## Candidate verification and activation

1. Wait for the exact commit's quality and all image jobs to succeed.
2. Set `WAPPS_IMAGE_TAG` to that full SHA and `WAPPS_GATEWAY_PORT=14203` for the
   private candidate. Pull all images and retain their resolved digests.
3. Start the candidate with `docker compose -p wapps-alpha-candidate -f
   compose.alpha.yaml up -d --wait --wait-timeout 300`. Confirm migration/storage
   jobs exited zero, API readiness, real authentication, and persisted writes.
   Qualify the Discussion inventory and erasure prerequisites below before
   opening alpha for use.
4. Stop the candidate without removing its external volumes. Preserve a backup
   before migrating an installation containing user data.
5. Configure the existing Coolify application `f227vpox0oocgqto5ja02wuy` to use
   branch `codex/alpha-full-operation`, the tested commit, `/compose.alpha.yaml`,
   `WAPPS_IMAGE_TAG=<full SHA>` and `WAPPS_GATEWAY_PORT=4203`.
   Both variables must be available at build time and runtime. Apply the raw
   Compose settings in the next section before deploying.
6. Deploy and require matching `/release.json`, API/authentication checks,
   worker health and browser smoke checks through the public origin.

The existing `sandbox3` tunnel on `coolify-01` routes alpha to
`http://localhost:4203`; only the gateway publishes a loopback port. No database,
object-store console, policy API or broker management port is public. The gateway
replaces identity headers using Authenticator and blocks `/api/internal/`.

## Coolify raw Compose settings

The installed Coolify 4.3.23 standard Compose flow replaces service `env_file`
entries with one `.env`. This stack requires its separate provisioned service
files, so set **Compose deployment: Raw (deploy file as-is)** and enable
**Preserve repository during deployment**. Keep the custom start command empty
so startup runs on the host with the preserved repository. Use **Manual
deployments only** and pin the Git commit as well as `WAPPS_IMAGE_TAG`.

The ephemeral Coolify build helper cannot read host service environment files
directly. Before activation, install the non-secret `coolify-helper.sh` from
this directory at `/data/wapps-alpha/helper.sh`, owned by root with mode 0644.
Its allowlist copies only the 13 service environment files into the ephemeral
helper. It never exports transport keys, Firebase credential JSON, or registry
credentials. Do not replace this allowlist with the entire secrets directory.
The script uses a pinned image digest that must already be pulled on the host.

Coolify's custom build field is limited to 255 characters. The verified launcher
for the October 13, 2026 release is:

```sh
sh -c 'set -eu; umask 077; docker run --rm --network none --entrypoint cat -v /data/wapps-alpha/helper.sh:/h:ro sha256:c67055d8db5493dd5051fbf939755f08ea23e13627dc4671661c7a43074ed3f1 /h > /tmp/h; sh /tmp/h; docker compose config --quiet'
```

This immutable local image ID belongs to the release Editorial image. Keep it
available for future deployments, or update the launcher and helper together to
another tested, locally present image. Coolify injects the Compose file,
project directory and build-time environment file flags. Validate the full
configuration import in an isolated official Coolify helper before changing it.
Application images are published by the quality-gated workflow; this command
only imports configuration and validates Compose.

Before loading raw Compose, pre-stage `deploy/alpha/mysql-init.sql` as a regular
file at `/data/coolify/applications/f227vpox0oocgqto5ja02wuy/deploy/alpha/mysql-init.sql`.
The raw parser otherwise attempts to create a directory for the bind source.
The Firebase JSON bind source must already exist from configuration provisioning.

Raw Compose keeps the `wapps-alpha` project name. Check all 17 services: thirteen
long-running containers, three successful migration jobs and successful storage
initialization. OPA and the two materializers have no Docker health probes;
inspect policy behavior and active projection queue consumers separately.

The `identity-events` queue currently has no consumer in this release. Identity
outbox completion confirms broker delivery only. Cross-service account erasure
uses the durable HTTP participant coordinator, not that queue. Retain queued
events and track their consumer/retention work as an open operational gate.

## Account erasure activation

The alpha configuration generator enables both Editorial and Discussion erasure
with their `*_ERASURE_WORKERS_FENCED=true` rollout acknowledgements. These flags
do not establish the prerequisites themselves. Before exposing a fresh deployment,
verify that incompatible writers and materializers are absent, migrations have
completed, current schema-3 Discussion materializers are running, and the
Discussion bucket is dedicated and unversioned. For an upgrade with legacy
writers, keep both acknowledgements false until the migration runbook is satisfied.

Run `node main.js --inventory-payloads` in the Discussion service, review every
planned object, then apply exactly the returned fingerprint with
`--inventory-payloads --apply <fingerprint> --legacy-writers-stopped`. Re-plan
and review additional batches until the inventory records completion. An empty
new bucket still needs the reviewed empty inventory applied. The CLI verifies
bucket versioning and rejects stale fingerprints. See `docs/MATERIALIZATION.md`
for the complete legacy-data prerequisites; do not infer safety from these flags.

During the October 13 rollout, public cleanup testing identified the missing
Discussion acknowledgement. The reviewed empty inventory was applied and the
host Discussion environment was corrected without changing application images.

## Rollback

Record the previous source SHA and resolved image digests before every release.
For a schema-compatible rollback, stop current writers, select the known-good
SHA for all services together, and redeploy through Coolify. Never run older
Account binaries with the newer classified source responses.

Database migrations are not automatically reversible. If schemas are incompatible,
keep writers stopped and restore a coordinated backup of authoritative SQL and
object payloads before restarting the matching version. Rebuild disposable
projections afterward. Restoring the original demo branch restores only the
browser-local preview; it cannot serve or migrate the alpha backend's data.
Do not delete volumes as a rollback mechanism.
