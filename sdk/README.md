# Backend SDK

The SDK groups reusable backend capabilities by responsibility:

- `features/identity`: identity model, authentication and account-management libraries, applications, and Firebase/OPA integrations.
- `features/discussion`: reusable discussion core, key-based management library, and materializer.
- `features/review`: reusable review core, key-based management library and generic HTTP adapter; consumers supply authority and canonical repositories.
- `apps/services/community` (outside the SDK): the Wapps consumer application, including application topics, article comments, reviews, profile and notification composition.
- `libs/usecases/account` (outside the SDK): Wapps profile composition, favorites, notifications, provider rosters and service-access policies; public alias `@wapps/account`.
- `libs/adapters/account-mysql` (outside the SDK): Wapps canonical account persistence and migrations; public alias `@wapps/account-mysql`.
- `kernel`: common result/types, primitives, event envelopes, and foundational domain models.
- `platform/queue`: transport-independent queue interfaces.
- `extras`: database, object-storage, and RabbitMQ implementations.

Applications own dependency injection and provisioning. Feature code depends on platform interfaces; application bootstrap supplies concrete adapters. Legacy `@foundation`, `@domains`, and `@infrastructure` aliases remain available during migration. The older `platform-queue` convenience API is retained for media ingestion, the editor, and the scraper.

## Discussion consumer keys

Discussion stores and compares an opaque `bindingKey`; it has no application/article
type registry or consumer key-version rules. Wapps owns its keys and public payload
contracts in `libs/domains/community` and supplies authorization, visibility and
payload adapters from `apps/services/community`. The public implementation entrypoint
is `@sdk/features/discussion/libs/management`. Another consumer can supply any valid
key and payload without editing the SDK. Aggregate revisions and projection schema
metadata are internal storage guarantees, independent of the consumer key.

The Wapps runtime keeps its existing Nx target and deployment service name for
compatibility. Its source moved out of the reusable SDK. Read the
[consumer application migration notes](../apps/services/community/README.md) before
upgrading existing data; this change needs a fenced forward migration and projection
rebuild, with historical command identities preserved by the Wapps adapter.

## Review and account consumers

Review management and HTTP accept an opaque `bindingKey`. Public entrypoints are
`@sdk/features/review/libs/management` and `@sdk/features/review/http`. Wapps BFF maps
its application-specific routes to `/api/reviews`, constructing keys and adapting
responses through `libs/domains/community`. Consumer authority and repository
adapters in Community retain the canonical SQL scopes and historical command
fingerprints. The generic packages do not interpret target kinds or role names.

Identity management provides generic saved-association/watch and notification
engines, and export/erasure coordinators with explicit required provider plans.
Wapps supplies target parsing, key construction, profile activity composition,
source access and fixed provider rosters through `@wapps/account`. Reusable core
and use-case code contains no Wapps content kinds or export/erasure service registry.
SDK application entrypoints remain the composition roots for the deployed account
and authenticator services. Account migrations, table names, outbox semantics and
deployment identities do not change in this extraction. Existing jobs keep the
fixed Wapps plan; changing that plan requires a separate durable-job migration.

## Authentication

Authentication is a separately running, swappable credential process. The local
implementation owns its MySQL schema, passwords and opaque sessions, and exposes
an authenticated `/credentials/*` contract. It does not access canonical Identity
persistence or run Account's broker workers. Identity/Account consumes that contract
through a bounded HTTP adapter for sign-in, registration, token verification,
credential administration, export and durable deletion. No provider adapter is
instantiated in Account.

Identity owns stable Wapps IDs and exact issuer/subject bindings. Registration
requires credential proof and a durable enrollment retry receipt; identity, binding
and creation outbox commit together. Existing subjects are not adopted by email.
Canonical lifecycle, consumer authorization, ownership, receipts and materialization
remain authoritative. Replacing an authentication implementation preserves mappings;
changing an issuer/subject requires a verified migration that preserves Wapps IDs.

BFF preserves the original browser authentication API and calls Identity's auth
facade. Ingress resolves tokens through private Identity validation before forwarding
trusted Wapps identity headers. Both local and alpha browser authentication routes
cross BFF. Authentication itself receives no browser identity headers.

Local authentication is explicitly selected, persistent and development-only.
Firebase integration is deferred. OAuth, anonymous credentials and email actions
remain unavailable in this local implementation, with truthful failures. The
[contract, configuration and migration guide](../docs/LOCAL-AUTHENTICATION.md)
describes independent migration jobs, legacy mapping blockers, single-issuer limits,
operator provisioning and the disposable real-process qualification. Existing alpha
configuration generation and Kubernetes deployment wiring remain unqualified for
the new contract. This change does not qualify frontend presentation or activate
any existing installation.

## In-app discussion mentions

Public application topics/replies and article comments accept optional `mentions`
containing up to ten distinct public profile UUIDs. Account privately resolves
recipients under the author's current profile access. Free-text names do not send
notifications. The aggregator supplies an explicit member picker, preserves the
references during edits, and resolves visible member names on demand. Shared
composer hosts must register `provideMentionMembers('api', accountOrigin)` and an
authentication session; demo mode is explicit and does not deliver notifications.

Account serves self-only `GET /api/me/notifications/mentions` with optional `cursor`
and `PUT /api/me/notifications/mentions/read` with `{id}`. The Mentions tab replaces
ten-item pages and reports saved opt-out, loading, unavailable and empty states.
Source events are unique per post and recipient. Removing and re-adding a mention
preserves the original event and read/suppression state instead of notifying again.
Current profile, conversation and parent access is rechecked for delivery and reads.

Discussion commits mention associations and durable source intent with the payload
reference, aggregate revision, command receipt and projection outbox. Account stores
canonical delivery/suppression/read receipts; both journals join private export and
bounded erasure. Exact write replay does not require another Account lookup. The
service-only endpoints are Account `POST /api/internal/mention-recipients` and
Discussion `POST /api/internal/mention-notifications`, using the dedicated
`x-notification-worker` credential and exact OPA service identity/scope/resource.

