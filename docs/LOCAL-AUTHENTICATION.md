# Independent local authentication

## Process boundary

Authentication is a separate, swappable process. The production local path is:

```text
Browser -> Catalog BFF -> Identity/Account -> Authentication
                               |                  |
                        Identity database   Credential database
Gateway -> private Identity validation -> Authentication token verification
```

Authentication owns password verification, opaque access/refresh sessions,
revocation and credential persistence. It exposes the service-only `/credentials/*`
contract. It has no Identity/Account SQL adapter, profile enrollment, lifecycle
outbox or broker worker. Its database user cannot access the Identity database.
Startup, migration and operator provisioning refuse a schema containing tables
outside the credential schema; a mistakenly reused Identity database fails closed.

Identity/Account owns stable Wapps IDs, lifecycle, profiles and verified mappings
from the exact `(issuer, subject)` pair to a Wapps ID. New IDs are independently
generated. No email matching, implicit adoption of old subjects, automatic account
linking or ownership rewriting occurs. The mapping, new canonical identity and
creation outbox event commit in one SQL transaction. The existing enrollment,
revision, export, erasure-provider plans and durable deletion jobs retain their
meaning. Mapping tombstones remain after deletion to prevent resurrection.

Identity/Account uses `RemoteCredentials` for sign-in, registration, refresh,
verification, credential changes, revocation, recovery, export and deletion.
It does not initialize Firebase or instantiate local credential adapters.
Identity resolves a subject before emitting any Wapps actor ID. Canonical
suspension/deletion and owning-service policies remain authoritative. Existing
trusted claim semantics are preserved: the credential implementation supplies
claims and consumer policies interpret them; this change does not introduce
an independent role-management service.

The browser retains `/auth/*` and `/api/auth/*`; both gateway configurations send
these through BFF. BFF calls Identity's `/api/auth/*` routes. Password recovery
also crosses BFF. BFF does not know authentication database settings, its service
secret or subject bindings. Gateway validation now calls the private Identity
routes `/api/internal/authentication/validate` and `validate-optional`. Browser
access to `/api/internal/` is blocked. No frontend files or presentation change.

## Credential contract

All operations are POSTs with JSON bodies, under `/credentials/`. Authentication
requires the dedicated `X-Credential-Service` secret. Browser Authorization and
trusted user/ingress headers are rejected on these internal requests. Secrets
must be 32-128 URL-safe characters; Account rejects reuse of its ingress/export/
erasure/notification credentials.

| Operation | Request fields | Successful value |
| --- | --- | --- |
| `password-session` | email, password | subject, token, refreshToken, expiresIn |
| `registration` | email, password, key | session fields plus enrollmentEligible |
| `refresh` | refreshToken | session fields |
| `verify-token` | token | subject, optional email/authTime/claims |
| `revoke`, `delete` | subject | confirmed: true |
| `update` | subject, patch | confirmed: true |
| `export` | subject | complete credential export entries |
| `password-recovery` | email | confirmed: true |
| `password-reset-verify`, `email-verify`, `email-complete` | code | confirmed: true |
| `password-reset-complete` | code, password | confirmed: true |
| `email-status`, `email-request` | subject, token | status or request outcome |
| `password-reset-link`, `email-verification-link` | subject, email | link |

The success envelope is `{ issuer, value }`, with an exact echoed `subject` for
subject-specific requests. Identity validates the issuer, subject, schema,
completion receipt, HTTP status and JSON content type. Requests are limited to
32 KiB and responses to 256 KiB, with a ten-second dependency deadline. There are
no automatic retries or redirects. Unsupported operations and outages never
produce synthetic success. Untrusted/incorrect service credentials are dependency
failures, not proof that a member supplied a wrong password.

Registration stores a hashed enrollment key in Authentication's own transaction.
Only the matching verified password and original key can recover a new unbound
registration. Old credentials without that receipt cannot create a Wapps identity
through sign-in or signup. Identity owns the subsequent profile enrollment receipt;
a retry preserves existing profile edits. Secrets and eligibility are removed
from the browser session mapping, which returns the stable Wapps ID as `uid`.

Administration translates Wapps IDs into credential subjects. Revocation and
cleanup require confirmation for every binding. Missing bindings or an issuer
that is not configured fail without a completion receipt. Ambiguous credential
edits fail rather than selecting an arbitrary subject. Credential exports remain
within the fixed `credentials` provider in accepted account-export plans; Account
also exports its own binding records. Cleanup keeps existing leases/retries/outboxes.

## Staff administration through BFF

The local and alpha gateway configurations route the entire `/api/admin/users`
family to BFF, including unknown/malformed actions. Deploy Account, BFF, the
generated Identity OPA bundle and gateway configuration together. A22 qualifies
these routes in disposable processes; the running local installation still has
the A21 images until that coordinated rollout is performed.

