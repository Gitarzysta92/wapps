# Workspace verification

## Operational foundations

`WAPPS_OPERATIONAL_INTEGRATION=1 node --test tools/readiness/operational-foundations.test.cjs`
runs the two Editorial SQL/projection recovery qualifiers against this invocation's
disposable Docker stores, then qualifies scoped Editorial/BFF readiness with real
OPA, SQL, Mongo, RabbitMQ and a separate materializer. Build Editorial/BFF with
prerequisites first. Nested qualifiers must emit one passing, non-skipped test;
an inherited Node test context or empty output cannot count as qualification.
See [the readiness contract and operator runbook](../../docs/EDITORIAL-CATALOG-READINESS.md).

Docker gateway qualification leaves `WAPPS_NGINX_BINARY` unset. The local-auth
harness preserves the checked-in bounded upstream pools, substitutes only service
addresses and also starts the complete local and alpha gateway configurations.
It adds 1,600 bounded authenticated reads through all four gateways/includes,
invalid-token checks and independent Account/BFF restart recovery, with no request
retry or pacing. Keep profile/member/export/erasure/suite/application/article extensions in
separate invocations. I28 qualifies the original six on its combined source; its command/log
index is `/tmp/wapps-integration-a28-20261018-l4s2868l/verification.json`.
Native Nginx remains an optional comparator, not a substitute for Docker evidence.

## Local authentication and BFF

### Article publication, covers and current comment authority

Run `WAPPS_LOCAL_AUTH_INTEGRATION=1 WAPPS_ARTICLE_PARITY_INTEGRATION=1
node --test tools/readiness/local-auth.test.cjs` after all builds finish in a fresh
Node 22.17.1 lockfile installation. The article extension is the seventh mutually
exclusive extension. `WAPPS_ARTICLE_LOCAL_ONLY=1` first qualifies local article
routes with alpha unchanged; omit it for both checked-in Docker API/auth/media
configurations. Keep `WAPPS_NGINX_BINARY` unset for acceptance.

The [article qualification contract](../../docs/ARTICLE-PARITY-QUALIFICATION.md)
maps accepted frontend data requirements and documents real sessions, controlled
operator claim setup, fresh Editorial/Discussion stores, actual broker workers,
frozen text/classification/media, rollback/replay, cover bounds/cancellation,
dependency failures and the 90-request BFF-stopped matrix. Current withdrawal
denies comments despite retained projections, with republication restoring the
same association. The local and both-gateway runs each pass 29 groups, including
the unchanged 1,600-request transport check. Application-image alpha parity and
original presentation acceptance remain separate. The six existing extensions
also pass separately: 25 profile, 25 member, 27 export, 31 erasure, 29 suite and
31 application groups, including overlapping baseline checks. The first member
run receives 504 instead of exact 502 with BFF deliberately stopped; its unchanged
rerun passes. Both attempts are retained without changing the shared assertion.
Exact commands, hashed logs, source/patch verification and cleanup:
`/tmp/wapps-article-parity-20261018-ow5ug443/verification.json`.

### Full account erasure (A28)

The current independent Authentication/Account entrypoint is
`WAPPS_LOCAL_AUTH_INTEGRATION=1 WAPPS_ERASURE_PARITY_INTEGRATION=1 node --test tools/readiness/local-auth.test.cjs`.
Build the complete snapshot first. Use only the runner's fresh stores; the erasure
extension runs separately from profile/member/export/suite/application/article extensions. See
[the A28 qualification contract](../../docs/ACCOUNT-ERASURE-QUALIFICATION.md) for
commands, process fences/inventory evidence, supplemental regressions and limits.
The historical Firebase export/erasure composition is not the current entrypoint.

### Application publication and ownership parity

Run `WAPPS_LOCAL_AUTH_INTEGRATION=1 WAPPS_APPLICATION_PARITY_INTEGRATION=1
node --test tools/readiness/local-auth.test.cjs` in a fresh Node 22.17.1 lockfile
installation after all builds finish. Profile, member, export, erasure, suite,
application and article extensions are mutually exclusive. `WAPPS_APPLICATION_LOCAL_ONLY=1` limits the new
application workflow to local ingress for qualification before an alpha route change;
omit it for the required local/alpha comparison. Shared authentication checks still
run against both configurations.

`application-parity-services.cjs` owns fresh Editorial SQL, Mongo, MinIO, real OPA,
the compiled API/materializer and the parent qualifier's RabbitMQ. The shared
`ownership-dns-fixture.cjs` supplies controlled UDP TXT responses to the production
Node DNS resolver. This substitutes public authoritative DNS propagation, while
preserving exact challenges, negative responses, failures and bounded recovery.
Real local credentials and canonical Identity/Account resolution authorize every
portal workflow; the test provider assigns dedicated staff claims before sign-in.

The application qualifier exercises frozen submission/classification, independent
content and ownership decisions, immutable media, canonical grants, revoke/release,
claim-bound drafts, revision/key conflicts, concurrent replay, SQL/outbox rollback,
broker projection lag and old-event suppression. DNS recovery expires only its own
failed lease, kills Editorial and retries the original command after restart.
Full route-family case/slash/unknown-suffix and command checks stop BFF to detect
owner fallbacks. Object/projection/owner/policy failures must recover truthfully.

`application-parity-privacy-checks.cjs` exercises existing Editorial participant
hooks after canonical self-deletion, then obtains successor ownership. Its own
materializer is stopped before enabling the disposable erasure fence. It verifies
retained approved content/media, private provenance removal and the permanent
ownership fence. Full Account erasure orchestration, credential cleanup convergence,
other participants and their final receipts are covered by the separate A28 extension.
Archived data and production fencing remain release dependencies.

Leave `WAPPS_NGINX_BINARY` unset for required Docker qualification; set it explicitly
only for a native comparison. Both checked-in API/auth configurations retain their
own routes; only listener/dependency addresses change.
Local application media is included for the necessary publication round trip;
alpha media keeps its separate routing and is not qualified by that round trip.
The complete gateway startup check also uses Docker. I28 passes the combined
Docker workflow; native results alone do not establish container transport. Public
DNS/TLS, browser acceptance and deployment remain separate.

Additional isolated regressions use `WAPPS_SUITES_OPA_DOCKER=1` and a unique
`WAPPS_SUITES_OUTPUT` with `node tools/readiness/qualify-suites.cjs
--application-ownership --ownership-http --no-browser`, then a separate run with
`--application-publication --delivery --no-browser`. These preserve controlled
setup identities/direct projection where documented and add competing claims,
reviewers, rebase, migration guards, broker acknowledgement/rebuild/reordering.

### Suite lifecycle and publication parity

Set `WAPPS_LOCAL_AUTH_INTEGRATION=1 WAPPS_SUITE_PARITY_INTEGRATION=1` when running
`node --test tools/readiness/local-auth.test.cjs` to exercise the suite vertical
slice through both gateway configurations. Build Editorial, Authentication,
Account and BFF with prerequisites before running; do not rebuild their `dist`
while runtime qualification is active. Use a separate clean-lockfile installation
and uniquely named disposable stores for each parallel lane.

`suite-parity-services.cjs` starts test-owned MySQL schema access, Mongo, Editorial
OPA and the compiled Editorial process, using the parent qualifier's fresh
RabbitMQ. `bff-suite-parity-checks.cjs` uses real enrolled credentials and reviewer
claims, the checked-in BFF handlers and the actual Editorial broker materializer.
Application prerequisites are created and independently approved through local
BFF; no manual projection publication is used. A withdrawn suite's retained
snapshot is removed explicitly in the disposable SQL store to reproduce the old
deletion representation and prove continued 404/non-resurrection behavior.
Suite commands cover owner/tenant/self-review denial, concurrent/exact receipts,
revision and key conflicts, SQL/outbox rollback, frozen review, rejection and
resubmission, approved classification, missing/hidden members, process restarts,
projection lag, dependency failures and full gateway families with BFF stopped.

Private suite removal now preserves approved publication. The owner retains
publication status and withdrawal access after private removal; edits, submission
and review of that removed draft remain denied. Withdrawal immediately revokes
public authority even while a previous projection remains. A confirmed outbox row
is re-exposed to simulate lost publisher acknowledgement; this is an explicit
fault injection, not an abrupt-process-crash qualification.

`suite-parity-privacy-checks.cjs` exercises the existing bounded Editorial export
stream and suite-only Editorial erasure participant, including canonical Account
self-deletion, exact participant receipts, provenance cleanup and anonymous
retained publications. Public erasure advances the publication revision while
preserving its frozen content. Only the disposable participant is enabled and its
materializer is fenced. This does not complete the Account export archive or
cross-service provider saga; A27/A28 privacy qualification remains separate.

Leave `WAPPS_NGINX_BINARY` unset for Docker; set it explicitly only for native
comparison. Both checked-in API/auth configurations use temporary listener/dependency
addresses; unrelated media is excluded. I28 qualifies suite transport alongside
the complete Docker gateways. No live activation, browser presentation acceptance,
external providers or backup/restore is implied.

### Authentication baseline

`WAPPS_LOCAL_AUTH_INTEGRATION=1 node --test tools/readiness/local-auth.test.cjs`
qualifies the built Authenticator, Account Management and BFF with the checked-in
local Nginx routes, fresh disposable MySQL/RabbitMQ stores, real OPA and no Firebase settings.
Build those services and their prerequisites first. The qualifier builds the
checked-in `deploy/local/mysql/Dockerfile` under a random test tag and runs its
actual fresh-volume initializers, including the separate credential user/grants.
It removes that tag during cleanup. Docker images `mysql:8.4`,
`rabbitmq:4-management`, `openpolicyagent/opa:1.4.2-static` and `nginx:1.28-alpine` must be cached locally. Only random-
named test containers/images are created/removed; no existing Wapps store is used.

Twenty-one baseline groups cover complete Docker gateway transport plus staged legacy import, registration/replay, independent sessions, concurrent refresh,
expiry, sign-out, process restart, canonical suspension/deletion, operator claims,
password updates, transaction fault/retry, private export allowlists, durable
credential cleanup and provider/database failures. The staff group exercises both
local and alpha admin routing, global/tenant/nonstaff policy, forged headers, exact
subjects, policy outage, SQL rollback, canonical revisions/outbox, suspension,
re-enablement and all-session revocation. Authentication aliases also cross BFF in both route sets. Separate SQL users cannot
read each other's databases; a misplaced migration against Identity is refused.
An independent token-verifier process retains the same Wapps identity/profile and
canonical suspension. The probe does not qualify a complete alternate credential
provider. Fault triggers are enabled
only in the disposable database. This external suite is separately inventoried;
portable tests do not report it as a pass. Full browser fidelity, external
email/SSO, abrupt crashes and backup/restore remain outside this qualification.

The legacy group imports only a synthetic unregistered stub into the qualifier's
fresh canonical schema. It proves exact identity/public IDs, inactive access,
absence of credential links, atomic outbox/receipt rollback, concurrent replay,
changed-plan denial and preservation of later state. Actual source inspection and
the separate copied-store rehearsal are documented in
`docs/LEGACY-IDENTITY-MIGRATION.md`; this test does not authorize live account policy.


The A22 administration extension is in `bff-account-admin-runtime-checks.cjs`,
called by the same local-auth qualifier. Both gateways exercise email/password
changes, session revocation, staff/tenant/forged denial, exact identity lookup,
rollback/retry, deletion replay and read-only cleanup state. BFF outage/recovery
checks prove all added routes avoid direct-owner fallback. Local unlink and email
action links fail explicitly; successful external-provider behavior is unverified.
Credential cleanup alone must leave account erasure pending. A terminal erasure
failure is injected only in the fresh fixture; full erasure completion remains a
separate qualification. This extension does not activate the running installation.

The A24 settings extension is in `bff-account-settings-runtime-checks.cjs`, called
by the same suite. Eight added groups qualify private account/profile/preferences
and avatar contracts in both gateway configurations: canonical/case/slash and
unknown paths, forged-context/query/body rejection, shared revisions, concurrent
and historical replay, SQL outbox rollback, isolation, real image conversion,
process restart, removal, policy/owner failures and no direct fallback when BFF
stops. Private missing/foreign avatar reads preserve Account's 403 contract.
The owner outage replaces only the test BFF's Account origin with an unavailable
loopback address; real Account remains available for ingress authentication.
Self-deletion acceptance creates the canonical tombstone and denies access while
reporting pending cleanup; it does not prove full erasure. Application/article
media includes, browser fidelity and the other route families in
`docs/BFF-ROUTE-PARITY.md` are outside this extension.

### Public profile gateway parity

Set both `WAPPS_LOCAL_AUTH_INTEGRATION=1` and
`WAPPS_PUBLIC_PROFILES_INTEGRATION=1` when running `local-auth.test.cjs` to add
`bff-profile-parity-runtime-checks.cjs`. Build Editorial, Community management and
the Discussion materializer as well as the three Identity/BFF services. Cache
`mongo:7` and `minio/minio:RELEASE.2025-04-22T22-12-26Z` in addition to the images
listed above. `profile-parity-services.cjs` starts fresh source schemas, Mongo,
claimed empty MinIO storage and separate real Editorial/Discussion OPA bundles;
only its disposable Discussion materializer consumes the test broker.

The extension exercises both checked-in API/auth gateway configurations, real
credential sessions, public/followers/private audiences, contact/photo privacy,
sharing switches, nonempty Editorial/Community content, truthful projection lag,
follow approval/cancellation/removal, global badge staff policy, rollback/replay,
independent process restart, dependency outages and BFF shutdown across complete
route families. GET bodies, selectors, malformed IDs/cursors, unsupported methods,
case/slash variants and unknown suffixes are included.

`profile-parity-content.cjs` provisions reviewed publications through real Editorial
HTTP APIs using trusted test identities tied to the canonical enrolled accounts.
Those setup requests supply the reviewer claim directly; they do not qualify the
Editorial browser authoring/administration path. Editorial projections are produced
by direct invocation of its production snapshot reader/projector; Discussion uses
the actual broker consumer. All shared-profile requests and Discussion commands
use the real authenticated BFF gateway. Dependency addresses are substituted and
the unrelated application/article media include is excluded. No live deployment,
frontend acceptance, mature-content filtering, full author erasure, abrupt-crash
recovery or production load/restore is established by this extension.

For an explicit native gateway comparison, set `WAPPS_NGINX_BINARY` to an absolute
Nginx executable built with the auth-request module and regular-expression support.
`native-qualification-gateway.cjs` uses the same local/alpha API/auth includes,
substituting temporary paths and loopback listener/dependency addresses. Docker
remains the default and is never silently replaced. The complete local gateway
startup check still uses its Docker image. The A25 passing run uses native Nginx
1.28.3; repeated Docker-to-host transport stalls are retained as failed evidence,
not claimed fixed or accepted as passing container qualification. Test listeners
use checked free ports below the usual ephemeral range; request timeouts and
intentional concurrent commands are unchanged. A native comparison is not Linux
container/deployment or load acceptance.

### Favorites and inbox gateway parity

Run the A26 extension separately from the public-profile extension:

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false \
  WAPPS_LOCAL_AUTH_INTEGRATION=1 WAPPS_MEMBER_PARITY_INTEGRATION=1 \
  node --test tools/readiness/local-auth.test.cjs
```

It uses the same prerequisites, fresh stores and source setup described above.
Finish all builds before starting either runtime suite: service restarts read
`dist`, which a concurrent build can replace. All six extension flags are mutually
exclusive. Leave `WAPPS_NGINX_BINARY` unset for the required Docker run. A26's
historical native-only limitation is superseded by I28's combined Docker regression;
a native comparator still does not establish deployment acceptance.

`bff-favorites-inbox-parity-checks.cjs` enables actual reply/mention/watch workers
only in disposable Account. It covers all four favorite kinds; General/Mature/
unclassified filtering in favorite metadata and five shared-profile sections;
anonymous/current viewer choices; complete route variants, body/query/forged-context
denial; concurrent/historical replay, conflicts, SQL/outbox rollback, independent
sessions/restarts, notification privacy/read state, pagination, current suppression,
target withdrawal, removal during source outages, watch re-add baselines and BFF
shutdown without owner fallback. Account's real delivered/suppressed SQL receipts
and source acknowledgements are checked.

The qualifier resets acknowledged Discussion rows in the fresh test schema to
simulate acknowledgement loss after receipt commit. It sets test watch
`availableAt=0` to advance the scheduler without waiting for the production polling
interval. Production resolution/delivery/receipt code is used in both cases; these
fault substitutions do not prove an OS-process crash window. Editorial uses trusted
canonical setup claims and direct production projection, while Discussion uses its
actual broker materializer. No live stores or workers are changed. Quarantine/requeue
operations, full export/erasure, external notification channels, browser acceptance,
Docker transport stability, deployment, backup/restore and load/soak remain separate.

## Generic Review owner API and BFF

The October 18 Review slice uses the same disposable `--discussion-bff` qualifier
described below. `bff-reviews-runtime-checks.cjs` adds four Review groups: historical
SQL receipts and concurrent replay; exact key/tenant/author isolation; helpful votes,
immutable report evidence and independent moderation/withdrawal; atomic journal
rollback, target/policy outage, Mongo independence and owner/BFF recreation. Both
local and alpha nginx routes must traverse BFF. Direct owner `/application-reviews`
returns 404; the BFF constructs keys for generic `/reviews` requests.

The fixture seeds a receipt with the previous SQL scope/fingerprint, injects a
temporary failing journal trigger only in the claimed disposable database, and
removes it before retrying. No schema migration is added. Authentication, policy
and parent authority remain controlled fixtures. The new management/HTTP suites
also exercise unfamiliar keys without Wapps parsing in reusable code. Arbitrary
new consumers need their own authority/repository composition; this is not a new
generic SQL store or qualification of real Firebase/OPA/Editorial.

## Generic Discussion owner API and BFF

October 18 route consolidation uses one reusable `/api/discussions` controller for
both scoped and keyless contracts. `/api/discussion-bindings` must return 404.
The HTTP library suite tests cross-scope denial, malformed/repeated key rejection,
legacy list/detail shapes and likes, plus keyed replies/votes/pins/discovery.
Community metadata tests require exactly one registered discussion controller.
Use the same real-store qualifier below for the consolidated routes; BFF and
Account clients must be from the same source version as Community. No additional
database migration is introduced by the route cleanup.

Run `node tools/readiness/qualify-materialization.cjs --discussion-bff` for the
bound and unbound Discussion integration. It requires the runner's existing cached
store images plus `nginx:1.28-alpine`, Docker access and temporary HTTP listeners.
All stores and the nginx container are disposable; the existing fresh-object-store
guard runs before mutations. Do not point it at shared stores. The runner exposes
only the selected temporary container ports on host loopback; nginx reaches the
temporary Node listeners using `host.docker.internal`.

The qualifier loads production BFF and Community controllers/clients, migrations,
SQL and object adapters, outbox dispatcher and materialization code. It exercises
the repository's local and alpha API/auth nginx configurations with temporary
upstreams. Unrelated media includes are excluded. Auth tokens, policy results and
parent visibility are controlled fixtures, so this is not Firebase/OPA/Editorial
or original-frontend acceptance. Service recreation preserves stores and replaces
Nest instances; it is not a separate process/container restart test.

The bound workflow uses the reusable `@sdk/features/discussion/http` handlers and
canonical query/discovery engines. BFF retains the original frontend contracts;
the four retired owner route families must return 404. The qualifier runs both
nginx configurations, replays historical Wapps receipts through the generic owner
API, and checks Account favorite selection/current parent authority. It applies
`DiscussionBindingIndex1792150000000` after the binding migration in its fresh SQL
fixture. No new projection format is involved.

`bound-discussion-runtime-checks.cjs` composes a second consumer with an unfamiliar
key/payload through the same generic HTTP and materialization implementations. It
covers twelve-root pagination, case/exact-key/tenant/owner isolation, nested replies,
votes/pins, discovery, revocation, service recreation, replay and tombstones.
The October 18 qualification passes ten runtime groups. It does not qualify real
Firebase/OPA/Editorial integration or browser presentation.

Legacy application-discussion/article-comment and export fixture startup now uses
`discussionProcessService` from `discussion-portal-fixture.cjs`. Its portal origin
routes dedicated paths through a real BFF; `serviceOrigin` exposes the owner for
internal generic endpoints. Supply `serviceOrigin` to Account and nested BFF clients;
portal origins reject internal key/prefix selection. The journey options expose
`discussionServiceOrigin` separately for these clients and their outage proxies.
Forged identity headers remain visible for rejection.
The wrapper is exercised by this qualifier. Full legacy browser/export/erasure
journeys must still be run for release; wrapper coverage is not their qualification.

Run BFF Jest tests with `configureGenericDiscussionBody` in bootstrap tests: Nest
must retain its default JSON parser for other endpoint families. Follow with
Discussion core/management/HTTP/Community/materializer regression tests, affected build,
lint, spec typecheck and architecture checks. This bounded qualification does not
replace the full workspace and deployment release gates.

## Review and Identity consumer boundaries

Wapps owns Review HTTP contracts in `libs/domains/community`, account/profile
composition in `libs/usecases/account`, and canonical account SQL adapters in
`libs/adapters/account-mysql`. Reusable Identity/Review core and use cases cannot
import back into those consumers. ARCH009/010 check consumer imports, known target
fields/content kinds and fixed provider registries; ARCH003/007 cover the new
consumer locations too. These checks complement runtime key-isolation tests.

Run `npm test`, `npm run lint`, `npm run check:boundaries`, all declared build and
typecheck targets, and `node tools/readiness/check-angular-packages.mjs --all` in a
clean lockfile-qualified snapshot with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`.
HTTP unit suites need loopback listening. Wapps adapter/consumer tests preserve
legacy HTTP, SQL and receipt contracts; SDK engine tests use previously unknown,
case-sensitive keys and providers. Real-store checks for this boundary are:

