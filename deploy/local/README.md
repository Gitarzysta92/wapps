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
Discussion, Account Management, Firebase Auth Validator, Content Node Registry,
Discussion Materializer, Media Ingestion, MySQL, MongoDB, RabbitMQ, MinIO, OPA,
the Firebase Auth emulator, and an Nginx gateway. The browser portals use CSR;
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
| Authentication BFF | http://localhost:8080 |
| Firebase Auth emulator REST API | http://localhost:9099 |
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

The Firebase emulator uses the isolated `demo-wapps` project. No Firebase account,
service-account key, or Google/GitHub OAuth credentials are needed for email and
password authentication. Create a user using the emulator REST API shown below, then sign in through
the Discussion portal:

```sh
curl 'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=local-emulator-key' \
  -H 'Content-Type: application/json' \
  -d '{"email":"developer@example.test","password":"wapps-local-password","returnSecureToken":true}'
```

Production Firebase endpoints remain the default outside
Compose; only `FIREBASE_AUTH_EMULATOR_HOST` activates emulator routing.

The gateway validates bearer tokens through the auth service and replaces incoming
identity headers before forwarding API requests. Public requests remain anonymous.
Same-origin `/api/discussions`, account routes, and `/api/catalog` go to their
respective services. Each app keeps its existing feature configuration: demo
portals may still show mock content where the app already uses mock providers.

MySQL creates the Editorial, Discussion, Identity, and Content Node Registry databases on
first initialization. Applications create their schemas and seed data using their
existing development behavior. Discussion creates its content bucket in MinIO.
Named volumes preserve databases, queues, object storage, and emulator accounts.
The emulator exports accounts on graceful shutdown.

## Everyday commands

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
