# Wapps locally with Docker Compose

Run from the repository root with Docker Desktop running (or Docker Engine and
Compose v2 on Linux). The initial build downloads dependencies and compiles the
apps; allow several GB of disk space and at least 8 GB of Docker memory.

```sh
COMPOSE_BAKE=false docker compose --parallel 2 build
docker compose up -d --wait --wait-timeout 300
docker compose ps
```

The default stack includes four browser portals, Editorial, Catalog BFF,
Discussion, Account Management, Authenticator, Content Node Registry,
Discussion Materializer, Media Ingestion, MySQL, MongoDB, RabbitMQ, MinIO, OPA,
and an Nginx gateway. The browser portals use CSR;
the alternative aggregator SSR/SSG entrypoints are not separate local services.

| Component | Local address |
| --- | --- |
| Aggregator demo | http://localhost:4200 |
| Discussion portal | http://localhost:4201 |
| Catalog portal | http://localhost:4202 |
| Aggregator | http://localhost:4203 |
| Catalog API / Swagger | http://localhost:3001/api/docs |
| Editorial API / Swagger | http://localhost:1337/api/docs |
| Discussion API / Swagger | http://localhost:1338/api/docs |
| Account API / Swagger | http://localhost:1340/api/docs |
| Content Node Registry / Swagger | http://localhost:1341/api/docs |
| Portal authentication (BFF) | http://localhost:4203/auth/methods |
| Authenticator (owner/debug) | http://localhost:8080 |
| RabbitMQ management | http://localhost:15672 |
| MinIO console | http://localhost:9001 |
| MinIO S3 API | http://localhost:9000 |
| OPA | http://localhost:8181 |

Use `localhost` in the browser. Host ports bind to loopback. MySQL is available
at localhost:3306 and MongoDB at localhost:27017. Local infrastructure credentials
are `wapps` / `wapps-local-password`; MongoDB authenticates against `admin`.
Optional overrides are documented in `.env.example`. These are local development
credentials, and this configuration is not a server deployment configuration.

## Authentication and data

Compose explicitly sets `AUTH_PROVIDER=local` in Authenticator and its separate
migration job. Authentication owns the `authentication` database and its dedicated
SQL user; Account owns Identity data and reaches Authentication through its private
HTTP contract. The local MySQL image provisions these separate grants on fresh
volumes. `LOCAL_AUTH_DATABASE_PASSWORD` overrides the credential database password
(16-128 URL-safe letters, digits, underscores or hyphens). Local email/password
credentials and sessions live in MySQL; Firebase is not initialized or contacted.
The old emulator service is
available only under the optional `firebase-emulator` Compose profile and is not a
dependency of the default stack. OAuth, anonymous credential accounts and email
verification/recovery delivery are unavailable in local mode. Public browsing
continues to use anonymous ingress requests.

Use the existing registration screen, or register through the BFF:

```sh
curl 'http://localhost:4203/auth/register' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: developer-enrollment-1' \
  -d '{"email":"developer@example.test","password":"wapps-local-password","passwordConfirmation":"wapps-local-password","nickname":"Local Developer"}'
```

Sign in at `/auth/signin` with that email/password. Refresh and sign-out also cross
BFF. A refresh rotates both opaque tokens; sign-out revokes every session for that
local subject. The access lifetime is one hour and the refresh lifetime is seven
days from initial sign-in. Password changes revoke sessions. SQL retains credentials
and sessions across service restarts.

For a local operator account, register through BFF first, then use the same email
and password with this CLI to assign explicit roles. This CLI is not a browser
endpoint:

```sh
export LOCAL_AUTH_USER_PASSWORD='choose-a-local-password'
docker compose run --rm --no-deps \
  -e LOCAL_AUTH_USER_EMAIL=operator@example.test \
  -e LOCAL_AUTH_USER_PASSWORD \
  -e LOCAL_AUTH_USER_ROLES=admin \
  authenticator node main.js --local-user
unset LOCAL_AUTH_USER_PASSWORD
```

The CLI requires credential migrations first, verifies existing credentials on
replay, assigns only the explicitly supplied roles/tenant, and revokes sessions
after a claims change. It does not create or change a Wapps identity/profile.
`LOCAL_AUTH_USER_TENANT` is optional.
Ordinary registration cannot choose identity IDs, roles or tenants. The default
local account has no extra claims; application authorization still uses OPA.

See [local authentication](../../docs/LOCAL-AUTHENTICATION.md) for migration,
provider replacement, qualification and limits. Existing emulator/Firebase
accounts and their data are preserved. They are not linked to new local accounts
by email. Moving existing accounts to another provider requires an explicit
verified subject mapping and a credential/job migration.

For a legacy installation, see the [staged migration procedure](../../docs/LEGACY-IDENTITY-MIGRATION.md).
`LOCAL_IDENTITY_DATABASE` selects the canonical schema for Account and its migration
job together (default `identity`). It does not create or populate a replacement
schema. Keep the legacy source and its guard intact; qualify the staged import
before changing this setting.