```sh
node tools/readiness/qualify-identity-mysql.cjs
node tools/readiness/qualify-identity-mysql.cjs --account-export-storage
node tools/readiness/qualify-identity-mysql.cjs --account-erasure-coordinator
node tools/readiness/qualify-materialization.cjs --reply-notifications
node tools/readiness/qualify-materialization.cjs --mention-notifications
node tools/readiness/qualify-materialization.cjs --favorite-updates
```

These runners create disposable stores. Keep their schema fixtures aligned with
runtime migrations (including Account mentions); a missing table is a failed
qualification, not a skip. Wapps provider plans remain fixed for existing durable
jobs; changing the plan requires a separate compatibility/data-migration review.

## Discussion consumer boundary and storage isolation

Discussion core/management and materializer accept an opaque consumer-owned key.
Wapps contracts and adapters live in `libs/domains/community` and
`apps/services/community`; the existing management Nx project/output identities
remain compatible. Run the core, management library, Community and materializer
tests, affected builds/typechecks, BFF spec typecheck and `npm run check:boundaries`.
ARCH007/008 detect consumer imports and known fixed target coupling in Discussion.
Forward migration/replay and arbitrary-key qualification are included in the
real-store Discussion recovery suite.

Always run destructive inventory/erasure tests with dedicated disposable stores:

```sh
node tools/readiness/qualify-materialization.cjs
node tools/readiness/qualify-materialization.cjs --discussion-author-erasure
```

The runner creates temporary containers without existing volumes. Do not point
`discussion-recovery.test.cjs` at an application's MinIO endpoint: isolated SQL
does not isolate a whole-bucket inventory. Before any fixture mutation, the harness
rejects pre-existing buckets and claims a fresh store with a unique marker. Racing
claims and unavailable listings fail closed. No bypass flag is provided. The
container owner removes its temporary storage after qualification. Portable
`fresh-object-store.test.mjs` checks rejection without mutations and marker cleanup.

Activation requires fenced old writers/materializers, backups, the forward
`CommunityDiscussionBindingKeys1792080000000` migration, new processes and
canonical reconciliation. Refresh gateway upstream resolution when a container
is recreated. Keep outage qualifiers sequential. The October 15 implementation
checkpoint records the local shared-bucket test incident, complete checksum-proven
payload recovery and safe reruns. It also records the separate Editorial fixture
migration failures; do not report the general runner as passing until fixed.

## Article comments and member reviews through the BFF

Use Node from `.nvmrc` and a lockfile-qualified isolated source snapshot:

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx run-many -t test \
  -p apps.services.catalog-bff,sdk-features-discussion-core,sdk-features-discussion-applications-management,sdk-features-review-core,portals-shared-features-review,portals-shared-features-articles \
  --runInBand --skip-nx-cache
```

Build BFF and its prerequisites, run BFF lint/spec typecheck, qualifier lint/syntax
and `npm run check:boundaries`. Save current BFF/gateway artifacts for rollback,
then activate the two complete route families in the existing local review stack.
Run outage qualifiers sequentially:

```sh
WAPPS_BFF_ORIGIN=http://localhost:4203 \
WAPPS_BFF_ACCOUNTS=/tmp/wapps-review/accounts.json \
WAPPS_BFF_COMPOSE_FILE=/tmp/wapps-review/compose.json \
WAPPS_BFF_COMPOSE_PROJECT=wapps-review \
WAPPS_BFF_REPORT=/tmp/wapps-review/bff-comments-reviews-runtime.json \
node tools/readiness/bff-comments-reviews-runtime-checks.cjs
```

The qualifier requires a local origin and unused evidence path. It creates two
disposable members, two independently approved articles/applications each, eleven
comment roots and two member reviews. Existing staff/admin permissions are reused
without changes. All content mutations and cleanup use ordinary APIs; Mongo
observation is read-only and restricted to this run's comment IDs. No store reset
or reseed occurs. Private mode-0600 `.accounts.json` recovery files must not be
published.

Coverage includes all sixteen routes; optional/public identity, independent
sessions, parent/author isolation, spoofing denial, keys/revisions, nested comment
redaction, ten-root pagination, canonical rating totals, helpful membership,
immutable-version reports and independent moderator/author lifecycle changes.
Paused comment materialization must not block canonical review reads/writes.
The qualifier stops/restores OPA, Editorial, Discussion, BFF and the comment
materializer, and restarts the local ownership-DNS sidecar after Editorial. BFF
outage checks include case/slash/unknown family variants. Tombstones and parent
withdrawal must prevent stale generations or historical receipts from resurrecting
content. Republishing restores retained associations.

Cleanup restores stopped services, deletes comment roots, withdraws reviews,
withdraws/deletes fixture parents and requests erasure of disposable identities.
Only this run's withdrawn parents may be republished to permit authorized cleanup.
Failures preserve recovery credentials. Background erasure/audit/payload retention
completion is not claimed. Browser checks are read/reload integration checks against
existing content; frontend merge/visual acceptance remains open. No migration,
deployment, SQL crash-window, duplicate/reorder/rebuild, backup or load qualification
is established by this bounded transport check.

## Application discussions through the BFF

Run the production-route HTTP specs and associated existing behavior suites in a
lockfile-qualified isolated source snapshot using Node from `.nvmrc`:

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx run-many -t test \
  -p apps.services.catalog-bff,sdk-features-discussion-core,portals-shared-features-discussion,sdk-features-discussion-applications-management \
  --runInBand --skip-nx-cache
```

After building BFF and activating the three explicit discussion gateway families
in the existing local review stack, retain rollback artifacts and run:

```sh
WAPPS_BFF_ORIGIN=http://localhost:4203 \
WAPPS_BFF_ACCOUNTS=/tmp/wapps-review/accounts.json \
WAPPS_BFF_COMPOSE_FILE=/tmp/wapps-review/compose.json \
WAPPS_BFF_COMPOSE_PROJECT=wapps-review \
WAPPS_BFF_REPORT=/tmp/wapps-review/bff-discussions-runtime.json \
node tools/readiness/bff-discussions-runtime-checks.cjs
```

The qualifier refuses nonlocal origins and existing report paths. It uses the
existing independently assigned staff/admin account without changing permissions,
and creates two disposable identities, two approved applications and twelve topics.
Credential recovery records live in the mode-0600 `.accounts.json` report sibling;
never publish them. No store is reset/reseeded and all mutations use ordinary APIs.
Mongo observation is read-only and restricted to this run's topic IDs.

Coverage includes all ten handlers, independent sessions, owner/parent isolation,
spoofed moderation denial, revisions/keys, nested replies, participation and pinned
pagination, public selection, favorites, edit/delete propagation and historical
vote/pin replay. It stops/restores Discussion, BFF, Mongo, MinIO and the Discussion
materializer. Run outage qualifiers sequentially. Full-thread transport tests cover
bounded size/concurrency/deadlines, malformed trees/redaction/receipts, lost replies
and no redirects or automatic command retries.

Cleanup deletes this run's topics and withdraws/deletes its applications. A withdrawn
fixture parent is resubmitted and independently approved only when needed to delete
its remaining topics through their normal authorization path. It requests erasure
of the disposable accounts after content cleanup; failures retain credentials for
recovery. Background erasure/audit/payload retention remains with owning services,
without claiming immediate completion. Keep failed evidence and use a fresh report
for each subsequent attempt.

Generic discussions, article comments and application reviews remain separate BFF
migrations. Browser checks establish integration only. Original frontend merge and
visual acceptance, full workspace/deployment/load and recovery gates remain open.

## Articles and covers through the BFF

Use the isolated, lockfile-qualified Node 22.17.1 environment with Nx cache
disabled. Run BFF tests, `domains-publication-article`, `catalog-media` and
`portals-shared-features-articles` tests, plus focused Editorial tests matching
`(articles|article-covers)/`. Qualify the BFF build with prerequisites, BFF lint,
separate BFF spec typechecking, readiness lint and `npm run check:boundaries`.
Save rollback artifacts before activating the matching build and both
`deploy/local/nginx/api.conf` and `application-media.conf`; validate `nginx -t`.
No frontend rebuild or new migration is required by this slice.

```sh
WAPPS_BFF_ORIGIN=http://localhost:4203 \
WAPPS_BFF_ACCOUNTS=/tmp/wapps-review/accounts.json \
WAPPS_BFF_COMPOSE_FILE=/tmp/wapps-review/compose.json \
WAPPS_BFF_COMPOSE_PROJECT=wapps-review \
WAPPS_BFF_REPORT=/tmp/wapps-review/bff-articles-runtime.json \
node tools/readiness/bff-articles-runtime-checks.cjs
```

The qualifier requires a local origin and fresh report path. It uses existing staff
permissions, two disposable identities, private articles and actual PNG/WebP media.
Credentials for recovery are kept in the report's `.accounts.json` sibling with
mode 0600; never publish that file. No stores are reset/reseeded. Failed reports
and cleanup evidence remain available rather than overwritten by later runs.

Coverage includes all 24 routes, independent sign-in, identity isolation and
spoofing denial, revisions/keys, multibyte content, cover normalization and exact
upload replay, immutable text/classification/covers, rejection/resubmission,
independent approval and live staff self-review denial. It checks public browse,
selection, visibility, immutable unique slugs, current-cover replacement,
materializer lag, withdrawal/tombstones and historical replay after restart.
It stops and restores BFF, Editorial, Mongo, MinIO and the materializer; run outage
qualifiers sequentially. Editorial restart reconnects the local DNS sidecar.

Cleanup withdraws/deletes only this run's articles (including its staff-owned
fixture), proves public covers inaccessible and requests disposable account
erasure. Existing staff/content and DNS records remain intact. Account erasure,
audit retention and object cleanup continue under owning-service lifecycle rules;
background completion is not claimed and no direct bulk deletion occurs. If
cleanup fails, accounts remain available for recovery.

HTTP specs additionally exercise trust on every route, malformed inputs/outputs,
bounded 100-article workspaces, upload/preview concurrency, disconnects, deadlines,
response media/framing/length, lost replies and no automatic retry. Browser checks
verify integration against the current frontend, not original presentation fidelity.
Original frontend merge/acceptance and full deployment/load/recovery gates remain
separate release work.

## Releases through the BFF

Run the production-route HTTP specs in a lockfile-qualified isolated install:

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx run-many -t test \
  -p apps.services.catalog-bff,catalog-versioning,portals-shared-features-application-workspace \
  --runInBand --skip-nx-cache
```

For the existing disposable local stack, after building and activating BFF plus
the explicit release gateway families, save rollback artifacts and run:

```sh
WAPPS_BFF_ORIGIN=http://localhost:4203 \
WAPPS_BFF_ACCOUNTS=/tmp/wapps-review/accounts.json \
WAPPS_BFF_COMPOSE_FILE=/tmp/wapps-review/compose.json \
WAPPS_BFF_COMPOSE_PROJECT=wapps-review \
WAPPS_BFF_DNS_ZONE=/tmp/wapps-review/dns-zone/records.json \
WAPPS_BFF_REPORT=/tmp/wapps-review/bff-releases-runtime.json \
node tools/readiness/bff-releases-runtime-checks.cjs
```

The qualifier refuses nonlocal origins. It uses the existing staff account and
creates two disposable identities, a parent application, independently approved
DNS ownership grants and private release drafts. Only this run's DNS records are
changed; existing records and file mode are retained. The qualifier does not
reset/reseed stores or change staff permissions. Recovery credentials are saved
in the report's `.accounts.json` sibling with mode 0600; never publish that file.
Use a fresh report path per attempt and retain failed logs and cleanup evidence.

Coverage includes all 16 routes, ownership binding, isolation/spoofing denial,
revision/key conflicts, future-date rejection, frozen review versus private edits,
rejection/resubmission, approval, immutable/unique version URLs, anonymous filters,
canonical open/rebase, revocation/new grants, withdrawal, service/Mongo failure,
projection lag and tombstone convergence, restart and historical replay. It stops
and restores BFF, Editorial, Mongo and the materializer; run other outage qualifiers
sequentially. Editorial restart also reconnects the local DNS sidecar. Cleanup hides
the disposable parent, deletes private drafts, releases grants, removes this run's
DNS records and requests erasure. Background erasure completion is not claimed.

HTTP specs additionally cover safe downstream errors, malformed contracts,
verified anonymous provenance, strict input bounds, duplicate headers, total
deadlines, lost replies without retry, full multibyte draft lists, legacy context
and closed unknown routes. Staff self-review remains covered by owning-service
tests; this live fixture does not create a second privileged staff identity.
No frontend presentation changes are part of qualification. Original frontend
merge/acceptance, deployed ingress and full load/recovery gates remain open.

## Application ownership through the BFF

Use the isolated Node 22.17.1 lockfile installation with Nx cache disabled. Run
`apps.services.catalog-bff`, `catalog-ownership` and
`portals-shared-features-application-workspace` tests, BFF build with prerequisites,
BFF/readiness lint, separate BFF spec typecheck and `npm run check:boundaries`.
Back up the active BFF/gateway artifacts, activate the matching build and `api.conf`,
and validate with `nginx -t`. No frontend rebuild or schema migration is required.

```sh
WAPPS_BFF_ORIGIN=http://localhost:4203 \
WAPPS_BFF_COMPOSE_FILE=/tmp/wapps-review/compose.json \
WAPPS_BFF_COMPOSE_PROJECT=wapps-review \
WAPPS_BFF_ACCOUNTS=/tmp/wapps-review/accounts.json \
WAPPS_BFF_DNS_ZONE=/tmp/wapps-review/dns-zone/records.json \
WAPPS_BFF_REPORT=/tmp/wapps-review/bff-ownership-runtime.json \
node tools/readiness/bff-ownership-runtime-checks.cjs
```

This local-only qualifier uses the existing staff account and DNS sidecar. It
creates two disposable members, one application, private editing drafts and claims
(including one staff claim to prove self-review denial). It preserves existing
accounts, permissions and content; no reset, reseed or schema change is allowed.
Nine workflow groups cover canonical-domain binding, claimant isolation, spoofing,
input validation, proof failure/throttling, cancellation, independent approval/
rejection, DNS outage and original-key recovery, competing claims, grant queues,
projection lag, future content review, mandatory BFF routing, BFF/Editorial restart,
Mongo outage, immediate revocation and voluntary release. A tenth group records
cleanup. Full mutation/review behavior is exercised through real HTTP.

Only BFF, Editorial, Mongo, the Editorial materializer and local DNS are stopped or
restarted. DNS rejoins Editorial's network namespace after Editorial restarts.
Read-only observation of this run's projection proves that canonical permissions
change while the old document remains stored. Database credentials stay inside the
owning container. Unreachable BFF can yield gateway 502/503/504; an unavailable
Editorial or DNS check returns the bounded BFF 503 contract. Historical receipts
must not restore cancelled claims, revoked grants or authoring permissions.

Cleanup restores services, withdraws the disposable application, deletes private
drafts, releases/cancels claims and removes only this run's DNS records. If needed,
cleanup obtains another independently approved disposable grant to withdraw the
application after testing revocation/release. It requests erasure of the two new
identities and checks subsequent access denial; background erasure completion is
not claimed. Use a fresh report path each attempt; its mode-0600 `.accounts.json`
recovery sibling contains credentials and must not be published.

Run the application draft/image qualifier sequentially as the related regression,
then check the existing ownership screens read/reload through BFF. Preserve the
original presentation. SQL crash windows, broker duplicates/reordering, backup
restoration, load and production deployment remain separate qualification gates.

## Application publication through the BFF

In the isolated Node 22.17.1 lockfile installation, disable Nx cache and run tests
for `apps.services.catalog-bff`, `catalog-record` and
`portals-shared-features-application-workspace`. Run BFF build with prerequisites,
BFF/readiness lint, separate BFF spec typecheck and `npm run check:boundaries`.
Save the active BFF/gateway artifacts before activating the matching build and
`api.conf`; validate with `nginx -t` before reload. Frontend assets stay intact.

```sh
WAPPS_BFF_ORIGIN=http://localhost:4203 \
WAPPS_BFF_COMPOSE_FILE=/tmp/wapps-review/compose.json \
WAPPS_BFF_COMPOSE_PROJECT=wapps-review \
WAPPS_BFF_ACCOUNTS=/tmp/wapps-review/accounts.json \
WAPPS_BFF_REPORT=/tmp/wapps-review/bff-application-publication-runtime.json \
node tools/readiness/bff-application-publication-runtime-checks.cjs
```

The local-only qualifier needs the existing staff credentials and creates two
disposable members and three drafts (including one disposable staff-authored draft
to prove self-review denial). It never changes staff permissions or reseeds data.
Twelve groups cover frozen submissions versus later edits, rejection/resubmission,
independent review, classification, slug collisions, original-key replay, canonical
status versus projection lag, public response privacy, mandatory BFF routes,
BFF/Editorial/Mongo outages, restart persistence and withdrawal without resurrection.
Read-only observation of only this run's Mongo projection proves that withdrawal
hides content while a live stale document still exists, then converges to a tombstone.
Database credentials remain inside the owning service's container.

Only BFF, Editorial, Mongo and the Editorial materializer are stopped/restarted.
The local DNS sidecar is restarted when Editorial restarts so its network namespace
remains valid. Cleanup restores services, deletes only the new drafts/publications,
checks deletion replay and requests erasure of the two disposable identities with
subsequent access denied. Existing staff/content remain intact. Background erasure
completion is not claimed. Use a fresh report path per attempt; its mode-0600
`.accounts.json` recovery sibling must not be published.

Run the application draft/image qualifier sequentially as the related regression;
it now exercises publication through BFF, including verified-owner editing and
frozen/public image previews. Browser publication status/read/reload checks are
separate; full mutation/review behavior is qualified through real HTTP. SQL crash
windows, broker replay/reorder, deployment, load and backup restoration remain
separate gates.

## Application drafts and images through the BFF

Use the isolated Node 22.17.1 lockfile installation, with Nx cache disabled. Run
`apps.services.catalog-bff`, `catalog-record`, `catalog-media` and
`portals-shared-features-application-workspace` tests, the BFF build with
prerequisites, BFF/readiness lint, separate BFF spec typecheck and
`npm run check:boundaries`. Back up the active BFF and gateway, activate matching
BFF artifacts plus both `api.conf` and `application-media.conf`, and run `nginx -t`
before reload. No frontend rebuild is required for this transport change.

```sh
WAPPS_BFF_ORIGIN=http://localhost:4203 \
WAPPS_BFF_COMPOSE_FILE=/tmp/wapps-review/compose.json \
WAPPS_BFF_COMPOSE_PROJECT=wapps-review \
WAPPS_BFF_ACCOUNTS=/tmp/wapps-review/accounts.json \
WAPPS_BFF_DNS_ZONE=/tmp/wapps-review/dns-zone/records.json \
WAPPS_BFF_REPORT=/tmp/wapps-review/bff-application-workspace-runtime.json \
node tools/readiness/bff-application-workspace-runtime-checks.cjs
```

This local-only qualifier requires an existing staff account and the review stack's
local DNS sidecar/zone. It creates two disposable members, private drafts/images
and one disposable publication/ownership grant. It covers strict contracts,
independent sessions, authorization, conflicts/replay, real normalized bytes,
slot attachment/removal, referenced cancellation, historical receipts, object-store
outage, frozen/public previews, canonical import/rebase, mandatory BFF routes and
BFF/Editorial restart recovery. Publication and ownership fixture commands also
use BFF.

Only MinIO, BFF and Editorial are stopped/restarted. The local ownership DNS sidecar
is restarted to join Editorial's new network namespace after its restart. Only the
new challenge record is merged into the DNS zone and subsequently removed; existing
records and file permissions are preserved. Cleanup restores services, withdraws
the new publication, deletes the new drafts, releases/cancels the new claim and
requests erasure of the new identities with access denied afterward. Background
erasure/object cleanup completion is not claimed. No reseed, reset or existing
content mutation is permitted.

Use a fresh report path for every attempt; recovery credentials are stored in a
mode-0600 `.accounts.json` sibling and must not be published. Run a related suite
qualifier sequentially, then restart the local DNS sidecar if that qualifier
restarts Editorial. Browser draft/editor/preview checks are separate. The owning
service's broker/crash-window proofs and full release/load/recovery gates remain
separate checks. Older BFF qualifiers now use read-only `/api/me/articles` as their
direct-Editorial control during a BFF outage; application drafts are no longer a
valid bypass control.

## Suite publication through the BFF

Build/test/lint `apps.services.catalog-bff` with prerequisites in the isolated
Node 22.17.1 lockfile installation with Nx cache disabled. Run
`domains-publication-suite` and `portals-shared-features-suite` tests, the separate
BFF spec typecheck and `npm run check:boundaries`. Activate the matching BFF and
local gateway after saving their previous artifacts. Frontend assets stay intact.

```sh
WAPPS_BFF_ORIGIN=http://localhost:4203 \
WAPPS_BFF_COMPOSE_FILE=/tmp/wapps-review/compose.json \
WAPPS_BFF_COMPOSE_PROJECT=wapps-review \
WAPPS_BFF_ACCOUNTS=/tmp/wapps-review/accounts.json \
WAPPS_BFF_REPORT=/tmp/wapps-review/bff-suite-publication-runtime.json \
node tools/readiness/bff-suite-publication-runtime-checks.cjs
```

The local-only qualifier requires two existing public applications and a credential
file containing an existing `staff` account's email, password and uid. It signs in
without changing roles, creates two disposable members and two disposable suites,
and never reseeds/resets data. Ten groups cover identity/ownership, staff denial,
self-review denial even for staff, frozen submission versus draft edits, rejection/
resubmission, classification/order, conflicts/replay, explicit projection lag,
anonymous public browse/detail/selection, mandatory BFF routes, BFF/Editorial
outages/restarts and withdrawal despite a stale live projection. Queued replacement
and withdrawal must materialize the current tombstone; old receipts cannot restore
the publication. A read-only observation of only this run's Mongo projection uses
credentials inside the Editorial container, never inside BFF or the browser.

Only BFF, Editorial and its materializer are stopped/restarted. Cleanup restores
services, deletes only new suites, requests erasure of the two new members and
verifies access denial. Existing staff/content are preserved. Erasure acceptance
does not prove background cleanup. Recovery credentials are stored with mode 0600
in the report's `.accounts.json` sibling; do not publish it. Use a fresh report path
for each attempt. Run the private-suite qualifier sequentially for the related
CRUD/search regression. Browser read/status checks are recorded separately; the
full mutation lifecycle is qualified through HTTP. Broker duplicate/reorder and
SQL crash-window qualification from the owning-service workflow is not rerun by
this transport qualifier. Full deployment/recovery/load gates remain open.

## Private suite workspaces through the BFF

Build/test/lint `apps.services.catalog-bff` and its prerequisites with the isolated
Node 22.17.1 installation and Nx cache disabled. Run `domains-publication-suite`
and `portals-shared-features-suite` tests, the BFF spec typecheck and architecture
audit. Activate the matching BFF/gateway without rebuilding or changing frontend
assets. Then run against the existing local review stack:

```sh
WAPPS_BFF_ORIGIN=http://localhost:4203 \
WAPPS_BFF_COMPOSE_FILE=/tmp/wapps-review/compose.json \
WAPPS_BFF_COMPOSE_PROJECT=wapps-review \
WAPPS_BFF_REPORT=/tmp/wapps-review/bff-suites-runtime.json \
node tools/readiness/bff-suites-runtime-checks.cjs
```

The local-only qualifier requires at least two existing public applications and
registers two disposable members. Ten groups cover strict identity/selectors,
application search and ordered metadata, suite creation/replay and an independent
session, cross-owner denial, edit/reorder/add/remove/classification/conflicts,
mandatory BFF paths, BFF/Editorial outages and restart persistence, Mongo projection
failure with canonical private reads/removal still working, deletion replay without
resurrection and cleanup. It never reseeds or resets databases, edits existing
accounts/content or publishes a suite. Publication and public-suite catalog routes
have their own qualifier described above.

Only BFF, Editorial and MongoDB in the named Compose project are temporarily
stopped/restarted. Cleanup restores stopped services, deletes newly created suites
and requests erasure of the two test identities, verifying access denial. Erasure
acceptance does not prove complete background cleanup. Recovery credentials are
stored with mode 0600 in the report's `.accounts.json` sibling; do not publish it.
Keep failed attempts and choose a fresh report path for another run.

Run the export qualifier sequentially as a related regression. The five previous
BFF qualifiers now use read-only `GET /api/me/application-drafts` as the unmigrated
control during BFF outages. Browser verification is separate; tests of the existing
frontend do not establish acceptance of its original presentation. Alpha/Kubernetes
activation, database restore and full release
qualification remain open.

## Account exports through the BFF

The A27 candidate qualifier is the export extension of the independent-authentication
harness. Build all consumers before starting it; keep that checkout's `dist` fixed:

```sh
WAPPS_LOCAL_AUTH_INTEGRATION=1 WAPPS_EXPORT_PARITY_INTEGRATION=1 \
  WAPPS_NGINX_BINARY=/path/to/verified/native/nginx \
  node --test tools/readiness/local-auth.test.cjs