Apply Discussion `MentionNotifications1791864016000` and identity
`AccountMentions1791864017000`, update both source-generated OPA bundles, provision
the distinct shared `NOTIFICATION_SERVICE_SECRET`, and fence older writers.
Configure Discussion `ACCOUNT_MANAGEMENT_URL` and Account `DISCUSSION_URL` before
setting Account `MENTION_NOTIFICATION_WORKER_ENABLED=true`. It defaults off and
disabled inbox reads return 503. Discussion maintenance supports `--mention-status`
and `--mention-requeue <uuid> --failed-at <timestamp>` for inspected failures after
twelve attempts. Restore/rollback must retain both journals, mappings and erasure
barriers; destructive down is refused. See the
[materialization contract](../docs/MATERIALIZATION.md#discussion-mention-associations-and-inbox-authority)
and [qualification](../tools/readiness/README.md#in-app-discussion-mentions).

## In-app favorite updates

Account serves self-only `GET /api/me/notifications/favorites` with optional
`cursor`, and `PUT /api/me/notifications/favorites/read` with `{id}`. The portal's
`/notifications` page separates Replies and Favorites and replaces ten-item pages
on navigation. Saved in-app/Favorite Updates preferences govern delivery and reads.
Public application/suite/article/discussion changes notify current subscribers;
published releases notify the application's subscribers. Changes between polls
coalesce. Saving establishes a baseline, while removal/re-add creates a new generation.

Editorial and Discussion expose service-only `POST /api/internal/favorite-updates`
with `{kind,id}`. Canonical SQL cursors advance atomically with public mutations;
Account atomically stores observation and delivered/suppressed receipt. Projection
replay/private edits cannot create updates, and current visibility controls reads.
Both Account journals participate in private export and bounded account erasure.

Migrate Editorial through `EditorialContentUpdates1791840017000`, Discussion through
`DiscussionContentUpdates1791840018000`, and identity through
`AccountFavoriteUpdates1791840019000`. Update source OPA, provision the same dedicated
`NOTIFICATION_SERVICE_SECRET` in all three namespaces, and fence older writers.
Both source APIs must be ready before Account accepts new favorites. Enable
`FAVORITE_UPDATE_WORKER_ENABLED=true` after this coordinated rollout; disabled
delivery returns 503, not an empty working inbox. Kubernetes expects
`notification-service-secret`, key `secret`, in each namespace.

Identity maintenance provides `--favorite-update-status` and
`--favorite-update-requeue <generation-uuid> --failed-at <timestamp>`. Inspect the
failure before requeueing after twelve attempts. Retain source cursors, watches and
receipts during restore/rollback; destructive migration rollback is refused. See
[materialization](../docs/MATERIALIZATION.md#favorite-update-subscriptions-and-inbox-authority)
and [qualification](../tools/readiness/README.md#in-app-favorite-updates).

## In-app reply inbox

Account exposes self-only `GET /api/me/notifications` with an optional bounded
`cursor`, and `PUT /api/me/notifications/read` with `{id}`. Responses are no-store.
The inbox covers replies to the immediate author's public application discussions
and article comments. It resolves current visibility, honors the saved in-app and
Discussion Replies preferences, and reports unavailable dependencies explicitly.
The aggregator's `/notifications` route provides bounded pages, persistent read
status and links to the exact conversation, with session-isolated state.

Discussion commits source intent atomically with each eligible reply. Account's
compiled worker uses the dedicated service-only POST
`/api/internal/reply-notifications` to claim, resolve and settle it. MySQL stores
canonical delivery/suppression and read receipts; no disposable inbox projection
is used. Both sources include these records in private export and erasure cleanup.

Before activation, migrate Discussion through `ReplyNotifications1791840015000`
and the shared identity database through `AccountNotifications1791840016000`,
fence older reply/erasure writers, install both updated OPA bundles, and configure
the same distinct `NOTIFICATION_SERVICE_SECRET` for Discussion and Account.
Set Account `REPLY_NOTIFICATION_WORKER_ENABLED=true` only after those steps. It
defaults off; disabled delivery returns 503 even for an empty inbox. Kubernetes
expects Secret `notification-service-secret`, key `secret`, in each namespace.
The Secret must be supplied by deployment provisioning; no credential is checked in.

Discussion maintenance supports `--notification-status` and
`--notification-requeue <uuid> --failed-at <timestamp>`. After twelve attempts,
operators inspect the cause before requeuing the exact failed receipt. Restoring
or rolling back requires both canonical journals and compatible erasure writers;
the migrations deliberately reject destructive rollback. See
[materialization](../docs/MATERIALIZATION.md#reply-notification-delivery-and-inbox-authority)
and [qualification commands](../tools/readiness/README.md#in-app-reply-notifications).
Email, push and system alerts remain unfinished.

## Local verification

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx run-many -t test -p sdk-features-identity-authentication,sdk-features-identity-applications-authenticator,identity --runInBand
NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx run-many -t build -p sdk-features-identity-applications-authenticator,sdk-features-identity-applications-management,sdk-features-discussion-applications-management,sdk-features-discussion-applications-materializer,discussion-csr,aggregator-csr
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

The configured MySQL database must already exist. Run the explicit `--migrate` maintenance mode before starting either identity service. Normal startup refuses pending migrations and never synchronizes schemas. The migration command needs schema privileges; API startup does not perform DDL. The canonical migration rejects nonempty legacy subject mappings and does not import old Mongo account/profile records. Preserve and reconcile those records before an existing deployment cuts over. Existing sessions without a canonical SQL identity must sign in again.

Focused qualification now exercises isolated MySQL/RabbitMQ/MongoDB/MinIO and the local Firebase Auth emulator. This is separate from deployed ingress, real email delivery or a production Firebase project. Before rollout, verify complete sign-in/signup/reset journeys, repeat OAuth sign-in, refresh, sign-out, disabled identities, provider cleanup and event consumption with the target environment's configuration. See the readiness evidence for exact test substitutions and remaining gaps.

## Canonical account management

Cross-service erasure and the API privacy-page workflow now pass local qualification.
Production activation and operational qualification remain open. Editorial and
Discussion use the shared identity MySQL adapter's `lockIdentityWrites` inside canonical write transactions,
before resource locks and receipt replay. `beginIdentityErasure` is an internal
adapter operation for an authenticated erasure participant; it permanently records
the Account deletion revision under the same lock. Both services install
`IdentityWriteBarrier1791840000000` through explicit maintenance before startup.
Staff publication/ownership commands include the affected author/claimant in the
ordered locks. The Account worker now activates these barriers through durable
participant requests and dedicated service-only APIs. Account now completes its
own bounded private-data cleanup. Discussion now composes its bounded cleanup and
durable completion as described below. Editorial canonical anonymity, private
workspaces/media and ownership/audit erasure are now locally qualified as bounded
phases. Exact projection confirmation and the composed production participant now
also pass local qualification. The enabled Account/portal erasure journey now passes
real-service/browser qualification through final coordinator and credential receipts.
The following phase descriptions retain their narrower scope; the complete workflow
supersedes their earlier pending-erasure limitations. Deployment remains unqualified.
The barrier itself adds no public projection or materialization event.
See the materialization contract and erasure checkpoint for rollout constraints;
writers predating this barrier cannot coexist once erasure activation is enabled.

Editorial's `EditorialAuthorErasure1791840010000` makes canonical ownership and
outbox actors nullable and installs durable projection targets. Its bounded adapter
requires the exact pending request/barrier and atomically anonymizes one canonical
contribution, advances its revision and records outbox/target intent. Articles keep
their text, URL, cover and timestamps with `Deleted account` attribution. Active
application ownership grants/claims are revoked with a legitimate system decision;
new proof/approval and concurrent ownership transfers remain supported. Current
revision checks hide stale attributed public content. Private/audit/media phases
are described below; the composed participant now confirms targets and completion.
This primitive alone cannot complete erasure. Explicit migration and writer fencing
precede activation. See `docs/MATERIALIZATION.md` for recovery/rollback constraints.

Editorial's `EditorialMediaAssets1791840011000` now separates immutable normalized
media descriptors from private upload history. Ready state, descriptor and receipt
commit together; references and retirement share the registry lock. Retired keys
keep permanent payload-free guards and existing durable object-cleanup intent.
Public images and a legitimate successor's inherited draft resolve authorized
canonical references without the original upload row; private selection still
requires an owned upload. No public revision/event changes during this backfill.
Real SQL/MinIO/API/browser qualification proves retained bytes after fixture
private-history removal and restart. Explicit migration and fencing of old
writers/cleanup workers are required. Cleanup now also retires registry-only orphan
assets after the existing seven-day unused-media threshold: reference/retirement
locks, durable intent, bounded retries, permanent object markers and exact guard
checks no longer require private uploader history. Real-store and compiled
maintenance qualification passes. Private workspace cleanup is now qualified below;
the composed participant and complete workflow are qualified below; see the
materialization contract and checkpoints for production activation requirements.

Editorial's `EditorialWorkspaceErasure1791840012000` adds bounded owner/parent
indexes. Its workspace-erasure port now drains application, suite, article and
release private drafts, submissions, commands and uploader history under the exact
pending identity barrier, after canonical anonymity. Batches retain valid
intermediate schema relationships. Referenced media survives via the immutable
registry; unused uploads wait for durable object-cleanup receipts before private
history disappears. Public snapshots/revisions/outbox are unchanged. Real-store
rollback, batch, restart, concurrent-worker and late-upload checks pass. This phase
is composed with ownership/audit cleanup and exact projection confirmation below.
Those checks precede the final Editorial receipt in the qualified Account journey.

Editorial's `EditorialAuditErasure1791840013000` adds explicit anonymous-review
timestamps and permanent application ownership history. Approval records the latter
atomically; its migration backfill preserves earlier approvals across ownership
transfers. The audit-erasure port drains owned claims/proofs/receipts and revoked
grants, preserves successor authority, and removes erased reviewer identities from
peers' reviews without changing their decisions, reasons, times or content. Outbox
delivery intent remains intact. Private cleanup adds no public materialization
event. Real SQL/HTTP, migration/restart, peer export and retained-content checks pass;
projection confirmation and participant completion are described below.
Apply the migration explicitly and fence older ownership/review writers before
activation; rollback must preserve barriers, anonymous attribution and the permanent
history that prevents old unbound authoring from returning.

`EraseEditorialProjections` uses the existing consistent SQL snapshot reader and
complete-document Mongo publisher for one durable erasure target at a time. It
requires matching primary/majority readback and an unchanged locked SQL revision
before target removal. A concurrent successor edit or newer publisher stays pending;
corrupt or same-revision conflicting documents fail. Duplicate workers and retries
after Mongo success/SQL failure converge, while old bylines and tombstoned content
cannot return through delayed publication. The one stable schema-1 Editorial
document does not require Discussion's multi-generation purge. This phase adds no
migration and does not itself complete the Editorial receipt.

Editorial now composes these phases through `CleanEditorialAccount` and
`CleanAccountErasureParticipant`. `MysqlEditorialErasureCompletion` checks every
one of 36 indexed attribution/target fields under the exact permanent barrier
before atomically recording completion. Missing data cleanup, object retirement,
projection confirmation or a failed final SQL write keeps the request pending.
Completed replay does not require Mongo or active cleanup. Apply the index-only
`EditorialErasureCompletion1791840014000` migration and all predecessors, fence old
API/materializer writers, configure Mongo write access and enable media cleanup
before setting `EDITORIAL_ERASURE_WORKERS_FENCED=true`. The flag defaults off and
invalid values fail startup. Real compiled HTTP/SQL/Mongo/MinIO/OPA checks and
retained-content browsers pass. Full Account/portal local qualification also passes;
deployment remains open.

`AccountErasureRequests1791840001000` installs each service's durable pending/
completed receipts; `AccountErasureCoordination1791840002000` installs Account's
separate leased journal and backfills all retained tombstones, preserving prior
credential receipts. Overall completion requires both credentials and erasure.
Normal pending receipts defer; failures back off and quarantine after 12 attempts.
`--erasure-status` and `--erasure-requeue <uid>` inspect/recover the erasure journal.
The internal POST endpoint requires `x-account-erasure-writer`, a dedicated OPA
service principal and `ACCOUNT_ERASURE_SECRET`, distinct from ingress and export
credentials. The Account runtime requires this configuration; local examples and
Kubernetes manifests supply references only. Overall cleanup stays pending until
all participants complete. The complete workflow now passes local qualification,
including a failed final coordinator-journal write after all participants finish.
Retry/restart preserves the exact participant receipts and eventually records global
completion; credential removal alone never implies it.

The API privacy page now verifies `GET /api/me`, requires consent and typed `DELETE`,
and sends one self `DELETE /api/me`. HTTP 202 means accepted, with pending/completed/
failed cleanup explicitly distinguished. A lost or invalid response stays uncertain
and is not automatically replayed. Authentication recovery is held for the originating
session during deletion; later sign-ins cannot be cleared by its delayed response.
The root application service depends on a port; a lazy HTTP adapter preserves the
existing bundle limit. Demo mode installs no remote action. Terminal notices survive
in-app navigation, not a full reload. Deleted credentials cannot query a new receipt
API: operators use the canonical journals. See `accountErasureWorkflowCheckpoint` for
1,205 tests, compiled service/restart/failure evidence and 24 browser layouts. This
adds no migration beyond the documented participant prerequisites, and enables no
production worker by itself.

`CleanAccountErasureParticipant` validates the accepted request before advancing
the cleanup port. Account composes it with `MysqlAccountErasureCleanup`, which
requires the exact inactive tombstone and permanent barrier. Bounded transactions
remove profiles/contact data, avatars, preferences, favorites, account commands,
follower relations/receipts, erased-recipient badge history and export jobs/chunks.
The receipt completes atomically only after no Account private rows remain.
Minimal lifecycle identities/barriers, coordination and credential journals and
existing lifecycle outbox intent are retained; deletion revision does not change.

`ProfileBadgeErasure1791840003000` follows coordination in both identity runtimes
and maintenance. It makes actor/reason/key/fingerprint jointly nullable for erased
staff decisions on surviving recipients, preserving their badge state and event
facts. New staff decisions still require reasons. Migration re-entry validates
anonymized history; temporarily partial erased-recipient history requires an exact
pending request/barrier and cannot survive completed cleanup. Staff portal history
renders explicit deleted-account/removed-reason labels. This Account-only cleanup
changes no projected content; see the materialization contract for the SQL-only
variation and remaining cross-service work.

Discussion now composes `RegisteredDiscussionPayloads` with a MySQL registry and
MinIO object adapter in its API and legacy-maintenance writers. Reservations
precede uploads; canonical publication requires the exact confirmed reservation
under owner/actor barriers, atomically with content, receipts and the outbox.
Run `DiscussionPayloads1791840004000` before startup; it backfills only current
references with proven owners and unknown uploaders. Stop older unregistered
writers before activation. Missing applied schema and destructive rollback fail.

Discussion projection schema 3 uses stable node IDs and atomic revision-protected
replacement. Complete snapshots still use a deterministic generation and readers
reject mixed/incomplete generations. An older in-flight snapshot cannot restore
bytes after a newer tombstone. Reconciliation upgrades schema-2 heads from authority
at the same canonical revision. The existing v2 queue names describe the transport
contract and remain unchanged. Old schema-2 node copies require separate erasure
cleanup. Drain old materializer binaries before activating erasure, and drain
in-flight workers before destructive projection drop/restore so a paused snapshot
cannot write into a cache whose revision guards were removed.

`RetireDiscussionPayloads` safely retires bounded obsolete references under an
exact pending erasure request using permanent empty object markers. It is composed
into the production participant below and cannot independently return completion.
Retirement requires an unversioned bucket and permanent retention of markers.
Historical/orphan inventory now has the reviewed maintenance path described below.
Deployment inventory and fencing remain operational prerequisites. Registered owner histories,
including obsolete and unfinished uploads, now have export coverage below.
See the Discussion payload checkpoint and materialization contract for evidence.

Canonical Discussion author removal now has a locally qualified bounded primitive,
`AnonymizeDiscussionContributions`. `DiscussionAuthorErasure1791840006000` is required
before updated API startup; it permits anonymous node/registry ownership and records
durable projection-cleanup targets. An exact pending erasure and completed inventory
are required. Public/unlisted contributions retain IDs, text and replies; anonymous
copies remove structured attribution and public readers supply `Deleted account`.
Private contributions become pointer-free tombstones. Reservation/conditional PUT
precedes the atomic ownership/pointer/revision/outbox mutation. Current reads and
schema-3 projection guards prevent old attribution from being exposed or restored.
Internal `anonymizing` copies remain protected from retirement until their canonical
node no longer belongs to the erased owner. Ordinary edits cannot reclaim anonymous
ownership. Historical projection/private/audit/review cleanup and production
composition follow below; this primitive does not independently finish erasure.

`EraseDiscussionProjections` now consumes those SQL targets after canonical author
removal. `MysqlDiscussionProjectionErasure` revalidates the request/anonymous node;
`MongoDiscussionProjectionErasure` uses primary majority reads and journaled majority
deletes, processes at most 100 historical copies, and keeps stable schema-3 records.
Call its `ensureIndexes()` during composition. Wire its generation collection to
`discussion_generation_nodes` and its legacy collection to `discussion_nodes`.
The application requires an explicit stopped-old-materializer acknowledgement.
Obsolete v1/v2 orphan caches drain before the phase reports `drained`; this is not a
service completion receipt. Other old heads may require normal authoritative
reconciliation. Private SQL/review cleanup is now composed into the runtime
participant; old-worker fencing and compatible restoration remain deployment gates.

`CleanDiscussionAccount` sequences canonical anonymity, payload retirement,
private SQL/registry cleanup, review cleanup and projection cleanup. The final SQL
adapter checks all remaining ownership/private records and cleanup targets under
the permanent identity barrier before atomically completing the matching request.
Retries preserve the first completion timestamp; concurrent requests converge.
Reviews use canonical SQL snapshots and revision fences, with no new projection.
Public reviews retain anonymous text/ratings/helpful marks; private reviews become
inaccessible tombstones and historical/actor data drains in bounded batches.

Set `DISCUSSION_ERASURE_WORKERS_FENCED=true` only after stopping/draining legacy
writers and old-schema materializers, applying all explicit migrations through
`ReviewErasure1791840008000`, and completing reviewed payload inventory. Keep the
bucket unversioned and retain permanent markers. Absent/`false` leaves requests
pending without cleanup; invalid values refuse startup. Current schema-3 workers
must process the anonymous projections before completion. The runtime ensures the
cleanup indexes on the actual generation/legacy collections. This configuration
acknowledgement does not prove deployment fencing or recovery safety.

Compiled Account-to-Discussion qualification now covers mixed discussions/reviews,
private history, retained peers, projection lag, API restart, final SQL failure and
concurrent completion. This intermediate pending state is followed by compiled
Editorial and global Account completion in the complete workflow qualifier. The
API portal action is enabled; production restore/rollback/load/soak remain open.

`DiscussionPayloadInventory1791840005000` adds durable inventory progress and is
required before updated Discussion startup. `--inventory-payloads` previews at
most 32 objects; append `--apply <fingerprint> --legacy-writers-stopped` only after
reviewing the plan and fencing/draining old writers. Each batch must be separately
reviewed. Known immutable history is adopted with an unknown uploader. Owned
mutable content is reserved/copied/confirmed before source retirement; unowned
legacy content requires the existing reviewed backfill. Unknown keys and broken
canonical graph references block progress. Proven orphans or obsolete content for
an exact pending erased owner can be retired with permanent markers.

Inventory uses ports for object I/O and SQL authority, connection-bound exclusive
maintenance ownership, canonical write barriers and conditional object generations.
It cannot rewrite public content, emit projection work or finish erasure. Completed
inventory is a prerequisite of the composed Discussion cleanup participant.
Keep the bucket unversioned and retain markers across backup/restore; a command-line
acknowledgement alone does not qualify production writer fencing or restore safety.

Shared erasure request/coordination migrations validate ordered pending-work
indexes from MySQL `SEQ_IN_INDEX`, independently of TypeORM enumeration. Missing,
reordered, truncated or incompatible unique definitions remain rejected; this
repair changes validation only and adds no schema migration or public projection.

Account export is locally qualified through durable jobs, all four real sources,
the compiled Account worker/API and Privacy Settings. The additive
`AccountExports1791676832000` migration belongs to both identity runtimes and
explicit maintenance. Self-only `identity.account-export.manage` protects
`POST/GET /api/me/exports`, `GET/DELETE /api/me/exports/:id` and
`GET /api/me/exports/:id/download`. POST accepts `{}` and one Idempotency-Key;
GET latest returns `{ job: null | AccountExportJob }`. The account/credential/
Editorial/Discussion captures form one verified gzip NDJSON archive; each source
has its own canonical snapshot. The job is durable capture intent, with no new
read projection or broker event. See the workflow checkpoint and materialization
contract for data coverage, retention, exclusions and failure/recovery evidence.

Account startup now requires `ACCOUNT_EXPORT_SOURCE_SECRET`, using the same
32-128-character URL-safe value in both owning source services and a value distinct
from `INGRESS_AUTH_SECRET`. Keep `EDITORIAL_URL` and `DISCUSSION_URL` private and
deploy all three services with their matching policies. Kubernetes references
`account-export-secret`, key `secret`, in each service namespace; provision these
secrets before rollout. Compose uses `LOCAL_EXPORT_SECRET` for the local fixture.
There is no new migration beyond the existing account-export migration.

The pump performs one capture per process, with SQL leases for replicas/recovery,
six attempts and 24-hour archive retention. HTTP downloads are no-store and capped
at four concurrent reads per process; early close/deadline stops the handler but
retains the permit until any pending SQL read cleans up. The browser verifies the
attachment before saving, clears old-session operations and reports actual job/
error states. It buffers the archive in memory. Real provider credentials,
deployed ingress, maximum-size device performance and operational gates remain
unqualified; cross-service erasure is still pending.

Discussion exposes `POST /api/internal/account-export` only to the fixed export
service actor. It accepts `{ "identityId": "canonical-uid" }` and no tenant/query
overrides, returning bounded `application/x-ndjson` with source receipts. The
`x-account-export-reader` credential must match `ACCOUNT_EXPORT_SOURCE_SECRET`
(32-128 URL-safe ASCII characters, distinct from `INGRESS_AUTH_SECRET`). Missing
or invalid configuration leaves source access denied; never pass this secret to
the portal. Its OPA action is `discussion.account-export.read`; even admin roles
cannot bypass the fixed service identity/role/scope. A source captures owned
records across tenants and records their canonical tenant IDs. It excludes other
members' payloads and never consults profile sharing or Mongo projections.
`RemoteAccountExportSource` is composed into Account's runtime pump alongside
the other three required captures. Source-secret provisioning and deployment
qualification remain pending; local integrated runtime/browser evidence is
recorded in the workflow checkpoints.

Discussion also emits `payload-versions` for exact-owner registered current,
historical/removed and uploaded-but-uncommitted bodies. Canonical contribution
references require an exact committed registration. Each version includes its
node/version UUIDs, tenant, lifecycle/times, hash/size and authored content; a
different uploader is labeled `other`, an unknown importer `unknown`. Own upload
actions on another owner's content emit only `payload-uploads` metadata, without
that owner's identity, content, hash, storage key or current-use status.

Reserved uploads use an explicit storage observation: `NoSuchKey` yields
`not-observed`, verified bytes yield `present`; missing buckets, generic errors,
denials, timeouts and corrupt bytes fail capture. Confirmed payloads must exist.
Retiring records cannot finish capture; retired records include metadata only.
SQL metadata shares the source's consistent snapshot, with bounded object reads
and existing deadlines/archive limits. Unknown unregistered history/legacy keys
still need inventory. This adds no projection or migration and does not complete
cross-service erasure.

Published profile articles use `GET /api/profiles/:id/articles?after=uuid`.
Current audience and Show Activity History apply, including owner preview.
Canonical authorship and public publication state select twenty summaries per
page, ordered by article UUID, with a public-ID continuation and no private owner
or draft fields. Exact published generations are checked before and after content
I/O; private edits remain isolated and withdrawal immediately hides old content.
Account reconfirms current profile facts after Editorial responds. Hidden sharing
skips that dependency; outages never become successful empty pages.
`POST /api/internal/profile-articles` requires the existing service reader secret
and the dedicated Editorial OPA action. Coordinate Account, Editorial, policy and
portal rollout; no new migration or projection is introduced. Local browser/API
qualification and remaining operational limits are recorded in the implementation
progress and materialization documents.

Profile totals use `GET /api/me/totals` and `GET /api/profiles/:id/totals`.
They count distinct current discussion participation, resolved public favorites,
owned published suites and authored published articles. Null means hidden;
unavailable dependencies never produce zero. Public audience and category sharing
apply, including owner preview; article counts follow Show Activity History.
Self-authorized private totals ignore sharing but still count public content.
`POST /api/internal/profile-totals` on Editorial/Discussion is service-only and
requires the existing reader secret and dedicated OPA actions. There is no new
migration or projection. Deploy all three services, their policies and the portal
together. See `docs/MATERIALIZATION.md` for complete semantics, bounds and current
qualification requirements.


Staff profile badges use `GET /api/admin/profile-badges` for current capabilities,
`GET /api/admin/profile-badges/:publicId?after=revision` for current state and
twenty-event audit pages, and `PUT /api/admin/profile-badges/:publicId` for decisions.
Writes require an `Idempotency-Key` and exactly `expectedRevision`, `kind`
(`verified` or `premium`), `action` (`award` or `revoke`) and a 3-1000-character
`reason`. The revision belongs to the badge aggregate. Stale decisions and changed
key reuse conflict; exact retries return the original event without replaying its
effect. Actor IDs and reasons are staff-only. Labels confer no permissions or
billing entitlement. The `identity:badge-manager` role grants badge management;
existing global `admin` also applies. Self-profile permission does not.

`GET /api/me/badges` returns the current owner's active kinds and award times.
`GET /api/profiles/:publicId/badges` additionally enforces the current audience and
Show Badges, including owner preview. Both expose `{ sharing, items }`, with empty
items for hidden sharing. Private/inaccessible profiles remain unavailable.
Public responses use `Vary: Authorization`; every badge endpoint is no-store.

The portal exposes staff management at `/me/profile-badges` through an authorized
capabilities link on My Profile. Private/public profile screens provide loading,
hidden/empty/unavailable states and refresh. Deploy the additive
`ProfileBadges1791676831000` migration, both identity runtimes, the identity OPA
bundle, Account routes and portal together. The local gateway explicitly routes
staff badge endpoints to Account. The existing account-host ingress covers them;
production same-origin routing and staff claim provisioning still require
deployment qualification. See `docs/MATERIALIZATION.md` for atomicity, audit
retention, privacy-race and recovery semantics.

Public profile activity uses `GET /api/profiles/:id/activity?after=opaque`.
Current profile audience and Show Activity History apply, including owner preview.
The stream merges current reviewed/direct publications, live individual community
contributions, reviews and saved public favorites. It excludes private account
events. Suite/discussion/favorite switches apply to their corresponding entries.
Account rechecks the full canonical profile stamp after all content I/O; owning
services recheck canonical selections and require current projections and parents.
Approved app editing drafts resolve to their canonical target and only the latest
publication supplies author/time. Publication activity never infers authorship from
a later ownership grant or exposes private draft IDs.

Pages contain at most ten entries. Each unfinished source supplies a private scan
boundary; merging stops at the earliest boundary so hidden candidates cannot cause
older entries to be skipped. An empty page can have continuation. Encrypted `a1.`
cursors bind the public profile and survive restarts with the same secret; rotation
requires a fresh first page. `POST /api/internal/profile-activity` uses only the
fixed reader identity and `x-profile-reader` secret on Editorial and Discussion.
Deploy both services, Account, the three affected OPA bundles and the portal
together, using matching `INGRESS_AUTH_SECRET` and private service origins.
No new migration or projection is required. See `docs/MATERIALIZATION.md` for
precise semantics, bounds, consistency and recovery requirements.

Shared profile discussions use `GET /api/profiles/:id/discussions?after=opaque`.
Current profile audience and Show Discussions both apply, including owner preview.
Account privately resolves the owner and confirms its full canonical profile stamp
after Discussion I/O. Discussion selects current live contributions to application
topics and article threads, reuses exact-generation/public-parent readers, resolves
canonical public parent routes through Editorial, then rechecks SQL membership and
revision. Deleted sole contributions and withdrawn parents disappear immediately;
lag or dependency failure is unavailable. There is no new projection or migration.
Pages scan ten candidates; an empty page may still have continuation. The encrypted,
authenticated cursor hides skipped identifiers, binds owner/tenant/context and
survives restarts with the same secret. Rotation requires reloading the first page.

`POST /api/internal/profile-discussions` accepts only `x-profile-reader` with the
existing ingress secret and a fixed service policy. It rejects mixed user headers
and scope injection. Configure the same secret in Account and Discussion and use
a private `DISCUSSION_URL`; deploy both services, both OPA bundles and the portal
together. Local Nginx blocks internal collection routes on the public listeners.
Article profile links use `?thread=uuid` and read that exact article-bound thread.
The linked view offers reply/edit actions and a link back to all comment threads.
See `docs/MATERIALIZATION.md` for bounds, consistency and cursor recovery.

Published profile suites use `GET /api/profiles/:id/suites?after=uuid`. Current
profile audience and the separate Show Suites policy both apply, including owner
preview. Account Management privately resolves the canonical owner after policy,
asks Editorial for current approved suites, and confirms the profile snapshot
again after content I/O. Hidden sharing avoids the dependency; denied access is
404 and unavailable policy/publication is 503. Only public UUID/title/description
and a visible-result cursor are returned, in pages of twenty.

Editorial's service-only `POST /api/internal/profile-suites` uses a fixed service
identity, configured public tenant and explicit OPA action. It requires
`x-profile-reader` with the existing `INGRESS_AUTH_SECRET` and rejects mixed
user/Authorization/ingress headers. Account Management and Editorial must use the
same secret value and coordinated rotation. `EDITORIAL_URL` must address the
private service, not the public ingress. Deploy both policies and APIs before the
portal; an old Editorial deployment yields unavailable content, never demo data.
Local Nginx blocks the internal prefix; target Kubernetes edge/header behavior
requires deployment qualification. No new environment variable or migration is
introduced. Existing suite publication and materialization remain authoritative;
private edits preserve approved metadata and withdrawal hides retained projections.
Contributor collections are not implemented by this owner lookup.

Suite publications now retain their own approved title, description and ordered
application IDs. Public reads, profile activity and export no longer depend on
private submission history. Run Editorial `--migrate` through
`SuitePublicationSnapshots1791840009000` with writers fenced before the updated API.
It backfills exact approved revisions in bounded transactions and refuses invalid
or missing approval history. Preserve the copied columns in backups and compatible
rollback; old approval writers cannot populate them. Public revisions/fingerprints
remain unchanged. This enables later private cleanup without completing Editorial
erasure; ownership anonymization and participant completion still follow.

Public shared favorites use `GET /api/profiles/:id/favorites` with an optional
`after=kind:uuid` continuation. The separate profile-audience `read-favorites`
policy requires both current audience access and Show Favorites, also for the
owner's public preview. Disabled sharing returns a hidden empty payload without
target-service access; denied audience is 404 and unavailable policy/content is
503. The route accepts no other query fields and returns private/no-store data.
The existing canonical account relations are rechecked against the full profile
snapshot before and after current public selections from Editorial/Discussion.
Only visible target metadata is exposed, twenty results per page, with cursors
drawn from returned public targets. Withdrawal never becomes an unavailable
reference containing a hidden target ID. No new migration or projection is needed.
Deploy the OPA policy, target selection endpoints, Account Management and portal
as a coordinated update. The existing profile ingress prefix covers this route;
`EDITORIAL_URL` and `DISCUSSION_URL` remain required. See the materialization
contract for concurrency and recovery limits.

Editorial article text publication uses `/api/me/articles` for account-owned
drafts, `/:id/publication`, `/:id/submit` and `/:id/withdraw` for revision-bound
publication, and `/api/editorial/article-reviews` with `/:id/decision` for
independent staff review. Every mutation requires `Idempotency-Key`. Apply
`ArticleWorkspace1791676818000` explicitly before startup and upgrade Editorial
workers for the `article` projection kind. Private edits preserve submitted/public
content; approval and withdrawal atomically commit canonical state, receipt and
outbox. Withdrawal is required before deleting a public/pending private draft.
Published article URLs remain reserved. Public list/detail/selection use
`/api/catalog/articles` and `/api/catalog/article-selection`, with canonical
visibility and exact projection revisions. The portal and account favorites are
locally qualified; operational/deployment gates remain open.
See the article checkpoint and materialization contract for recovery limits.

Article comments use the portal BFF at `/api/article-comments/:articleId`
for public listing and member creation, `/:id` for thread read/author edit/removal,
and `/:id/replies` for member replies. Supply `Idempotency-Key` for all writes and
`expectedRevision` for edits/removals. Bodies contain a chosen public `displayName`
and plain `text`; edits wrap them in `content`. Responses expose no private account
IDs. Authors edit their own text; tenant-scoped admins can remove another member's
comment but cannot edit it. BFF constructs the consumer-owned `article:<UUID>` key
and maps requests/responses to the owner's generic `/api/discussions` API.
Keyless `/api/discussions` requests retain the legacy unbound contract and refuse
bound resources. The single reusable controller validates scope explicitly; there
is no separate binding-resource API.

Run Discussion `--migrate` explicitly for `DiscussionArticleTargets1791676822000`
before API startup. Configure `EDITORIAL_URL` and `DISCUSSION_PUBLIC_TENANT`;
eligibility uses canonical `/api/catalog/article-visibility/:id`, independently
of article projections. Upgrade Discussion materializers before enabling these
writes. Root/target/revision/receipt/outbox remain atomic, immutable payloads and
complete generations remain rebuildable, and parent withdrawal denies subsequent
reads/writes. Root removal hides its thread; reply removal retains a redacted
structural placeholder. Portal uncertain-command retry is memory-only across
route changes and is cleared on account changes/full reload. See the article
comments materialization contract and checkpoint for evidence and limits;
Kubernetes provisioning, cross-service erasure and operational gates remain open.

Application discussions use BFF `/api/application-discussions/:applicationId` for
public list/member creation, `/:id` for read/author edit/removal, and
`/:id/replies` for replies. Bind to the canonical application UUID. Topics carry
`title`, `displayName`, `text` and optional `tags`; replies carry only name/text.
All writes require `Idempotency-Key`; edits/removals need `expectedRevision`.
Authors edit their own content; tenant admins can remove but cannot rewrite it.
BFF maps these operations to `/api/discussions` with `application:<UUID>`.
The owner enforces exact keys through consumer ports; unbound and article-comment
routes cannot bypass the application binding. Reusable HTTP handlers live in
`@sdk/features/discussion/http` and never parse these Wapps namespaces.

Run `DiscussionApplicationTargets1791676823000` through explicit `--migrate`,
then upgrade materializers before enabling these writes. The marker validates the
existing binding schema without additional DDL. Configure the same
`EDITORIAL_URL` and public tenant; canonical eligibility is checked through
`/api/catalog/application-visibility/:id` without depending on its projection.
The API-mode aggregator selects the real discussion list/detail workflow;
application slugs resolve through the catalog to UUIDs. Full-service community,
erasure, Kubernetes provisioning and deployment gates remain open.

Private BFF `GET /api/me/discussions` lists application topics with a live post owned
by the signed-in member. The explicit self-read OPA action checks account/tenant
scope; SQL ownership and lifecycle define participation, and existing exact
Discussion generations supply titles. Ten-candidate keyset pages accept an
optional `cursor`; hidden applications may leave an empty page with `next`.
No new projection is added. Run `DiscussionParticipation1791676824000` explicitly
before API startup. The API portal resolves current app names/slugs through the
catalog and clears private listings on session changes. Deleted contributions,
article-comment history and service-wide export/erasure are outside this view.

The aggregator's API-mode quick dialog reuses the same application-topic
endpoints and exact-revision reads. It resolves the current app slug to its UUID,
supports replies/author edits/removal and moderator removal, and refreshes the
originating list when closed. Uncertain commands retain their original key in
session memory across closing/reopening; account changes and full reload clear
that local retry. No new migration, policy action or materialization pipeline is
introduced. Demo mode selects the separate browser-local dialog explicitly.

Application topics and replies now support signed votes through BFF
`PUT /api/application-discussions/:applicationId/:id/vote`, with
`{ value: -1 | 0 | 1, expectedRevision }` and `Idempotency-Key`. Zero removes the
actor's choice. Apply `DiscussionVotes1791676825000` explicitly, update the
Discussion OPA bundle for `discussion.application-topic.vote`, then coordinate
the API/portal release: strict application-post responses now require vote state.
The generic materializer remains compatible. Retain SQL vote and
receipt rows through any rollback; destructive down migration is refused.

Votes, thread revision, receipt and outbox commit atomically. Totals and `mine`
come from a consistent canonical SQL snapshot at the exact generation revision;
there is no separate vote projection or change to immutable payloads. Current
parent visibility, binding, tenant and lifecycle still fence reads/writes. Public
responses expose no voter identities, and removed replies expose no vote state.
List/full-thread/dialog controls support switching/removal, exact retry and
conflicts while preserving unfinished composer text. See the vote section in
`docs/MATERIALIZATION.md` and the voting checkpoint for recovery and deployment
limits; generic legacy likes, feed votes and review helpfulness remain separate.

Tenant administrators can pin/unpin live application-topic roots with
BFF `PUT /api/application-discussions/:applicationId/:id/pin`,
`{ pinned, expectedRevision }` and `Idempotency-Key`. Ownership alone is
insufficient; replies cannot be pinned. Apply `DiscussionPins1791676826000`
explicitly and update the OPA bundle for `discussion.application-topic.pin` before
coordinating the API/portal release. Application responses add canonical
`pinned`/`canPin` fields and use `0|1.timestamp.UUID` page cursors. Pinned topics
sort first, then creation time descending and UUID ascending, in ten-topic pages.
Article and My Discussions cursors are unchanged. Pin state, revision, receipt
and outbox remain atomic; existing materializers need no pin projection. Preserve
state through rollback and see the materialization contract for recovery limits.

The API portal now reuses the bounded application-topic list for overview and
same-application related previews. The shared feature owns isolated read state,
shows three canonical pin-first/newest topics and excludes the current thread.
Public chosen names and structural reply counts come from existing exact
generations; no view counts or author/profile rank are invented. Projection lag,
outage, deletion and parent withdrawal retain the list's existing fail-closed
contract. No additional API, migration, policy or worker is required.

Member reviews are hosted by a separate module in Discussion management, with
the pure domain at `features/review/core`. Routes under
`/api/application-reviews/:applicationId` expose public list, `summary`, `:id`,
member `PUT mine`, author `DELETE :id`, `PUT :id/helpful`, `POST :id/reports`,
and staff `moderation`, `GET :id/reports`, `PUT :id/moderation`. Writes require
`Idempotency-Key` and `expectedRevision`; creation starts at revision zero.
Content contains `displayName`, integer `rating` from 1 to 5, and plain `text`.
Moderation accepts `hidden` and `reason`; reports accept `reason`.

Apply `MemberReviews1791676827000` explicitly and update the Discussion OPA
bundle before exposing this workflow. Configure `EDITORIAL_URL` and
`DISCUSSION_PUBLIC_TENANT`. Every command checks current canonical application
visibility; ownership of an app grants no review authority. Authors cannot mark
their own reviews helpful, report or moderate them. Staff hides survive author
edits/republishing; staff restoration preserves author withdrawal.

This module uses canonical SQL snapshots without a review projection. Immutable
content, state, helpful/report facts, revision, historical receipt and change
journal are transactional. Missing authority fails closed. The journal has no
feed/notification consumer yet. Public summaries include only currently visible
member ratings; no verified-purchase or profile badges are fabricated. Backup
and rollback must retain all seven review tables consistently; destructive down
is refused. Existing Discussion runtime dependencies still apply. Portal exact
retry is session-memory only; full reload/account changes clear it. See the review
checkpoint and `docs/MATERIALIZATION.md` for evidence and outstanding deployment,
retention/erasure, restore and load qualification.

Article covers now use `/api/me/article-covers` for reserve/list, `/:id` for
status/cancellation and `/:id/content` for upload/owner preview. Reserve accepts
`articleId` and the exact source descriptor; upload needs `If-Match` and
`Idempotency-Key`. Save optional `cover: { imageId, alt }` through the normal
article revision command. The image must be ready and owned by this article's
owner/tenant; alternative text is required. Submission freezes image and text,
and approval publishes their reference with the existing atomic outbox.
Owner and independent reviewer previews use `/:id/submissions/:revision/cover`
under their respective article routes. Public reads use
`/api/media/articles/:articleId/:imageId`, checking current SQL authority before
and after object I/O. Withdrawal denies access immediately.

Apply `ArticleCovers1791676819000`, `ArticleCoverReferences1791676820000` and
`ArticleCoverCleanup1791676821000` before startup. Covers share the configured
private, unversioned media bucket with a separate namespace. The existing media
cleanup switch enables cover cleanup too; maintenance supports
`--article-cover-cleanup`, `--article-cover-cleanup-status` and
`--article-cover-cleanup-requeue <cover-id>`. Draft/latest-submission/canonical
references prevent retirement. Canonical reviewed covers remain retained after
withdrawal/private deletion, with access denied; old nonlatest submissions do
not retain bytes indefinitely. The portal now qualifies upload/reload recovery,
required descriptions, frozen review, anonymous reads and account-switch
isolation. Provisioning, account erasure and operational gates remain open.

Editorial release notes now have a durable backend. Verified application owners
use `/api/me/releases` for private drafts, `source/:applicationId` for canonical
source/grant metadata, `open` for a fresh editing draft, and `:id/rebase` for
explicit merging. `:id/publication`, `:id/submit` and `:id/withdraw` use independent
private/public revisions. Assigned staff reviewers use
`/api/editorial/release-reviews` and `:id/decision`; they cannot review their own
drafts. Every mutation requires `Idempotency-Key`.

Public `/api/catalog/releases/:appSlug` and `/:version` return only approved
canonical notes under the current parent application's visibility. Publication
uses the standard Editorial `release` materialization protocol. Run the additive
`ReleaseWorkspace1791676817000` migration explicitly before API startup and upgrade
materializers before enabling the routes. Version URLs remain reserved after
withdrawal, private deletion preserves reviewed notes, and ownership transfer
requires a new private draft. The API portal now provides owner drafts, explicit
merge, independent review and public devlogs, with local gateway routing to
Editorial. Public browsing supports `page`, optional `channel` and exclusive
`before=YYYY-MM-DD` filters. Reviewer application labels come from currently
visible canonical parent records, separately from immutable submitted notes.
See the release checkpoints and materialization contract for qualification and
the remaining deployment/recovery gates.

Editorial's private application image API exposes `POST /api/me/application-images`
to reserve an upload, `GET /:id` for canonical status, `PUT /:id/content` for
uncompressed `application/octet-stream` bytes, and authenticated `GET /:id/content`
for a normalized WebP preview. PUT needs the quoted upload revision in `If-Match`
and the original `Idempotency-Key` for retries. Creation requires the draft ID,
logo/banner purpose and exact source MIME/byte-count/SHA-256 descriptor.
Source formats are PNG/JPEG/WebP still images, up to 8 MiB, 20 million pixels
and 8,192 pixels per input dimension. No caller-provided storage path or owner
is accepted. Reservations expire after 24 hours. Limits are 20 pending, 100 new
reservations per rolling day and 200 retained ready/unexpired reservations per
owner/tenant. `GET /api/me/application-images?draftId=...` lists retained uploads
for reload recovery. `DELETE /api/me/application-images/:id` cancels an unused
upload using `expectedRevision` and `Idempotency-Key`; any draft, submission or
public reference prevents cancellation.

Provision a dedicated private bucket and set `EDITORIAL_MEDIA_ENDPOINT` (HTTP(S)
origin), `EDITORIAL_MEDIA_BUCKET`, `EDITORIAL_MEDIA_ACCESS_KEY` and
`EDITORIAL_MEDIA_SECRET_KEY`. Do not make the bucket publicly readable. The API
uses conditional PUT and bounded verified reads; missing configuration returns
503 when object access is required. Run `ApplicationImages1791676814000` and
`ApplicationImageBindings1791676815000` and `ApplicationImageCleanup1791676816000`
through `--migrate` first. Normal
Editorial startup refuses pending migrations and does not run DDL.

`PUT /api/me/application-drafts/:id/images` attaches/removes one slot using
`expectedRevision`, `purpose`, nullable `imageId` and `Idempotency-Key`. Uploaded
images must belong to that owner/tenant/draft. Submission freezes both slots;
approval atomically publishes the reviewed references and public materialization
intent. Configure `EDITORIAL_MEDIA_PUBLIC_ORIGIN` as an HTTP(S) origin for generated
`/api/media/applications/:applicationId/:purpose/:imageId` URLs. The bucket stays
private. Public image reads check current canonical visibility and exact slot
reference before and after fetching bytes, so stale projections grant no access.

Private draft and canonical-source previews use the corresponding draft route
followed by `/images/:purpose/content`; submitted previews use
`/:draftId/submissions/:revision/images/:purpose/content` beneath
`/api/me/application-drafts` or `/api/editorial/application-reviews`. Review
access requires an independent assigned reviewer in the tenant. Editing drafts
inherit canonical images, and explicit rebase accepts `imageChoices` with
`draft`/`canonical` for each slot. Legacy submissions without recorded images
require resubmission before approval. Portal controls now cover upload/preview,
separate attachment/removal, retained uploads and cancellation, exact session-scoped
reload recovery, frozen reviewer images and per-slot canonical merge. Browser retry
metadata retains no file bytes, source filename or bearer token. Deployment
provisioning remains unfinished; local qualification is recorded in the media
portal, publication and retention checkpoints.

The media bucket must stay unversioned and private. Cleanup replaces retired
bytes with permanent empty markers so delayed conditional uploads cannot restore
them; do not configure lifecycle deletion of those markers. Enable
`EDITORIAL_MEDIA_CLEANUP_ENABLED=true` after provisioning. Unreferenced pending
uploads expire after 24 hours, unused ready images seven days after creation,
and deleted-draft images immediately. References always prevent retirement.
Cleanup uses durable SQL jobs, fenced leases and at most eight attempts before
operator recovery. Run `--media-cleanup` for one bounded batch,
`--media-cleanup-status` for retained failures, and
`--media-cleanup-requeue <image-id>` to retry one failed job. Object success and
SQL receipt loss are recoverable. Bucket versioning is refused, and activation
defaults to disabled. See `docs/MATERIALIZATION.md` for limits and recovery rules.

Private application drafts are owned by Editorial, separately from account
profile/preferences and published catalog records. Self-workspace policy permits
canonical owner/tenant draft reads and revision-bound changes through
`/api/me/application-drafts`. SQL row/receipt writes are atomic, deletion retains
scrubbed tombstones, and no projection intent is needed for private canonical
reads. Draft creation grants no verified ownership or public visibility. Run
Editorial's `ApplicationDrafts1791676810000` migration before API startup.
Application submission/publication now uses immutable SQL submissions and
actor-scoped receipts through `/api/me/application-drafts/:id/publication`,
`/:id/submit` and `/:id/withdraw`. Independent assigned reviewers use
`/api/editorial/application-reviews` and `/:id/decision`. Approval atomically
updates canonical catalog content, lifecycle, receipt and outbox; later private
edits cannot change approved content. Direct public edits invalidate a pending
approval's public revision. Withdrawal/deletion immediately revoke visibility.
Run `ApplicationPublication1791676811000` before startup; public and private
website fields now share a 2,048-character limit. The catalog author association
does not verify real-world ownership. Ownership now requires canonical-host DNS
proof and independent `editorial:ownership-reviewer` approval. Claims and grants
use authoritative SQL; approved owners edit separate private drafts tied to their
claim and source public revision. Explicit merging cancels pending content review
without changing publication. Revocation preserves private work and a later grant
requires a new draft. Both additive ownership/editing migrations must precede
normal startup. The API portal and independent-browser workflow are locally
qualified; media, cross-service erasure and deployment gates remain open. See
the materialization contract and dated qualification evidence for limits.

Account Management shares Authenticator's case-sensitive Firebase UID and SQL
identity lifecycle. It reads private profile state from SQL and completes profile
registration with an expected revision and idempotency key. It does not provision
a second Mongo/SQL-subject graph. Deletion tombstones the identity and queues
retryable Firebase cleanup; it returns accepted/pending rather than claiming all
data is already erased. Admin suspension gates application access in SQL, without
claiming that the Firebase credential record has been disabled.

The account service requires the same `MYSQL_*`, `QUEUE_*`, Firebase project/key,
Admin credentials and `INGRESS_AUTH_SECRET`, plus `OPA_URL` and `EDITORIAL_URL`
(an HTTP origin for canonical application/suite favorite eligibility). Its Kubernetes
manifest uses `authenticator-runtime` for the shared SQL/queue settings and mounts
`firebase-admin-credentials`. Compose runs `identity-migrate` before either API.
Kubernetes migration orchestration and secret provisioning still need release
qualification. The exact public password-recovery path requests provider delivery;
private account routes require trusted, current identity. `GET/PUT /api/me/profile`
now reads/edits canonical profile text and social links under an explicit self-access
policy. PUT requires `expectedRevision` and `Idempotency-Key`; profile fields,
revision, receipt and outbox intent are atomic. Registration completion cannot
overwrite an existing profile. Run the additive private-profile migration before
either service starts. The basic public audience workflow is described below;
remaining privacy consumers, legacy import and cross-domain deletion stay open.

Private photos use `PUT/DELETE /api/me/profile/avatar` and an authenticated
`GET /api/me/profile/avatar/:id`. Mutations require the quoted account revision
in `If-Match` and `Idempotency-Key`; upload additionally requires source MIME,
`X-Avatar-Bytes` and `X-Avatar-Sha256`. PNG/JPEG/WebP still images up to 2 MiB are
normalized to bounded WebP. Immutable current bytes, association, shared revision,
receipt and outbox commit in one SQL transaction. Reads never expose an anonymous
URL; the portal uses authenticated blobs and revocable object URLs. Replacement,
removal and local account deletion reclaim SQL bytes atomically.

Run `ProfileAvatars1791676828000` through identity `--migrate` before restarting
both services. The account ingress permits 2 MiB bodies; deploy that route limit
with the portal/API. No object-store configuration or new worker is required.
Include the avatar table in consistent backups and use a compatible rollback:
older account binaries cannot erase its rows. See the materialization variation
and qualification evidence; deployed audiences and deployment/restore/load gates
remain open.

Public profiles now use the existing SQL subject UUID as `publicId`, separately
from private credential IDs. `GET /api/profiles` lists bounded current public
profiles; `GET /api/profiles/:id` reads public, private-owner or approved-follower
content under the dedicated `wapps.profile_audience.authz` OPA policy. The policy
module is generated into the existing identity-admin bundle and must be deployed
with the account API. It grants no administrative audience bypass. Public reads
recheck canonical privacy/lifecycle/relationship facts after policy I/O and never
publish credential email or legacy external photo URLs. Audience-protected photos
use `/api/profiles/:id/avatar/:avatarId`; responses are private/no-store.

`GET /api/me/profile-follows` lists incoming pending/approved requests;
`GET /api/me/profile-follows/outgoing` lists a member's outgoing relations, even
when the target becomes private. `PUT /api/me/profile-follows` takes
`ownerId`, `requesterId`, `expectedRevision`, `action` and `Idempotency-Key`.
Requesters use `request`/`cancel`; owners use `approve`/`remove`. New requests
require followers visibility and two saved profiles. Commands atomically persist
pair revision/tombstone, historical receipt, both account revisions and outbox
intent. Historical retry never restores revoked access. Account deletion removes
both incoming and outgoing relations and their receipts in the tombstone transaction.

Run `ProfileFollows1791676829000` through identity `--migrate` before both APIs.
The new `/api/profiles` ingress uses `/validate-optional`; private account routes
keep strict authentication. The local gateway now routes public profiles to Account
Management. Supplied invalid/suspended sessions are rejected, not made anonymous.
Include both relation/receipt tables in backups; older binaries do not erase them
and require a compatible rollback plan. No new worker or object store is needed.
Basic profiles, photos and approval controls are separate from the still-required
content sections and full export/cross-service erasure.

Profile Settings accepts an optional `contactEmail` in `PUT /api/me/profile`.
This is a member-provided, unverified contact address, separate from credential
email. Null/blank removes it; omission preserves it for older clients and retains
existing retry fingerprints. It commits with the profile/revision/receipt/outbox
and is erased with the account row. Public profile detail returns it only when
`privacy.showEmail` is enabled and the viewer satisfies the current audience.
Directory responses never include an address. No email is sent by this feature.
Run `ProfileContactEmail1791676830000` via identity `--migrate` before both APIs,
and coordinate the API/portal response contract rollout. The nullable column is
included in ordinary account backups; retain it through compatible rollback.
The migration rejects incompatible definitions/noncanonical values and refuses
destructive down. See the materialization contract and qualification evidence.

`GET/PUT /api/me/preferences` now provides canonical account preferences under
explicit self-read/update policy. It uses the same account revision as profile
and lifecycle commands, an independent preferences command fingerprint, and
atomic preference/revision/receipt/outbox writes. The additive
`AccountPreferences1791676806000` migration creates validated case-sensitive SQL
storage; deletion removes preferences in the account tombstone transaction.
Unconfigured accounts have private defaults and no stored preference timestamp.
The portal now selects API/demo providers explicitly. Account settings bind to
canonical snapshots; guest display storage and local demo preferences are separate.
Real-service browser checks cover account isolation, conflicts, lost-response
retry and restart persistence. API export covers saved preferences only.
Public profile visibility now controls profile text/photos and approved follower
access. Remaining privacy consumers and notification delivery remain unfinished.

`GET/PUT /api/me/favorites` provides private canonical target references under
self-access policy. PUT uses `expectedRevision` and `Idempotency-Key`; relation,
shared account revision, receipt and outbox commit together. Replays return their
original receipt without undoing later removal. Removal and completed retries do
not need target services. New adds support applications, suites and articles through
Editorial, and application-topic discussions through Discussion. Every new addition
checks current public eligibility; that observation grants no target permission.
Reads return kind, UUID and added time without copied target metadata. There is a
200-relation account limit. Run `AccountFavorites1791676807000` before either
identity service; account deletion clears favorites atomically with its tombstone.
No projection is introduced. The portal now uses canonical application IDs,
revision-bound commands and current BFF metadata with explicit API/demo providers.
Real SQL/OPA/service/browser qualification covers retry, isolation and restart;
suite and article publication/favorites are separately qualified. Cross-domain
erasure and production deployment remain unfinished. The suite lookup
uses `/api/catalog/suite-selection` and never resolves unpublished private drafts.
See the readiness evidence.

Account Management now requires `DISCUSSION_URL` alongside `EDITORIAL_URL`. Use
the Discussion service origin, without a path, query, credentials or fragment.
Its unsigned `/api/discussions/selection?bindingPrefix=application:&ids=...`
lookup validates live roots, public tenant, exact generations and current parent
visibility through the consumer binding adapter. The endpoint accepts at most fifty
distinct UUIDs; Account checks one application-topic reference per eligibility
request. Replies and article/unbound threads are not favorite targets. Generic
selection returns bound roots with consumer content; the portal's separate BFF
`/api/discussion-selection` contract maps these to topic/application IDs, revision,
title and reply count. Hidden targets are omitted; pending projections and service
outages fail.
The portal resolves current parent slugs separately and retains unavailable saved
references for removal. List, full-thread and quick-dialog favorite controls share
canonical account state. Apply `DiscussionBindingIndex1792150000000` after
`CommunityDiscussionBindingKeys1792080000000`, then coordinate Community, BFF,
Account Management and ingress versions. Dedicated internal discussion routes are
retired; mixed old/new clients are not supported during this switch. The index
does not change projections or historical receipts. See the Community README and
the bound Discussion API checkpoint for rollout and qualification.

Both service entrypoints expose `--migrate`, `--outbox-status`, `--cleanup-status`,
`--outbox-requeue <event-uuid>`, and `--cleanup-requeue <uid>`. These commands start
no API/Firebase/broker. See [materialization](../docs/MATERIALIZATION.md) for the
write, delivery, lifecycle, migration and recovery contract, and
[implementation progress](../docs/IMPLEMENTATION-PROGRESS.md) for current evidence.