The gateway validates bearer tokens through Identity's private validation endpoint,
which verifies credentials through Authentication and checks canonical lifecycle.
It replaces incoming
identity headers before forwarding API requests. Public requests remain anonymous.
Same-origin `/api/discussions` now goes through Catalog BFF, which calls Community.
Its explicit handlers preserve generic JSON bodies, revisions and command keys;
deploy the matching BFF build before activating this ingress configuration. Other
route families have their own entries in `nginx/api.conf`. Staff account
disable/enable/revoke-tokens now cross BFF and require the matching generated
Identity policy and Account build. Remaining credential administration and staff
health routes are pending BFF integration. The October 18 local activation preserves
the old mapping in its source store and imports a restricted stub into the separate
canonical schema; see the
[activation note](../../docs/LOCAL-AUTHENTICATION.md#existing-local-installation-activation).
Local `/auth/*` and `/api/password-recovery` now cross BFF; static `/auth/action`
and `/auth/callback` remain frontend routes. Each app keeps
its existing feature configuration: demo
portals may still show mock content where the app already uses mock providers.

### Authentication-only activation checkpoint

The approved October 18 cutover starts Authentication, Account, Catalog BFF, OPA,
the existing static portal containers and the gateway, with MySQL/RabbitMQ. The
local `.env` and `compose.auth.local` select the staged schema and qualified image
versions. They are private, ignored local configuration. To restart this same
slice after its databases are running:

```sh
docker compose up -d --no-deps --no-build authenticator account-management catalog-bff opa aggregator-csr discussion-csr catalog-csr
docker compose up -d --no-deps --no-build gateway
```

The schemas must already have passed their matching migration jobs. `--no-deps`
deliberately avoids starting legacy domain writers. The normal full-stack Compose
dependency requirements are unchanged. The local gateway resolves the stopped
Editorial, Community and registry services per request; missing services return
errors. Its static `/health` endpoint proves only that nginx is serving requests.
Use the authenticated BFF journey for authentication readiness. This checkpoint
does not qualify domain APIs, old frontend images, browser behavior or full-stack
availability. Preserve new canonical/credential data when rolling back; returning
to the original legacy snapshot would lose accounts created after cutover.

MySQL creates the Editorial, Discussion, Identity, and Content Node Registry databases on
first initialization. Applications create their schemas and seed data using their
existing development behavior. Discussion creates its content bucket in MinIO.
Named volumes preserve databases, queues, object storage and local credentials.
The identity migration job installs the additive local credential tables before
Authenticator and Account Management start.

## Everyday commands

### Private application images

The Editorial media API uses a separate private, unversioned `application-images`
bucket; create it in the local MinIO console before uploading. Compose supplies
local-only credentials and uses `http://localhost:4203` as the public gateway
origin. Override `EDITORIAL_MEDIA_BUCKET` and `EDITORIAL_MEDIA_PUBLIC_ORIGIN` in
`deploy/local/.env` when necessary. Never enable bucket versioning or lifecycle
deletion: cleanup retains empty markers to fence delayed writes.

Run Editorial's explicit migrations before normal API startup, then enable
`EDITORIAL_MEDIA_CLEANUP_ENABLED=true` for continuous retirement. It defaults to
disabled, so provisioning mistakes cannot masquerade as working cleanup.

```sh
docker compose run --rm --no-deps editorial node main.js --migrate
docker compose run --rm --no-deps editorial node main.js --media-cleanup-status
docker compose run --rm --no-deps editorial node main.js --media-cleanup
docker compose run --rm --no-deps editorial node main.js --media-cleanup-requeue IMAGE_UUID
```

These commands require the configured MySQL/MinIO services to be running. The
cleanup batch runs at most 20 attempts; failed jobs retain their image IDs and
can be requeued after fixing storage access. Exit 2 means work is failed,
scheduled for retry or unconfirmed. Historical references retain their images.
Portal media controls and full-stack deployment qualification remain open.

### Containers

```sh
docker compose logs -f discussion discussion-materializer
COMPOSE_BAKE=false docker compose --parallel 2 build discussion
docker compose up -d --wait discussion
docker compose down
```

`down` preserves data. **`docker compose down --volumes` deletes local stack data.**
Database initialization scripts run only for an empty volume; changing the local
password later does not rotate credentials in existing databases.

## External integrations

These services are defined but excluded from default startup because they contact
external services. Supply their variables in `deploy/local/.env` before enabling
them. Run only the profile you intend to use:

```sh
docker compose --env-file deploy/local/.env --profile ai up -d --build editor-agent
docker compose --profile scraper run --build --rm store-app-scrapper
docker compose --env-file deploy/local/.env --profile discord up -d --build discord-notifier
```

The editor needs an OpenAI key. The scraper accesses store.app and publishes work
to local RabbitMQ. The Discord notifier needs Discord, GitHub, OpenAI, and ArgoCD
credentials; its existing implementation still monitors ArgoCD. It is not needed
to run Wapps locally. OpenSearch is omitted because the currently wired services
do not use it. No Kubernetes, Vault, or threesixty setup is needed.

## Verification

```sh
docker compose config --quiet
node deploy/local/smoke-test.mjs
```

The smoke test checks portal HTML, API readiness, and an emulator login/refresh
cycle through the local auth service. It creates a temporary emulator user and
removes it afterward.

Reference: [Firebase Auth emulator](https://firebase.google.com/docs/emulator-suite/connect_auth).