node tools/readiness/qualify-identity-mysql.cjs --account-export-storage
node tools/readiness/qualify-materialization.cjs --account-export-sources
WAPPS_SUITES_OPA_DOCKER=1 WAPPS_SUITES_OUTPUT=/tmp/unique-export-evidence \
  node tools/readiness/qualify-suites.cjs --account-export-editorial --no-browser
```

Run the profile, member, export, suite and application extensions separately. The export extension uses
fresh test-owned SQL/RabbitMQ/Mongo/MinIO/OPA, independent Authentication/Account/BFF,
and real Editorial/Community sources. Credential subjects differ from application
identity IDs; the archive includes their exact verified binding. Both local and
alpha API/auth configurations exercise request/latest/status/cancel/download,
case/slash/unknown suffixes, input bounds, private digest-checked attachments,
independent sessions, replay/conflict, suspension, corruption and no BFF fallback.
Six export groups supplement the nineteen shared groups. They also check all
three remote-provider outages, durable retries, expiry purge, actual Account
SIGKILL/restart, in-flight cancellation, malformed source streams and rejected
missing/foreign/duplicate completion receipts. Exactly `account`, `credentials`,
`editorial`, `discussion` remain required; no plan/schema migration is introduced.

Editorial setup uses trusted canonical fixture claims and direct production
projection functions; Discussion commands and exports cross real authenticated
BFF. Explicit Discussion writer claims are provisioned in the disposable local
credential store. Invalid provider responses are deliberate loopback fault probes,
separate from successful real capture. Credential-outage work is submitted directly
to the durable store while ingress authentication is unavailable. Expiry/lease
timestamps are accelerated in disposable SQL; capture cancellation blocks a real
Editorial table. Nginx reports failed authentication subrequests as HTTP 500;
that is a denied request, not a successful empty export. Native gateway evidence
does not qualify the unresolved Docker-to-host transport or deployment. Browser
acceptance, external Firebase/SSO, maximum-size load and full erasure remain separate.

The source/storage regressions cover 140 Account favorites, 140 retained Editorial
submissions and 134 Discussion contributions, 135 registered payload versions and
131 review versions. They retain their explicit fixture authority and corruption,
snapshot, reconnect, cancellation and object-history bounds. The identity fixture
must run credential-binding and legacy-import migrations before current capture.

The older Compose probe below is retained for existing isolated installations;
its execution is not part of A27. The older combined `--account-export-runtime`
Firebase/browser/erasure harness still needs independent Authentication wiring
and issuer/subject-aware credential assertions before the A28 full-erasure rerun.
Do not treat its historical pass as current provider or erasure qualification.

Use the isolated Node 22.17.1 installation to build/test/lint BFF with prerequisites,
typecheck its specs, run the identity feature tests and architecture audit. Activate
the matching BFF and gateway without rebuilding or changing the frontend. Then run:

```sh
WAPPS_BFF_ORIGIN=http://localhost:4203 \
WAPPS_BFF_COMPOSE_FILE=/tmp/wapps-review/compose.json \
WAPPS_BFF_COMPOSE_PROJECT=wapps-review \
WAPPS_BFF_REPORT=/tmp/wapps-review/bff-export-runtime.json \
node tools/readiness/bff-export-runtime-checks.cjs
```

The local-only qualifier registers two disposable members and never rewrites
existing accounts/content. Nine check groups cover strict trusted requests,
202 acceptance and same-job replay, complete four-source gzip/type/length/digest,
cross-account denial, mandatory BFF paths, BFF/Account restarts and outages,
repeatable revocation with historical replay, source failure/recovery and cleanup.
The archive must contain all four source receipts and the requesting account's
profile/credential record, without password/token material or the other account.
The qualifier checks a small real archive; it does not qualify the one-GiB load gate.

Only BFF, Account and Discussion in the named Compose project are briefly stopped
and restarted. Cleanup independently attempts service restoration, revocation of
new archives and erasure of the two new identities, then verifies access denial.
Erasure acceptance is not complete background cleanup. A sibling `.accounts.json`
stores disposable recovery credentials with mode 0600; never publish it. Preserve
failed logs and use a fresh report path on retry. Do not reseed or reset the stack.

Run the private-profile qualifier sequentially as a related regression. All BFF
qualifiers now use read-only `GET /api/me/application-drafts` as the unmigrated control during
BFF outages, because exports and private suites have migrated. Browser status/polling/download checks
are separate from HTTP qualification. No original-frontend fidelity, alpha/Kubernetes
activation, production provider, backup/restore or full release readiness is claimed.

## Public profiles, follows and badges through the BFF

Build/test/lint `apps.services.catalog-bff` and its prerequisites in the isolated
Node 22.17.1 installation; typecheck its spec sources, run the user-profile feature
tests and architecture audit. Activate the matching BFF build and local gateway.
No frontend build is needed for this slice. Then run:

```sh
WAPPS_BFF_ORIGIN=http://localhost:4203 \
WAPPS_BFF_ACCOUNTS_FILE=/tmp/wapps-review/accounts.json \
WAPPS_BFF_CONTENT_FILE=/tmp/wapps-review/content.json \
WAPPS_BFF_COMPOSE_FILE=/tmp/wapps-review/compose.json \
WAPPS_BFF_COMPOSE_PROJECT=wapps-review \
WAPPS_BFF_REPORT=/tmp/wapps-review/bff-public-profile-runtime.json \
node tools/readiness/bff-public-profiles-runtime-checks.cjs
```

The existing files supply a current staff token and public `atlas.id`. The qualifier
registers three disposable members, uploads a synthetic photo, saves Atlas and
creates one temporary topic. Eight check groups cover trusted anonymous reads,
photo audience, shared content/hidden totals, follows and independent approval,
staff badges/reasons/history, replay/conflicts, mandatory BFF routing, Account
failure, restarts, revocation/private visibility and cleanup. Populated favorites
and discussions use real records; suite/article reads include visible-empty and
hidden responses. Contract fixtures additionally cover their populated shapes.

Only the explicit local Compose project's BFF and Account are stopped/restarted.
The staff profile is compared before/after, the temporary topic is removed, and
erasure is accepted only for the three new accounts. All cleanup steps are attempted
independently; failures retain recovery records. Acceptance is not completed
background erasure. Report siblings ending `.accounts.json` contain credentials,
are mode 0600 and must not be published. Preserve failed logs and use a fresh report
path when retrying. Never reset or reseed the existing review stack.

Run the private-profile and preferences qualifiers sequentially for shared-identity
regression. All BFF qualifiers now use read-only `GET /api/me/application-drafts`
as their unmigrated route during BFF outages. Browser checks
remain separate: own totals/badges, public preview, hidden sharing states and
follower/directory loads. No visual fidelity, original-frontend acceptance,
alpha/Kubernetes deployment or full release/recovery readiness is established.

## Favorites and notifications through the BFF

Build/test/lint/typecheck the favorites domain, favorites feature and
`apps.services.catalog-bff` in the isolated Node 22.17.1 installation. Build the
aggregator library/CSR and inspect Angular artifacts. Activate the matching
frontend adapter, BFF and gateway as one compatible set; presentation sources
remain unchanged. The local OPA bundle must include the generated
`identity-admin/profile-audience.rego`. Both local and alpha image mergers are
checked with real OPA evaluations:

```sh
OPA_BINARY=/path/to/opa node --test tools/readiness/opa-policies.test.mjs

WAPPS_BFF_ORIGIN=http://localhost:4203 \
WAPPS_BFF_CONTENT_FILE=/tmp/wapps-review/content.json \
WAPPS_BFF_COMPOSE_FILE=/tmp/wapps-review/compose.json \
WAPPS_BFF_COMPOSE_PROJECT=wapps-review \
WAPPS_BFF_REPORT=/tmp/wapps-review/bff-member-runtime.json \
node tools/readiness/bff-member-runtime-checks.cjs
```

The existing content file supplies public General `atlas.id`, `article.id` and
`suite.id` references. The qualifier registers two disposable users, saves all four
favorite kinds and creates a temporary topic with eleven replies and one mention.
It waits for the normal favorite-watch baseline before adding updates. Seven check
groups cover canonical metadata, replay/conflicts, trusted identity and isolation,
mandatory BFF routing, Account outages/restarts, real notification delivery and
pagination, durable recipient-only read receipts, opt-out, removal during metadata
outages and historical replay after removal. The temporary topic is removed and
only the new accounts are erased. Accepted erasure does not prove background
cleanup complete. Existing review accounts/content are not rewritten or reseeded.

Only the explicit local Compose project's BFF, Account, Discussion and Editorial
processes are briefly stopped/restarted. The report records check names and
cleanup status without credentials. Its sibling `.accounts.json` is mode 0600 and
contains disposable recovery credentials; never publish it. Preserve failed logs
and use a new report path for retries. Run the profile and preferences qualifiers
sequentially as related regressions; all use unmigrated `GET /api/me/application-drafts` for the
BFF-outage comparison. Browser favorites/category loading and save/remove/reload
checks are separate. These checks do not certify original frontend fidelity,
alpha/Kubernetes activation, production identity or release/restore readiness.

## Account, private profile and photos through the BFF

Build/test/lint `apps.services.catalog-bff` and its prerequisites from the isolated
Node 22.17.1 installation, typecheck its spec sources, and run the architecture
audit. Activate the matching local BFF build and gateway routes, allowing the
Nginx reload to settle before starting requests. From that installation:

```sh
WAPPS_BFF_ORIGIN=http://localhost:4203 \
WAPPS_BFF_ACCOUNTS_FILE=/tmp/wapps-review/accounts.json \
WAPPS_BFF_COMPOSE_FILE=/tmp/wapps-review/compose.json \
WAPPS_BFF_COMPOSE_PROJECT=wapps-review \
WAPPS_BFF_REPORT=/tmp/wapps-review/bff-profile-runtime.json \
node tools/readiness/bff-profile-runtime-checks.cjs
```

The accounts file supplies an existing `staff` test account with current `token`
and `uid`; that account is read-only. The qualifier registers a fresh local member
through the actual gateway and stores recovery credentials in the report's sibling
`.account.json` with mode 0600. Do not publish that file. The report contains check
names, the disposable identity and erasure-acceptance status, without credentials.

Seven check groups cover account/profile reads and trusted email, text saves and
conflicts, bounded photo upload/normalization/private reads, mandatory BFF routing,
restart persistence and outage/retry, photo replacement/removal with historical
replay, and erasure acceptance/access revocation. Only the newly registered member
is erased during cleanup. Accepted erasure does not prove all cleanup workers have
finished. The explicit Compose project's BFF and Account services are briefly
stopped and restarted; no database reset or frontend rebuild occurs.

Follow with `bff-preferences-runtime-checks.cjs` as the related integration
regression. Its direct-service comparison route is now `GET /api/me/application-drafts`
because account/favorites/badge/export routes have migrated. Browser verification is separate: save/reload
profile text, upload/save/reload a synthetic photo, remove it and restore original
profile values. Preserve failed attempts; an expired session may require explicit
photo reselection after refresh. These checks do not qualify original frontend
fidelity, public-profile audience routes, production identity or deployment/recovery.

## Account preferences through the BFF

Build `apps.services.catalog-bff` with its dependencies from the isolated,
lockfile-qualified Node 22.17.1 workspace. Run its `test` and `lint` targets plus
`tsc --noEmit -p apps/services/catalog-bff/tsconfig.spec.json` and the architecture
audit. The BFF HTTP suite uses a contract fixture for Account; it is not a real-store
qualification. Activate the matching local gateway route and BFF build before
running the separate live qualifier:

```sh
WAPPS_BFF_ORIGIN=http://localhost:4203 \
WAPPS_BFF_ACCOUNTS_FILE=/tmp/wapps-review/accounts.json \
WAPPS_BFF_COMPOSE_FILE=/tmp/wapps-review/compose.json \
WAPPS_BFF_COMPOSE_PROJECT=wapps-review \
WAPPS_BFF_REPORT=/tmp/wapps-review/bff-preferences-runtime.json \
node tools/readiness/bff-preferences-runtime-checks.cjs
```

The accounts file supplies two existing local test accounts named `member` and
`staff`, each with a current `token` and canonical `uid`. No secrets are printed or
written to the report. The qualifier requires a local origin and an explicit
Compose project; it briefly stops/restarts only that project's `catalog-bff` and
`account-management`. It changes the member's default view and restores original
preference values through a revision-checked command in cleanup. Revisions,
timestamps, command receipts and outbox history advance normally; this is not a
database reset. A pre-write recovery snapshot is retained in the report. Concurrent
preference changes cause cleanup to fail rather than overwrite another editor.

Checks cover real authentication, spoofed identity-header replacement, account
isolation, read/save/replay, stale/mismatched commands, both service outages and
SQL persistence across process restarts. Canonical, trailing-slash and mixed-case
preferences URLs must fail when BFF is stopped while unmigrated `GET /api/me/application-drafts` still
works. Account outage returns BFF 503; restart recovers the saved state and permits
same-key retry. Run after the gateway reload has settled. An immediate live reload
can close an HTTP keep-alive connection and is not a passing check.

Use the browser tool separately to verify the existing settings page loads/saves
through this endpoint. This qualifier does not rebuild frontend assets, seed or
reset stores, qualify the original frontend merge, exercise production identity,
or close deployment/backup/load gates. Alpha and Kubernetes routing activation
remain pending.

## Favorite content preferences

```sh
OPA_BINARY=/path/to/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/favorites-content-preferences \
  node tools/readiness/qualify-suites.cjs --account-export-runtime --favorites-content-preferences
```

Use the isolated Node 22.17.1 installation and build the favorites feature,
aggregator library/CSR and their prerequisites. The compiled Account, Editorial,
Discussion and Catalog BFF services must also match the current contracts. In
particular, Account's strict selection parsers must include classification: an old
Account binary rejects classified targets even when the portal and Editorial are
current. Upgrade compatible consumers before producers or coordinate activation.
Keep executable sources and outputs frozen during qualification.

This option runs the existing Explore/service baseline and a dedicated favorites
extension, without the unrelated Digest/timeline browser extensions. It creates
General, Mature and unclassified publications through actual author commands and
independent staff approval, then saves all four favorite kinds through Account.
Independent browsers exercise exact visible metadata, selected-group hidden
counts, sidebar filtering, same-document settings saves, held old-account replies,
preference and metadata outages, keyboard removal/retry and Account/BFF restart.
Frozen suite and parent-application reclassification exercise private edits,
projection lag and canonical rebuild. Discussion classification changes without
rewriting its projection.

Reports and screenshots are under `favorites-content-preferences/`; baseline
evidence is under `explore-browser/`. The changed states run at 390/768/1440 in both
themes. Captures wait for theme scopes and actual card surfaces to settle, then
check the 24px header gap, overflow and control fit. Inspect final screenshots
before recording qualification. Preserve failed runs and their source/build
differences; an old-service parser failure is evidence of a compatibility boundary.

Account preferences/favorites, Editorial, Discussion, SQL, Mongo, object storage
and OPA use real local services. Trusted ingress identities remain substituted,
materializer functions run directly, and external browser traffic is blocked.
This does not qualify broker delivery, production identity, provider delivery,
backup restoration, rollback or load/soak. No new migration or projection is added.

## Individual feed content preferences

```sh
OPA_BINARY=/path/to/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/feed-content-preferences \
  node tools/readiness/qualify-suites.cjs --account-export-runtime --timeline
```

Run from the isolated Node 22.17.1 installation after building the feed domain,
shared feed feature, Editorial, Discussion Management, Catalog BFF, aggregator
library and CSR, including their prerequisites. Run affected source/spec compilers,
lint/tests, Angular package inspection, architecture and inventory checks. Keep the
executable sources and built outputs frozen while qualification is running.

`--timeline` includes existing Explore and Digest regressions plus the feed-choice
extension. Baseline legacy publications remain unclassified: members explicitly
enable mature content for their original link/ranking tests, and guests hide those
fixtures. The extension creates General, Mature and unclassified application,
article and suite publications through real author commands and independent staff
approval. Discussions and reviews use real commands and inherit the application
classification. Suites in a General application timeline keep their own choice.

The extension compares displayed IDs and hidden counts with current source pages
in independent member and guest browsers. It saves actual Account preferences
through the settings page without reloading the portal document, holds old-session
responses during current preference loading, injects preference outages and checks
keyboard retry. It also exercises frozen reclassification despite private edits,
projection lag/rebuild, all-hidden page continuation/Back, independently filtered
Digest groups, parent reclassification and Account/BFF restart. Its reports and
responsive screenshots are in `feed-content-preferences/`, alongside the baseline
`explore-browser/`, `digest-browser/` and `timeline-browser/` evidence. Inspect final
screenshots before recording a qualified checkpoint; failed runs remain evidence.

The October 13 checkpoint passes 21 integrated check groups and 78 measured layouts
(60 feed-choice states plus 18 baseline Explore/Digest/timeline layouts). Ten final
screenshots were inspected. Captures start at the document top so sticky search
does not cover page headings. Checks cover 24px header spacing, horizontal overflow,
control fit and the API feed's themed surface above the Home decoration. Final
evidence is `feed-content-preferences-runtime-4`; earlier runs remain retained.

Account preferences, Editorial, Discussion, SQL/object stores and policy are real
local services. Trusted ingress identities remain substituted, production
materializer functions run directly, and external browser traffic is blocked.
The baseline release is unclassified; focused service tests cover changed release
parent classification and confirmation races. This does not qualify production
ingress, broker delivery, backup restore, rollback or load/soak. The activity
classification field is optional but older strict consumers reject it: upgrade
compatible consumers before producers or coordinate their activation. No new
projection or migration is introduced by this read integration.

## Home grouped search previews

Build discovery, search/multi-search, aggregator Angular/CSR, Editorial and BFF in
the isolated Node 22.17.1 installation. Preserve/clear changed outputs, build
dependencies without cache and inspect Angular artifacts. Keep executable sources
and outputs frozen while qualification runs.

```sh
OPA_BINARY=/path/to/opa WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/home-discovery \
  node tools/readiness/qualify-suites.cjs --discovery
