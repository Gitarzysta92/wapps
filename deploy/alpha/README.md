# Wapps alpha on Coolify

Alpha runs the API-mode aggregator and real backend services at
https://alpha.wapps.ai. Source development comes from `codex/full-operation`;
release snapshots use `codex/alpha-full-operation`. The original demo release is
`c965790e063139bcd5e6bacc759f289703e4ea9a` on `codex/coolify-alpha`.

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
4. Stop the candidate without removing its external volumes. Preserve a backup
   before migrating an installation containing user data.
5. Configure the existing Coolify application `f227vpox0oocgqto5ja02wuy` to use
   branch `codex/alpha-full-operation`, the tested commit, `/compose.alpha.yaml`,
   `WAPPS_IMAGE_TAG=<full SHA>` and `WAPPS_GATEWAY_PORT=4203`.
6. Deploy and require matching `/release.json`, API/authentication checks,
   worker health and browser smoke checks through the public origin.

The existing `sandbox3` tunnel on `coolify-01` routes alpha to
`http://localhost:4203`; only the gateway publishes a loopback port. No database,
object-store console, policy API or broker management port is public. The gateway
replaces identity headers using Authenticator and blocks `/api/internal/`.

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
