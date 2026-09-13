# Backend SDK

The SDK groups reusable backend capabilities by responsibility:

- `features/identity`: identity model, authentication and account-management libraries, applications, and Firebase/OPA integrations.
- `features/discussion`: discussion core, management service, and materializer.
- `kernel`: common result/types, primitives, event envelopes, and foundational domain models.
- `platform/queue`: transport-independent queue interfaces.
- `extras`: database, object-storage, and RabbitMQ implementations.

Applications own dependency injection and provisioning. Feature code depends on platform interfaces; application bootstrap supplies concrete adapters. Legacy `@foundation`, `@domains`, and `@infrastructure` aliases remain available during migration. The older `platform-queue` convenience API is retained for media ingestion, the editor, and the scraper.

## Authentication

The authenticator uses Firebase for credentials and sessions, and MySQL for application identity state. Firebase UID is the stable identity claim for all providers. On first sign-in, it inserts an active identity; returning users reuse their identity without resetting suspension/deletion flags. Concurrent first sign-ins converge using the unique claim constraint.

The service emits `identity.created` for new rows and `identity.authenticated` for successful sign-ins. RabbitMQ must be available at startup. Publication uses the existing queue API; database writes and queue publication are not an atomic transaction or transactional outbox.

Token validation checks Firebase token revocation and application identity state. Refresh also requires an available application identity. Sign-out revokes the user's Firebase refresh tokens (all sessions for that Firebase user). Optional validation returns anonymous access when authentication cannot be established, preserving the ingress contract.

Google and GitHub OAuth require a verified provider email. Existing Firebase accounts are reused only when enabled and email-verified; otherwise linking is rejected. New accounts are created through Firebase Admin. Email/password and anonymous sign-in use Firebase REST.

The portals use `BffAuthenticationService` when configured with `authBffUrl`; the explicit local demo fallback remains a mock. The interceptor sends tokens only to the portal origin, configured authenticator origin, and explicitly configured `authenticatedOrigins`. It shares in-flight refreshes and retries with the new access token. Registration and password-reset demo handlers retain their prior behavior; this refactor does not implement those flows.

## Local verification

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx run-many -t test -p sdk-features-identity-authentication,sdk-features-identity-applications-authenticator,identity --runInBand
NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx run-many -t build -p sdk-features-identity-applications-authenticator,sdk-features-identity-applications-management,sdk-features-discussion-applications-management,sdk-features-discussion-applications-materializer,discussion-csr,aggregator-demo-csr
kubectl kustomize environments/dev/apps/authenticator-kustomization
```

## Deployment configuration

Authenticator runtime requires:

- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USERNAME`, `MYSQL_PASSWORD`.
- `QUEUE_HOST`, `QUEUE_USERNAME`, `QUEUE_PASSWORD`; optional `QUEUE_PORT` (5672) and `QUEUE_VHOST`.
- `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY`, and Firebase Admin application-default credentials (the Kubernetes service-account JSON mount).
- `INGRESS_AUTH_SECRET` to authenticate ingress-generated headers downstream.
- `ENABLE_GOOGLE` / `ENABLE_GITHUB` and their client IDs/secrets when enabled; `ENABLE_ANONYMOUS=true` to permit guest sign-in. Email/password defaults to enabled.
- `ALLOWED_ORIGINS` for the portal origins as a comma-separated list.

The authenticator workflow provisions `authenticator-runtime` from environment variables `IDENTITY_MYSQL_HOST`, `IDENTITY_MYSQL_PORT`, `IDENTITY_MYSQL_DATABASE`, `QUEUE_HOST`, `QUEUE_PORT` and secrets `IDENTITY_MYSQL_USERNAME`, `IDENTITY_MYSQL_PASSWORD`, `QUEUE_USERNAME`, `QUEUE_PASSWORD`. Existing Firebase secrets are still required. Optional OAuth/allow-origin settings can be supplied through the runtime secret or an environment overlay.

The configured MySQL database must already exist. An explicit TypeORM migration creates the `identities` table on application startup; schema synchronization is disabled. The database account needs table-creation/migration privileges. This does not import legacy Mongo identity records: preserve/backfill application account restrictions before a production cutover, or use a fresh development database. Existing sessions without a MySQL identity must sign in again.

Builds and tests do not exercise a live Firebase project, MySQL server, RabbitMQ server, or deployed ingress. Before production rollout, verify real sign-in, repeat OAuth sign-in, refresh, sign-out, disabled identities, and event consumption with the target environment's configuration.