WAPPS_CATALOG_BROWSER_OUTPUT=/tmp/wapps-readiness/home-catalog \
  node tools/readiness/qualify-materialization.cjs --catalog-only --catalog-browser
```

`--catalog-only` runs the catalog journey without unrelated materialization suites;
its only optional companion is `--catalog-browser`. The default materialization
qualification remains unchanged. Catalog qualification covers real SQL/Mongo,
compiled APIs, taxonomy, canonical selections, rename/deletion, process restart,
projection loss/rebuild and unavailable upstreams. Browser badge assertions require
actual taxonomy names and deliberately do not assume source ordering. Controlled
catalog fixtures restore General classification after direct privileged edits;
this fixture setup is not proof of author/staff approval.

Discovery qualification uses actual publication/review and compiled Editorial/BFF
against SQL/Mongo/OPA. Home checks run before classification browser checks mutate
the publications. They verify one bounded grouped request, exact totals, real links,
same-phrase account switching, held preference/old-account reads, all-hidden groups,
both outage/retry paths, blank/empty/invalid searches and keyboard navigation. Seven
Home states add 42 light/dark layouts at 390/768/1440, including keyboard access to
the last suite inside the scrollable preview. Review the saved screenshots as well
as reports. Bring the tested browser page forward before focus/keyboard assertions.

Ingress identities and shell/profile/preferences are fixtures; Account preference
save persistence and production identity are not qualified by these runs. Catalog
materialization is invoked directly and external browser traffic is blocked.
Explore/Discussion/health/timeline child services are absent from discovery setup;
their explicit failure states do not qualify those feeds. Deployment, restore,
rollback, load/soak and full OP gates remain separate work. Record the snapshot hash
and preserve failed logs; rerun only checks affected by subsequent source changes.

## Application subpage content preferences

Build the application-overview, discussion and application-workspace features,
aggregator Angular/CSR, Editorial/BFF and Discussion services in the isolated
Node 22.17.1 installation. Preserve/clear changed Angular outputs and use uncached
dependency builds. Keep executable sources and output frozen during qualification.

```sh
OPA_BINARY=/path/to/opa WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/subpages-discovery \
  node tools/readiness/qualify-suites.cjs --discovery
OPA_BINARY=/path/to/opa WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/subpages-discussion \
  node tools/readiness/qualify-suites.cjs --application-discussions --article-comments --delivery --my-discussions --quick-discussion-browser
```

The discovery journey also tests discussion/review/release/health/timeline parent
guards using reviewed General/Mature/unclassified applications and independent
enabled/disabled/guest sessions. Hidden views cannot request child content or retain
parent names in headers/sidebars. Account switching, preference failure/retry and
36 new light/dark 390/768/1440 layouts are covered. This harness does not configure
Discussion, health or timeline sources; their allowed failures remain explicit.

The separate Discussion journey uses real SQL/Mongo/RabbitMQ/MinIO/OPA and compiled
Editorial/Discussion APIs. Fixture classification changes go through author update,
submission and independent staff approval. A hidden quick dialog removes its title,
messages and composer. Preference retry and existing real reply/retry/conflict,
moderation, restart and projection-rebuild checks must still pass. It adds twelve
hidden/error modal layouts to the existing responsive/focus/scroll checks.

Both harnesses explicitly substitute ingress identities and shell/profile/preference
reads; they do not requalify Account preference-save persistence. Inspect the changed
screenshots and retain the reports, command logs and executable/config snapshot hash.
Individual feed/timeline item filtering, production ingress/activation,
restore/rollback/load/soak and every complete operational gate remain separate work.

## Grouped Discover

```sh
OPA_BINARY=/path/to/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/discovery \
  node tools/readiness/qualify-suites.cjs --discovery
```

Build Editorial, Catalog BFF, discovery/search libraries, aggregator Angular and
its production CSR in the isolated installation first. Keep that installation's
sources and outputs frozen during qualification. The workflow uses disposable
MySQL/MongoDB and OPA; it does not require an Auth emulator or notification worker.
`--no-browser` omits portal evidence and cannot qualify the complete workflow.

The qualifier publishes 23 applications, articles and suites through actual APIs
and checks exact source totals, private edits/drafts, another tenant, literal
case-insensitive search, explicit facets and sort, independent paging, page sizes
1/10/20/50/100 and one bounded correction of out-of-range publication pages. Missing
selected projections make the entire response unavailable; canonical rebuild
recovers it. Withdrawal remains hidden before tombstone materialization and after
old replay. Compiled Editorial/BFF restart and outage recovery are included.

Independent browser sessions exercise real detail links, keyboard pagination,
Back/search restoration, legacy aliases and empty/invalid/unavailable/retry states.
Inspect all six screenshots at 390/768/1440 in both themes alongside `browser.json`;
automated checks cover overflow and 24px/16px/8px page/card/description spacing.
Saved category exclusions apply to the current page only, with hidden counts and
unchanged source totals. Groups are independent current source reads.

Trusted ingress identities, shell/profile/preferences fixtures and direct production
materializer invocation are explicit substitutions. External browser traffic is
blocked. This does not certify production ingress, broker delivery, deployment,
restore/rollback or load/soak. The Home and public-content preference extensions are
described above; remaining feed/profile/notification consumers stay separate work.
Grouped read composition adds no migration, projection, worker or secret; see
`docs/MATERIALIZATION.md` for the owning publication and classification contracts.

## HTTP application health

```sh
OPA_BINARY=/path/to/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/health \
  node tools/readiness/qualify-suites.cjs --health
```

Build Editorial, Catalog BFF, the reliability/health feature libraries, aggregator
Angular and its production CSR in the isolated installation first. Keep the source
and compiled output frozen throughout qualification. This workflow needs disposable
MySQL/MongoDB and OPA; it does not require the Auth emulator or the notification
qualifier. `--no-browser` deliberately omits portal qualification.

For a cached, pinned Docker OPA instead of a host executable, replace `OPA_BINARY`
with `WAPPS_SUITES_OPA_DOCKER=1`. This uses `openpolicyagent/opa:1.4.2-static` with
the checked-in Editorial bundle. Both modes use real OPA. The staff extension also
requires cached `nginx:1.28-alpine`. All containers/stores are fresh, randomly named
and removed by the runner; no existing Wapps installation is used. The qualifier
explicitly disables automatic monitoring and invokes the controlled worker itself.

`bff-health-monitors-runtime-checks.cjs` adds four groups through compiled BFF and
both actual Nginx API/auth includes. It substitutes dependency addresses and a
controlled authentication subrequest, while preserving real OPA and SQL authority.
It verifies member/tenant/forged denial, identity-erasure fences, bounded input,
approved-origin/application-revision checks, exact application isolation, concurrent
and historical replay, disabled monitors and unknown public evidence. SQL faults
must roll back both configuration/version writes. A transport fixture drops one
committed write reply: BFF must return 503 without retry, and the caller's identical
replay must recover one receipt. Owner/BFF restarts preserve state; withdrawal and
owner/policy failures deny access. Stopping BFF must break both gateway route families,
including case variants and unknown suffixes, without fallback to Editorial.
The separate local-auth suite verifies real credentials/Identity and the complete
local gateway's health route returning 503 while Editorial is absent.

The real-store/API checks cover same-tenant staff authorization, current approved
website origin, expected revisions, immutable replay/conflict, atomic configuration
rollback, migration re-entry/recorded table loss, concurrent claims, expired leases,
three-attempt bounds, duplicate results, configuration generations, disabled checks,
eight-definition capacity, current parent withdrawal and service restart/outage.
The production HTTP adapter makes actual requests to a local fixture, including
slow responses and a real ten-second deadline. Only its test DNS/transport route
substitutes a logical public hostname with the fixture socket; production address
validation is retained and a private-address check must open no socket. There is
no private-network override in the service. Controlled SQL changes accelerate stale
history/lease time. Real internet DNS/TLS and deployed egress remain unverified.

Independent guest browsers use compiled BFF/Editorial endpoints, verify responding,
failed, redirected, stale and never-observed states, no invented internal-service
uptime, unmonitored/missing applications and keyboard refresh/retry after an outage.
Six saved layouts cover 390/768/1440 in both themes, with overflow, column alignment,
24px page gap and 16px/8px card spacing checks. Inspect those screenshots in addition
to `browser.json`. Browser shell profile/preferences and trusted staff ingress are
fixtures; browser external traffic is blocked. This qualification does not certify
production ingress, restore/rollback, load/soak or full operational completion.

Production probing is default-off through `EDITORIAL_HEALTH_MONITOR_ENABLED`.
See `docs/MATERIALIZATION.md` for authoritative tables, migration/OPA activation,
the staff configuration API, recovery and rollback requirements. Owner notices and
public observation ingestion are outside the HTTP-only product policy.

## Application timeline with Digest and Explore regression

```sh
OPA_BINARY=/path/to/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/timeline \
  node tools/readiness/qualify-suites.cjs --account-export-runtime --timeline
```

Run from the isolated installation after affected builds, keeping its sources and
compiled outputs frozen throughout qualification. `--timeline` includes Digest and
Explore regression; use one workflow flag. The compiled BFF, Editorial, Discussion
and Account services use disposable MySQL/MongoDB/MinIO and the local Auth emulator.
The timeline checks five public content kinds, canonical scope before paging,
private-versus-approved suite membership, current withdrawal, projection lag,
missing parents, strict query validation, cross-application/Explore cursor rejection,
source outages and restart. Controlled SQL fixture changes isolate membership reads;
they do not requalify publication writers or broker delivery.

Independent member, second-session, other-account and guest browsers exercise real
detail links, URL paging/Back, saved exclusions/ranking/favorites across Account
restart, opt-out, held-response cancellation, missing/unavailable/retry states and
keyboard controls. Inspect the six screenshots in `timeline-browser/` alongside the
six Digest and six Explore regression layouts. Widths are 390/768/1440 in both themes;
automated checks cover overflow, controls and 16px/8px card spacing. Existing local
gateway identities, blocked external browser traffic and direct production
materializer invocation remain explicit substitutions. This is current public
activity; no fabricated article association or health event is included, and no
deployment or full operational gate is closed.

## Digest and shared Explore regression

```sh
OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/digest \
  node tools/readiness/qualify-suites.cjs --account-export-runtime --digest
```

Build the same services and production portal as Explore, then freeze sources and
compiled outputs throughout qualification. `--digest` includes the complete shared
Explore regression and its browser checks; do not also pass `--explore`. The four
public Digest selections are independently bounded, reject caller scope, preserve
actual summaries/cover references, and fail unavailable during projection lag,
legacy authority gaps, missing credentials or required source outages. Canonical
parent withdrawal must hide stale activity and application/discussion cards.

Independent member, second-session, other-account and guest browsers check compact
sections, actual detail links and covers, category exclusions, real vote/favorite
ordering, personalization opt-out, persistence after Account restart, held-response
cancellation after account switching, source recovery and cover fallback/retry.
Refresh/retry use keyboard activation. Six Digest layouts and six Explore regression
layouts at 390/768/1440 in both themes include overflow/control and 16px/8px spacing
assertions. Inspect final screenshots in `digest-browser/` and `explore-browser/`.

The source/publication fixtures, direct production materializer calls, local identity
gateway, blocked browser external traffic and operational exclusions are the same
as Explore. Another member's public application is deliberately retained: category
exclusions hide only matching taxonomy, not every other card. `--no-browser` cannot
qualify the complete portal workflow. Deployed ingress/credentials, production
activation, global popularity, mature classification and full operational gates
remain separate qualification.

## Explore activity

```sh
OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/explore \
  node tools/readiness/qualify-suites.cjs --account-export-runtime --explore
```

Build Account, Editorial, Discussion, Catalog BFF, aggregator Angular dependencies
and the production CSR in an isolated installation first. Freeze the source and
compiled outputs for the whole run. The qualifier uses real compiled services,
OPA, disposable MySQL/Mongo/RabbitMQ/MinIO and the existing Firebase Auth emulator
on `127.0.0.1:9099`. Run it separately from notification/erasure workflow modes;
`--no-browser` omits browser checks and cannot qualify the complete portal flow.

It creates real application topics and a review, materializes existing public
publication fixtures, traverses six content kinds without duplicates, and checks
canonical revision gaps, projection lag, private/foreign scope, mixed credentials,
cursor tampering and restart. Current topic deletion and parent withdrawal must
hide content despite stale projections; hidden pages remain traversable. Dependency
outages, restart recovery and absent secret are checked without a separate feed
projection or synthetic successful fallback.

Independent member/other-account/guest browsers exercise paging and Back navigation,
six real detail links including article/release bodies and suite membership, saved
category exclusions, real vote/favorite ordering, personalization opt-out, Account
restart, outage/retry and cancellation after account switching. Layout assertions
cover 390/768/1440 in both themes, including overflow, controls, the 16px card
header gap and 8px supporting-text gap. Paging, refresh and retry also use keyboard
activation. Inspect the saved screenshots as well as measurement results. Failure
diagnostics retain page text/screenshots alongside the normal qualification record.

The gateway substitutes trusted identities for deployed ingress; browser external
traffic is blocked. Public publication/ownership fixtures come from the export
setup, and production materializer functions run directly. Canonical withdrawal and
a legacy authority gap are introduced only in disposable data. These checks do not
qualify real credentials/ingress, production activation, restore/rollback, load/soak
or the static BFF health endpoint. Popular/recommended order is page-local; mature
classification, timelines and status observations remain separate work. Digest
qualification above also rechecks the shared Explore workflow.

## In-app discussion mentions

```sh
node tools/readiness/qualify-materialization.cjs --mention-notifications
OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/mention-notifications \
  node tools/readiness/qualify-suites.cjs --account-export-runtime --mention-notifications
```

Build Account, Discussion, Editorial, aggregator Angular dependencies and the
production aggregator CSR in an isolated installation. Freeze sources and compiled
outputs while qualifiers run. The SQL/MinIO qualifier checks atomic multi-recipient
rollback, exact replay, exclusive/expired leases, duplicate receipts, remove/re-add,
current access, opt-out, twelve crashed attempts, quarantine/exact requeue, deletion,
exports, bounded erasure including stale recipient fencing, and schema/row validation.
Its profile, policy and parent ports are controlled fixtures.

The compiled-service qualifier uses real Account/Discussion/Editorial, OPA,
disposable MySQL/Mongo/RabbitMQ/MinIO and the existing Firebase Auth emulator on
`127.0.0.1:9099`. Account and Discussion retain stable loopback origins across their
independent restarts. It exercises real public-profile preferences and private
recipient resolution, current access, suppressed/duplicate delivery, lost source
acknowledgement, read persistence, removal/re-add, dependency outage, exact command
replay during Account outage, multiple root recipients, source/parent deletion,
private export and disabled-worker unavailability.

The browser qualifier uses independent compiled-portal sessions to select members
and post topics, replies, quick-dialog replies and article comments, remove/re-add
mentions, follow actual inbox links, mark read and recover from a lost read response.
It checks opt-out, paging, loading/unavailable/retry states, session cancellation,
and 390/768/1440 layouts in both themes for the inbox, picker and public member display.
`--no-browser` omits browser checks. Each notification workflow runs separately.

The local gateway substitutes trusted identities for deployed ingress and blocks
external browser requests. Canonical publication/ownership fixtures come from the
export setup; production materializer functions run directly. Only a disposable
source lease is expired to exercise crash recovery. These checks do not qualify
production authentication, activation, database restore/rollback or load/soak.

## In-app favorite updates

```sh
node tools/readiness/qualify-materialization.cjs --favorite-updates
OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/favorite-updates \
  node tools/readiness/qualify-suites.cjs --account-export-runtime --favorite-updates
```

Build Account, Discussion, Editorial, the aggregator Angular package/dependencies,
and `aggregator-csr:build:production` in the isolated installation first. Freeze its
sources/artifacts while qualifiers run. The first command uses real MySQL/MinIO and
production adapters to verify rollback, replay, coalescing, saved baselines, current
visibility, removal/re-add, opt-out, competing leases, twelve crashed attempts,
quarantine/exact requeue, paging, export, erasure and migration validation. Policy
and public parent metadata are controlled ports in that command.

The second command uses compiled Account/Editorial/Discussion, real OPA, disposable
MySQL/Mongo/RabbitMQ/MinIO and the existing Firebase Auth emulator on port 9099.
Actual approval/publication/reply commands drive all four target types, including
published-release application updates. It checks silent private edits, exact replay,
source authentication, self isolation, durable reads, restart/outage, opt-out,
remove/re-add after projection recovery, bounded pages, four-source private export,
current withdrawal despite old projections and disabled-worker failure.

The compiled portal uses independent local browser contexts through a trusted local
identity gateway, with external traffic blocked. Checks cover all four real target
links, lost read response without automatic retry, session cancellation, preference/
loading/empty/unavailable states, page replacement and six width/theme combinations.
`--no-browser` omits these checks. Source materializers run directly; disposable watch
due times are accelerated to avoid 30-second waits. Domain-proof/ownership and parent
fixtures come from the export setup. These substitutions do not prove deployment,
real credentials/ingress, production writer fencing, restore/rollback or load/soak.
Run reply and favorite notification qualifiers separately.

## In-app reply notifications

```sh
node tools/readiness/qualify-materialization.cjs --reply-notifications
OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/reply-notifications \
  node tools/readiness/qualify-suites.cjs --account-export-runtime --reply-notifications
```

Build Account, Discussion, Editorial and the aggregator CSR in the isolated
installation first. Freeze that source snapshot and its compiled outputs for the
entire qualification. The first command uses real MySQL/MinIO with production
source/inbox adapters: atomic rollback, command replay, competing/expired leases,
crash-after-receipt replay, twelve-attempt quarantine and exact reviewed requeue,
preference/source suppression, bounded pages, both exports and >128-row erasure
cleanup, strict physical/row migration validation and non-destructive rollback.
Policy and public parent metadata are controlled ports in that command.

The second command reuses the disposable account-export setup but runs the focused
notification workflow instead of repeating its archive/erasure browser suite.
It uses compiled Account/Discussion/Editorial, real OPA, MySQL/Mongo/RabbitMQ/MinIO
and the existing Firebase Auth emulator at `127.0.0.1:9099`. Canonical public-parent
fixtures are materialized through production functions. Real reply commands feed
the compiled Account timer; no inbox response is fabricated. It checks independent
principals, application/article delivery, exact replay, self exclusion, opt-out,
source outage, restart and read persistence, lost settlement after durable receipt,
private export, hidden/deleted sources and disabled-worker behavior.

Independent browsers use the compiled CSR and real API responses through a local
bearer-to-canonical-identity gateway. They check real conversation links, uncertain
read recovery, preference/loading/empty/unavailable states, bounded pagination,
session change during an outstanding request, Home/OAuth route regression, and
390/768/1440 layouts in both themes. `--no-browser` omits browser evidence. External
browser traffic is blocked. A disposable lease timestamp is accelerated for crash
recovery; conversation materialization is invoked directly, not through a deployed
broker consumer. This does not prove production credentials/ingress, rollout/fencing,
coordinated restore/rollback, load/soak or any other notification channel.

## Editorial production erasure participant

```sh
OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/editorial-participant \
  node tools/readiness/qualify-suites.cjs --editorial-erasure-participant
```

Build Editorial in the isolated installation first; freeze sources and artifacts
until this command finishes. Real MySQL/Mongo/MinIO/OPA/Sharp and compiled HTTP
create all six content kinds, real uploads and four publication/review families.
The compiled service-only erasure endpoint drives the actual composed phases and
final completion, with existing compiled media-cleanup timers. Authorization,
invalid/disabled writer-fence activation, private SQL failure, stopped media workers,
Mongo outage, final-receipt failure, concurrent retries and process restart are
qualified. Completed replay must work with activation off and Mongo unavailable.

The qualifier compares final residual-check coverage against the physical schema,
verifies full leading indexes and injects each of 36 residual fields independently
inside rolled-back SQL transactions. Missing/invisible applied completion indexes
must fail migration validation. Public content/media, peer decisions and successor
editing remain valid. The browser decodes real retained cover bytes in independent
sessions/restart across three widths and both themes (12 layouts). `--no-browser`
omits browser checks. Existing deep workspace/audit/media qualifiers remain separate
evidence; their real setup helpers supply this fixture, including copied >128-row
histories and controlled domain proof. Ingress and browser shell data remain local
fixtures; Discussion comments and the Account erasure portal are not exercised.
No deployment, actual writer fencing, restore, rollback, load or soak is implied.

## Editorial projection erasure

```sh
OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/editorial-projection-erasure \
  node tools/readiness/qualify-suites.cjs --editorial-projection-erasure