All target IDs are stable, case-sensitive Wapps IDs. Account authorizes every
operation against canonical actor state and OPA. These are global identity
operations: both `admin` and `identity:admin` credentials with any tenant context
are denied, including lookups and action-link generation. BFF forwards only
verified, allowed context and never obtains credential-service secrets.

| Method and suffix after `/api/admin/users/:uid` | Body | Success |
| --- | --- | --- |
| POST `/disable`, `/enable`, `/revoke-tokens` | none | 201; existing boolean receipt |
| PATCH `/email` | `{email}` | 200 `{updated:true}` |
| PATCH `/password` | `{password}` | 200 `{updated:true}` |
| POST `/unlink-providers` | `{providersToUnlink}` | 201 `{updated:true}` when supported |
| POST `/generate-password-reset-link`, `/generate-email-verification-link` | `{email}` | 201 `{link}` when supported |
| DELETE (no suffix) | none | 202 `{identityId,revision,status:"accepted",cleanup}` |
| GET `/identity` | none | 200 canonical identity state, or JSON `null` if absent |
| GET `/deletion-status` | none | 200 deletion receipt, or JSON `null` if no deletion is accepted |

No query parameters are accepted. Credential bodies reject unknown fields and
bound email/password/provider values; gateway bodies are capped at 8 KiB. Downstream
requests have a ten-second deadline and bounded bodies/responses. Receipt schema,
target identity, HTTP status and JSON content type must match; action links must
use HTTPS without URL credentials. Responses are private/no-store. Mutations are
never automatically retried or redirected after an ambiguous response.

Local email/password edits revoke existing access and refresh sessions while
preserving the Wapps identity and its profile/ownership. Unlinking is unsupported
and returns 400; reset/verification-link generation returns 503 because no local
email channel exists. Those failures are not successful provider qualification.

Deletion acceptance atomically tombstones the account and schedules existing
credential/account-erasure work. `cleanup` is `completed` only when both journals
confirm the same revision; either terminal failure reports `failed`, otherwise
it remains `pending`. Missing/inconsistent journals return unavailable. Status
reads never create, repair or replay cleanup work. Repeating DELETE preserves
the accepted revision and returns its current cleanup state. Complete privacy
erasure still requires all configured consumer providers and the existing saga.

Credential mutations and link requests emit credential-free actor/target/outcome
audit events. These operational logs do not replace durable audit retention or
provide a new command receipt journal. Deployment, external-provider behavior,
full privacy convergence and original-frontend acceptance remain separate work.

## Local behavior and limits

`AUTH_PROVIDER=local` uses salted scrypt password hashes and random opaque tokens;
only token hashes are stored. Access tokens expire after one hour. Refresh rotates
both tokens and retains the original seven-day refresh deadline. Concurrent
refresh has one winner. Sign-out and credential changes revoke all sessions.
Credentials and sessions survive process restarts. Credential deletion clears
private fields and retains a minimal subject tombstone for idempotent cleanup.

OAuth, anonymous credentials, email delivery, verification and password recovery
remain unavailable in the local simulator. Only password sign-in is advertised.
Email status truthfully reports `verified: false`; unsupported actions return
errors. Public anonymous browsing is separate. Firebase integration remains
deferred. Existing Firebase adapters are retained but are not part of this local
qualification. External-provider, delivery, SSO and multifactor qualification
remain release work.

The operator-only `--local-user` command now manages credentials and claims only.
Prefer registering through BFF first, then supplying the same email/password to
that command to assign operator roles; it revokes existing sessions. A newly
created credential alone has no Wapps account. Its initial enrollment retry key is
`local-user:` followed by the SHA-256 of the lowercase email. Registration must
still cross BFF/Identity with that key before application access. Public signup
never accepts roles or an existing Wapps ID. Global staff administration requires
an unscoped `admin` or `identity:admin` claim; tenant-scoped claims remain denied.

## Configuration and migration order

Local Compose configures separate `identity` and `authentication` schemas and
separate database users. The local MySQL image packages its initializers with
explicit non-executable modes so the upstream entrypoint sources its shell helper
on both Linux and Docker Desktop. The fresh-volume initializer gives the
`authentication` user grants only on its own schema. `LOCAL_AUTH_DATABASE_PASSWORD`
controls its development database password (16-128 URL-safe letters, digits,
underscores or hyphens). Existing database volumes are never reprovisioned by
editing initializer scripts.

Authentication receives `AUTH_PROVIDER=local`, `AUTH_ISSUER`,
`AUTH_SERVICE_SECRET` and its own `MYSQL_*` credentials. Account receives
`AUTHENTICATION_URL`, the same exact `AUTH_ISSUER` and `AUTH_SERVICE_SECRET`, plus
its own Identity database/broker configuration. BFF only needs
`ACCOUNT_MANAGEMENT_URL` for the public authentication facade. Authentication
provider selection is explicit; missing settings never fall back to Firebase.
Local authentication refuses production mode.