```

Build Editorial in the isolated installation first and freeze its sources and
artifacts while qualifying. This extends canonical-author erasure qualification
with the production projection use case and MySQL target repository. Real MySQL,
Mongo and OPA checks cover all six kinds, multiple tenants, exact pending requests,
stale bylines, missing documents, corruption, unexpected attribution, conflicting
or ahead-of-authority documents, successor edits, duplicate workers, SQL failure
after Mongo success, retry/restart and migration reentry. Anonymous public text
survives delayed publication of old snapshots; tombstones remain intact.

The existing compiled public-article browser checks now invoke the projection
cleanup itself between lag and retained-content states. They cover 18 layouts,
independent restart and both themes at 390/768/1440. `--no-browser` omits those
checks. Domain proof, trusted ingress and browser shell data remain controlled;
invalid SQL/Mongo state is injected only for failure cases. Cover metadata is a
fixture, so byte delivery is excluded. This harness does not run Discussion
comments, private/audit/media cleanup, complete the production participant, or
enable the Account erasure portal. Those and deployment/restore/rollback/load/soak
qualification remain separate requirements.

## Editorial ownership and audit erasure

```sh
OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/editorial-audit-erasure \
  node tools/readiness/qualify-suites.cjs --editorial-audit-erasure --editorial-media-retirement
```

Build Editorial first and freeze the isolated source/artifact snapshot while the
qualifier runs. Audit mode includes canonical anonymity and private-workspace
cleanup before directly driving `MysqlEditorialAuditErasure`. Real compiled HTTP
and OPA/MySQL create approved/rejected application, suite, article and release
reviews, ownership approvals/rejection/revocation, a later successor grant, deleted
peer draft history and an unfinished proof check. Checks cover exact barriers,
claim-deletion rollback, missing permanent ownership authority, batches of 128,
concurrent workers, restart, late verification, preserved peer export/content,
anonymous review timestamps, unbound editing denial and fresh proof/approval after
erasure. Peer withdrawal/deletion must remain valid after reviewer anonymization.

A separate disposable legacy database backfills more than 128 grants, including
older approval history hidden by later transfers. It resumes an interrupted page,
rejects incompatible physical columns before DDL, and validates applied history,
stamps, indexes and claim/decision relationships. Reentry uses no DDL. Reversed ORM
index enumeration must not invalidate physically correct predecessor schemas.

Domain proof is a controlled port in this combined harness; the separate ownership
HTTP regression uses real local DNS TXT queries. Large receipt/outbox and legacy
grant histories are explicit SQL fixtures. The peer export fixture has no uploaded
media. Trusted ingress and browser shell data remain fixtures. `--no-browser` omits
only retained-content browser checks; combining media retirement adds reference
races, quarantine and compiled cleanup maintenance. Full participant composition,
projection completion, the enabled Account/portal erasure journey and deployment,
restore, rollback, load and soak remain unqualified.

## Editorial private workspace erasure

```sh
OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/editorial-workspace-erasure \
  node tools/readiness/qualify-suites.cjs --editorial-workspace-erasure --editorial-media-retirement
```

Build Editorial first in the isolated installation and keep sources/artifacts frozen
through qualification. This mode replaces the retained-media fixture's private-row
deletion with the actual `MysqlEditorialWorkspaceErasure` adapter. Both compiled
publication/upload APIs and OPA use real MySQL/Mongo/MinIO. Applications, suites,
articles and releases are published before canonical anonymization and bounded
private cleanup. It verifies preserved public snapshots/outbox, legitimate successor
editing/media, other-member content, multiple tenants and case-distinct identities.

A real upload/publication/editing/republication sequence leaves an image shared
only by the erased author's private drafts. All owned references must drain before
uploader metadata, and this image must receive a permanent object marker before
workspace erasure drains. The large-history fixture adds 130 valid submitted revisions and command receipts
per family, then runs production migration validators. Cleanup asserts 128-row
limits, SQL rollback, valid intermediate restart, exact request fencing, permanent
object markers, process loss before cleanup receipt, stale lease rejection and late
upload denial. Missing private authority and corrupt receipt cardinality fail closed.
The overall participant must remain pending. Index reentry rejects invisible or
missing applied indexes and destructive down migration.

Combining `--editorial-media-retirement` also runs reference-race/quarantine and
compiled maintenance regressions after production private cleanup. The compiled
public article portal verifies retained cover bytes in independent sessions and
mobile/tablet/desktop light/dark layouts. `--no-browser` omits only that UI check.
Domain proof, trusted ingress and browser shell/account/preferences remain controlled
ports/fixtures; no real Account erasure orchestration is claimed. Stress history and
additional retirement rows are explicit SQL fixtures. Lease/retention clocks are
advanced in the harness. Ownership/audit cleanup, projection completion, participant
composition, the enabled erasure journey and deployment/restore/rollback/load/soak
remain open.

## Editorial media retirement after private erasure

```sh
OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/editorial-media-retirement \
  node tools/readiness/qualify-suites.cjs --editorial-media-retirement
```

This extends retained-media qualification with the production cleanup stores and
both compiled maintenance commands. Real MySQL/MinIO checks cover registry-only
orphan media, seven-day and batch limits, atomic descriptor/job rollback, object
success before process/SQL receipt loss, lease takeover, stale receipt rejection,
permanent markers, migration reentry and quarantine/requeue. A controlled held
reference lock proves a concurrent inherited attachment survives; retirement then
prevents stale reattachment after the reference is removed. Public/inherited bytes
and the same 12 browser layouts remain usable after cleanup. `--no-browser` omits
only the portal checks.

Additional orphan records and the held reference are SQL fixtures with real
normalized MinIO objects. The harness advances cleanup time for retention and
lease expiry; compiled maintenance runs against wall-clock time. Original private
history is removed explicitly in the fixture unless combined with
`--editorial-workspace-erasure`.
The underlying retained-media substitutions and deployment exclusions still apply.
No new schema or projection event is required for registry-only retirement.
Ownership/audit erasure, projection completion and the Editorial participant's final
receipt remain pending.

## Editorial retained media

Build Editorial and the existing aggregator Angular/CSR artifacts in the isolated
Node 22.17.1 installation. Keep source and artifacts frozen during qualification.

```sh
OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/editorial-media-assets \
  node tools/readiness/qualify-suites.cjs --editorial-media-assets
```

`--no-browser` omits only the compiled public portal. Disposable MySQL/Mongo/MinIO
and real OPA/Sharp/HTTP verify application and article uploads, atomic descriptor/
ready-state/receipt rollback, exact retry against existing immutable bytes,
independent approval, ownership transfer, canonical anonymity and retained byte
delivery after restart. Original private upload/draft/submission/command history
is removed explicitly in the disposable fixture: this does not implement or qualify
production private cleanup. Public and successor-draft reads must still return the
exact approved bytes; direct private upload selection remains scoped.

A separate legacy database validates beyond one 128-row page, rejects invalid
metadata/references before DDL, resumes an interrupted backfill and verifies 262
live descriptors/retirement guards with unchanged source/event data. Applied
table/index/descriptor loss, retired references, conflicting registration and
destructive down fail closed. Existing application/media-retention, article-cover,
Editorial author-erasure and account-export-editorial modes cover affected
regressions. The public browser checks two independent sessions across API restart
at 390/768/1440 widths in both themes, including decoded real cover bytes.

DNS proof is controlled; staff approval uses real OPA/MySQL. Trusted ingress and
browser shell account/profile/preferences are fixtures; Discussion comments are
unavailable. Legacy migration rows are metadata fixtures. No full erasure,
registry-only orphan retirement, production fencing, deployment, restore,
rollback, load or soak qualification is claimed. No projection event is needed
for this representation-only backfill; existing event protocol evidence is reused.

## Editorial canonical author erasure

Build Editorial, the aggregator Angular package and CSR in the isolated Node
22.17.1 installation, keeping sources and artifacts frozen during qualification.

```sh
OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/editorial-author-erasure \
  node tools/readiness/qualify-suites.cjs --editorial-author-erasure
```

`--no-browser` runs the same real-store checks without the compiled portal. The
mode uses disposable MySQL/Mongo and real OPA/HTTP to cover all six canonical
content kinds, exact pending request/revision checks, atomic anonymity/revision/
outbox/target and ownership-decision rollback, concurrent bounded progress,
cross-tenant/case isolation, restart and new ownership during candidate selection.
Articles retain text/URLs/cover associations and timestamps; public reads hide old
attributed projections and older snapshots cannot overwrite anonymous content.
All migration reentry checks run after anonymity, and a separate 130-row legacy
database exercises pre-DDL validation, interrupted committed DDL, recovery and
missing/corrupt applied schema/index rejection. Premature completion is refused.

The browser mode checks public projection lag, anonymous retained content and an
independent public session after API restart at three widths in both themes.
Shell account/profile/preferences and trusted ingress are fixtures. Domain proof
is a controlled port; ownership approval uses the real policy and SQL. Ready cover
metadata and its processing receipt are fixtures: exact public association is
checked, but no image bytes or Discussion comments are supplied in this browser
harness. Their unavailable states must remain truthful. RabbitMQ delivery is not
rerun by this mode; existing delivery/recovery evidence applies to the unchanged
event protocol. This phase is not yet composed into Editorial's participant and
does not qualify private/audit/media cleanup, projection target completion, the
complete erasure portal journey or production fencing/migration/restore/rollback/
load/soak. It must leave the participant pending.

## Suite publication snapshots

Build Editorial and the aggregator Angular package/CSR in the isolated Node 22.17.1
installation. Run the following against disposable local services:

```sh
OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/suite-publication-snapshots-runtime \
  node tools/readiness/qualify-suites.cjs --delivery
OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/suite-publication-snapshots-export \
  node tools/readiness/qualify-suites.cjs --account-export-editorial --no-browser
```

The default suite workflow includes exact approved-content backfill for 131 rows,
128-row transaction boundaries, interruption/restart, pre-DDL provenance checks,
missing applied schema and corrupt content refusal. After removing private history
in its disposable database, it verifies canonical reads/selection, scoped profile
activity, fresh Mongo publication and account export. The ordinary compiled
owner/reviewer/public browser journey checks immutable approval, conflicts, retry,
restart, withdrawal and both themes at mobile/tablet/desktop widths. Layout checks
include available title width, so header actions cannot crush a mobile title.
`--delivery` adds actual broker delivery, replay and projection recovery. The export
mode covers all Editorial source families, SQL snapshot isolation and real media.

This does not qualify account-erasure composition or production writer fencing,
migration, restore/rollback, load or soak. Sources and artifacts must remain frozen
while qualifiers run. The new migration requires explicit writer fencing and must
precede the updated approval writer; see `docs/MATERIALIZATION.md`.

## Account erasure through all participants and the portal

Build changed Editorial, frontend identity, aggregator Angular and CSR artifacts in
the isolated Node 22.17.1 installation. Reuse unchanged, previously qualified Account,
Discussion Management and Discussion Materializer artifacts. Run:

```sh
OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/account-erasure-workflow \
  node tools/readiness/qualify-suites.cjs --account-export-runtime --account-erasure-coordinator
```

The command retains the four-source export regression journey, then requires global
erasure completion through the compiled Account pump and each service-only endpoint.
Discussion outage, pending activation, author/private/media cleanup, projection
confirmation and restart precede exact final receipts. A trigger rejects the Account
coordinator's last journal write: every participant can be complete while global
status must still be pending. Removing the fault and restarting must converge to
`cleanup: completed`, with Firebase credentials absent, all 36 Editorial residual
fields empty, complete current projections and foreign ownership preserved. Public
application/article image bytes remain readable; source export has no remaining
owner-attributed records. The historical cancelled-cover fixture uses the production
retirement operation to establish its guard and cleanup journal. Approved ownership
fixtures also record permanent ownership history through the production helper.

Browser checks use the compiled privacy page and real Account records behind a
controlled trusted-ingress gateway. They require fresh account verification, typed
consent, cancellation, exactly one DELETE, accepted/pending and uncertain notices,
old-session denial, a delayed lost receipt with a background 401, and a late receipt
after an actual cross-tab session change. Browser-created deletion requests must
complete through the compiled coordinator and Firebase worker. Confirmation, accepted
and uncertain views are measured at 390/768/1440 in both themes. The session-switch
fixture uses an inert same-origin page and returns focus to the application so browser
animation-frame polling remains active. Screenshots wait for theme transitions; a
failure saves fixture request statuses and visible panel text for diagnosis. Use `--no-browser`
only for the backend subset; it does not qualify the portal.

Only disposable, unleased retry scheduling is accelerated; no cleanup receipt is
manufactured. Compiled services perform cleanup. These checks reuse the existing
Firebase emulator and remove only their random project users/disposable services.
They do not qualify production credentials/ingress, deployed writer fencing, reviewed
legacy inventory, restore, rollback, load or soak. Keep sources and artifacts frozen
while the qualifier runs. Final UI notices are in-memory and do not survive a full
reload; they do not provide a post-deletion authenticated status endpoint.

## Discussion production erasure participant

After building Discussion Management in the isolated Node 22.17.1 installation,
retain the already qualified Account, Editorial and Materializer builds and run:

```sh
node tools/readiness/qualify-materialization.cjs --discussion-author-erasure
OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/discussion-participant \
  node tools/readiness/qualify-suites.cjs --account-export-runtime --no-browser --account-erasure-coordinator
```

The runtime command uses the existing Firebase emulator without stopping it and
disposable MySQL/Mongo/RabbitMQ/MinIO with compiled services and real OPA. It starts
from Account DELETE, verifies default-off activation and incomplete-inventory
refusal, then completes reviewed inventory in the disposable fixture. The compiled
participant cleans mixed discussions/reviews, private payload/history and actor
interactions while retaining anonymous public text/ratings and peer replies/helpful
marks. It remains pending during projection lag and after a partial API restart.
The real materializer consumes queued rebuild work before historical caches drain.
A SQL trigger fails final completion; retry and concurrent invocations converge to
the same durable receipt. At this intermediate checkpoint Account erasure remains
pending for Editorial; the extended command now continues into the full completion
checks described above.
Existing integrated export/source outage/cancellation/policy checks run in the same
meaningful integration checkpoint. The `--no-browser` form excludes the portal journey.

Deployment requires all explicit migrations through `ReviewErasure1791840008000`,
reviewed payload inventory, an unversioned bucket with permanent markers, and actual
fencing/draining of legacy writers/materializers before setting
`DISCUSSION_ERASURE_WORKERS_FENCED=true`. Absent/false keeps requests pending without
destructive cleanup. Current schema-3 workers must run. This local acknowledgement
does not qualify production fencing, coordinated restore/rollback, load or soak.
Never copy sources or rebuild artifacts while these qualifiers consume them.

## Discussion canonical author erasure

Build Discussion Management/Materializer in the isolated installation, then run:

```sh
node tools/readiness/qualify-materialization.cjs --discussion-author-erasure
node tools/readiness/qualify-materialization.cjs --discussion-payloads
node tools/readiness/qualify-materialization.cjs --account-export-sources
```

The author-erasure mode uses disposable real SQL, MinIO and MongoDB. It verifies
the additive nullable-owner migration and strict re-entry; exact request/inventory
authority; public and unlisted retention; private tombstones; preserved/new replies;
projection lag and stale-worker protection; upload/commit recovery; retirement
exclusion for active copies; outbox rollback; moderator deletion while waiting for
the aggregate lock in both reserve and commit; concurrent retries; and a worker
overtaken before reservation which must never upload unregistered bytes.

The same mode now also runs retained-projection cleanup checks: missing/lagging
current projections keep SQL targets pending; 205 schema-2 copies require multiple
100-record batches; a failure after Mongo deletion and before SQL completion is
retryable; current anonymous records, tombstones and other members are preserved.
It drains obsolete v1/v2 orphans and rejects unknown schemas or unaccounted current
attribution. Majority read/write settings are exercised on the disposable standalone
MongoDB instance; production replica-set failover is not qualified by this test.

The same mode also checks private SQL cleanup: actor-first index migration/re-entry,
outbox-failure rollback, concurrent peer reactions, current count rebuilding and
stale-materializer refusal, 128-row receipt/registry batches across tenants,
duplicate workers and resumed adapters, preserved object retirement guards, delayed
acknowledgements, other-owner content and unmapped legacy-interaction refusal.
It verifies that SQL-phase drainage leaves the full service request pending.

Review checks in the same mode cover anonymous public retention, private tombstone
refusal, atomic target rollback, 131 historical versions in bounded batches, new
report/moderation preservation, actor interaction/history cleanup, exact legacy
moderation provenance despite equal timestamps/reasons, reason rollback/retry,
in-flight reads, duplicate workers and corrupt chronology refusal. SQL phase
drainage still leaves the production participant pending. The compiled review
browser mode (`--delivery --application-discussions --member-reviews`) additionally
checks anonymous public and erased private views in responsive themes. Erasure is
fixture-triggered there; it does not qualify the Account-triggered portal journey.

The latter modes regress registered history, reviewed legacy inventory and export
after the registry state/ownership changes. The compiled ordinary Discussion
browser workflow is qualified by the command in the next section. Author-erasure
checks invoke application/adapters directly. Production participant composition is
qualified by the separate runtime command above; the portal erasure action remains
pending. Primitive checks do not independently certify service completion or deployment.

## Discussion projection erasure prerequisite

Build Discussion Management and Materializer in the isolated installation, then:

```sh
node tools/readiness/qualify-materialization.cjs
OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/discussion-projection-erasure \
  node tools/readiness/qualify-suites.cjs --delivery --application-discussions --topic-browser
```

Schema-3 checks prove stable node revision guards, same-revision schema-2 upgrades,
same-schema conflicts, duplicate/out-of-order delivery, a worker paused before its
first projection write, deletion and authoritative rebuild. Unit coverage also
requires pending/incomplete reads after a partial batch, without mixed generations.
The runtime/browser mode covers real delivery, independent sessions, API restarts,
recovery and 84 responsive/theme layouts with unchanged portal artifacts.

Canonical anonymization, private cleanup and removal of old schema-2 documents
remain pending. Drain old-schema workers before activating erasure and preserve
stable tombstones. Destructive cache drop/restore requires draining in-flight
workers before rebuilding from current authority. These checks do not qualify a
production rollout, full account erasure, coordinated restore/rollback or load/soak.

## Discussion historical payload inventory

Build Discussion Management in the isolated Node 22.17.1 installation, then run:

```sh
node tools/readiness/qualify-materialization.cjs --discussion-payloads
node tools/readiness/qualify-materialization.cjs --account-export-sources
```

The payload mode now also qualifies `--inventory-payloads` and reviewed
`--apply <fingerprint> --legacy-writers-stopped` through the compiled maintenance
CLI. Each invocation processes at most 32 objects with durable per-object progress.
Checks cover strict migration/re-entry/loss, advisory exclusion, recovered owner
history/export, a legacy-copy crash window, unresolved ownership/graph preservation,
generation drift, concurrent registration under SQL gaps, erasure during copy and
real refusal of enabled/suspended versioning. The source mode regresses existing
private export consumers of the shared bounded object reader. Earlier public
materialization/browser evidence is reused because those paths have no changes.

Run `--migrate` before updated API startup. For deployment, first fence and drain
legacy writers, review any needed ownership backfill, preview each inventory batch
and apply only its reviewed fingerprint. A blocked or partially applied batch
requires a new preview; never force past an unresolved owner or unknown key. Retain
permanent markers and unversioned bucket configuration across recovery. Completion
of this maintenance inventory does not complete an account erasure. Real writer
fencing, deployed data inventory, coordinated backup/restore, rollback and load/soak
are still unqualified. Never rebuild or copy sources while qualifiers consume them.

## Discussion registered-payload export

Build Discussion Management in the isolated Node 22.17.1 installation, then run:

```sh
node tools/readiness/qualify-materialization.cjs --account-export-sources
OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/discussion-export-history \
  node tools/readiness/qualify-suites.cjs --account-export-runtime --account-erasure-coordinator
```

The source mode uses disposable MySQL/MinIO and exercises 134 contributions,
135 registered versions, 131 retained review versions, consistent snapshot paging,
historical/removed/uncommitted content, lost upload confirmation, absent reserved
objects and uploader-only privacy. Corrupt or missing confirmed history, a real
missing bucket and concurrent retirement fail capture; fresh completed-retirement
metadata and cancellation/reconnect are checked. Its command policy is substituted.
Adapter tests separately reject generic 404/access/outage errors as absence.

The runtime mode uses compiled Account/Editorial/Discussion, real OPA and isolated
stores/emulator identities. It creates and edits private Discussion content through
HTTP, then verifies both versions in the compressed archive and browser download.
Existing outage/retry/restart, cancellation, exact replay, foreign-account denial,
current lifecycle and erasure-pending regressions remain active. The unchanged
privacy page is checked at mobile/tablet/desktop widths in both themes. Trusted
ingress is a local fixture; production credentials/ingress are not qualified.

This extends export for registered history. Unknown legacy/unregistered objects,
full erasure/anonymization, deployment, restore/rollback and load/soak remain open.
Never rebuild or copy source snapshots while a qualifier consumes their artifacts.

## Discussion payload registration and retirement

Use the isolated Node 22.17.1 installation and build affected libraries/services
before compiled-runtime qualification. Preserve existing portal build artifacts
for the unchanged Discussion UI; never rebuild while a qualifier consumes them.

```sh
node tools/readiness/qualify-materialization.cjs --discussion-payloads
node tools/readiness/qualify-identity-mysql.cjs --account-erasure-coordinator
node tools/readiness/qualify-materialization.cjs
OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/discussion-payload-browser \
  node tools/readiness/qualify-suites.cjs --delivery --application-discussions --topic-browser
WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/discussion-payload-runtime \
  node tools/readiness/qualify-suites.cjs --account-export-runtime --no-browser --account-erasure-coordinator
```

The focused payload mode creates only disposable MySQL/MinIO. It checks durable
reservations, confirmed scope-bound publication, outbox rollback, 36 obsolete
references across bounded batches, storage failure/reconnect, permanent markers
and an upload paused after reservation but before PUT. Current public payloads and
foreign/case-distinct owners survive. Migration upgrade/re-entry/corruption,
missing-applied schema and destructive rollback are covered. Enabled/suspended
bucket versioning is rejected by unit tests; the real store is unversioned.

The coordinator SQL mode also reverses ORM index metadata over actual valid
indexes and requires missing/reversed/prefix SQL indexes to fail validation,
including re-entry with separate service databases. The full materialization
mode covers Discussion/Editorial/catalog recovery. The Discussion browser covers
independent members, conflicts, retries, moderation, pagination, restart and
projection loss/rebuild across 84 responsive/theme layouts. The runtime mode
regresses the previous export scope and truthful pending erasure.

Retirement is invoked directly by the focused qualifier; it is not yet composed
into Discussion's production erasure participant. Historical/orphan inventory is
now qualified by the maintenance checks above; its deployment execution,
public-author anonymity, automatic private/audit cleanup and service completion
remain open. Registry/obsolete-body export is qualified by the separate export
mode above. These checks do not qualify portal
erasure, production rollout, backup restoration, compatible rollback or load/soak.

## Account private-data cleanup

Use the isolated Node 22.17.1 installation. Build the affected identity libraries,
four services, aggregator library and CSR before qualification; do not rebuild
while a qualifier uses their artifacts.

```sh
node tools/readiness/qualify-identity-mysql.cjs --account-erasure-cleanup
OPA_BINARY=/path/to/verified/opa \
  WAPPS_PROFILE_BROWSER_OUTPUT=/tmp/wapps-readiness/account-erasure-badges \
  node tools/readiness/qualify-identity-mysql.cjs --profile-badges-browser
WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/account-erasure-runtime \
  node tools/readiness/qualify-suites.cjs --account-export-runtime --no-browser --account-erasure-coordinator
```

The first mode uses disposable real MySQL to verify rollback, bounded commands/
badge-history/export-chunk cleanup, exact completed Account receipts, reconnect/
concurrency, foreign-account isolation, blocked late writes and retained lifecycle
authority. Migration re-entry runs during partial erased-recipient cleanup and
after completion; anonymized surviving-recipient history must still replay.
The browser mode qualifies erased staff attribution/reasons through the real
staff-history HTTP/portal, using canonical adapters to seed the erased staff.
Fourteen states produce 84 mobile/tablet/desktop light/dark layouts. This is not a
complete browser account-erasure journey.

The runtime mode verifies that compiled Account DELETE completes the Account
participant and removes its private data during a Discussion outage, while
overall erasure remains pending. Export regression, exact service receipts,
restart and write-barrier enforcement remain covered. The harness substitutes
trusted ingress and uses an isolated Firebase project; production identity and
deployment are not claimed. Editorial/Discussion cleanup, public-author anonymity,
object retirement, portal erasure, restore/rollback and load/soak remain open.

## Account erasure coordination

```sh
node tools/readiness/qualify-identity-mysql.cjs --account-erasure-coordinator
WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/erasure-coordination \
  node tools/readiness/qualify-suites.cjs --account-export-runtime --no-browser --account-erasure-coordinator
```

The SQL mode uses separate disposable owning-service databases. It covers old
credential-completed tombstone backfill, exact receipts, case-sensitive barriers,
rollback, outage/retry/deferral, lease fencing, reconnect and missing-applied-table
recovery guards. Manually completed receipts model future cleanup consumers only.
The runtime mode also regresses export and runs compiled Account/Editorial/
Discussion APIs with real OPA and isolated stores plus a random Firebase project
in the existing loopback emulator. Account DELETE reaches available participants
while Discussion is offline, resumes after restart, denies later writes and keeps
cleanup pending after credentials are removed. Trusted ingress headers substitute
for deployed authentication. The runtime mode now also verifies Account-owned
private-data cleanup as described above. It does not qualify Editorial/Discussion
anonymization/object cleanup, erasure UI, deployment, restore, rollback, load or soak.

Run migrations for all owning services first. Configure a separate
`ACCOUNT_ERASURE_SECRET`; local examples use disposable development values.
Account maintenance provides `--erasure-status` and `--erasure-requeue <uid>`.
Never treat a pending request as completed erasure or roll back to pre-barrier
writers after activation. Qualification starts and cleans up only its own stores;
it does not stop the user's existing Firebase emulator.

## Account erasure write barriers

Use the isolated Node 22.17.1 installation and rebuild Editorial and Discussion
after the shared identity MySQL adapter. These checks create only disposable
containers/databases and internal fixture erasure markers.

```sh
node tools/readiness/qualify-identity-mysql.cjs --identity-write-barriers
WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/erasure-write-barriers \
  node tools/readiness/qualify-suites.cjs --identity-write-barriers
```

The first checks real InnoDB wait ordering, both erasure/write races, rollback,
replay/conflict, case isolation, reconnect, migration re-entry and 20 prepared
adapter write/receipt paths. It rejects recreation of a missing table after its
migration is recorded as applied. It observes database lock waits rather than
treating an elapsed delay as proof of serialization. The second creates canonical drafts
and submissions through compiled Editorial HTTP and real OPA, then verifies
author/actor barriers on application/suite/article publication and ownership
decisions, receipt denial and restart without canonical/outbox changes. Trusted
ingress identities and internal erasure markers are supplied by the harness.
Neither check qualifies Account-triggered erasure, anonymization, private-data or
object cleanup, the erasure portal, deployed authentication or production recovery.

## Account export storage and integrated workflow

Use the isolated Node 22.17.1 installation and an existing local `mysql:8.4` image.
The qualifier creates only a disposable container/database, mounts no existing
Wapps data and cleans up its own resources.

```sh
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true
node tools/readiness/qualify-identity-mysql.cjs --account-export-storage
node tools/readiness/qualify-identity-mysql.cjs
```

The focused mode tests the real migration, SQL stores, worker and gzip writer:
concurrent receipts/claims, case-sensitive ownership, chunk immutability and hash,
partial-attempt reclamation, restart, rollback, source failure/backoff, expiry,
cancellation/erasure during download and per-account request bounds. Reentry
rejects corrupt chunks/artifacts, missing applied tables and incompatible keys;
rollback refuses data loss. The storage worker uses fixture source records; this
mode now also independently qualifies the real Account source against canonical
MySQL, including consistent concurrent edits, keyset batches, private profile,
avatar integrity and lifecycle/cancellation failures. It does
not qualify real credential/Editorial/Discussion data, HTTP export endpoints,
the portal, complete erasure or production operation.

Run affected core, management, MySQL and both identity-runtime tests, builds,
typechecks and lint. Core now has its own nonempty Jest target. Validate the
generated identity OPA bundle, test inventory and architecture boundaries.
See the export storage checkpoint for exact local evidence and remaining work.

Real credential and Discussion source checks:

```sh
WAPPS_CREDENTIAL_INTEGRATION=1 node --test tools/readiness/identity-credentials.test.cjs
node tools/readiness/qualify-materialization.cjs --account-export-sources
OPA_BINARY=/path/to/verified/opa node --test tools/readiness/opa-policies.test.mjs
```

The credential test requires the existing loopback Firebase Auth emulator and
uses a random qualification account, cleaned up by the test. It checks the real
Admin source's safe allowlist, missing/disabled credentials and private-claim
exclusion. It never sends external email or contacts a production provider.
The Discussion option starts only disposable MySQL and MinIO, captures 134 owned
contributions across tenants and 131 retained review versions, and tests snapshot
edits, pagination, tombstones, votes/likes/reports/helpful marks, object/structural
corruption, exact case isolation, reconnect and cancellation. Its fixture command
authorization is substituted. It does not start the compiled Discussion API,
Account pump, portal, Mongo or broker; this source-only check does not qualify the
full four-source archive. Separate Jest HTTP tests exercise the
real controller/middleware and bounded Account client with substituted data and
policy responses; the OPA suite separately validates real generated policies.

Real Editorial source and compiled internal transport:

```sh
node node_modules/nx/bin/nx.js run apps.services.editorial:build --skip-nx-cache
WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/account-export-editorial \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-suites.cjs --account-export-editorial --no-browser
```

The existing suite harness starts disposable MySQL, Mongo, MinIO and OPA; export
reads canonical SQL and owned immutable objects only. The new mode uses explicit
canonical SQL fixtures for all four publication families, ownership history,
140 retained suite submissions, multiple owner tenants, transferred ownership,
scrubbed tombstones, taxonomy and media bindings. It checks snapshot edits,
exact-case/foreign isolation, verified chunked bytes, missing/corrupt objects,
cancel/early return/reconnect, concurrent retirement, compiled API restart and
real policy failure. It does not rerun publication commands or use browser/demo
data. Source transport requires a dedicated URL-safe 32-128-character
`ACCOUNT_EXPORT_SOURCE_SECRET`, distinct from ingress credentials. Production
provisioning remains pending. The integrated mode below adds Account runtime and
portal download acceptance. Preserve valid earlier source evidence.

Integrated account export and privacy-page workflow:

```sh
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true
# Build Account, Discussion Management and Editorial sequentially; then build
# aggregator-angular and aggregator-csr. Keep the CSR output fixed during browsers.
WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/account-export-workflow \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-suites.cjs --account-export-runtime
```

Add `--no-browser` for the backend portion. This starts disposable MySQL 8.4,
Mongo 7, RabbitMQ 4, MinIO and OPA, plus all three compiled APIs. It uses the
existing Firebase Auth emulator at `127.0.0.1:9099` in a fresh project namespace
and cleans up its two users. It never stops that emulator or accesses production
credentials. RabbitMQ/Mongo are service-startup dependencies; archive capture reads
canonical SQL/committed objects rather than projections. Editorial uses canonical
SQL fixtures; Discussion content is created through real HTTP commands.

The check verifies complete source receipts and digest, replay/conflict/ownership,
corruption, real source outage/retry, API restart, recovery from a persisted
interrupted lease/partial chunk, in-flight cancellation, expiry purge, suspension
and policy outage. Lease/expiry timestamps are accelerated only in disposable SQL.
Temporary suspension blocks download without removing an unexpired archive.
The browser adds exact lost-response retry, independent owner/foreign sessions,
reload after restart, verified download, unavailable-state recovery, account switch
during download, removal, and six light/dark layouts at 390/768/1440 pixels.
Its local gateway substitutes trusted ingress headers for fixture bearer tokens.
The output includes service results and `browser/qualification.json` plus PNGs.
Real deployed authentication/ingress, secret provisioning, restore/rollback/load/
soak and maximum-size browser memory remain separate unverified release gates.

## Published profile articles

Build Account, Editorial, Discussion Management and the Aggregator Angular
library/CSR in the isolated Node 22.17.1 installation. Reuse the qualified
Discussion materializer build and keep CSR fixed while browsers run.

```sh
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true
WAPPS_PUBLIC_PROFILE_ACTIVITY=1 WAPPS_PROFILE_ARTICLES_ONLY=1 \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/profile-articles \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-suites.cjs --application-discussions --delivery --discussion-favorites
node tools/readiness/qualify-application-media-gateway.cjs
```

The article flag reuses only the initial activity fixtures, then runs
`profile-articles-checks.cjs` and the surrounding Discussion/favorites regression.
It creates 21 reviewed public articles plus private/other-author/other-tenant
fixtures through production commands. Checks cover UUID continuation, unchanged
full totals, private draft isolation, withdrawal, exact projection lag,
loss/reconstruction from canonical SQL, stale replay, strict scope and service
credentials. A proxy holds actual Editorial responses while canonical profile
sharing or audience changes; Account must reject the obsolete result. Source
outage, hidden dependency avoidance, retry and Account process restart are tested.

The compiled portal uses independent member/anonymous sessions, actual privacy
settings, owner previews, approved followers and revocation. Ten states at
390/768/1440 in both themes produce 60 layouts with no overflow or column
misalignment. `profile-articles/qualification.json` records layouts and browser
errors; screenshots accompany it. Nginx routing and internal endpoint blocking
are separately tested. Local ingress identities are controlled fixtures;
production deployment, load/soak, restore and rollback remain unqualified.

## Staff profile badges

Build both identity services, the Aggregator Angular library and its production
CSR in the isolated Node 22.17.1 installation. Keep CSR fixed during browser runs.

```sh
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true
OPA_BINARY=/path/to/verified/opa \
  WAPPS_PROFILE_BROWSER_OUTPUT=/tmp/wapps-readiness/profile-badges \
  node tools/readiness/qualify-identity-mysql.cjs --profile-badges-browser
node tools/readiness/qualify-application-media-gateway.cjs
```

The runner creates only an ephemeral MySQL database/container and local compiled
Account/OPA/browser processes, then cleans them up. SQL checks cover atomic
outbox rollback, concurrent and exact retries, no resurrection after revocation,
actor/recipient lifecycle, audit paging, reconnect and schema/audit/state
corruption. Existing identity/profile/preferences/favorites SQL regressions run
in the same fresh database. Normal Account startup must reject a pending badge
migration; compiled `--migrate` validates retained history before restart.

Real HTTP checks include staff authorization, strict scope rejection, private and
owner-approved-follower audiences, Show Badges, staff-only reasons, immutable
history and fail-closed policy loss. A proxy forwards real OPA responses while
making a canonical sharing or revocation change before the badge read continues;
the API must reject the obsolete snapshot. The browser uses independent staff,
member and anonymous contexts, real settings, a lost response after a committed
decision, exact retry, conflicts, history paging, session changes and API restart.
Fourteen states, including anonymized erased-staff history, are checked at
390/768/1440 in both themes. `layout.json` records
actual layouts and browser errors; screenshots accompany it. Gateway qualification
checks real Nginx route selection and trusted header replacement separately.

Credential-to-ingress mapping, unavailable unrelated APIs, the policy timing
proxy and the lost-receipt injection are explicit local substitutions. Production
credentials, ingress, restore/rollback, load/soak and cross-service erasure remain
open. Account-owned badge audit cleanup is qualified by the first section.

## Profile totals

Build Account, Editorial, Discussion Management and Aggregator library/CSR using
Node 22.17.1 in the installed snapshot. Reuse the existing Discussion materializer
build; keep CSR fixed while browsers run. The totals journey uses the activity
fixture setup, then checks only the totals workflow and the existing surrounding
discussion/favorites integration:

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true \
  WAPPS_PUBLIC_PROFILE_ACTIVITY=1 WAPPS_PROFILE_TOTALS_ONLY=1 \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/profile-totals \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-suites.cjs --application-discussions --delivery --discussion-favorites
```

`profile-totals-checks.cjs` creates real reviewed publications beyond first-page
sizes, distinct discussion participation and all favorite types. It checks private
and public counts, private-draft isolation, withdrawal/deletion, per-category
sharing, owner preview, strict service credentials/scope, Account restart, source
outage and a privacy change while a real upstream response is held. The browser
checks complete/zero/hidden/loading/unavailable counts, independent sessions,
follower approval/removal and restart at 390/768/1440 in both themes. Its
`profile-totals/qualification.json` records layouts/errors and screenshots.

Run all three OPA bundles separately and the Nginx gateway qualifier. Counts do
not introduce a new projection or migration. The discussion query currently caps
unique parent groups at 200 and fails unavailable above that bound. The fixture
uses local ingress identities and disposable stores; production credentials,
restore/rollback, load and soak remain separate qualification requirements.

## Public profile activity

Build Account Management, Editorial, Discussion Management/Materializer and the
Aggregator library/CSR in the installed Node 22.17.1 snapshot. Keep CSR fixed while
browsers run. The journey uses real canonical writes, independent publication
review, live Discussion generations and Account privacy/follower policy:

```sh
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true
WAPPS_PUBLIC_PROFILE_ACTIVITY=1 \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/profile-activity \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-suites.cjs --application-discussions --delivery --discussion-favorites
```

The fixture includes reviewed applications, verified-owner editing drafts, suites,
articles, releases, individual topics/replies/comments, reviews and all four saved
favorite types. It checks canonical publication attribution, direct publisher
supersession, private draft isolation, current deletion/moderation/parent withdrawal,
all relevant sharing switches, owner preview, internal credential/scope denial,
encrypted paging and Account restart. It drops a Discussion generation and rebuilds
from SQL/object authority, pauses delivery to prove lag fails unavailable, and holds
a real upstream response while changing the profile audience/sharing preference.
An empty page of hidden candidates must progress to older public sources without
exposing hidden identifiers. The browser checks chronological page contents and
routes, including a release version containing `+`, independent sessions, follower
approval/revocation, loading/hidden/empty/unavailable/retry and restart persistence.
Responsive captures cover 390/768/1440 pixels in both themes, followed by the
existing discussion-favorites regression.

Run identity-admin, Editorial and Discussion OPA bundles separately. Matching
ingress secrets and private service origins are required; the existing public
gateway denies internal prefixes. Account transport has an eight-second deadline.
No new migration or projection is introduced. DNS matching for this fixture is a
controlled adapter: approved-grant consumption is qualified here, while native DNS
proof has separate ownership evidence. Trusted local ingress identities and
controlled Editorial projection publication remain explicit substitutions.
The contract and deployment limitations are in `docs/MATERIALIZATION.md`; local
qualification does not close production restore/rollback, load/soak or erasure gates.

## Public profile discussion participation

Build Account Management, Discussion Management/Materializer, Editorial and the
Aggregator library/CSR in the installed Node 22.17.1 snapshot. Keep CSR fixed while
browsers run. The focused journey includes both application topics and article
comment threads, using real contribution writes and independently reviewed parents.

```sh
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true
WAPPS_PUBLIC_PROFILE_DISCUSSIONS=1 WAPPS_PUBLIC_PROFILE_SUITES=1 \
  WAPPS_PUBLIC_PROFILE_FAVORITES=1 \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/profile-discussions \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-suites.cjs --application-discussions --delivery --discussion-favorites
node tools/readiness/qualify-application-media-gateway.cjs
```

Account, Editorial and Discussion use the same isolated ingress secret. The
journey checks authored/participated roots, duplicate replies, removal of the last
contribution, root moderation, current parent withdrawal, owner/tenant isolation,
Show Discussions, private/follower audiences, historical approval receipts,
service credentials, strict queries, generation lag/loss/rebuild and API restart.
Real response proxies qualify privacy changes during Discussion I/O and removal
of participation while Editorial metadata is in flight. Ten-candidate paging
checks encrypted continuations across restart, cross-owner/tampering/key rotation
and a completely hidden page. Unit tests additionally cover cross-tenant tokens.

The collection browser checks eleven states at 390/768/1440 in both themes,
including continuation from an empty page. Separate article captures cover a
profile-linked thread outside the first comments page, invalid links, wrong-parent
links and an actual member reply/reload in the linked view. It also checks the
return-to-all-threads link, duplicate/empty query handling and application-topic
navigation. Evidence is written to `public-profile-discussions/qualification.json`
and `thread-links.json`. Suite and shared-favorite browser regressions run when
their flags are enabled, followed by discussion favorites. The common runner's
default page size stays twenty; discussion participation explicitly uses ten.

Run identity-admin and Discussion OPA bundles independently because their data
roots collide. No schema migration or new projection is added. Deploy both OPA
bundles, both APIs and the portal with matching ingress secrets and a private
Discussion origin. Production sessions/edge, coordinated deployment rotation,
restore/rollback, load/soak and cross-service erasure require separate evidence.

## Public profile suites

Build Account Management, Editorial, Discussion Management/Materializer and the
Aggregator library/CSR in the installed Node 22.17.1 snapshot. Keep CSR fixed while
browsers run. Enable the focused suite journey and the shared-favorites regression:

```sh
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true
WAPPS_PUBLIC_PROFILE_SUITES=1 WAPPS_PUBLIC_PROFILE_FAVORITES=1 \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/profile-suites \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-suites.cjs --application-discussions --delivery --discussion-favorites
node tools/readiness/qualify-application-media-gateway.cjs
```