For a fresh, separately provisioned local database installation:

1. Build `mysql`, `identity-migrate`, `authentication-migrate`, `account-management`,
   `authenticator` and `catalog-bff` from the same source.
2. Run both migration jobs. They are independent and may run in either order.
   Identity runs canonical migrations plus `CredentialBindings1792281601000`.
   Authentication runs `LocalCredentials1792281600000` and
   `LocalEnrollment1792281602000` in its own database.
3. Start Authentication, Identity/Account and BFF, then recreate the gateway with
   the new private validation route. Confirm the BFF authentication journey.

There is no schema synchronization or startup migration. Both services refuse
pending migrations. Additive migrations do not backfill guessed bindings or alter
existing Wapps IDs. Rollback requires a matching backup; authoritative credentials
and bindings are not dropped by down migrations.

### Existing local installation activation

The staged [legacy migration procedure](LEGACY-IDENTITY-MIGRATION.md) now provides
an explicit import for verified unregistered stubs into a separate canonical
schema. It preserves IDs and archives, imports a restricted identity without a
credential binding, and retains the original migration guard. The user approved
that policy, and the import plus local authentication activation completed on
October 18, 2026. Recovering legacy login access remains a separate operation.

The October 18 activation attempt found one legacy row in
`identity.identity_subjects`. The original guard still refuses that schema; the
verified stub was imported into `identity_canonical` with the same UUID and original
creation time. `authentication` has its own SQL user, and both directions of
database access denial were checked. No local credentials existed to relocate.
The original SQL/Mongo records remain retained and unchanged. Do not truncate the
legacy table or bypass the guard. Existing canonical UIDs need verified bindings; the
new migration deliberately does not infer them from email or historical provider
labels. Existing local credentials, if any, need a reviewed move into the isolated
credential database with session and enrollment continuity accounted for.

The ignored local `.env` selects `LOCAL_IDENTITY_DATABASE=identity_canonical` and
`COMPOSE_FILE=compose.yaml:compose.auth.local`. The latter selects the versioned
local Authentication, Account, BFF and OPA images. Backups and activation evidence
are retained privately in `deploy/local/identity-cutover.local/`. Registration,
sign-in, restart persistence, refresh and sign-out pass through port 4200. The
local gateway resolves stopped domain services only when requested; their routes
remain unavailable. Editorial, Community, registry, materializers and media workers
have not been upgraded or activated. Existing frontend images are unchanged;
frontend merge and browser acceptance are still outstanding.

The alpha Compose topology now has separate migration jobs and removes Firebase
credentials from Account's container mounts. Alpha secrets/config generation,
Kubernetes deployment wiring and external-provider qualification are not completed
by the local runtime slice. Existing generated environment files are insufficient;
do not deploy this branch using the previous shared-database configuration. The
runtime database guard refuses that configuration. No alpha or Kubernetes services
were changed by the local activation.

## Replacing Authentication

Implement the same HTTP contract in another independently running process and
point Identity at it. The process may use another language, storage system or
credential technology; Identity/BFF do not import its implementation. Preserve
issuer and subject continuity when replacing implementation for the same authority.
Changing issuer or subject requires a verified mapping migration that retains the
Wapps identity and ownership. Never infer such a migration from matching email.

The current deployment configures one issuer. Existing bindings for other issuers
are not ignored: administration/export/cleanup fail until their authorities are
configured or the mappings and accepted jobs are explicitly migrated. Concurrent
multi-issuer configuration and public account-linking workflows are not included.

## Qualification

```sh
WAPPS_LOCAL_AUTH_INTEGRATION=1 node --test tools/readiness/local-auth.test.cjs
```

Build the three services and their prerequisites first, using Node 22.17.1 and
the checked-in lockfile in an isolated installed snapshot. The external test uses
fresh disposable MySQL 8.4, RabbitMQ 4, OPA 1.4.2 and Nginx 1.28 containers. It
starts real production service bundles without Firebase settings and cleans up
only its own resources.

The test exercises separate SQL grants in both directions, refusal of a shared
schema, exact issuer/subject isolation, stable Wapps IDs, concurrent registration,
credential and canonical-outbox rollback/retry, missing-binding denial, session
rotation/expiry/revocation, restart, real OPA administration through both gateways,
secret-free exports, canonical deletion, durable credential cleanup and outages.
A second standalone token-verification process with no database configuration
proves that existing identity/profile resolution and suspension do not depend on
the local implementation. This alternate probe does not implement the entire
credential lifecycle contract; that lifecycle is qualified against the local
Authentication process. Architecture rule ARCH011 prevents the original direct
adapter/application dependencies from returning.

Evidence and remaining limits are in the A20 implementation checkpoint. No alpha
activation, historical data migration, full distributed erasure/export journey,
abrupt crash/restore/load test or frontend visual acceptance is claimed.