The harness uses the same trusted ingress secret for its isolated Account and
Editorial processes. All suites are created/submitted/independently approved
through actual HTTP APIs. It checks owner filtering, private/pending/foreign
publication exclusion, twenty-item continuation, immutable public metadata,
withdrawal, projection lag/recovery, Show Suites, owner preview, private/follower
audiences, revocation/historical receipts, strict payloads, internal service
authentication and restart. A proxy delays real Editorial responses while profile
privacy changes; the final canonical check must discard the old result. A
controlled canonical tenant change qualifies scope isolation explicitly.

The shared collection browser runner checks independent sessions, real settings
toggles, suite-detail links, pagination, loading/unavailable/retry, hidden/empty,
follower approval/removal and restart. Each collection captures ten states at
390/768/1440 in both themes (60 layouts); discussion favorites also regresses.
See `public-profile-suites/qualification.json` and
`public-profile-favorites/qualification.json` under the output directory.
The separate Nginx test uses the complete checked-in gateway with fixture
authentication/upstreams and proves the public internal-route block.

Run identity-admin and Editorial OPA bundles separately: their data roots collide
if passed to a single `opa test` invocation. The workflow adds no projection or
migration. Provider sessions, production ingress/secret rotation, restore/rollback,
load, soak and cross-service erasure remain separate qualification gates.

## Public profile favorites

Build Account Management, Editorial, Discussion Management/Materializer and the
Aggregator library/CSR in the installed snapshot, with Node 22.17.1. Do not
rebuild CSR while qualification browsers are using it. This extends the existing
discussion-favorites journey with a separate profile owner, real reviewed suite
and article publication, and all four public content families.

```sh
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true
WAPPS_PUBLIC_PROFILE_FAVORITES=1 \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/profile-favorites \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-suites.cjs --application-discussions --delivery --discussion-favorites
```

The real SQL/OPA/HTTP checks cover both audience and sharing policy, owner preview,
independent follower approval/revocation, old receipts, narrow DTOs, canonical
links, immutable approved content, projection lag/recovery, withdrawal, public
parent visibility, visible-only paging, dependency failure and Account restart.
A local proxy delays actual Editorial responses while preferences or saved
relations change, proving that the final canonical stamp check rejects old data.
Hidden sharing must issue no content requests. The new read requires no migration
or projection and does not change the existing atomic favorites write protocol.

Focused browser evidence is in `public-profile-favorites/qualification.json`
under the selected output directory: ten states, 60 layouts at 390/768/1440 in
both themes. The existing discussion-favorites browser regression runs afterward.
Also run `qualify-identity-mysql.cjs --profile-browser` with a fresh
`WAPPS_PROFILE_BROWSER_OUTPUT` directory at this integration point. Provider/edge,
cross-service erasure and production operational gates remain unverified by these
local journeys. Screenshots contain only disposable qualification identities.

## Contact email and public profile audiences

The public-profile journey also qualifies explicit contact-email editing and
sharing. Run `ProfileContactEmail1791676830000` in both identity runtimes through
the normal migration entrypoint. SQL checks prove default-hidden contact,
post-policy privacy fencing, stable legacy command fingerprints, omission-preserves
semantics, historical replay, atomic rollback, competing edits, reconnect, strict
migration reentry, explicit removal and erasure with the account row. Existing
command hashes remain retained; they contain no plaintext address and cannot
bypass the deleted-account check.

The compiled API rejects invalid/header-bearing addresses and keeps credential
email separate. Contact reads require both the saved show-email switch and current
profile audience; the directory always omits addresses. Browser checks add invalid
input, lost-save exact retry, independent sessions, conflicting edits, enabled/
disabled sharing, approved-follower access and explicit removal. The focused
journey now captures 90 layouts across fifteen states in both themes and at
390/768/1440 widths. Use separate output folders to preserve earlier evidence.
Profile response validation loads lazily with explicit failure and session
cancellation; the broader `--profile-browser` run also covers this loading change.

These addresses are member-provided and unverified. The workflow does not send
email or assert mailbox ownership. Provider sessions, real edge controls, full
account export/cross-service erasure and production operational qualification
remain outside this local journey.

## Public profiles and approved followers

Build both identity services, `portals-shared-features-user-profile`,
`portals-shared-features-my-profile`, `aggregator-angular` and `aggregator-csr`
with Node 22.17.1 in the installed snapshot. Keep CSR fixed during browser runs.

```sh
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true
node tools/readiness/qualify-identity-mysql.cjs
WAPPS_PROFILE_BROWSER_OUTPUT=/tmp/wapps-readiness/public-profiles-portal \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-identity-mysql.cjs --public-profiles-browser
```

SQL checks cover canonical privacy snapshots, approval/removal, pair tombstones,
actor isolation, historical receipts, outbox rollback, concurrent writes, request
quota, migration reentry and atomic local erasure. The compiled API uses actual OPA
for anonymous/public/private/follower access, protected photos, staff denial,
invalid policy results and provider/session lifecycle fencing. The focused portal
checks independent and anonymous sessions, owner approval, lost request/removal
responses, conflict/reload, outgoing cancellation after privacy changes, object URL
revocation and API process restart. Nine states at 390/768/1440 in both themes
check alignment, overflow, theme text and button labels; inspect screenshots too.
The six additional contact-email states are described above.
The existing `--profile-browser` provides the separate broader profile/settings/
avatar regression. Neither command is the whole-service release gate.

Credential-to-ingress mapping and controlled failure injection are substituted.
Broker delivery and unrelated APIs remain unavailable; identity intent stays in
SQL. There is no public-profile projection. Deployed ingress/provider sessions,
remaining public content consumers, full export/erasure, restore/rollback/load and
soak remain separate required qualification.

## Private profile avatars

Build both identity services, `portals-shared-features-my-profile`,
`aggregator-angular` and `aggregator-csr` with Node 22.17.1 in the installed
snapshot. Do not rebuild CSR while qualification browsers consume it.

```sh
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true
node tools/readiness/qualify-identity-mysql.cjs
WAPPS_PROFILE_BROWSER_OUTPUT=/tmp/wapps-readiness/profile-avatars-portal \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-identity-mysql.cjs --profile-avatars-browser
```

The first command includes the avatar SQL migration/transaction checks along with
identity, profile, preferences and favorites regressions. The focused browser run
adds the actual compiled Account API, real OPA, independent sessions, normalized
photo reads, invalid/oversized input, foreign and suspended accounts, lost upload/
removal responses, exact retry, conflicts, session URL revocation, text-edit
protection and API restart/outage. Six photo states at 390/768/1440 in both themes
check alignment, card spacing, overflow and button-label clipping. Inspect the
screenshots too. `--profile-browser` includes this workflow and the broader existing
profile/preferences portal regression; neither flag means the full release gate.

The runner uses a disposable MySQL 8.4 container and local credential-to-ingress
mapping. Firebase, broker delivery and unrelated APIs are deliberately unavailable;
ordinary identity events remain in the SQL outbox. There is no image projection or
object-store dependency. Production ingress/provider/load/backup/restore/rollback
and public-profile audiences remain separate qualifications.

## Integrated email verification

Build `sdk-features-identity-applications-authenticator`,
`sdk-features-identity-applications-management`, `identity`, `aggregator-angular`
and `aggregator-csr` with Node 22.17.1 in the installed source snapshot. Keep the
CSR bundle fixed while browsers consume it. An existing localhost Firebase Auth
emulator and local MySQL 8.4/Nginx 1.28 Alpine images are required.

```sh
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true
WAPPS_CREDENTIAL_INTEGRATION=1 node --test tools/readiness/identity-credentials.test.cjs
WAPPS_EMAIL_VERIFICATION_OUTPUT=/tmp/wapps-readiness/email-verification-portal \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-identity-mysql.cjs --email-verification-browser
node tools/readiness/qualify-email-action-static.cjs
```

`IDENTITY_TEST_FIREBASE_PORT` defaults to 9099 and
`IDENTITY_TEST_FIREBASE_PROJECT` to `demo-wapps`. Qualification creates/deletes
only random emulator users and disposable MySQL; it never sends external mail.
The built authenticator validates actual sessions and canonical lifecycle; the
local gateway forwards those validated headers to the built account service and
real OPA. No fake session/profile authority is used. The queue is deliberately
unavailable; this does not qualify notification/event consumers. Other catalog
APIs are outside the browser run and return unavailable.

Checks cover registration, current status, request/inspection/explicit completion,
wrong/used code types, independent accounts, lost completion, old-token status,
restart, provider outage, suspension, unenrolled users, disabled/revoked sessions,
and invalid optional-ingress rejection. Ten states at three widths/both themes
check layout, color and code/referrer handling. The separate static check uses
both checked-in Nginx configurations and verifies no-store, no-referrer and
action-code log suppression. Read screenshots and failure logs as well as exit
codes. Real templates/inbox delivery, provider time-based expiry, deployed ingress
and rate limiting, load/restore/rollback remain unverified.

## Discussion preview qualification

Build shared Discussion, aggregator Angular and CSR with Node 22.17.1 in the
installed snapshot; reuse the qualified Editorial/Discussion/materializer builds.

```sh
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true
WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/discussion-previews-portal \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-suites.cjs --application-discussions --delivery --discussion-previews
```

This retains the twelve existing application-topic service/recovery groups and
adds independent public/member browser checks for overview/related previews.
Actual topic/pin/reply commands provide canonical ordering, names and counts.
Keyboard links, current-thread exclusion, isolated unfinished composer text,
outage/reload, edit propagation, stopped materializer, restart, projection loss/
rebuild, deletion and parent withdrawal/republish are exercised. Eight states at
390/768/1440 in both themes check layout and shared related-section spacing.
Inspect screenshots as well as assertions. The existing read contract supplies
previews; there is no extra projection or migration. Shell accounts, ingress and
catalog projection advancement are fixtures. Production identity/deployment,
retention/erasure, restore/rollback, load and soak remain separate. Never rebuild
CSR while the browser consumes it.

## Member review qualification

Build Review core, Discussion management, Editorial, the shared Review feature,
aggregator packages and `aggregator-csr` with Node 22.17.1 in the installed source
snapshot. Apply the review migration through the explicit Discussion maintenance
path; the harness performs that step for its disposable stores. Run:

```sh
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true
WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/member-reviews-portal \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-suites.cjs --application-discussions --delivery --member-reviews
```

Five review groups exercise strict author-slot/rating/body contracts, tenant and
member/staff isolation, concurrent exact receipts, helpful marks, version-bound
reports and immutable evidence, hide/edit/withdraw/restore/republish, transactional
journal rollback, restart with the materializer stopped, missing authority,
keyset/summary agreement and populated migration reentry/down refusal. The parent
Discussion journey also covers outbox/materializer recovery, parent lifecycle,
schema upgrades and unavailable policy. Reviews themselves use canonical SQL
without a projection; retained journal intent has no feed/notification consumer.

Independent browsers qualify author/member/staff/anonymous behavior, conflicts,
unfinished text, identical uncertain retries, API restart, moderation, account
changes, withdrawal, keyboard navigation and overview summary outage/recovery.
Sixteen states are checked at 390/768/1440 in light/dark themes. Inspect saved
screenshots as well as assertions. Do not rebuild CSR while the browser runs.
Trusted ingress identities, shell account data and catalog projection advancement
remain fixtures. Production provisioning, integrated identity, service-wide
erasure/retention, database restore/rollback, load and soak remain separate.

## Discussion pinning qualification

Build Editorial, Discussion management/materializer, shared Discussion and the
aggregator Angular/CSR targets in the Node 22.17.1 installed snapshot. Run:

```sh
WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/discussion-pins-portal \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-suites.cjs --application-discussions --article-comments --delivery --my-discussions --discussion-pins
```

This uses actual SQL, OPA, compiled APIs and the Discussion broker/materializer
for concurrent replay, competing moderators, member/tenant/reply/scope denial,
atomic outbox rollback, historical receipts, restart, projection loss/rebuild,
withdrawal/deletion and populated schema qualification. Thirteen topics with
twelve pins exercise bounded pages crossing pinned/unpinned groups. Migration
reentry rejects lost history, missing constraints, wrong index direction and
destructive rollback. Existing topics, My Discussions, votes and article-comment
regressions run alongside the new workflow. Add `--discussion-regression` for
the generic Discussion legacy/backfill/recovery suite; its harness includes all
current migrations.

Independent browser sessions cover moderator controls, public/member reading,
uncertain retry, conflicts, list ordering, modal/keyboard changes, composer
preservation, restart, projection lag, outage and account/role changes. Changed
states run at 390/768/1440 in both themes with modal bounds/overflow/control
access checks. Shell account data, ingress identities and catalog projection
advancement remain fixtures. Do not rebuild CSR while the journey consumes it.
Production identity/ingress, deployment, database restore/rollback and load/soak
remain separate. Pin state is canonical SQL metadata read at the exact content
generation revision, without an additional projection.

## Discussion voting qualification

Build Editorial, Discussion management/materializer, shared Discussion and
aggregator Angular/CSR with Node 22.17.1 in the installed source snapshot. Run:

```sh
WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/discussion-votes-portal \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-suites.cjs --application-discussions --article-comments --delivery --my-discussions --discussion-votes
```

This selects real-service voting checks and its independent-browser journey.
Canonical counts/own choices, concurrent exact replay, competing revisions,
case-sensitive actor membership, switching/removal, historical receipt replay,
outbox rollback, current parent visibility, restart and projection loss/rebuild
use compiled APIs, SQL and the actual Discussion worker. Populated migration
reentry rejects missing history, reversed primary-key order, absent value checks
and destructive rollback. Existing application-topic, My Discussions and article
comment regressions run in the same disposable topology.

Browsers cover anonymous controls, uncertain response/retry, conflict, reply
votes, quick-modal removal/keyboard voting, list refresh, projection lag,
dependency outage, account switching/signout and withdrawal/deletion. Twelve
states run at 390/768/1440 in both themes; modal bounds/overflow/control access
are checked too. Voting preserves unfinished composer text. Shell account data,
trusted ingress identities and catalog projection advancement are controlled
fixtures. Do not rebuild CSR while browsers consume its output. Production
identity/ingress, deployed migrations/connectivity, database restore/rollback and
load/soak remain unverified. Votes use authoritative SQL snapshots at the exact
thread revision, not an additional projection; see `docs/MATERIALIZATION.md`.

## Discussion favorites qualification

Build Editorial, Discussion management/materializer, Account Management, shared
Discussion/favorites and aggregator Angular/CSR targets with Node 22.17.1 in the
installed snapshot. The favorites project is
`portals-shared-features-my-favorites`. Run:

```sh
WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/discussion-favorites-portal \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-suites.cjs --application-discussions --article-comments --delivery --my-discussions --discussion-favorites
```

This flag selects the favorite browser journey. It adds compiled Account
Management with real SQL/OPA to existing Discussion and article-comment recovery
checks. Canonical topic selection rejects injected scope and omits replies,
article/generic bindings and other tenants. Account additions, exact replay,
conflicts, restart, projection lag, target-service outage, withdrawal and deletion
use real APIs. Removal and completed receipt replay work without target services.

Independent browsers exercise list/detail/quick-dialog controls, keyboard save,
identical uncertain retries, stale-session conflicts, canonical links, updated
titles, account switching and signout. Pending or unavailable metadata clears
links while references remain removable. Changed states are checked at
390/768/1440 in both themes. The modal additionally checks bounds, overflow and
favorite-button scroll access. Account records are real; shell profile/preferences,
trusted ingress tokens and catalog projection advancement are controlled fixtures.
Account broker/Firebase are deliberately unavailable. Discussion uses its real
broker/materializer. Do not rebuild CSR during the journey. Production
identity/ingress, deployment, database restore/rollback, load and soak remain open.

Account Management requires `DISCUSSION_URL` even in unrelated profile/favorite
journeys; their unavailable fixture origin is deliberate. The local gateway check
includes `/api/discussion-selection` dispatch. Render the base and development
Account Kustomizations to verify their respective Discussion namespaces before
deployment; a rendered manifest is not a deployed connectivity test.

## Quick discussion qualification

Build Editorial, Discussion management/materializer, the shared Discussion
feature and aggregator Angular/CSR targets in the Node 22.17.1 installed snapshot.
Run the real-service modal journey with:

```sh
WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/quick-discussion-portal \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-suites.cjs --application-discussions --article-comments --delivery --my-discussions --quick-discussion-browser
```

The quick-dialog flag selects its browser journey instead of the topic or My
Discussions journey. It covers anonymous/member reads, independent editing
conflicts, exact reply retry after closing/reopening, projection lag, restart,
account changes/signout, moderation, My Discussions refresh, full-thread
navigation, outages, withdrawal and root removal. Modal geometry, scroll access,
distinct form IDs and theme borders are checked at three widths in both themes;
keyboard focus containment is checked in the member dialog. Disabled fields
remain deliberately disabled while an uncertain command awaits retry.

The existing application-topic, article-comment and My Discussions real-service
regressions run alongside this journey. Rebuild assertions wait for every
expected topic's exact generation before comparing an account page. Trusted
ingress identities, shell account data and catalog projection advancement are
controlled fixtures. Do not rebuild CSR while browsers consume it. Production
identity/ingress, deployment, restore/rollback, load and soak remain separate.

## My Discussions qualification

After building Discussion management, the shared Discussion feature and the
aggregator Angular/CSR targets in the Node 22.17.1 installed snapshot, run:

```sh
WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/my-discussions-portal \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-suites.cjs --application-discussions --article-comments --delivery --my-discussions --my-discussions-browser
```

The existing Editorial and Discussion materializer builds are prerequisites.
This extends application-discussion qualification with private self-read policy,
canonical participant deduplication, tenant/case isolation, last-contribution
and root deletion, bounded filtered pages, projection lag/loss/rebuild, API
restart and explicit participation-index upgrade/reentry/corruption checks.
Binding isolation checks temporarily change target-kind metadata in controlled
SQL; ordinary topics, replies, edits, removals, publication and withdrawal use
the compiled APIs. `--article-comments` also qualifies the new migration with
the existing article-comment workflow.

`--my-discussions-browser` selects the My Discussions journey instead of the
application-topic browser journey. Independent sessions use real account-owned
topics, resolve current catalog links, traverse pages, switch accounts, remove
participation and recover from pending projections, outages and withdrawal.
Ten UI states are checked at three widths in both themes. The underlying
application-topic write UI retains its separately qualified journey. Trusted
ingress identities, shell account data and catalog projection advancement remain
controlled fixtures. Do not rebuild CSR while the browser runs; production
identity, deployment and database restore/rollback/load/soak remain separate.

## Application discussion qualification

Build Editorial, Discussion management/materializer, the shared Discussion
feature and aggregator packages/CSR with Node 22.17.1 in the installed snapshot.
Run:

```sh
WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/application-discussions-portal \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-suites.cjs --application-discussions --delivery --topic-browser
```

This uses disposable SQL, Mongo, MinIO, RabbitMQ and actual OPA/compiled APIs.
The journey publishes a real independently reviewed application, creates member
topics/replies, checks root/reply schemas and author/admin/tenant isolation,
replays concurrent commands, forces outbox rollback, restarts APIs and rebuilds
after projection loss through the actual broker worker. It also checks canonical
withdrawal/suspension/deletion, migration reentry/explicit upgrade and policy
outage. Suspension is a controlled SQL lifecycle fixture; ordinary publication
and withdrawal use the actual Editorial API.

The browser flow covers anonymous reading, independent members, title/tag edits,
conflicts, exact uncertain retry across list/detail navigation, session changes,
moderation, removed replies, bounded pages and outage/restart/withdrawal recovery.
Changed states are checked at 390/768/1440 in both themes. Omit `--topic-browser`
for backend only. Add `--article-comments --discussion-regression` to run the
shared article/generic Discussion regressions in the same disposable topology;
use a separate output directory if also requesting the article browser journey.
Do not rebuild CSR while browsers read its output. Catalog projections are
advanced explicitly; Discussion generations use the actual worker. Shell account
data and trusted ingress tokens are fixtures. Production identity/ingress,
restore/rollback, load/soak and deployment qualification remain separate.

## Article comment qualification

Build Editorial, Discussion management/materializer, the article feature and the
Aggregator packages/CSR with Node 22.17.1 in the installed source snapshot. Run:

```sh
WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/article-comments-portal \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-suites.cjs --article-comments --delivery --comment-browser --discussion-regression
```

This provisions disposable MySQL 8.4, Mongo 7, pinned MinIO, RabbitMQ 4 and real
Editorial/Discussion OPA servers. Compiled APIs and the actual Discussion worker
exercise concurrent receipt replay, restart, rollback, parent visibility without
article projections, tenant/owner/raw-route isolation, pagination, moderation,
projection loss/rebuild, migration reentry and policy outage. The additional
generic-discussion recovery regression shares these disposable stores under its
own database/queue names. Omit `--discussion-regression` to exclude that regression;
`--delivery` is required for comments. Omit `--comment-browser` for backend only.

The compiled portal journey covers independent ordinary members, anonymous
readers and moderation; conflicting edits, exact retry across navigation, account
switching, projection lag, restart/outage, bounded pages and withdrawn/republished
parents. Changed states are checked at 390/768/1440 in both themes. Do not rebuild
CSR while browsers read it. Shell profile/preferences and trusted ingress tokens
are fixtures. Article projection advancement is controlled; comment generations
use the actual broker worker. Production identity/ingress, database restore/
rollback, load and soak remain separate. Local gateway dispatch/header/body-limit
checks use `node tools/readiness/qualify-application-media-gateway.cjs`.

## Release publication qualification

After a clean Node 22.17.1 installation and an Editorial build, run:

```sh
WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/release-publication-backend \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-suites.cjs --releases --delivery
```

This starts disposable MySQL 8.4, Mongo 7 and RabbitMQ 4 plus real OPA and the
compiled Editorial API. It tests grant-bound private drafts, immutable independent
review, receipt/outbox rollback, canonical version uniqueness, competing edits,
explicit rebase, grant revocation/transfer, private deletion, public withdrawal,
parent visibility, bounded capacity, schema reentry and two API restarts. Broker
checks include publisher confirmation, redelivery after lost acknowledgement,
SQL reconciliation after projection loss and old events after withdrawal.
Omit `--delivery` to exclude actual broker qualification.

After building `aggregator-angular` and `aggregator-csr`, add `--release-browser`
to qualify the compiled API portal in independent owner, reviewer, wrong-account
and anonymous browser sessions. It covers exact retry keys across navigation,
private persistence, immutable submitted notes, rejection/approval, conflict
preservation, explicit canonical merge, private deletion, withdrawal, projection
lag, API restart, channel filters and previous-release pagination. Changed screens
are measured at 390/768/1440 widths in both themes. Do not rebuild the CSR output
while this browser qualification is running. Release write recovery is in memory
across client navigation; full reload does not retain its pending intent.

`node tools/readiness/qualify-application-media-gateway.cjs` also checks release
route dispatch and trusted-header replacement through real Nginx with fixture
authentication/upstreams, alongside the existing media/account/catalog checks.

Trusted ingress identities and successful DNS proof are supplied by the harness;
parent suspension/withdrawal is seeded explicitly. Portal qualification requires
the browser option; public DNS, production identity/ingress, database
restart/restore/rollback, load and soak remain unqualified. Containers/processes are removed
on success/failure. Preserve output and its matching source manifest independently
of previously accepted media/application/suite evidence.

## Private application media qualification

After a clean Node 22.17.1 installation and an Editorial build, run:

```sh
WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/application-media-http \
  OPA_BINARY=/path/to/verified/opa \
  node tools/readiness/qualify-suites.cjs --application-media --media-http
```

The harness uses disposable MySQL 8.4, MinIO
`RELEASE.2025-04-22T22-12-26Z`, local OPA and the compiled Editorial API. It also
provisions the suite harness's Mongo dependency. Qualification checks reservation
and receipt races, owner/tenant isolation, lease takeover, retry/capacity bounds,
immutable-object corruption, SQL rollback after PUT, migration reentry/startup
refusal, bounded binary requests, private previews, aborted-body recovery and API
restart. It supplies trusted identities; it does not qualify production ingress,
public-media association, portal controls, cleanup, database restore/rollback or
load/soak. Omit `--media-http` for only the SQL/object/application-boundary checks.
The existing legacy media-ingestion worker is not exercised by this upload suite.

Use `--media-publication` in place of `--media-http` to also qualify draft image
attachment/removal, immutable submission media, independent reviewer previews,
atomic public references and current-authority public reads. It checks competing
draft revisions, exact retry, missing public-origin configuration, outbox/reference/
receipt rollback, API restart, withdrawal, replacement, inherited references,
revocation, explicit image rebase, private deletion and migration legacy/reentry
behavior. Ownership grants and direct lifecycle/URL changes in these media checks
are controlled SQL fixtures; run `--application-ownership --ownership-http` for
the real claims/DNS/review regression. Neither proves cleanup or media portal UI.

Add `--media-retention` to the publication run to exercise cancellation and
durable cleanup against the same disposable SQL/MinIO/OPA services:

```sh
WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/application-media-retention \
  node tools/readiness/qualify-suites.cjs --application-media --media-publication --media-retention
```

This covers retained-upload recovery lists, atomic cancellation/receipt rollback,
attach/cancel and attach/automatic-retirement races, expiry and reference retention,
fenced leases, object-success/SQL-receipt loss, bounded failure/requeue, strict
compiled HTTP routes, API restart and opt-in background/maintenance execution.
Real MinIO checks exercise conditional marker writes against concurrent uploads
and reject enabled/suspended bucket versioning. Bucket configuration must remain
operator-controlled and markers must never expire. The harness injects failed-job
state only for compiled CLI reporting/requeue; adapter checks exhaust all eight
attempts. It does not qualify portal media controls, deployment provisioning,
account erasure, restore/rollback or load/soak.

For the media portal, first complete `aggregator-csr:build` and the separate
`aggregator-angular:build` dependency chain. Inspect emitted Angular packages,
then run against the stable CSR output:

```sh
WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/application-media-portal \
  node tools/readiness/qualify-suites.cjs --application-media --media-browser
```

This adds independent-browser upload, digest-verified preview, attach/remove,
unused cancellation, same-key reload recovery, wrong-file refusal, unsaved-text
preservation, stale revision conflicts, account changes, no-file cancellation and
deleted-draft recovery. It exercises immutable review/public media, API restart,
withdrawal during projection lag, per-slot rebase and unknown legacy resubmission.
Changed states are captured at 390/768/1440 in both themes. Shell accounts and
trusted ingress are fixtures; grants and an unknown legacy snapshot are supplied
through SQL. Existing `--application-publication` and `--application-ownership
--ownership-browser` runs separately cover shared draft/publication behavior and
actual controlled-DNS ownership issuance. The media browser run focuses on media
and does not repeat their generic draft checks. Retention/deployment/restore/load
qualification remains separate. Do not rebuild a CSR directory while browsers
are reading it. Use a new output directory for each accepted evidence checkpoint.

Run `node tools/readiness/qualify-application-media-gateway.cjs` for exact local
nginx syntax and media routing, header replacement/stripping and 8 MiB body-limit
qualification. It uses a disposable nginx container with fixture auth/upstreams,
not production identity or a deployed ingress. The existing
`--application-publication` browser run requires a freshly built portal after
the draft/submission DTO changes; its layouts qualify compatibility, not media
upload/review controls.

## Workspace commands

Use the Node version in `.nvmrc`, install with `npm ci`, then run:

```sh
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true
npm run check:boundaries
npm run check:inventory
npm run lint
npm test
npx nx run-many -t build --all --skip-nx-cache --parallel=3
node tools/readiness/check-angular-packages.mjs --all
npx nx run-many -t typecheck --all --skip-nx-cache --parallel=3
```

`check:boundaries` verifies responsibility tags/project edges and the source
import audit. ESLint also rejects dependency cycles, invalid imports and the
framework/storage/broker dependencies forbidden to kernel/domain code. These
checks complement code review; they do not prove domain behavior or authorization.

`check:inventory` assigns every source spec to its closest Nx project. It rejects
unowned tests, missing targets, empty-target success and stale coverage gaps.
`test` executes each inventoried project with cache disabled, validates the Jest
JSON result against the complete file inventory, then runs portable tool tests.
It fails on missing suites, skipped/todo tests or empty passes. Root npm scripts
are excluded from Nx script inference to prevent recursive `wapps:test` execution.

The product lint gate selects one lint target per project: explicit `lint`, or
the inferred `eslint:lint` where necessary. It also checks this directory. It
excludes the root orchestration project and user-owned `wapps-recordings` tools;
it does not exclude product code based on previous failures.

Reports go into a fresh directory under the OS temporary directory. Set
`WAPPS_CHECK_OUTPUT_DIR` to retain uniquely named report directories elsewhere.
Each contains per-project logs and a summary; test runs also retain raw Jest
results and the inventory. A successful unit gate still reports uncovered
projects and unrun integration qualification explicitly.

## External qualification

`workspace-checks.mjs` names the suites requiring isolated SQL/Mongo/RabbitMQ,
object storage, Firebase Auth emulator or the OPA binary. They are not portable
unit checks. Use `qualify-materialization.cjs`, `qualify-identity-mysql.cjs` and
the documented environment-specific commands in the readiness evidence. Never
point qualification tools at production stores. Fixture browser checks likewise
do not establish real service integration, durable user journeys or email delivery.

Build `apps.services.editorial` and `apps.services.catalog-bff` before running
`qualify-materialization.cjs`: it also runs `catalog-journey.test.cjs` against those
actual HTTP processes. The catalog test controls projection publication and
substitutes fixture policy approval; the existing recovery suites separately
exercise broker delivery. It verifies service restart and Mongo loss/rebuild, not
database restart or backup restoration. `TZ=Pacific/Honolulu`
additionally checks the explicit UTC timestamp contract. Temporary Mongo storage
is 512 MiB, with bounded socket probes and retained startup diagnostics.

The catalog journey also qualifies bounded canonical-ID selections through
`GET /api/catalog/app-selection`: strict input at both HTTP boundaries, ordered
visible subsets, private/suspended/deleted omission, projection lag, slug rename
and reuse, process restart, projection loss/rebuild and upstream outage. A
production use-case invocation with real SQL/Mongo injects a deletion between
projection reading and the final authority check; the response must fail.
Those default assertions qualify target resolution. Add `--favorites` and set
`OPA_BINARY` to run the compiled account API alongside Editorial/BFF and real OPA,
using an additional disposable identity database. Build both identity services
and their dependencies first. The journey covers account isolation, revision
conflicts, target rename/delete/lag, lost-receipt replay, outage-safe removal,
policy denial/outage and account-process restart. Ingress claims and catalog
fixture policy are substituted; projection publication is controlled. Account
broker/Firebase point at unavailable loopback endpoints. This does not qualify
portal favorites, other target families or collections.

Add `--favorites-browser` instead to include the compiled API portal and a local
account/catalog gateway. It implies `--favorites`; `--catalog-browser` can be
combined for the existing catalog regression. `WAPPS_FAVORITES_BROWSER_OUTPUT`
chooses the evidence directory (default `/tmp/wapps-readiness/favorites-browser`).
Thirty favorites layouts cover saved/empty/account-error/metadata-error/deleted
target states in both themes at 390/768/1440 pixels. Screenshots wait for finite
animations. Functional checks include canonical UUID toggles, distinct favorite
routes, independent sessions, restart persistence, profile conflicts, lost-receipt
retry, rename/delete/lag and metadata-outage removal. External browser traffic is
blocked; account/profile/preferences/catalog responses come from real services.
Trusted ingress claims and catalog fixture publication remain explicit substitutions.

`qualify-identity-mysql.cjs` also tests canonical favorites using real SQL:
transaction rollback, competing commands, case isolation, replay after removal,
profile revision conflicts, reconnect, migration validation, account deletion
and two writers competing for the 200th relation. No existing data is targeted.

Editorial recovery explicitly locks pending outbox rows while two pollers attempt
claims. Both must return idle without changing pending work. After lock release,
concurrent pollers must progress; an idle poll may retry once after the competing
transaction finishes, then the two live leases must be distinct. The test also
checks lease fencing and terminal-failure/requeue behavior. It does not assume
every simultaneous `SKIP LOCKED` poll returns work or qualify contention throughput.

Build `aggregator-csr` in its default API mode, then add `--catalog-browser` to
`qualify-materialization.cjs` to run Chromium through the compiled portal, BFF and
Editorial against those disposable stores. A loopback static server proxies the
catalog contract without response mocks. Other account endpoints return an
explicit unavailable response; this does not qualify identity or the deployed
gateway. The journey covers application redirects, category/tag directories,
search, filters, pagination/reload, details, projection lag/loss/rebuild, service
restart and deletion. It also verifies home preview detail/group/full-search links,
bounded preview counts, real totals, success/empty/error states and materialization
failures. It checks seven screen/state combinations at 390/768/1440 pixels in both themes,
captures screenshots and records alignment, overflow and clipping measurements in
`/tmp/wapps-readiness/catalog-browser`. Set `WAPPS_CATALOG_BROWSER_OUTPUT` to retain
each qualification in a separate evidence directory. External images/network
requests are blocked.

Catalog demo data is selected with `aggregator-csr:build:production,demo` or
`aggregator-csr:serve:demo`. An empty environment name selects same-origin API
routes; it no longer selects demo data. The alpha Dockerfile explicitly adds the
demo configuration. Fixture tests select demo providers themselves. Home search
previews use the real catalog in API mode; activity is unavailable until its service
exists. The feed and other unfinished features still need integration; selecting API
catalog mode is not a declaration that the whole portal is operational.

The complete operational criteria remain in `docs/OPERATIONAL-READINESS.md`.
Missing feature tests, warning debt, dependency-audit findings, image immutability,
live worker/process recovery, restore and browser-to-service acceptance cannot
be closed by this gate.

For private suites and suite publication, build `domains-publication-suite`,
`apps.services.editorial`, `portals-shared-features-suite`, `aggregator-angular`
and `aggregator-csr` in API mode. Run the focused external qualification with
locally available `mysql:8.4` and `mongo:7` images and a verified OPA binary:

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true \
  OPA_BINARY=/path/to/verified/opa node tools/readiness/qualify-suites.cjs
```

`--no-browser` runs the real SQL/OPA/compiled-HTTP checks only. Add `--delivery`
with a locally available `rabbitmq:4-management` image to qualify confirmed
publication, acknowledgement-loss redelivery, duplicates, projection-loss rebuild
and out-of-order withdrawal. It can be combined with `--no-browser`. The full command
adds create/list/reopen/edit/delete, independent browsers, account isolation,
conflicts, lost-response retry, process restart, keyboard access and responsive
light/dark layout checks. `WAPPS_SUITES_OUTPUT` selects the evidence directory
(default `/tmp/wapps-readiness/suites`). The runner creates and removes its own
containers and uses no existing database volumes. Failures remain failures.
The portal's suite/catalog responses are real; shell profile/preferences and
ingress identity mapping are explicit fixtures. Catalog projection publication
is controlled for browser lag checks. The browser also exercises owner submission,
reviewer approval/rejection, independent public reading and withdrawal. This does
not qualify deployed sessions, database restart, backup restoration or rollback.
Private suite reads need no
materializer because they query the canonical SQL aggregate directly.

Add `--favorites` to qualify canonical suite favorites, also building
`sdk-features-identity-applications-management` and
`portals-shared-features-my-favorites`. This adds real Account Management/OPA,
application/suite eligibility, immutable approved metadata, withdrawal/deletion,
rollback/retry/conflict and account restart checks. Unless `--no-browser` is used,
it exercises public favorite controls and filtered/grouped routes in independent
browsers, with light/dark mobile/tablet/desktop measurements. The favorite browser
uses actual account/catalog APIs and stores evidence under `favorites-browser/`;
trusted ingress identities and projection timing remain controlled. Account
Firebase/broker dependencies are intentionally unavailable; this check does not
qualify those providers or replace the separate materialization delivery checks.

For canonical application drafts, build `catalog-record`,
`portals-shared-features-application-workspace`, `apps.services.editorial`,
`aggregator-angular` and `aggregator-csr` in API mode, then run:

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true \
  OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/application-drafts \
  node tools/readiness/qualify-suites.cjs --application-drafts
```

This selects the draft workflow only, reusing the disposable service setup.
`--no-browser` omits Chromium. The check exercises real SQL/OPA and compiled
Editorial for ownership/tenant/case isolation, concurrent retries/revisions/slugs,
100-draft capacity, atomic rollback, scrubbed deletion/replay, migration reentry,
corruption refusal, process restart and policy outage. It asserts that private
drafts create no public record or projection intent. The compiled browser journey
covers forms, independent sessions, a lost committed response, same-route revision
reload, conflicts, deletion, restart, unavailable states and account switching.
Both themes at 390/768/1440 are checked for overflow, column alignment, 24px page
gap, 16px card-content gap and 8px heading-description gap. Shell account responses
and trusted ingress identity mapping are fixtures. Publication, ownership
verification, deployed sessions, database restart and restore/rollback are not
qualified by this command.

For application submission/review/publication, build the same targets plus
`apps.services.catalog-bff`, then run:

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true \
  OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/application-publication \
  node tools/readiness/qualify-suites.cjs --application-publication --delivery
```

This runs the draft browser regression and adds independent owner/reviewer/public
browser sessions. It checks immutable submissions, review authorization and
tenant isolation, concurrent reviewers, exact response-loss retry, private edits,
rejection, withdrawal/deletion during projection lag and API restart. SQL outbox
failure must roll back the complete decision. Migration reentry rejects malformed
receipts, invalid revisions and missing/self reviewers. Public slug collisions
leave submissions pending; direct Editorial changes invalidate stale approval.
The 2,048-character website survives canonical storage and public projection.

`--delivery` adds real RabbitMQ confirms, acknowledgement-loss redelivery,
duplicates, SQL reconciliation after projection loss and old events after
withdrawal. Without it those broker checks remain unrun. Browser projection
timing remains controlled for visibility-lag checks. Layout assertions use both
themes at 390/768/1440, including page/card/description gaps and overflow. Trusted
ingress identities and unrelated shell account responses are fixtures. Claims,
ownership verification, media, production identity/ingress, database restart,
backup restore and deployment rollback are outside this focused qualification.

Ownership's domain/application/write path has a separate prerequisite check:

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true \
  OPA_BINARY=/path/to/verified/opa \
  WAPPS_SUITES_OUTPUT=/tmp/wapps-readiness/application-ownership \
  node tools/readiness/qualify-suites.cjs --application-ownership
```

It uses real MySQL/Mongo/OPA and Node's DNS resolver against a controlled local
UDP TXT server. It exercises canonical claims, independent reviewer permissions,
immutability/replay, atomic grant/decision/receipt/outbox changes, ownership
transfer, competing claims, release/revocation, interrupted verification leases,
persistent retry limits and migration corruption refusal. It also covers
grant-bound editing of existing applications, former-author private cleanup,
revocation, explicit conflict merging, frozen publication, competing approvals
and atomic rollback. Ownership/editing migrations run in normal API startup and
maintenance as well as this qualification branch.

Build `catalog-record`, `catalog-ownership` and `apps.services.editorial`, then add
`--ownership-http` to the command to exercise the compiled API against the same
real stores/policy and controlled DNS server. This adds private owner/reviewer
routes, HTTP denial/conflict/rate-limit/error mapping, idempotency, canonical
editing and two process restarts. `EDITORIAL_OWNERSHIP_DNS_SERVERS` configures the
test resolver through ordinary service composition (1-4 comma-separated IP
addresses with optional ports); production defaults to system DNS. The test
substitutes trusted ingress identities and does not alter public DNS records.
After building `aggregator-angular` and `aggregator-csr`, add
`--ownership-browser` to include the compiled HTTP checks and independent Chromium
sessions. The browser workflow covers claims, negative/positive DNS proof,
independent review/rejection, the active-grants list, release/revocation and
verified-owner editing. It exercises uncertain retries across navigation,
canonical revision conflicts, explicit merging, immutable content publication,
projection lag/recovery, obsolete grants, private cleanup, API restarts and
account-switch isolation. It also reruns the private-draft browser regression.

Changed screens are checked at 390/768/1440 in both themes, including alignment,
spacing, overflow, themed inputs, single-row section navigation and keyboard
controls. Shell account/profile/preferences and trusted ingress claims are
fixtures; projection publication is controlled and the broker is unavailable.
The separate application `--delivery` qualification covers actual broker
recovery. Public authoritative DNS, deployed identity/ingress, database
restart/restore/rollback, load and soak remain separate checks. Keep independent
SQL connections and API restarts distinct from database restart qualification.

For private profile qualification, build `aggregator-csr` in API mode and
`sdk-features-identity-applications-management`, then run:

```sh
OPA_BINARY=/path/to/verified/opa node tools/readiness/qualify-identity-mysql.cjs --profile-browser
```

The optional profile journey starts the compiled account service and a real OPA
process against the disposable MySQL instance. The broker and Firebase emulator
are deliberately unavailable on loopback; no external credential operations or
existing data volumes are used. It checks self-access, optimistic concurrency,
idempotent retries, atomic outbox rollback, restart persistence, independent
sessions, account switching and policy outage. The portal's profile responses are
proxied from the real account API; ingress credential identity is substituted.
Seven screens/states (settings, profile, unregistered, privacy, conflict,
unavailable, signed-out) are checked at 390/768/1440 pixels in both themes.
The journey also verifies keyboard save and the saved-preferences export's declared scope.
Screenshot/layout
output defaults to `/tmp/wapps-readiness/private-profile-browser`; override
`WAPPS_PROFILE_BROWSER_OUTPUT` to keep each run separately. This does not qualify
real sign-in, deployed ingress, public privacy, media uploads, backup or rollback.

The identity runner also includes canonical account-preferences SQL qualification:
outbox and deletion rollback, duplicate/concurrent commands, shared profile
revision conflicts, independent connections, reconnect, stored-data validation
and lifecycle restrictions. With `--profile-browser`, it additionally exercises
the built preferences API with real OPA, independent accounts, two process restarts
and policy outage. `account-preferences-browser.cjs` extends the 42 profile
regressions with 72 account/conflict/unavailable/guest settings states at the same
widths/themes. It exercises independent browsers, shared profile revision conflicts,
keyboard retry after a deliberately lost committed receipt, guest/demo separation,
saved-preferences export and portal restoration after process restart. The push
control remains disabled. Local ingress mapping, blocked external requests and
unavailable unrelated APIs are explicit substitutions. Do not interpret durable
settings as completed notification delivery or public-privacy enforcement.
