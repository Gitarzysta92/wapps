# Materialization contract

## Account lifecycle administration through BFF (October 18, 2026)

BFF maps three staff commands to the existing Account owner. It does not read SQL,
decide staff authority, create projections or retry an uncertain command. Account
preserves verified tenant context and evaluates the generated global-resource
policy before writes. Tenant-scoped authority cannot mutate global identity state.

Suspension/re-enablement retain the existing canonical row lock, monotonically
increasing revision and atomic lifecycle-outbox transaction. Repeating the current
state produces no extra revision/event. A failed transaction produces no success
receipt or lifecycle event. SQL suspension does not assert credential-provider
disablement. Local token revocation independently deletes all existing sessions
under its credential lock, including refresh tokens; it is not a projection write.
Re-enabling alone does not revoke existing credentials. No cross-store transaction,
new cleanup job or durable revocation receipt is introduced.

The owner emits credential-free operational logs with actor, exact valid target,
action and confirmed/denied/unconfirmed outcome. These logs need deployment retention
and are not a durable command audit journal. Existing erasure/export provider plans,
identity mappings, cleanup receipts and materialization protocols are unchanged.
The local installation still requires verified legacy mapping migration before
activation; its migration guard was preserved.

## Local credential authority (October 18, 2026)

Explicit local authentication adds authoritative credential/session tables in the
Identity SQL database. They are not disposable projections. Credentials use random
salts/password hashes and opaque token hashes; transactions lock the credential
subject before issuing/rotating/revoking sessions. Refresh consumes its predecessor
atomically and has no best-effort event or automatic BFF retry. Credential creation
and canonical enrollment remain separate provider/use-case steps: interrupted
registration recovers only after proving the existing credentials and replaying the
canonical enrollment receipt. Token return still requires current canonical access.

The existing canonical identity transactions, profile receipts, lifecycle outbox,
queue delivery and deletion jobs are unchanged. No new credential materializer is
introduced. The Account cleanup worker uses the selected credential port; local
cleanup removes secrets/sessions and leaves a minimal retry tombstone. A subject
from another provider cannot receive an invented local cleanup receipt. The fixed
export/erasure provider roster and accepted jobs retain their existing meaning.
Switching existing subjects requires verified mapping/migration, not an environment
flag alone. See [local authentication](LOCAL-AUTHENTICATION.md) for recovery,
configuration and the real-store rollback/concurrency/lifecycle qualification.


Implementation branch: `codex/full-operation`. Started October 11, 2026.
This document specifies the implementation target and invariants. Use
[implementation progress](IMPLEMENTATION-PROGRESS.md) for completed work and
verification; this contract alone does not claim the system already meets them.

## Review generic API (October 18, 2026)

Review commands/queries and HTTP handlers now accept consumer-owned opaque keys.
Wapps maps its key to the historical `(tenantId, applicationId)` SQL scope in a
consumer adapter; the generic capability never parses that representation. BFF
owns application-specific route/response mapping. This extraction introduces no
schema migration or changes to review versions, locks, receipts, fingerprints,
erasure state or the transactional journal.

Reviews retain their synchronous canonical SQL variation: a mutation and its
journal/receipt commit atomically, and reads use repeatable snapshots followed by
current parent and scope-revision checks. They do not require a Mongo projection
or Discussion broker delivery. The disposable qualifier proves historical replay,
whole-transaction rollback on an injected journal error, exact retry, independent
staff/author lifecycle and continued Review reads/writes with Mongo unavailable.
Owner/BFF recreation preserves receipts and current state. Providers are controlled
fixtures and recreation replaces Nest instances; production-provider and separate
process-crash recovery remain unverified by this slice. See the Review checkpoint
in `IMPLEMENTATION-PROGRESS.md` for evidence and limits.

## Discussion route consolidation (October 18, 2026)

The single `/api/discussions` owner controller now serves unbound and explicitly
scoped operations. `/api/discussion-bindings` is retired. This changes only HTTP
composition and client routing: canonical rows, payload references, receipts,
aggregate revisions, outbox intent, broker delivery and projection schema 4 retain
their representations. No additional migration or rebuild is required for this
route cleanup; the earlier binding/index migrations still apply where pending.

Exact-key isolation remains authoritative. Invalid query scope fails validation;
omitted or wrong keys cannot access a bound resource. Keyless likes remain isolated
from scoped votes. The disposable real-store qualifier passes historical receipt
replay, parent revocation, lag, nested redaction, service recreation, deletion and
stale-generation suppression through the unified route, including a second consumer.
Its policy/authentication/parent fixtures and Nest-instance recreation do not prove
production-provider or independent process-crash recovery. See the October 18
implementation checkpoint for commands, failed attempts and limits.

## Bound Discussion owner API (October 16, 2026)

`/api/discussion-bindings` now exposes the reusable command/read/discovery contract.
BFF maps application-topic, article-comment, participation and selection routes
to it. The owner still enforces exact stored keys and current canonical authority
through consumer ports; discovery prefixes are filters, never permissions.

`DiscussionBindingIndex1792150000000` follows
`CommunityDiscussionBindingKeys1792080000000` and adds the canonical lookup index
`(tenantId, bindingKey, pinned, createdAt, id)`. It does not rewrite rows, change
revisions/receipts, add an event format or upgrade projection schema 4. Explicitly
configured consumers may use opaque keys with null Wapps `subjectKind/subjectId`
metadata. Wapps keeps validating its historical metadata and receipt fingerprints.

The real-store BFF qualifier replays receipts originally accepted through Wapps
facades through the new HTTP contract. A second consumer uses the same generic
handlers and materializer with an unfamiliar key and payload. Tests cover exact-key
and case isolation, parent revocation, vote/pin state, pagination, service recreation,
removed ancestors, durable tombstones and stale-generation suppression. The existing
SQL transaction -> immutable object reference/outbox -> RabbitMQ -> guarded Mongo
snapshot path remains intact. No alternate best-effort publishing path is added.

Deploy the index and coordinate Community, BFF, Account Management and ingress
versions because dedicated internal routes are retired. See the Community README
for migration/traffic-fencing order. This is verified with isolated real stores and
controlled authority fixtures, not a production rollout or independent process-crash
qualification.

## Unbound Discussion through the BFF (October 16, 2026)

Generic list/detail, create/reply, edit/delete and like/unlike APIs now cross the
BFF. Their existing JSON and receipt contracts are preserved. BFF validation is
transport validation; canonical tenant, ownership, lifecycle and exact binding
checks remain in Community and its reusable Discussion engine. Unbound APIs cannot
read or change a consumer-bound resource. No schema, event, worker or storage
representation change is introduced.

The isolated `qualify-materialization.cjs --discussion-bff` runner exercises both
nginx configurations, BFF and owning HTTP handlers against fresh stores. It verifies
that command receipts survive service recreation, current authority denies private
or deleted content before projection convergence, removed ancestors retain only
structural placeholders, and older snapshots cannot resurrect a deleted root.
The production outbox dispatcher and materialization function participate via real
RabbitMQ. Authentication, policy and parent visibility are controlled fixtures;
full-stack provider and crash-window qualification remain separate gates.

## Opaque Discussion bindings (October 15, 2026)

Discussion stores and compares the consumer's opaque `bindingKey`; it does not
parse target kinds, identifiers, namespaces or consumer schema versions. Wapps
interpretation lives in Community. Generic reads/mutations require exact binding
equality and current canonical tenant/owner/parent authority. Unbound APIs cannot
access bound resources. Aggregate revisions, immutable object references and
projection schema markers remain storage guarantees.

`CommunityDiscussionBindingKeys1792080000000` backfills consumer-owned keys without
changing revisions, receipts, payload references or tombstones. Each aggregate's
key update and current-revision outbox requeue commit together; interrupted
migrations resume. Existing revision intents are reused. The materializer reads
only the opaque key, includes it in snapshot identity and emits projection schema
4. Guarded writes replace schema-3 stable records at the same revision and remove
obsolete consumer fields. Stale snapshots cannot replace newer authority. Erasure
waits for older stable guards to upgrade and never treats them as disposable
historical cache.

Fence old writers and materializers before migration; preserve SQL, immutable
objects and projection/artifact snapshots, apply migrations, start both new
processes, refresh gateway upstream resolution after container recreation, then
verify authoritative reconciliation and BFF reads. A binary-only rollback is
unsafe: use a coordinated fenced snapshot restore or reviewed forward fix.
Historical consumer receipt fingerprints remain unchanged and are tested.

Destructive inventory/erasure qualification requires a dedicated fresh object
store as well as isolated SQL/Mongo/queue state. The runner creates disposable
containers and the Discussion harness rejects pre-existing buckets before fixture
mutations. See the October 15 implementation checkpoint for the shared-bucket
test incident, checksum-proven recovery and subsequent isolated verification.

## Existing meaning

[Architecture Abstract, section 6](../architecture-abstract.md) defines a
projection as a derived, disposable, rebuildable, eventually consistent read
model. The write model determines truth. Materialization is the process that
turns those authoritative facts into a queryable representation.

The current discussion implementation already distinguishes MySQL content
nodes/relations, MinIO payloads and MongoDB projections. Its
[event contract](../apps/shared/src/contracts/discussion-projection.ts) requests
materialization; it is not an event-sourced domain history. Rebuilding must not
depend on RabbitMQ retaining every historic request.

## Article comments and member reviews through the BFF (October 15, 2026)

Six comment and ten review handlers now cross the portal BFF. They retain the
owning-service protocols described in the Article comments and Member reviews
sections of this document. No schema, owning-service or materializer changes are
introduced. BFF verifies ingress provenance, validates bounded contracts and
preserves keys/revisions, but neither accesses storage nor authorizes against
projections. It forwards each command once without retry or redirect. Only
Discussion decides whether the original durable receipt is still accessible.

Comments remain SQL/immutable-object writes with atomic receipts and outbox intent,
followed by RabbitMQ/Mongo generation materialization. Full reads require the current
canonical revision; a stale thread or a cursor page containing it returns 503.
Other current cursor pages remain available. Root deletion and parent withdrawal
deny access immediately even while an older live generation exists. Deleted reply
ancestors retain only structural placeholders. Republishing the same article
restores access to its retained, nondeleted comments.

Member reviews deliberately use canonical SQL snapshots. Review content versions,
helpful membership, immutable-version reports, revisions, historical receipts and
the durable event journal commit transactionally. Public rating totals derive from
current visible reviews. Staff hiding and author withdrawal remain independent;
editing does not clear a staff hide, and staff restoration does not republish an
author-withdrawn review. Replaying an older moderation receipt never reverses later
state. Parent visibility and application revision checks remain in Discussion.
No broker-delivery or projection claim is added to the review event journal.

The bounded BFF qualifier covers comment lag/tombstones, canonical review changes
while the comment worker is paused, parent withdrawal/republishing, dependency
outages, restarts and exact historical replay. Crash-window, duplicate/reorder,
authoritative rebuild, backup restoration, deployment and load qualification remain
separate release gates. See the dated implementation checkpoint for outcomes and
limits; frontend fidelity is still unaccepted.

## Application discussions through the BFF (October 15, 2026)

Application topics, threaded replies, edits/deletion, votes, pins, participation
pages and public selection cross explicit BFF handlers. Discussion retains
canonical identity/tenant/owner/policy and parent visibility decisions, immutable
MinIO payload references, SQL revisions/receipts and atomic materialization intent.
The BFF has no database access and introduces no schema, event or worker changes.

The portal preserves aggregate revisions and command keys. The BFF validates
complete thread structures and historical receipts, forwards commands once, and
does not use projections to pre-authorize mutations or receipt replay. Discussion
continues to decide whether a historical command is still accessible. A replayed
receipt is evidence of its original command, not proof of current visibility.

Reads pin the exact canonical revision and recheck authority after projection and
parent-service I/O in Discussion. Missing/stale generations remain 503. Deleted
replies retain structural placeholders without text, votes, timestamps or edit
rights so their children remain reachable. Root deletion and parent withdrawal
revoke public access even while a previous live generation remains stored.
Participation and favorite selection use current canonical visibility.

The bounded transport qualifier exercises paused materialization, edit/delete
convergence, immediate deletion/parent revocation, Mongo and object-store failure,
BFF/Discussion restart and historical replay. SQL crash windows, broker duplicate/
reorder, full authoritative rebuild, backup restore, load and deployment remain
separate release checks. The dated implementation checkpoint records evidence and
limits; the original frontend merge and visual acceptance remain outstanding.

## Articles and covers through the BFF (October 15, 2026)

The article portal boundary now uses explicit BFF handlers for authoring,
submission/withdrawal, independent staff review, public content and cover media.
Editorial still owns canonical authorization, SQL transactions, immutable submitted
content and cover references, receipt replay, outbox and projection delivery.
This transport slice introduces no schema or projection protocol changes.

Private edits after submission do not change the reviewed text, proposed
classification or cover. Approval publishes the frozen submission. Public article
reads retain authority selection, exact Mongo revision matching and a second
authority check; a missing/stale projection is 503, never an older or invented
article. Withdrawal hides text, selections and covers immediately using canonical
state while an older live projection can still exist.

Cover normalization and immutable object writes remain in Editorial outside SQL
locks, followed by fenced completion and durable reference management. BFF only
validates and transports the reserved original bytes. Protected uploads re-enter
owning-service authorization before BFF buffering. Protected and public cover reads
retain Editorial's authority recheck after object I/O; a public image must match
the current canonical cover. Object failure is explicit, and Mongo availability
does not grant or deny canonical cover access. Cancellation and background cleanup
retain their existing reference, lease and receipt rules.

The BFF does not preflight publication lifecycle or reject an old command because
its returned revision is historical. Only Editorial may replay the durable receipt.
No transport retries or redirects are allowed after an uncertain result. The
bounded runtime qualifier exercises replacement/withdrawal with a paused
materializer, exact frozen covers, dependency outages, restarts and historical
replay. SQL crash windows, broker duplicate/reorder, rebuild and backup restoration
remain owning-service/full-release checks rather than claims of this transport
qualification. Evidence and remaining release work are in
`IMPLEMENTATION-PROGRESS.md` and `OPERATIONAL-READINESS.md`.

## Releases through the BFF (October 15, 2026)

Private release drafts, canonical source/open/rebase, publication commands,
independent staff review and public release pages/version reads cross explicit
BFF routes. BFF validates trusted identity, strict selectors and command/response
contracts, preserves expected draft/publication revisions and original keys, and
bounds requests, responses and deadlines. It performs no state preflight, storage
access, projection writes or automatic command retries. A lost reply remains
uncertain; a replayed receipt describes its original operation, not current rights.

Editorial retains canonical identity/tenant checks and claim-bound authoring.
Revocation blocks source/rebase/submission/approval even while an older application
projection remains stored. Private editing/deletion and staff rejection remain
available; a new grant does not silently rebind old drafts. Submissions freeze
fields and target revisions. Approval atomically commits the approved fields,
canonical release revision, decision, receipt, content-update cursor and durable
outbox intent; withdrawal commits its tombstone and intent atomically. Public
version URLs remain immutable and reserved even after withdrawal.

Public reads still select canonical visibility, require an exact projection, and
recheck authority after projection I/O. BFF receives either qualified public
content, explicit 503 for unavailable/lagging data or 404 for withdrawn content.
It cannot resurrect an old release from cached content or a historical receipt.
No migration, event protocol, owning-service behavior or materializer change is
introduced. SQL crash-window, broker duplicate/reorder, authoritative rebuild and
backup-restoration qualification remain separate release checks. See the dated
implementation checkpoint for the live transport proof and its limits.

## Application ownership through the BFF (October 14, 2026)

Private ownership claims, domain verification, cancellation/release and independent
staff queues/details/decisions now use explicit local BFF routes. Pure ownership
contracts validate inputs and complete challenge/lifecycle responses. BFF forwards
verified identity, expected revisions and original keys once, bounds payloads and
deadlines, and returns explicit uncertainty on missing replies. It performs no DNS
lookup, storage access, grant calculation or transition preflight.

Claims and DNS check reservations remain canonical SQL data in Editorial. Proof
uses the canonical website host, a bounded external DNS operation and fenced check
completion. A matched challenge does not grant ownership. Independent staff approval
must still satisfy proof freshness, application revision and active-grant invariants.
Grant, release and revocation commit the ownership decision, application revision,
receipt and durable outbox intent atomically. Read projections remain disposable;
editing, rebase and publication check the current grant in the owning service.
Future content changes still require independent publication review.

Historical create, proof, approval and import receipts are retained outcomes, not
current authority. Replaying them after cancellation/revocation cannot recreate a
grant or enable authoring. No schema, projection, event protocol or owning-service
implementation changes are introduced by this transport migration. Existing SQL
crash-window, duplicate/reorder, rebuild and backup-restoration proofs remain
separate owning-service/release checks. See the implementation progress checkpoint
for the local runtime evidence and its limits.

## Application publication through the BFF (October 14, 2026)

Application publication status/submit/withdraw and staff queue/detail/decision now
cross explicit BFF routes. The existing frontend adapter retains its contract and
uses no direct owning-service path for these operations. BFF validates trusted
identity, strict input/response shapes and matching receipts, then forwards the
original key and expected/submitted revisions once. Missing replies remain uncertain;
only an explicit caller replay can recover the owning receipt. Legacy image snapshot
markers and stale canonical editing bindings remain visible to the caller.

Editorial still enforces canonical owner/tenant access, independent review, immutable
submitted text/classification/images, rejection reasons, canonical source revision
and public slug uniqueness. Approval/withdrawal retain their single SQL transaction
for decisions, aggregate/public revisions, receipts and outbox. No new storage,
projection, schema migration, worker or event semantics are introduced. BFF neither
uses a projection for permission nor infers current publication from a receipt.

The local HTTP qualifier demonstrates that paused materialization yields 503 until
the approved snapshot arrives; private submission/review still operate during Mongo
failure. Rejection preserves an older publication. Withdrawal returns public 404
while the old live projection remains stored; queued replacement/withdrawal converge
to the current tombstone. Old submit/approve receipts and process restart cannot
restore visibility. Existing SQL crash-window, broker duplicate/reorder and backup
restoration proofs remain separate owning-service/release checks.

## Application drafts and images through the BFF (October 14, 2026)

Private drafts, canonical import/rebase, upload lifecycle and all six application
image preview variants now cross explicit local BFF routes. This is a transport
change: Editorial still authorizes against canonical SQL, commits draft/image
references and receipts, normalizes bytes, writes immutable objects and completes
uploads under fenced processing leases. No BFF database access, new projection,
worker, migration or altered outbox protocol is introduced. Private workspace reads
do not depend on a public projection.

The BFF re-enters Editorial authorization before buffering uploads, preserves the
original source bytes, expected revision and idempotency key, and bounds body sizes,
concurrency and deadlines. It never retries an uncertain write automatically.
Historical ready receipts can replay after cancellation; they are not current
lifecycle assertions and cannot restore object references. Current upload state and
preview access are read separately. Editorial continues rechecking authorization
and current image references after object I/O, including published image identity.

Frozen submission images stay unchanged when a private draft slot changes. A
verified owner's import/rebase uses the canonical revision and explicit image merge
choices; it does not approve or publish content. Public previews require a current
canonical publication reference and become unavailable immediately on withdrawal.
The local qualifier uses submission/review and ownership commands through BFF to
set up disposable image fixtures.

Existing private-image materialization, upload lease, cleanup and crash-window
contracts below continue to apply. The BFF qualifier tests object-store outage,
restart persistence, byte integrity and receipt replay; it does not rerun broker
duplicate/reorder, SQL crash-window, backup restoration or production load proofs.

## Suite publication through the BFF (October 14, 2026)

Owner submission/status/withdrawal, staff review/decision and public suite reads
now cross explicit local BFF handlers. This changes the transport boundary only.
Editorial remains the canonical authority for owner/tenant scope, independent staff
review, immutable submitted fields/classification, aggregate and publication
revisions, command receipts and transactional outbox. No new store, projection,
worker or migration is introduced. Public reads still select canonical lifecycle
and revision, validate the complete projection and repeat canonical selection after
projection I/O. BFF never authorizes from a projection or accesses an owning store.

The BFF preserves command keys and expected/submitted revisions. It validates
receipt identity/action/revision, but a historical receipt is not a current-state
assertion. A lost reply can follow a committed command; the BFF never retries it
automatically. Replaying an old approval after withdrawal returns the original
receipt without republishing. Submit/withdraw bodies contain only expectedRevision;
review decisions carry the frozen submittedRevision and private reason. Public
DTOs reject private owner/review fields and preserve publication classification
and ordered application IDs.

Local qualification pauses the materializer around approval and observes explicit
503 public reads until the frozen snapshot arrives. A rejected replacement leaves
the prior publication intact. With the worker paused again, a replacement advances
public revision to 2, then withdrawal advances it to 3. Canonical public reads
immediately return 404/empty selection despite the revision-1 live Mongo projection.
Restart processes the queued work and the projection converges to the revision-3
tombstone. Historical submit/approval replay and Editorial restart cannot restore
the public resource. The qualifier observes only its new suite's projection,
read-only, outside BFF. Real BFF/Editorial outages, owner/staff denial and private
CRUD regression also pass; see `IMPLEMENTATION-PROGRESS.md` for evidence.

The existing owning-service crash-window, duplicate/reorder and reconciliation
contracts below remain unchanged. This transport qualifier does not repeat all of
those checks or qualify backup restore, deployment/load, complete account erasure
or the original frontend merge. Older sections retain their historical scope.

## Private suite workspaces through the BFF (October 14, 2026)

Private suite CRUD now crosses explicit local BFF handlers. Editorial remains the
owner of this domain. Its canonical SQL draft, tenant/owner scope, capacity lock,
revision, immutable command receipts and deletion tombstone retain the private
suite protocol documented below. Creation/editing still needs no materialized
projection; deletion retains the existing atomic public revocation/outbox when a
publication exists. This transport change introduces no migration, database access,
projection, worker, public revision or materialization protocol.

BFF validates the portal contract and forwards only verified identity context,
the original command key and expected revision. Editorial rechecks authorization
and current eligibility of newly added application IDs inside its use case/
transaction. No browser metadata or BFF projection grants access. Stored membership
preserves application order and remains removable when metadata is unavailable.
Application search/selection still uses the existing BFF/Editorial catalog boundary;
these reads are separate observations, not one atomic suite/metadata snapshot.

No automatic command retry occurs. A lost reply may follow a committed transaction,
so the caller retains the command and key. Historical receipts retain their original
revision and deletion flag; a create/update retry never restores a deleted suite.
Current detail reads return 404 for the tombstone. JSON transport is bounded to
64 KiB commands, 1 MiB responses and fifteen-second deadlines, with private/no-store
responses and safe retryable uncertainty.

HTTP contract tests cover malformed requests/results, scope forwarding, bounds,
lost replies and receipt semantics. Local runtime qualification exercises canonical
CRUD/order, independent sessions, cross-owner denial, conflicts/replay, mandatory
BFF routing, process restarts and projection outage. Private reads and removal
continue while catalog metadata fails explicitly. Publication approval/materializer
crash windows, database restoration, production deployment and the original
frontend merge remain separate qualification work.

## Account exports through the BFF (October 14, 2026)

The local portal now requests, inspects, revokes and downloads exports through BFF.
Account still owns the canonical export job, durable capture intent, leases,
immutable chunks, ready transition, expiry, cleanup and request idempotency. The
existing four-source capture protocol below is unchanged. BFF introduces no SQL,
broker, projection, migration, worker, artifact cache or new capture authority.

A request preserves its original Idempotency-Key and 202 acceptance. Replay returns
the same canonical job in its current state, including cancellation/expiry; it does
not resurrect an archive. Cancellation remains naturally repeatable by owner/job.
No automatic retry occurs. An unavailable response can follow a committed request
or revocation, so clients retry the same request/key or inspect current state.

Downloads inspect canonical metadata, then ask Account for bytes under the same
verified identity. Account rechecks current lifecycle, ownership and ready state
per stored chunk. BFF performs no permission caching, forwards no internal source
credential and never directs the browser to storage. Its bounded stream checks
length and digest against inspected metadata and withholds final bytes until EOF;
a failed stream cannot become a complete successful attachment. Already-sent bytes
cannot be recalled after revocation. Disconnect/deadline aborts the HTTP read;
Account's existing pending-query cleanup and permit rules still apply.

All responses are private/no-store. Four BFF download permits, backpressure, a
fifteen-minute deadline and the canonical one-GiB limit bound this transport.
Nginx archive buffering and temporary-file spill are disabled. Local qualification
covers real four-source completion, ownership isolation, replay, revocation,
mandatory BFF routing, source recovery and process restart persistence. Stream
fixture tests cover corruption, truncation, backpressure, cancellation and limits.
These checks do not requalify transaction crash windows, one-GiB device performance,
complete background erasure, backup restore or deployment. Frontend presentation
and the existing frontend adapter's download orchestration are unchanged in this slice.

## Public profiles, follows and badges through the BFF (October 14, 2026)

Public profiles/photos, shared content, totals, follows and staff badge operations
now cross the local BFF. Account retains canonical identity lifecycle, audience and
sharing decisions, follow and badge revisions, audit reasons, command receipts and
existing transactional outbox/materialization. Public content still uses its owning
service's visibility, revision and tombstone checks. No database access, migration,
projection, worker or materialization protocol is added to BFF.

Every profile and photo read re-enters Account authorization, including anonymous
requests with verified ingress provenance. Prior follow approval and a previously
available photo never become cached permission grants. Hidden content stays an
explicit hidden page and hidden totals remain null. These composed reads are
current observations, not an atomic snapshot across services.

Follow and badge commands preserve the original key and expected revision. Neither
BFF nor the migrated gateway automatically retries a mutation. Lost replies remain
uncertain; callers may retry the identical command/key or reload canonical state.
Historical approval/award retries return their original receipts without undoing
later follow removal or badge revocation. All responses are private/no-store.

The real local qualifier verifies privacy changes, independent follower approval,
staff award/revoke reasons, replay/conflicts, protected photos, shared content and
totals, mandatory BFF routing, dependency failure and restart persistence. It removes
its temporary topic and requests erasure only for its three disposable accounts.
This does not requalify transaction crash windows, broker recovery, complete
background erasure, backup restoration or production deployment.

## Favorites and notifications through the BFF (October 14, 2026)

Account retains canonical favorites, shared account revisions, command receipts,
transactional outbox intent and recipient-scoped notification/read state. The BFF
does not access SQL, publish events or introduce a projection, migration or worker.
Discussion delivery intent and Account's existing watch/delivery machinery remain
authoritative. BFF transport preserves favorite command keys and revisions;
mark-read retains natural idempotency by recipient and notification ID. A replay
returns the first read timestamp. Historical favorite-add retries return their
original receipt without resurrecting subsequently removed references.

Favorite metadata is a bounded composition of the member's canonical references
and current public Editorial/Discussion selections, including the discussion's
parent application classification. Services retain visibility, exact-projection
revision and tombstone enforcement. The BFF rechecks the Account revision and
reference set after composition and rejects a change with 409. It does not claim
an atomic cross-service snapshot or cache a permission grant. Absent targets stay
removable; source outages fail metadata reads explicitly while canonical removal
remains possible. Existing portal preference masking stays in the feature layer.

No automatic mutation retries occur. Uncertain transport outcomes require the
caller to retry the identical favorite command/key or reload; repeated mark-read
uses the same notification ID. All private responses are no-store. Local tests
exercise real reply, mention and favorite-update delivery, recipient isolation,
pagination, read persistence across Account restarts, opt-out and dependency
outages. They do not requalify SQL crash windows, broker recovery or backup restore.
The policy packaging repair includes the existing profile-audience Rego module;
it changes neither audience rules nor materialization semantics.

## Account and private profile through the BFF (October 14, 2026)

Account summary, private-profile text and private-photo transport now cross the
portal BFF. Account Management remains authoritative for identity lifecycle,
profile state, shared revisions, normalized photo bytes, idempotency receipts and
transactional outbox intent. The BFF neither reads their SQL tables nor creates a
projection, worker, outbox or migration. Existing erasure/backup protocols apply.

Text saves preserve `expectedRevision` and command identity. Photo replacement and
removal preserve the quoted revision, command key and immutable source descriptor;
the BFF checks incoming bytes before forwarding them. An original command replay
returns its historical receipt without restoring a replaced or removed photo.
Private photo reads re-enter Account's current identity/ownership checks on every
request. The BFF does not cache a prior grant or use projection availability for
permission. Normalization and photo persistence stay inside Account.

All private responses are no-store. Bounded transport can still lose a reply after
the owner commits, so neither BFF nor migrated ingress automatically retries a
mutation. The client retains the original command identity and revision or reloads
canonical state. `DELETE /api/me` retains the existing bodyless 202 erasure contract
when the shared account route migrates. Its acceptance does not establish completed
credential or cross-service cleanup; tombstoned identities cannot use the BFF to
regain access. This does not introduce a new deletion or retry protocol.

Local real-service qualification covers profile/photo persistence across BFF and
Account restarts, replacement/removal, historical retries, cross-account denial,
dependency failure and erasure of a newly created test identity. It does not
requalify transaction crash windows, broker delivery, backup restore, production
identity or deployment. Original presentation reintegration remains separate:
the original form stages a photo with text until Save Changes, so its feature
orchestration must handle the existing separate revision-bound commands and partial
failure truthfully. The BFF does not make those commands one atomic transaction.

## Account preferences through the portal BFF (October 14, 2026)

The BFF adds an explicit authenticated transport boundary for canonical preference
reads and replacements. It does not read a projection or database. Account remains
the authority for current identity/lifecycle, self-access policy, preferences,
shared account revisions, idempotency receipts and the transactional outbox.
Existing account materialization, erasure and replay protocols are unchanged.

The BFF preserves `expectedRevision` and the caller's `Idempotency-Key`, checks
returned identity/revision and rejects malformed responses. No automatic mutation
retry occurs in the BFF or migrated local gateway route. A timeout or invalid
receipt does not imply rollback: a same-key identical retry returns Account's
original receipt, while a fresh stale command retains its 409 conflict semantics.
Private responses are no-store. Missing Account configuration and dependency
failures are explicit unavailable responses rather than defaults or empty success.

No migration, new projection, outbox, database access or reconciliation job is
introduced. Local qualification covers actual Account/SQL persistence across
service restarts, independent-account isolation and outage/retry through the BFF;
the lost-response-after-commit window is separately covered by the BFF HTTP
contract fixture. This does not requalify SQL transaction crash windows, broker
delivery, database restoration or deployed ingress. The original frontend merge
and the remaining portal BFF routes are still outstanding.

## Grouped Discover: bounded composition of current public catalogs

### Rich discovery tile reads (October 14, 2026)

Discover adds optional, strictly validated `displayTags` and discriminated
`details` fields. Filter `tags` retain canonical ID/slug aliases; display tags
contain one actual name and destination per tag. Application details contain the
real logo and anonymous public review summary/preview. Articles carry the approved
byline and protected cover reference. Suites retain their authoritative member
count and preview at most the first six authored members selected from the public
catalog, with batches of at most 50 IDs. Saved mature-content choices mask nested
member metadata without rewriting source counts or publications.

Review reads use the configured Discussion origin, forward no user identity,
disable redirects, enforce a five-second timeout and 128 KiB response limit, and
run in batches of five. After enrichment the BFF reconfirms application and suite
publication identity/revision/classification through the canonical selection
ports. Owning services continue enforcing visibility, erasure, exact projection
revision and tombstone rules. A selected dependency failure or changed publication
fails the search with a retryable unavailable response. It never substitutes demo
data, invented ratings or success-shaped empty metadata. These independent bounded
reads do not provide a global cross-service snapshot.

This adds no storage, projection, migration, outbox intent or materialization
worker. Existing rebuild and retry protocols remain authoritative. New consumers
accept older responses without the optional fields; older strict consumers reject
the new fields. Upgrade compatible portal consumers before the enriched BFF, or
activate them together, and retain compatible versions during rollback. Home quick
search consumes the same contract and protected article-cover reader. Qualification
is recorded in the Home/search checkpoint of `IMPLEMENTATION-PROGRESS.md`.

### Reviewed content classification

Applications, articles and suites carry optional `classification: 'general' |
'mature'`. Absence is unclassified; legacy content is never implicitly approved
as General. Authors propose the value in their private draft. Submission freezes
it with the content, and independent staff approval confirms that exact snapshot.
Later private changes require another submission and approval. The direct privileged
application write API clears classification when it changes public content outside
this review path, preventing an earlier approval from labeling new content.

Classification uses the existing authoritative revision, publication transaction,
receipt and outbox. It adds no separate projection or queue. Public readers require
the exact current projection revision and existing canonical visibility checks.
Snapshots omit missing classification instead of inserting a default or `null`, so
legacy immutable fingerprints remain valid. Classified snapshots bind the value
into their existing fingerprint. Retries, reordering, withdrawal and rebuild follow
the owning publication protocol. Account exports include the private proposal,
frozen submissions and current approved value; private deletion scrubs the field.

Apply Editorial `ContentClassification1791886000000` before starting the updated
services. It adds nullable, case-sensitive columns to `app_records`,
`application_drafts`, `application_submissions`, `private_suites`,
`suite_submissions` and `suite_publications`. Article fields use existing JSON.
The migration preflights storage and existing definitions/values, resumes partial
DDL, and refuses recorded column loss or destructive rollback. There is no automatic
backfill. Older migration validators accept the exact additive column on replay.

Fence old writers and materializers before activation: old application writers can
preserve an obsolete classification on changed content, and old snapshot builders
do not preserve the field. Deploy compatible Editorial, materializer, BFF, Account and portal
binaries together. Retain the additive columns in consistent backups. Rolling back
to a binary that ignores classification is not a valid serving rollback; keep writes
fenced until a compatible binary is restored. Production migration, restore and
rollback remain separate qualification gates.

Discover, application catalog listings and overviews, and public article/suite
lists and details apply the saved choice: with mature content disabled, only
approved General records appear. Lists filter their bounded source page, retain
source totals and report hidden counts without fetching replacement pages. Suite
members are checked individually; a hidden member retains only a generic placeholder,
without its name, description or link. Private author/reviewer views remain available
under their existing authorization. Guests use the disabled default.

The shared public-content preference reader requires a completed preference read
for the current session. Loading/failing preferences, account changes and changed
choices clear old results; delayed responses cannot restore another choice's content.
Application overview/sidebar and catalog resource results also bind to the exact
choice that initiated their request. Hidden details have generic states and do not
mount content images, comments or favorite controls. Preference failures provide an
explicit retry rather than displaying stale content or treating failure as empty.

Application discussions/reviews, quick discussion dialogs, release notes, HTTP
health and application timelines now use a host-owned reader around the same
overview application service. It binds results to the exact route and current
preference choice, and clears parent metadata before opening child reads. Loading,
preference failure and hidden parents remove child views; child services cancel
their outstanding reads. Release cancellation includes previous-release reads,
and a cleared health selection cannot be restored by its periodic refresh. The
reader changes display eligibility only: owning APIs still enforce authorization
and canonical public visibility. Private staff and authoring workflows remain
independent. Individual activity classification follows the feed read contract
below; a suite keeps its own approved classification inside an application timeline.

This is a read/display integration: it adds no authoritative write, migration,
projection, outbox, worker or secret. Classification still comes from exact approved
publication revisions and never grants access or replaces canonical public eligibility.
Favorites now follow the read contract below. Profiles and notifications still
require complete integration; these views do not establish service-wide preference
enforcement.
Qualification is recorded separately in the implementation progress document.

### Home grouped previews

Home composes the same public-discovery port in API mode, with one request for
page one and at most three entries per application/article/suite group. Canonical
source totals remain unchanged when saved classification/category choices hide
entries. There is no refill scan. All-hidden groups retain counts and navigation.
The preview clears and cancels when the current session or relevant preferences
change, including a same-phrase search; late replies cannot restore old content.
Failed preference reads require retry. Demo mode is explicitly separate.

The discovery response adds optional `tagNames` for display: applications resolve
canonical taxonomy names, articles retain actual authored names, and suites have
none. Existing `tags` remain filter keys; they are never substituted as labels.
The strict response parser validates optional names, and a new consumer accepts
older responses without them. Older strict consumers reject this added field, so
upgrade portal consumers before the BFF or activate compatible versions together.
Rollback must retain a compatible consumer/BFF pair. This additive read contract
requires no authoritative mutation, migration, projection, durable intent, worker,
secret or additional backup dataset. Owning publication visibility, revision,
rebuild and tombstone rules remain unchanged.

### Individual Explore, Digest and timeline choices

The optional classification on an activity item comes from its current approved
application, article or suite publication. Releases, discussions and reviews inherit
their current application classification. Editorial rechecks release parent identity,
classification and taxonomy after its canonical page confirmation; Discussion
rechecks parent metadata after loading individual content and again after page
confirmation. A changed or unavailable parent fails the read. These checks use
owning-service authority, not a cached feed or a new classification projection.

`FeedChoicesService` combines the current authenticated session, completed saved
preferences and, only for personalized recommendation order, current favorites.
Explore, Digest and application timelines bind their read and displayed snapshot
to that choice. Session changes, same-account changes and preference failures clear
old content and cancel reads; late results cannot restore mismatched choices.
Preference failure requires an explicit retry, with no default-value fallback.

Filtering precedes category selection and ranking. Every consumer retains its
bounded source selection and continuation; an all-hidden page stays navigable.
Digest selects its four groups independently and exposes per-group hidden counts
only in the presentation selection. Its public transport remains `{items, more}`
for each group. Timeline composition retains each suite's own classification even
when application taxonomy is added for category filtering. Parent classification
also continues to guard the entire timeline and its identifying metadata.

This adds no authoritative write, migration, projection, journal, worker, secret or
backup dataset. Publication approval and materialization retain their existing
atomicity, immutable snapshots, revision checks, tombstones and rebuild protocol.
The optional activity field is additive: new consumers accept older unclassified
responses, but older strict consumers reject responses containing the new field.
Upgrade feed consumers (including BFF and Discussion's shared readers) before
enabling the producing service versions, or activate compatible versions together.
Rollback requires a compatible consumer/producer set; the earlier classification
writer-fencing requirements still apply. Qualification and its limitations are
recorded separately from this contract in the implementation tracker.

### Favorite content choices

Saved favorites remain canonical account-owned references. Their display metadata
comes from the existing public application, article, suite and discussion selection
ports. Applications/articles/suites carry their currently approved classification;
discussion favorites inherit it from the current public parent application lookup.
Strict transport parsing rejects malformed classification. Missing classification
stays unclassified. Missing or withdrawn targets remain unavailable references.

API metadata reads require completed preferences for the current session and the
same canonical account as the favorites snapshot. Independent service session
counters are not compared with one another. Account/preference changes cancel old
reads, and displayed snapshots also check current choices synchronously. An
unavailable preference read hides metadata until explicit retry; no permissive
default or demo fallback applies. Explicit demo mode remains separate.

With mature content disabled, excluded favorites retain only their kind, ID and a
generic hidden label. They have no title, image or target link. Removal continues
through the ordinary authorized, revision-bound Account command, including during
preference or metadata outages. It never depends on the visibility of a read
projection. Both the favorites page and its sidebar consume the shared view; type
filters count only the hidden entries in the selected group. No replacement-page
scan or new public content source is introduced.

This read/display integration introduces no authoritative write format, migration,
projection, outbox, worker, secret or backup dataset. Existing selection APIs still
enforce canonical public visibility and exact projection revisions; publication
approval, immutable snapshots, retries, tombstones and rebuilds remain unchanged.
Deploy the compatible selection APIs and classification writers described above
before enabling the portal integration. Account is also a strict selection consumer:
an old Account binary rejects the added classification field and cannot save newly
classified targets. Build and activate compatible Account consumers before the
producing APIs (or coordinate activation), and preserve that set on rollback.
Qualification evidence and limitations are
recorded separately in the implementation tracker.

### Public catalog composition

`GET /api/catalog/discover` composes the existing application, article and suite
public readers. It adds no writes or materialization intent. SQL remains the source
of eligibility, tenant scope, approved publication, counts and ordered IDs/revisions.
Every owning reader selects before reading exact projection revisions and compares
the canonical selection afterwards. A private edit, stale projection or public
withdrawal therefore cannot grant public access through Discover.

The request bounds every group to 1-100 items and page 1-10,000, with a search up to
100 characters. Each selected source is called once; an out-of-range article/suite
page can receive one bounded correction. A changed total during correction fails.
There is no full-catalog fetch, unbounded scan loop or application-side imitation
of source search. Application source requests retain their 15-second/16-MiB limits;
publication requests use 15 seconds/2 MiB and reject redirects. SQL selectors retain
their execution limits and bounded parallel projection reads. Missing or malformed
source evidence fails the entire BFF response with 503 and no-store; genuine empty
selections return successful empty groups. Inputs never select a tenant or owner.

Each group is a current source snapshot, not a distributed snapshot across all
groups. Publication replacements and withdrawal can change pages between requests.
Result validation checks kinds, identities, destinations, pagination and exact
page cardinality. Application description previews are capped at 1,000 Unicode
code points. No synthetic ratings, comments or authors are added.

API-mode portal composition uses a feature port and clears results on route,
session, preference loading/failure and source failure. Category exclusions act on
the bounded displayed page; source totals are preserved and hidden counts are
shown. Display preferences affect view, date and page size. These presentation
choices never authorize access. Mature classification follows the canonical reviewed
publication contract above; no classification is inferred from taxonomy.

Recovery uses the existing authoritative publication snapshots, outboxes,
monotonic projections and tombstones. A BFF restart holds no durable search state.
Deploy updated Editorial publication readers, BFF and portal together: older
readers reject the new explicit size/order parameters, so mixed rollout fails
unavailable rather than serving a partial or fixture result. No new migration,
secret, broker or backup dataset is introduced. Existing publication backup,
writer-fencing and compatible rollback requirements still apply.

Local qualification covers real SQL/Mongo/OPA, actual publication commands,
projection loss/rebuild, stale replay after withdrawal, compiled service restart,
independent browsers and six inspected layouts. Direct materializer execution and
trusted ingress/shell fixtures are explicit substitutions. Deployment, restore,
rollback, load/soak and broker delivery remain independently unverified.

## HTTP application health: durable observations without a projection

The reliability domain defines measured endpoint states, five-minute slots,
fifteen-minute staleness and thirty UTC calendar days of coverage. Only HTTP checks
are supported; owner-authored notices are excluded by the confirmed product policy.
The portal describes actual response evidence rather than inventing internal
database/storage health or continuous uptime. Successful slow responses count as
available; unknown and missed samples count as neither uptime nor outage. Sampled
availability always appears beside measured/expected interval counts.

Editorial owns `health_monitors`, immutable `health_monitor_versions` and
`health_observations`. Configuration and its immutable version commit in one SQL
transaction, with application-before-monitor locking, expected application/config
revisions, an eight-definition limit and the existing identity write barrier.
OPA allows configuration only for same-public-tenant staff with `admin` or
`editorial:health-manager`. Endpoints must share the current approved application
website origin. Private drafts and read projections cannot authorize a target.

Enabled canonical monitor rows are durable scheduling intent. The default-off
worker (`EDITORIAL_HEALTH_MONITOR_ENABLED=true`) requires the exact OPA service
identity `wapps-health-monitor`, tenant `health` and role `health:monitor` before
enumerating a bounded batch. A monitor/configuration/slot primary key serializes
claims. Leases expire after twenty seconds, with at most three attempts per slot.
Only the current lease can commit a result. Duplicate identical results converge;
different evidence, superseded/expired leases, changed configurations and current
parent withdrawal reject the write. A failed monitor does not starve the remaining
batch. Unfinished slots can retry; missed intervals are never measured retroactively.

The HTTP adapter resolves a credential-free, standard-port hostname, rejects
private/special addresses, pins one validated address and uses bounded DNS/request
timeouts. It follows no redirect and consumes no response body. HTTP 2xx is responding
or slow at two seconds; other 4xx/5xx is a failed check except 401/403, which remains
unknown. Redirects and DNS/transport/certificate errors remain unknown; a ten-second
request timeout is a failed check. There is no public result-ingestion endpoint or
production private-network bypass.

Public `GET /api/catalog/application-health/:slug` reads current-generation samples
from a repeatable SQL snapshot. It also retains the latest older sample to distinguish
stale from never observed. Current public application reads occur before and after
the health read; missing parents return 404, while changed/unavailable authority or
inconsistent evidence returns 503. BFF and portal adapters validate the complete
bounded report. Responses are no-store. The page cancels old-route requests and
refreshes each minute, clearing previous evidence on refresh failures. Its state is
public, with no account-owned health history or author identity.

This workflow adds no projection, outbox or broker. Summaries are computed from
canonical samples; configuration edits begin a new measurement generation. The
additive `HealthObservations1791840018000` migration validates table shape, indexes
and parent/version relations, refuses recorded table loss and refuses destructive
rollback. Restart resumes scheduling from SQL. Backups must preserve all three
authoritative tables together: lost observations cannot be reconstructed from the
current endpoint. Roll back serving binaries only with probing disabled and the
new tables retained. Production restore/rollback and egress qualification remain
mandatory deployment gates, separate from local workflow evidence.

Staff can read the current configuration and application revision through BFF
`GET /api/editorial/health-monitors/:applicationId`, then submit
`PUT /api/editorial/health-monitors/:applicationId/:monitorId` with exactly
`{expectedRevision, expectedApplicationRevision, name, url, enabled}`. New UUIDs use
`expectedRevision: 0`; edits use the returned monitor revision. Retry an uncertain
write with the identical ID and payload. Reload after 409 before making another
change. Disabled definitions remain reusable within the limit. Both local and alpha
gateways route the entire `health-monitors` family through explicit BFF handlers.
Ingress supplies authenticated identity; BFF verifies provenance and forwards only
the identity, roles and tenant to Editorial. Editorial retains OPA, canonical
parent/tenant checks, the identity-erasure write fence and transactional SQL authority.

The BFF rejects query selectors and extra/missing body fields. Commands are limited
to 8 KiB, owner responses to 32 KiB, and owner calls to ten seconds without redirects
or automatic retries. Configuration reads contain the current application revision,
approved website and at most eight unique monitors belonging to the requested
application. Historical monitor URLs remain visible if the approved website changes;
Editorial enforces the current origin on writes and probes. PUT receipts must match
the requested monitor/application, normalized fields and expected next revision.
Responses, including BFF validation errors, are private/no-store. Owner 400/401/403/
404/409/429 semantics are preserved with sanitized messages; unavailable dependencies,
malformed receipts and uncertain writes return 503. Identical historical replay can
return the original accepted revision without overwriting a later configuration.

Apply the migration and compatible OPA/Editorial/BFF/gateway versions before enabling
probing. Configuration/observations require no new external credential. The A23
staff BFF change adds no schema, worker, frontend or live activation change.

## Application timeline: current scoped public activity

API-mode `/apps/:appSlug/timeline` uses Catalog BFF
`GET /api/applications/:slug/timeline`, accepting only an optional opaque `after`.
The BFF resolves the current public application, passes its canonical UUID to the
existing Editorial and Discussion activity readers, merges their bounded pages,
then confirms the parent again. Missing/withdrawn parents return 404. Changed or
unavailable parents, source failures and eligible projection lag return 503 rather
than a partial or fabricated empty timeline. Responses are no-store.

Owning services validate `applicationId` at their existing authenticated/OPA
boundary and apply it in canonical SQL **before limiting candidates**. Applications
match their ID; releases, topics and reviews match their canonical parent; suites
match the approved publication's application membership. Private suite drafts never
determine membership or title. The public suite reader additionally confirms that
its current approved snapshot contains the selected application. Both sources
recheck the same scoped selection after I/O and retain exact revision/lifecycle
checks. Article records currently have no canonical application association.
HTTP observations use the separate health endpoint described above; neither
articles nor health observations are included in this timeline.

Timeline cursors use the existing encrypted 24-hour Explore cursor protocol with
additional authenticated data binding them to the canonical application UUID.
Cross-application and Explore/timeline cursor reuse fails. Default Explore cursor
keys and bindings are unchanged. A slug rename does not change application identity;
slug reuse cannot resume a previous application's timeline. Activation requires
compatible Editorial/Discussion/BFF binaries, existing Explore credentials/OPA and
configured public readers. The existing gateway BFF fallback covers this API path.

This is a selection of current public facts, not an immutable history of every edit.
It adds no projection, migration, outbox, queue or writer. Existing owners retain
their materialization, tombstone, retry and rebuild protocols; a timeline restart
needs no separate reconstruction. Cross-service reads do not claim one atomic
snapshot. Repairing source authority/projections and retrying restores availability.

The portal preserves bounded pages in its `activity` URL parameter and applies
saved choices within each page. The selected application's taxonomy is included
for all items, including suites, so category exclusions cover the whole timeline.
Popular/recommended order is page-local; personalization opt-out restores recent
recommendation order. Route/account changes clear prior state and cancel pending
responses. Mature classification and a complete event history remain outside this
read contract. Qualification and its local substitutions are recorded separately
in the implementation checkpoint and readiness tools.

## Digest: independent current public selections

API-mode Digest reads Catalog BFF `GET /api/digest`. It combines four independent,
bounded reads: the first Explore page (ten items), a discussion-only canonical
source scan (ten candidates), the newest catalog applications (ten items), and
the first public article page (twenty items). Each response group contains only
`items` and `more`. Caller query parameters are rejected. Private scan boundaries,
owner IDs and payload references never enter this contract. Responses are no-store;
any required source failure makes the whole Digest unavailable.

Discussion-only selection uses the existing authenticated Explore source endpoint
with optional `kind`. Owning application services validate allowed kinds, enforce
the existing service identity/OPA policy, select only that kind in canonical SQL,
read current public revisions and recheck the same selection after I/O. Both visible
items and hidden boundaries must match the selected kind. Omitting `kind` preserves
Explore's mixed selection. Existing application/article catalog readers retain
their authority and current-projection requirements; another member's public content
remains eligible, while private content and foreign tenant scope do not.

The portal applies saved category exclusions and selection-local ordering before
limiting display to three activity cards, two articles, two applications and one
discussion. It preserves real excerpts, bylines, covers and application metadata.
Known engagement and saved favorites/preferences affect order only inside these
bounded source windows. No global ranking, complete-catalog absence or mature-content
classification is implied. Empty states explicitly refer to the current selection.
Unclassified applications cannot match a category exclusion; taxonomy matching has
the same exact-value limitations described for Explore. Personalization opt-out
restores chronological recommendation order but does not disable popular ordering.

The read composition introduces no durable state, projection, outbox, migration or
writer change. Current authority controls visibility; missing revisions/projections
fail closed. Cross-service reads do not claim a single atomic snapshot. Recovery
retries the existing readers after their services/projections recover. Account
preferences and favorites retain their own durable commands and restart behavior;
Digest waits for the current account's saved choices and cancels held responses on
account or choice changes. Cover failure retains the article text/link and offers
an independent retry. Demo composition remains explicitly separate.

Activation requires the existing Explore secret/source URLs and compatible
Editorial, Discussion and BFF binaries before switching the portal. Older source
endpoints reject `kind` and therefore leave Digest unavailable. The local gateway's
`/api/` fallback and development API ingress already route Digest to Catalog BFF.
The new read path does not alter restoration or rollback of canonical data; existing
source migration, writer-fencing and materialization requirements still apply.
See the Digest qualification command and dated implementation checkpoint for proof
and exclusions. No deployment qualification is implied by this contract.

## Explore: current public activity without a new projection

### Rich card read contract (October 14, 2026)

Explore and application timeline items carry optional, strictly parsed `details`
discriminated by the existing item kind. Current producers populate it from the
owning public readers: application descriptions, images and named taxonomy;
reviewed article bylines, excerpts and immutable cover references; approved suite
descriptions and current public member previews; published release descriptions
and changes; public review attribution, text and rating; and discussion opening
posts/reply excerpts. No private owner ID, profile audience data, moderation flag
or mention association enters this preview. Erased authors retain the owning
service's anonymized public byline. Missing images remain absent.

Preview work is bounded to four suite members, five release changes and three
discussion posts; totals retain their authoritative meaning. Suite member
selection and release/community parent metadata are reconfirmed before returning
the source page. Canonical publication revisions, visibility, tombstones and
projection-lag failures remain enforced by the existing public readers and index
confirmation. The BFF reads actual public review summaries for selected application
cards, then rechecks application identity, revision and classification. An unavailable
summary or changed application fails the page instead of supplying zero ratings.
Cross-service observations remain separate reads, not a distributed snapshot.

The portal uses the original content-specific card compositions and host-owned
navigation. Published article covers use the existing protected blob reader,
retry and object-URL cleanup. Suite previews apply the current account's mature
content choice to each member without changing the collection count or refilling
the preview. Explore, Digest and timeline selection preserve account/choice
cancellation. There is no demo metadata fallback or local vote substitute.

This is read composition only: no write-model, materializer, migration, outbox,
queue, new secret or backup dataset is added. Existing rebuild and replay rules
remain unchanged. New consumers accept older responses without details and show
an explicit unavailable preview; older strict consumers reject the new field.
Upgrade compatible portal/BFF consumers before enabling Editorial/Discussion
producers, or activate them together. Rollback must retain compatible contracts.
The BFF uses its existing `DISCUSSION_URL` for public review summaries. Local
qualification and deployment limits are recorded in the implementation tracker.

### Existing selection and recovery protocol

Explore composes existing public facts from Editorial and Discussion. The owning
services select canonical SQL candidates in their configured public tenant, then
use existing public readers to require current visibility and exact materialized
revisions. Applications, approved suites/articles, published releases, public
application topics and member reviews are eligible. Private drafts, replies,
comments and unobserved health events are not feed items. Retained public content
remains eligible after author erasure; the response carries no author identity.

Each source selects at most eleven ordered candidates and resolves ten. Editorial
uses application update time, article publication update time and suite/release
publication time. Discussion uses topic/review creation time. The tie-breaker is
`kind:UUID`. SQL selection is repeated after content reads; Discussion also confirms
all visible parent metadata after the page loads. Selected legacy applications
without verified canonical revisions, projection lag/corruption and dependency
failures make the page unavailable. Current canonical withdrawal hides content
despite stale projections. These checks observe current state, not a transaction
or immutable snapshot spanning both services and successive page requests.

Catalog BFF merges against the earliest unfinished source boundary so a page of
hidden Discussion candidates cannot skip older visible items. An empty page can
therefore still have a continuation. Internal boundaries may identify hidden
content and are never sent in plaintext: BFF seals them with AES-256-GCM, a
purpose-derived key, random nonce and a 24-hour expiry. Cursors use version `e1.`;
tampering, expiry or key rotation requires refreshing the feed. There is no
eligibility cache or partial success when a required source is unavailable.

No new write model, projection, migration, outbox or queue is introduced. Existing
content writers/materializers retain their revision, tombstone and rebuild
protocols; Explore never materializes on demand. Recovery consists of restoring
the owning service and repairing its existing authority/projections. Feed restarts
need no separate rebuild. Account preferences and favorites remain canonical in
Account and continue through their existing export/erasure protocols.

Public `GET /api/explore` returns `{items, after}` with at most ten items. Internal
`POST /api/internal/explore` accepts `{after}` under the dedicated
`x-explore-reader` credential and exact `wapps-explore-reader` identity,
`explore:reader` role and `explore` scope. Each OPA action is limited to its owning
service's `explore` resource. Caller identity/tenant injection is rejected.

Configure a matching, distinct `EXPLORE_SERVICE_SECRET` (32-128 URL-safe characters)
in BFF, Editorial and Discussion, update both generated OPA bundles, and configure
BFF `EDITORIAL_URL`/`DISCUSSION_URL` before activation. Kubernetes uses optional
`explore-service-secret`/`secret` in each service namespace; absent configuration
returns unavailable. Rotation invalidates outstanding cursors. No deployment or
readiness result follows from the static BFF health endpoint.

The portal replaces pages and preserves the opaque `activity` query on navigation.
Saved category exclusions apply per page; popular/recommended order is explicitly
within that chronological page. Popular uses real helpful marks/net votes;
recommendations use favorites, preferred categories and tags. Personalization
opt-out makes recommended order fall back to recent. Account changes cancel pending reads; unavailable
preferences/favorites never silently become successful defaults. Categories/tags
match exact stored values: applications and their community/releases supply
catalog IDs and slugs, articles supply authored text, and suites have no taxonomy.
Mature filtering remains unsupported until authoritative classification exists.

See the Explore qualification command in `tools/readiness/README.md` and the
implementation checkpoint for measured evidence and deployment limits.

## Discussion mention associations and inbox authority

Public application topics/replies and article comments accept up to ten distinct,
sorted public profile UUIDs in optional `mentions`. These are explicit public
references in the immutable structured payload, never credential IDs. Names typed
in free text do not create mentions. Account privately resolves each reference for
the current author using canonical profile visibility and approved-follower rules.
Unavailable profiles and self mentions produce no recipient intent. Public reads
retain the references; names are resolved on demand under the current viewer's
profile access. A hidden/deleted profile is displayed as unavailable.

Discussion checks exact durable command replay before remote recipient lookup.
For a new command, sorted identity barriers precede the aggregate lock. The SQL
transaction binds immutable content, advances the aggregate revision, retains the
command receipt and materialization outbox, and updates canonical mention
associations/intents together. An insertion failure rolls back the entire write.
Account lookup failure before commit returns unavailable; it never invents an
empty successful recipient resolution. A known receipt remains replayable during
that outage. The Discussion erasure barrier rejects stale resolved recipients.

`discussion_mention_notifications` contains one event per `(nodeId, recipientId)`
and one mapping per `(nodeId, profileId)`. Event IDs differ from node/root IDs, so
roots and replies support multiple recipients. Edits deactivate old associations
and reactivate only currently eligible mentions. Removing and re-adding a member
preserves the original event, delivery/suppression/read state and quarantine; it
does not notify that member again for the same post. This also avoids treating a
materializer replay or an unrelated revision as a new mention.

The Account worker claims a source event and resolves current canonical node/root
visibility, source erasure barriers, current Editorial parent access and current
Account profile audience. Discussion rechecks its source after remote reads.
Inactive/unregistered authors resolve to no recipients; service-principal failures
remain denials. Account checks its own lifecycle and saved in-app/Discussion
Mentions preferences before committing an exact delivered or suppressed receipt
in `identity_mention_notifications`. Only then is source work acknowledged.
An acknowledgement failure may replay the event but cannot duplicate delivery.

Both journals are canonical SQL authority, not disposable projections. Current
access also controls self-only ten-item inbox pages. Read acknowledgement is
idempotent and persists across sessions/restarts. Privacy changes, removal and
parent withdrawal hide entries even while old content projections remain. Remote
errors return unavailable. Canonical preference revision checks fence concurrent
changes. Both journals participate in private export without lease credentials
and in bounded account erasure; projection rebuilds cannot recreate receipts.

Claims consume attempts even when workers crash. Thirty-second leases, bounded
backoff and twelve-attempt quarantine retain recoverable work. Discussion maintenance
provides `--mention-status` and `--mention-requeue <uuid> --failed-at <timestamp>`;
requeue requires the exact inspected failure. Apply
`MentionNotifications1791864016000` and `AccountMentions1791864017000`, update both
OPA bundles and fence old discussion/erasure writers before activation. Configure
Discussion `ACCOUNT_MANAGEMENT_URL`, Account `DISCUSSION_URL`, and the same distinct
`NOTIFICATION_SERVICE_SECRET` in both services. Account
`MENTION_NOTIFICATION_WORKER_ENABLED` defaults to false; its inbox returns 503
while disabled, including when empty. Restore/rollback must preserve both journals,
associations and erasure barriers with compatible writers. Destructive down is
refused. Deployment, restore/rollback and load/soak remain separate gates.

## Favorite update subscriptions and inbox authority

Public application changes, approved suite/article snapshots, published releases
(on their parent application), and public discussion creation/reply/text edits
advance `content_update_cursors` in the same SQL transaction as the authoritative
write and required materialization intent. The per-target cursor never resets and
is independent of aggregate/projection revisions. Overflow aborts the transaction.
Private drafts, votes, likes, anonymization and projection replay do not advance it.
Several changes between observations deliberately coalesce into one update; this
is stated in the portal rather than represented as a complete event history.

Saving a new favorite captures its canonical source version before Account commits
membership and a fresh UUID subscription generation together. Removing it deletes
the watch; re-adding captures a new baseline/generation. Old receipts and leases
cannot reappear. Existing favorites migrate with an unknown baseline and establish
it on their first successful observation without historical notifications. An
already-applied migration refuses a lost watch instead of silently recreating a
baseline and losing pending updates.

The Account worker claims one watch, resolves current canonical public state through
the dedicated source API, then locks identity followed by subscription. An immutable
delivered/suppressed receipt and the new observed cursor commit together. Opt-out,
suspension and hidden content permanently consume an observed change; later opt-in
cannot revive that receipt. Deleted accounts cannot receive or recreate watches.
Thirty-second leases/poll intervals, attempt charging on claim, five-minute maximum
backoff and twelve-attempt quarantine bound recovery. Maintenance requires the exact
generation and failed timestamp to requeue, retaining the observed source baseline.

The inbox is canonical Account data, not a Mongo projection. At most ten items are
resolved per page, with current membership, generation, source visibility and
account lifecycle/preferences rechecked before response. Mark-read is self-only and
idempotent. Current hidden sources disappear despite old projections. Source errors
return unavailable; independent sessions, delayed responses and lost read responses
cannot disclose another account's inbox or fabricate success. Private export includes
watches/receipts without lease credentials; erasure removes both in bounded batches.

Apply `EditorialContentUpdates1791840017000`,
`DiscussionContentUpdates1791840018000` and `AccountFavoriteUpdates1791840019000`
before compatible writers start. They validate physical definitions and bounded row
pages and refuse destructive down. Update Editorial/Discussion OPA and provision the
distinct `NOTIFICATION_SERVICE_SECRET` in all three service namespaces. Favorite
creation needs both source APIs even while background delivery is off, so coordinate
this rollout with Account rather than activating incompatible versions independently.
Fence old public-content, favorite and erasure writers. Then enable Account
`FAVORITE_UPDATE_WORKER_ENABLED=true`; the default is false and the inbox returns
503 while disabled, including for an empty account. Restore/rollback must retain all
source cursors, subscription generations, suppression/read receipts and erasure
barriers with compatible writers. A projection rebuild must never recreate these
canonical decisions. Production activation/restore/rollback/load remain separate gates.

## Reply notification delivery and inbox authority

A new public application-discussion or article-comment reply records one notification
for its immediate parent author in the same SQL transaction as the reply, immutable
payload reference, aggregate revision, command receipt and projection outbox. Exact
command replay creates no second notification. Self replies, anonymous parents,
erased recipients and unbound/private conversations create no recipient intent.
Sorted identity barriers precede aggregate locks, including the optional recipient;
erasure prevents intent recreation without preventing a peer's otherwise valid reply.
The source event contains only IDs, revision and time, never copied names or text.

The Account worker pulls a leased event from Discussion using a dedicated service
credential and exact OPA identity/role/scope. It checks current Discussion and
Editorial visibility, then locks the canonical Account identity and checks its
lifecycle and saved in-app/reply preferences before committing an exact receipt.
Suppression is durable too: later opt-in or replay cannot revive a suppressed event.
Deleted/nonexistent accounts receive no receipt; their canonical lifecycle prevents
later recreation. An acknowledgement follows that durable decision. Lost responses,
competing workers and process restarts converge on the same event/receipt.

Claims consume attempts, including crashes before settlement. Leases last 30 seconds;
retry backoff is bounded at five minutes; twelve attempts quarantine the event.
Discussion maintenance reports aggregate counts and at most 50 failed IDs with
failure times. Requeue requires the exact ID and recorded `failedAt`, and refuses
stale, active or completed work. It rechecks current access/preferences on delivery.
The journal is retained authority, not a disposable Mongo projection: rebuilding
notifications from public content would lose suppression and read decisions.

Account serves self-scoped pages of at most ten receipts. Each read resolves current
source/parent visibility and rechecks canonical account lifecycle/preferences after
remote I/O. A lagging public parent projection returns unavailable until it can be
confirmed; it never grants access. Hidden/deleted sources disappear even if old
projections remain. Mark-read stores an idempotent account-owned receipt. Browser
pagination replaces the current page; refresh returns to latest, and session changes
cancel requests and clear all private state. No browser state grants permission.
Both journals participate in private account exports and bounded erasure cleanup.

Apply Discussion `ReplyNotifications1791840015000` and Account
`AccountNotifications1791840016000` through their explicit migration entrypoints.
They validate physical journal definitions and bounded row pages, resume compatible
partial installation, reject a missing applied journal, and refuse destructive down.
Fence older reply/account-erasure writers before enabling delivery; they do not know
the new durable intent/residual fields. Configure the same distinct 32-128-character
`NOTIFICATION_SERVICE_SECRET` on Account and Discussion, install both updated OPA
bundles, then set Account `REPLY_NOTIFICATION_WORKER_ENABLED=true`. The default is
off, and the inbox reports unavailable while disabled (including an empty inbox).
Preference opt-out remains an explicit disabled state. Kubernetes requires the
`notification-service-secret` Secret in each service namespace; provisioning real
credentials and activation are deployment work, not implied by local configuration.
Backup/restore and rollback must preserve both journals, permanent erasure barriers,
account preferences and compatible writers. No historical-notification backfill is
inferred from old replies. Favorite updates use the separate subscription protocol
above. Email, push, mentions and system notifications remain unfinished consumers.

## Account acceptance, completion and portal outcomes

Account `DELETE /api/me` commits the canonical identity tombstone, private Account
changes, credential-deletion work, cross-service erasure work and event intent in
one SQL transaction. HTTP 202 acknowledges that durable request. Credential removal
alone cannot complete erasure: Account, Editorial and Discussion must each return
their exact durable completion receipt before the Account coordinator completes its
own journal. Canonical cleanup status is `completed` only when both the credential
and cross-service journals have completed. A failed final coordinator write remains
retryable even if every participant has already finished; replay preserves their
original receipts and tombstone revision.

The API-mode privacy page verifies the current account, requires explicit consent
and the exact typed `DELETE` confirmation, then issues one authenticated self request.
Its application service depends on a port and is retained across page navigation;
the HTTP adapter loads lazily and validates the complete acceptance response, status
and expected identity. Browser state never establishes completion. The accepted
notice distinguishes pending cleanup from completed or failed cleanup. Demo mode
has no remote erasure provider or action.

A lost or invalid response is an unknown outcome: deletion might already have
committed. The browser does not automatically repeat DELETE. Recovery for the exact
session is held during this request, so a background 401 or an already-running token
refresh cannot replace the session or navigate away before the outcome is shown.
Accepted and uncertain outcomes clear only the originating session; delayed results
cannot affect a newer login. Sign-out storage failures are reported separately.
The notice survives the privacy page's guest branch and in-app page recreation, but
is not a durable receipt after a full browser reload. Normal authentication rejects
the deleted identity, including ordinary DELETE retries. Operators inspect the
canonical journals for final cleanup status.

This adds no browser-owned projection or authority. Existing SQL intent, permanent
barriers, anonymized complete projections and immutable-media retirement protocols
continue to govern cleanup. All participant activation, historical inventory and
writer-fencing requirements still apply; an accepted request does not prove that a
deployment has enabled or finished those phases. The complete local service/browser
workflow is now qualified in `accountErasureWorkflowCheckpoint`; deployment,
restore/rollback and load/soak remain unqualified.

## Production Editorial participant and durable completion

`EditorialModule` composes `CleanAccountErasureParticipant` with
`CleanEditorialAccount`. The service-only endpoint first establishes the exact
durable identity barrier/request, then advances canonical contribution anonymity,
private workspace/media cleanup, ownership/review audit cleanup, projection
confirmation and final SQL completion in that order. Each phase remains bounded.
`media-pending` stops progression until existing application-image/article-cover
workers record durable retirement; quarantined jobs require existing recovery.
An unavailable phase returns a retryable failure, never a completion receipt.

`EDITORIAL_ERASURE_WORKERS_FENCED=true` is an explicit rollout acknowledgement,
defaulting off. Invalid values fail startup. Apply all migrations through
`EditorialErasureCompletion1791840014000`, drain/fence older API and materializer
writers, configure revisioned Mongo write access, and enable
`EDITORIAL_MEDIA_CLEANUP_ENABLED=true` before activation. The flag does not itself
stop old binaries or verify a deployment. While disabled, requests establish the
barrier but do not erase data. Completed receipts remain replayable when disabled
or Mongo is unavailable. The lazy configured Mongo adapter now exposes the existing
publisher as well as reads; connection failure does not prevent canonical writes.

`MysqlEditorialErasureCompletion` locks the exact permanent barrier and request,
then checks all 36 supported SQL attribution/target fields through leading indexes.
This includes canonical/public owners, copied application/suite submission authors,
private drafts/workspaces/receipts, upload history, review/ownership actors and
projection targets. Only an empty result across all of them can atomically record
`completedAt` for the same request revision, never before `requestedAt`. No external
I/O occurs in this transaction. Concurrent final calls converge; a call overtaken
by completion rechecks the durable receipt before treating a phase failure as
completed. A failed completion write leaves the request pending for exact replay.

The additive completion migration supplies the three previously missing author
indexes for article publications and application/suite submissions. It validates
all columns and existing index definitions before DDL, resumes partial installation,
rejects missing/incompatible applied indexes and refuses destructive down. The
qualification inventory compares completion coverage against every owner/actor/
reviewer field in the physical Editorial schema and tests each residual independently.
Identity barriers/receipts, identity-free public snapshots, permanent ownership
history, media descriptors/retirement markers and object-cleanup journals remain
deliberately durable. Outbox projection messages carry resource/revision intent,
without their SQL audit actor attribution.

This closes local Editorial participant composition. It does not complete the
cross-service Account/portal journey or production rollout. Restore and rollback
must preserve these barriers, receipts, projection revisions, ownership history and
retirement guards with compatible binaries; deployment/restore/load qualification
remains open.

## Account erasure: Editorial projection confirmation

`EraseEditorialProjections` handles one `editorial_erasure_resources` target per
call after canonical author anonymization. It uses the existing complete-snapshot
reader and monotonic Mongo publisher. This deliberately performs materialization
inside the cleanup workflow: the canonical anonymity transaction already committed
the revision, outbox event and exact cleanup target, and broker delivery alone
cannot prove removal of a stale byline. The ordinary outbox worker can deliver the
same intent concurrently or later without changing the result.

`MysqlEditorialProjectionErasure` locks the exact pending identity barrier/request,
requires that no canonical ownership remains for that identity, and selects one
target. It validates the target's minimum revision and anonymous or subsequently
transferred authority. The complete SQL snapshot is read separately, then published
with the existing majority/journal write and revision comparison protocol. Cleanup
reads the actual document back from the primary with majority read concern and
validates its complete schema, fingerprint, tenant, resource and revision. A
publication result without matching durable readback cannot acknowledge the target.

A second SQL transaction takes the same barrier and lifecycle locks. Only an exact
unchanged revision, scope, deletion state and target may remove the target. Mongo
I/O never runs while holding these SQL locks. Concurrent successor edits, a newer
publisher or a lagging/missing read retain the target for another bounded pass.
Ahead-of-authority documents stay pending; corrupt, foreign or same-revision
conflicting documents fail closed. The cleanup does not repair those inconsistencies
by overwriting newer data. A crash after Mongo success but before SQL deletion
replays safely; duplicate workers can confirm the already-removed exact target.

Editorial schema 1 has one stable document per kind/resource in
`editorial_projections_v1`. It contains no owner identity; the structured author
attribution is the article byline. Replacing the stable article document removes
its obsolete byline while preserving reviewed public text. Durable tombstones and
revision comparisons prevent an older publisher from restoring it. There is no
multi-generation Editorial copy format in the current or baseline source contract;
Discussion's separate legacy-collection purge is not applicable. Arbitrary personal
details in user-authored public text are retained under the confirmed public-content
policy, rather than inferred and rewritten by this cleanup.

`drained` means the canonical target queue is empty, not that the account is erased.
Private workspaces, media retirement, audit cleanup and the final SQL residual check
must also finish under the permanent identity barrier. Production composition is
described above; the complete local Account/portal workflow is now qualified, while
deployment writer fencing remains a separate requirement. No additional schema migration is introduced
by this projection phase.

## Account erasure: Editorial ownership and review history

`MysqlEditorialAuditErasure` implements the `EditorialAuditErasure` port after
canonical anonymity and private workspace cleanup. It locks the exact pending
identity barrier/request and cannot advance while canonical ownership, an owned
draft or a private workspace remains. Every call removes one owned claim, at most
128 receipts/checks/outbox actors/workspaces, or one peer review attribution.
Claims retain their bounded proof/command history until those batches drain;
claim, matching revoked grant and bounded decision history then disappear together.
A later owner's grant, claim, content and authoring authority remain unchanged.
Delayed verification completion and old command replay still encounter the permanent
identity barrier before they can restore erased private data.

Other members' submission/ownership decisions keep their original status, reason,
content, revision and review time. Only the departing reviewer's identifier is
removed. A nullable reviewer/actor plus explicit `reviewerErasedAt`/`actorErasedAt`
records intentional anonymity; its timestamp cannot precede the review. A latest
ownership decision and its claim change atomically and must retain matching actor
and erasure timestamp. An old approval followed by another staff member's revocation
only loses the old approval's actor. Anonymity never rewrites an old decision as a
system action. Undecided reviews cannot carry erasure stamps. Ordinary peer draft
deletion removes these columns together with the submission, without another registry.

`application_ownership_history` permanently retains only the application ID, tenant
and earliest recorded approval time. It contains no identity, claim, proof or
reason. Grant approval records it atomically; erasure requires it before deleting
historical claimed ownership. Its presence permanently disables unbound authoring,
including after the last private revoked grant disappears. New domain proof and
independent approval can still establish a fresh claim-bound grant.

`EditorialAuditErasure1791840013000` validates binary transactional authority and
physical ordered/visible indexes before DDL, adds explicit erasure columns and
indexes, makes decision actors nullable, and backfills permanent history in batches
of 128 grants, using all surviving approval decisions so legacy transfers cannot
hide an older grant's timestamp. An interrupted installation resumes from committed data. Applied
history/index/stamp loss or inconsistent attribution fails closed. Successful
reentry performs no DDL. Predecessor validators understand intentional anonymity;
application/suite publication and ownership index checks read MySQL's explicit
index order instead of relying on ORM enumeration.

This phase changes no public snapshot/revision and creates no materialization event.
Outbox records keep their revision, operation and delivery metadata while losing
the erased actor. Apply the additive migration explicitly and fence older ownership
and review writers before activation. Coordinated backup/rollback must retain the
identity barriers, migration ledger, permanent ownership history and erasure stamps;
destructive down migration is refused. `drained` does not prove projection completion
or complete the Editorial participant. The composed participant above owns those
steps; the complete local Account/portal workflow is qualified separately in the
workflow checkpoint. Deployment activation remains unqualified.

## Account erasure: Editorial private workspaces

`MysqlEditorialWorkspaceErasure` implements the `EditorialWorkspaceErasure` port.
Every call locks the exact pending identity barrier/request and refuses to remove
private history while any canonical Editorial resource still belongs to that
identity. It handles application, suite, article and release workspaces across all
tenants. Binary identity comparisons preserve case-distinct accounts.

Each transaction handles one owned draft or at most 128 command/workspace rows.
It first drains and tombstones every live owned draft before deleting any uploader
history. This prevents an image shared only between that account's private drafts
from becoming an unattributed orphan when its last private reference is removed.
For a draft it drains at most 128 command receipts or submitted revisions, keeping
application submission-image pairs together and the article's latest-submission
cover reference until that submission is removed. The private application
publication marker is removed before its submitted source. Canonical application,
suite, article and release content, public media associations, lifecycle revisions
and outbox records are unchanged. Private drafts become valid tombstones only
after submissions are gone; private media references disappear with that change.
The remaining empty draft and editing target are removed after upload cleanup.
Staff receipts about peers' drafts are removed separately; their actual decisions
remain for the ownership/audit erasure phase.

Media cleanup handles one upload per call under upload/registry/job locks. A live
referenced image keeps its exact immutable descriptor and bytes while private
uploader history is erased. Unreferenced pending/ready uploads are cancelled with
permanent registry guards and durable `draft-deleted` cleanup jobs in the same
transaction. A cancelled upload cannot lose its private history until the existing
cleanup worker confirms durable object retirement. Object success without a SQL
receipt remains `media-pending`; failed/quarantined jobs remain pending for existing
operator recovery. Metadata validation rejects mismatched ownership/descriptors,
missing guards and conflicting references. Reservation, bounded processing attempts
and cancellation limit valid media receipts to twelve; a capped read rejects larger
histories before atomic removal. Permanent SQL guards and empty object markers
remain after private rows disappear, fencing delayed uploads.

`EditorialWorkspaceErasure1791840012000` adds owner/parent indexes for bounded scans.
It verifies transactional, binary identity/parent keys, nullable unsigned deletion
timestamps and full, ordered, visible nonunique indexes before DDL; interrupted additive installation can resume,
while missing or incompatible applied indexes fail. Apply it with explicit
`--migrate` after the registry migration. Older writers must be fenced before
activation. A rollback must preserve identity barriers, retained canonical content,
registry guards, cleanup journals and migration history with compatible binaries.

This private SQL workflow deliberately emits no additional materialization event.
Canonical anonymity already commits revision/outbox/target intent; these private
records are not public projection authority. The permanent identity barrier fences
new writes and old command replays after receipt deletion. `drained` only describes
these private workspace tables. Ownership claims/proofs and review attribution,
projection completion and the final residual check are separate phases of the
composed participant above; private cleanup alone cannot complete a receipt.
The complete local Account/portal journey is qualified in the workflow checkpoint;
its production rollout remains unqualified.

## Account erasure: retained Editorial media

`editorial_media_assets` separates immutable normalized byte descriptors from
private uploader history. A key consists of media kind and image ID; its live row
holds tenant scope, optional exact article scope, normalized metadata and creation
time. It contains no uploader identity or source-image digest. Application images
can be shared by approved publication and a legitimate successor's editing draft.
Article covers remain bound to their exact canonical article.

Upload completion records this descriptor in the same SQL transaction as ready
upload state and the processing receipt. Immutable object storage precedes that
transaction: SQL failure can leave unreferenced bytes, and the same command retries
against those bytes without overwriting them. All new references and retirement
serialize on the registry row. Retirement clears the descriptor and permanently
retains the key/timestamp together with the cancelled private upload and durable
cleanup intent. Existing S3 empty markers prevent delayed uploads from recreating
retired bytes. An immutable registration cannot revive a retired registry key.

Public reads first validate the current canonical tenant/visibility/association,
then resolve the live descriptor. They no longer need private upload rows. Inherited
application previews/submissions use their authorized draft association; direct
private image selection still requires the caller's own upload in that draft.
Article private review references continue to require the owned upload. Export
binding metadata uses the registry; private upload/source/byte exports remain
limited to the uploader. Object reads retain their subsequent visibility check.

`EditorialMediaAssets1791840011000` follows canonical author erasure. With writers
and cleanup workers fenced, explicit `--migrate` validates both legacy upload
families, association completeness and retirement intent before DDL, then backfills
in transactional pages of 128. Ready uploads create live descriptors, cancelled
uploads create permanent guards using the cleanup-intent timestamp, and pending
uploads have no descriptor. Interrupted pages retry immutably. Applied-schema,
index or descriptor loss and inconsistent references fail closed; destructive down
is refused. Earlier association validators recognize registry authority after this
migration, including assets whose original private upload no longer exists.

This representation change produces no projection event: content, URLs, references,
public revisions and payload bytes are unchanged. Existing publication/erasure
outbox contracts continue to govern content changes. Back up the registry and
retirement guards together with references, cleanup intents and migration history;
rollback requires compatible binaries or a reviewed forward migration. Old binaries
that register uploads without descriptors must not run after activation.

Real SQL/Mongo/OPA/MinIO qualification covers both HTTP uploads, injected descriptor
failure/retry, independent approval, ownership transfer, canonical anonymity,
retained public/inherited bytes after fixture removal of private history and API
restart. Migration recovery covers 262 descriptors/guards across multiple pages.
The compiled public article portal decodes the real cover at three widths in both
themes and an independent session. Discussion comments remain unavailable in that
harness. Production private-workspace removal, ownership/audit cleanup, projection
confirmation and the composed Editorial participant are now qualified above.
Registry-only orphan retirement is qualified below.

### Retirement after private upload erasure

The existing application-image and article-cover cleanup stores also scan live
registry assets with no private upload, no retained reference and a creation time
at least seven days old. This preserves the existing unused-media policy. Scans and
transactions are bounded; retirement rechecks eligibility after locking the
optional upload and registry row. A reference committed while cleanup waits on that
lock prevents retirement. Once retired, stale descriptors cannot create references.

Clearing the descriptor and creating the ordinary cleanup job is one SQL
transaction. Cleanup claims lock optional upload, registry and job in that order.
They require the matching permanent guard/time and no current reference; any
remaining private row must also agree with that guard. Missing authority or a
reference conflict quarantines the job before object I/O. A missing private upload
alone is no longer an error. Existing eight-attempt retry, lease takeover, explicit
requeue, empty object markers and recovery after object-success/receipt-loss apply.
Earlier cleanup migrations validate registry authority after the media migration
while continuing to validate every private row and receipt that remains.

No new schema or materialization event is needed. An eligible orphan has no public
or retained private association; reference removal retains its existing publication
contract. Live referenced images remain unchanged. Both compiled maintenance
commands and the existing opt-in runtime workers use these updated stores.

Real MySQL/MinIO checks qualify both media kinds, age/batch boundaries, rollback,
controlled reference concurrency, lease takeover, receipt failure, quarantine,
requeue, migration reentry and compiled maintenance. Public/inherited bytes and
12 compiled article layouts remain valid after cleanup. Additional orphan records
and the held in-flight reference are SQL fixtures; retention/lease time is advanced
in the harness, while compiled maintenance uses the actual clock. The composed
Editorial participant above has separate local qualification; production rollout
and the complete Account/portal journey remain open.

## Account erasure: Editorial canonical anonymity

`MysqlEditorialContributionErasure` is a bounded persistence phase behind
`EditorialContributionErasure`. The composed participant invokes it before private
cleanup; this phase cannot itself issue a completed receipt. Each invocation locks the exact
pending identity barrier/request, then processes at most one owned canonical
application, category, tag, suite, article or release. Content locks precede the
lifecycle lock, matching normal publishers; ownership is rechecked after both.
A concurrently approved new owner is preserved. All tenants for the erased
identity are covered; case-distinct and unrelated identities are untouched.

The transaction sets canonical ownership to SQL `NULL`, advances its monotonic
revision, inserts actor-free durable outbox intent and records the exact required
projection revision in `editorial_erasure_resources`. Existing deletion times and
tombstones remain. Articles also replace the approved byline with `Deleted account`
while retaining text, slug, cover reference and publication timestamps. The domain
parser allows 14 additional serialized characters only for that exact byline, so
replacing a one-character attribution in a maximum-sized legacy article never
truncates retained text or makes its snapshot invalid. There is no fabricated owner.

For an active application ownership grant, the same transaction validates its
approved claim, revokes grant and claim and appends a system `revoke` decision with
the account-erasure service principal and a fixed reason. Any outbox, target or
decision failure rolls everything back. A later independent proof/approval can
grant ownership again. Retained audit/command history remains private pending the
next cleanup phase; profile activity excludes an identity with an erasure barrier.

Current canonical visibility/revision checks hide an old attributed Mongo article
until a complete anonymous snapshot is materialized. Higher revisions supersede
old snapshots, including tombstones. Public article selection accepts matching
null ownership without depending on a private draft. Public cover reads still need
the exact live article/image association and tenant, but no longer depend on an
erased uploader being the current public author. Private submission reads keep
their owner checks. This phase retains projection targets; a later phase must
confirm their completion and drain private/audit/media data before erasure finishes.

`EditorialAuthorErasure1791840010000` follows the suite snapshot migration. It makes
canonical owner and outbox actor columns nullable, adds the bounded owner index
and installs durable projection targets. It validates canonical content in pages
of 128 before DDL, checks transactional/case-sensitive storage and physical index
order/prefix/visibility, and resumes interrupted MySQL DDL. Applied-schema loss and
invalid target/request/revision relationships fail closed. Legacy migration reentry
recognizes the applied schema and retained anonymous authority; destructive down
is refused. Fence old writers and run explicit `--migrate` before activation.
Keep migration history, null ownership, revisions, targets, permanent barriers and
all new outbox rows in coordinated backups. Rollback needs compatible binaries or
a reviewed forward migration; restoring attributed projections alone cannot undo
canonical erasure. Actual production fencing/restore/rollback remains unqualified.

Real MySQL/Mongo/OPA and compiled HTTP checks cover all six kinds, rollback,
concurrent workers, exact requests, restart, new ownership during selection,
stale projection rejection and interrupted migration recovery. Public article
browser checks cover lag/anonymity/restart in independent sessions and both themes
at three widths. Domain proof and ready cover metadata/receipts are controlled
fixtures; media bytes and Discussion comments are outside this browser check.
No complete Editorial or cross-service erasure is claimed.

## Account erasure: canonical write barriers

The erasure policy retains public contributions with anonymized attribution,
removes private data and ends ownership access. Its write-barrier prerequisite is
implemented and locally qualified. Account orchestration now atomically records
pending requests with each service barrier and requires every matching completion
receipt. Account and Discussion cleanup now have locally qualified participant
completion. Editorial now also has locally qualified composed cleanup and final
completion. The enabled Account/portal cross-service journey now passes local
qualification, including final coordinator-journal failure and process restart.
Production activation and recovery qualification remain open.

Each owning service has its own authoritative `identity_erasure_barriers` table.
It is not an identity projection and does not consume eventual identity events to
grant access. Writers insert/lock a case-sensitive identity row and check its
permanent erasure marker in the same transaction as their canonical changes,
receipts and existing durable intent. All identity locks precede resource locks;
commands involving both staff and an author acquire both identities in sorted
order. Ordinary command replay must take the barrier too. Review transactions
carry their authenticated actor explicitly into the adapter.

Beginning erasure takes the same lock and stores the Account deletion revision
and first local request time. An earlier writer finishes before this marker can
commit. A later or queued writer observes the marker and is denied before
changing data. Failed erasure transactions roll back the marker. Retries of the
same deletion revision preserve its cutoff; a different revision conflicts.
Markers are minimal retained lifecycle authority and must never be removed by
private-data cleanup, projection rebuild, or restoration from an older projection.
They are stored independently per service, not as a distributed snapshot.

No public content changes in this prerequisite, so no new projection/outbox event
is needed for the barrier itself. The later erasure participant must separately
commit canonical anonymization/tombstones, monotonically advanced revisions and
required durable intent atomically, enforce current anonymity during projection
lag, retire replaced immutable bytes durably and account for in-flight uploads.
A committed barrier alone is not successful cleanup and cannot acknowledge a
completed account-erasure request. Account coordination uses a separate durable
journal from credential cleanup; both must complete before overall cleanup does.
The request and barrier commit together. These SQL-only control records do not
change public content and need no projection event. Pending work defers normally;
outages retry with bounded backoff and quarantine, without resetting completed
participant receipts. Account now records completion for its own private-data
cleanup. Discussion now composes its phases and can issue a durable completion
receipt after the activation prerequisites and cleanup below; Editorial remains pending.

`IdentityWriteBarrier1791840000000` runs explicitly in Editorial and Discussion
maintenance before updated API startup. It validates schema and stored states in
bounded batches and refuses a destructive down migration. Mixed writer versions
are unsafe after erasure activation because old binaries bypass these locks.
If migration history records this migration but its barrier table is absent,
maintenance refuses to recreate an empty table; retained markers must be restored.
Activation and any rollback require all owning-service writers to follow this
contract; the current checkpoint does not authorize or qualify that rollout.

## Discussion: durable immutable upload registration

Ordinary Discussion create/reply/edit and the explicit legacy importer now use
`RegisteredDiscussionPayloads`. An application port durably reserves the exact
node/key/hash/byte length and tenant/owner/actor before the object adapter performs
the conditional immutable PUT. A second barrier-protected transaction confirms
the upload. The canonical content transaction accepts only that exact uploaded
reservation and commits its state with the mutation, command receipt, aggregate
revision and existing materialization outbox. Sorted owner/actor locks precede
resource locks. A lost upload response or failed SQL commit leaves attributable
reserved/uploaded bytes; neither condition publishes partial canonical content.

`discussion_payload_objects` is authoritative storage bookkeeping, not a public
projection. Its reserved/uploaded/committed transitions need no extra outbox;
the ordinary content mutation retains its existing materialization intent.
`DiscussionPayloads1791840004000` also installs the complete payload-key lookup
index, validates retained registry records/current references and backfills only
provable current canonical owners. Imported or migrated uploaders remain null.
Applied-but-missing schema or references fail closed, and destructive rollback
is refused. Legacy writers must be stopped before the migration/updated writers
are activated; old binaries do not register uploads.

`RetireDiscussionPayloads` is a locally qualified cleanup primitive, composed
into the production participant below. It claims at most 32 obsolete objects
under the exact pending service request and permanent owner barrier, excluding
every currently referenced key. The durable retiring state survives an object
failure. MinIO writes an empty permanent marker with an ETag conditional replace,
or an absent-key conditional create; ordinary immutable PUTs cannot overwrite it.
It retries at most three conflicts with a shared 20-second deadline. SQL confirms
retirement only after the marker operation and another reference check. A paused
upload either precedes that marker or fails afterward; it cannot resurrect bytes.

Retirement requires a dedicated unversioned bucket. Enabled and suspended
versioning are refused, because replacing current bytes would retain old object
versions. Never remove retirement markers through lifecycle rules or cleanup,
and do not change bucket versioning while retirement is active. Real qualification
uses unversioned MinIO; versioning refusal is separately unit-tested. Rollout,
bucket policy and backup/restore behavior remain deployment work.

The primitive returns a progress count and cannot complete account erasure.
Unknown historical/uncommitted objects and legacy mutable keys now have the
reviewed inventory described below; deployment inventory remains required.
Registry owner/actor attribution, private/audit rows, canonical public
authors and payload display names still require cleanup/anonymization. Registered
payload history now has export coverage as specified below. Public-author
changes must later commit revisions/outbox atomically and protect current reads
during projection lag. No such change is claimed by upload registration alone.

## Discussion: canonical contribution anonymity

`AnonymizeDiscussionContributions` now advances one owned node per call under an
exact pending erasure request. It requires the permanent owner barrier and a
completed historical-payload inventory. It returns progress, never a completion
receipt. The production participant composes it with the remaining phases below.

Published public/unlisted contributions beneath a published nonprivate root retain
their stable IDs, authored content, relationships and other members' replies. The
new immutable payload drops envelope metadata and the structured display name;
public presentation supplies `Deleted account` from current null ownership. This
keeps the label out of stored payload-size accounting. Nonpublic/deleted nodes lose
their pointer and become structural tombstones. Authored text is retained verbatim;
this is attribution removal, not a search/redaction of names inside authored prose.

The internal `anonymizing` reservation binds node, tenant, erased owner, deterministic
object key, hash and size before PUT. Its actor is null. Ordinary payload reservations
still require a non-null owner and ordinary write authority. A failed or ambiguous
PUT can replay exact bytes. If another worker finishes before reservation, the
application receives no reservation and performs no PUT. A reserved copy is excluded
from retirement while its canonical node still belongs to that owner; after another
worker tombstones the node, the obsolete copy can be retired normally. This prevents
both unregistered late uploads and retirement racing a necessary anonymous copy.

Canonical commit locks the owner/request before the aggregate, then uses current
locking reads for node/root revalidation. Earlier repeatable-read inventory snapshots
cannot hide a concurrent moderator deletion. Commit atomically clears ownership,
commits the anonymous registry reference (or clears a private pointer), advances the
current aggregate revision, records a projection-cleanup target and appends the
outbox intent. Unrelated replies can advance the aggregate while copy I/O proceeds;
the cleanup preserves them and increments that latest revision. Legacy serialization
that would exceed aggregate bounds fails before any canonical publication.

`DiscussionAuthorErasure1791840006000` makes canonical node/registry ownership
nullable and adds `discussion_erasure_nodes`. Ordinary edit paths cannot acquire
ownership of an anonymous contribution, including through staff edits. Target rows
retain erased identity, deletion revision, node/root IDs and minimum projection
revision until historical storage cleanup finishes. Migration re-entry validates
schema, indexes and target authority; missing applied state or destructive rollback
is refused. Earlier participation/registry validators accept nullable ownership only
with the later migration's recorded history.

Readers finish awaited target/vote/projection work with current canonical checks.
Old revisions return pending; anonymous ownership neutralizes attribution even if a
same-revision projection contains old metadata. Topic lists recheck assembled items
after their final target lookup. Schema-3 stable nodes preserve newer anonymous values
against delayed older materializers. Historical projection and private SQL cleanup
now have the separately qualified phases below, together with review cleanup.
No Discussion completion receipt is issued by this primitive. Drain old writers and
materializers before activation; deployment, restore and rollback remain unqualified.

### Retained projection cleanup

`EraseDiscussionProjections` now consumes the durable SQL targets after canonical
anonymization finishes. Each call revalidates the exact pending request and permanent
owner barrier. SQL ownership must already be null and the aggregate revision must
be at least the recorded target. The Mongo adapter first reads the stable schema-3
node from the primary with majority read concern. Missing/lagging nodes remain
pending; wrong scope, ownership or remaining structured attribution fail closed.

At most 100 historical schema-2 node copies are removed per batch, using journaled
majority-acknowledged deletes. The v1 `discussion_nodes` entry for the same node is
also deleted. Current schema-3 records and tombstones are never deleted. A final
durable guard read and historical-copy absence check precede removal of the SQL
target under the owner/aggregate locks. A crash after Mongo deletion but before SQL
completion replays safely. Removing the target is control-state cleanup and does
not change canonical content, so it creates no additional projection event.

After the owner's targets are exhausted, bounded batches drain the entire obsolete
v1 node collection and remaining schema-2 node copies. V1 payloads did not retain
reliable ownership; an orphaned cache entry therefore cannot be assigned to a user
for selective deletion. These collections are disposable and older workers must be
fenced/drained before cleanup. An unrelated old schema-2 head can temporarily become
pending until normal authoritative reconciliation rebuilds schema 3. Current
schema-3 nodes, canonical data, and other members' current content are preserved.
Legacy aggregate/event-ID collections store no authored payload or identity and
are not removed by this step. Unrecognized generation schemas or leftover current
attribution block the phase rather than being treated as erased.

The application requires an explicit stopped-old-worker acknowledgement; this is
an activation precondition, not proof that production fencing occurred. `drained`
only describes projection cleanup. Private SQL/registry cleanup follows the phase
below; review content, interactions and audit records must also drain before
the owning participant can complete. The production composition below sequences
these phases. Preserve stable guards and retirement markers across any
compatible restore; drain in-flight workers before destructive cache replacement.

### Private SQL and registry attribution

`MysqlDiscussionPrivateErasure` implements the application-layer cleanup port. Each
call requires the exact pending request and permanent actor barrier, completed
object inventory and no remaining canonical nodes owned by that identity. One
node's erased-actor likes/votes are removed per call. Cleanup takes the same
aggregate lock as ordinary mutations, rechecks current graph membership, and commits
deletion, a monotonically increased aggregate revision and outbox intent together.
Other actors' concurrent reactions remain authoritative. Authored payloads and
timestamps do not change. Counts rebuild from canonical interactions; reads reject
older revisions and stable projection guards refuse delayed old snapshots.

Private command receipts drain in batches of 128 across all tenants. The permanent
identity barrier remains, so deleting receipts cannot make an erased command
replayable. No materialization is required for these private control rows.
`DiscussionPrivateErasure1791840007000` installs actor-first lookup indexes,
validates their full keys/order and case-sensitive InnoDB identities, and refuses lost
applied indexes, incompatible schema and destructive rollback. Unmapped legacy
interactions require authoritative repair instead of being silently discarded.

Registry owner attribution clears only after all of that owner's original objects
are retired, with a fresh check that each key is unreferenced. Each call updates at
most 128 rows, retaining anonymous `retired` records and permanent object markers.
The parser permits null owner/actor only for `committed` public anonymous payloads
or confirmed `retired` guards; unfinished reservations must keep their owner.
A delayed retirement acknowledgement may confirm an already anonymous retired guard
after rechecking that it is unreferenced. It cannot change ownership or resurrect
bytes. Ordinary PUTs remain blocked by the object marker.

Actor attribution on another owner's registry records clears separately in batches
of 128, preserving that owner's content, ownership and upload state. All ordinary
uploaders already serialize against both actor and owner barriers; a paused erased
staff upload cannot commit after this cleanup. Registry bookkeeping is private
authority and requires no extra materialization event. This phase reports `drained`,
never a completed service receipt. Review erasure is qualified separately below;
production composition is described below. Rollout/fencing/restore remain open.

### Review anonymity, history and moderation provenance

`MysqlReviewErasure` implements the review cleanup port under the exact pending
Discussion request/barrier and completed inventory. Public reviews keep their IDs,
rating, text and other members' helpful marks in a new immutable version attributed
to `Deleted account`; ownership becomes null. Hidden/withdrawn reviews lose their
content pointer and become permanent `erasedAt` tombstones. Canonical reads/mutations,
including staff access, exclude those tombstones. Ordinary writes lock the actor
and current author in identity order before application locks; pending erasure
cannot be overtaken by a moderator restoring the author's private review.

The owner/pointer transition, review/application revision increments and
`review_erasure_targets` cutoff commit together. Anonymous reads immediately exclude
pre-transition reports. History drains in 128-row batches, ordered reports, command
receipts, audit events and versions, restricted to the recorded revision cutoff.
New reports and staff decisions survive. Private tombstones also lose helpful rows.
Erased-actor helpful/report rows on other reviews are removed with revision fences;
private actor receipts and audit events drain separately. Permanent identity
barriers prevent replay after command receipts are deleted.

Report resolution stores its exact moderation revision. Legacy reconstruction uses
the first moderation event after each report event, never timestamp/reason equality
as identity. Cleanup removes reasons attributable to erased moderators while keeping
later staff reasons and hidden/visible decisions. Relevant application/review
revisions advance; an audit failure rolls the reason change back. Tombstones and
current anonymous versions retain structural authority after history targets drain.

Reviews have no public materialized projection: current canonical SQL snapshots,
application revision fences and final authority checks after awaited target reads
provide consistency. No broker outbox is required for this SQL-only workflow.
`ReviewErasure1791840008000` validates nullable ownership/content, tombstones,
resolution provenance, complete indexes and stored authority. Missing applied state,
invalid chronology or destructive rollback fail closed. The phase returns only
`drained`; only the production composition below can issue service completion.

### Production Discussion participant and durable completion

`DiscussionsModule` now composes `CleanAccountErasureParticipant` with the
application-layer `CleanDiscussionAccount`. Ports advance canonical contribution
anonymity, obsolete object retirement, private SQL/registry cleanup, review cleanup
and historical projection cleanup in dependency order. A request stops after the
first phase that makes progress or remains pending; it never loops through an
unbounded account history. The shared authenticated service-only endpoint and OPA
policy remain the application authorization boundary.

Cleanup activation requires `DISCUSSION_ERASURE_WORKERS_FENCED=true`; absent or
`false` accepts the permanent request/barrier but returns pending without destructive
work. Invalid settings refuse startup. Operators must first stop/drain incompatible
writers and old materializers, apply explicit migrations through
`ReviewErasure1791840008000`, complete reviewed payload inventory, and ensure the
dedicated bucket stays unversioned with permanent retirement markers. The setting
is an acknowledgement, not proof of fencing. Current schema-3 materializers must
remain available to fulfill the durable anonymous projection targets.

Composition uses `discussion_generation_nodes` and legacy `discussion_nodes` and
ensures the projection cleanup indexes at startup. Missing/lagging stable records
keep the participant pending. No SQL completion occurs on a phase/store failure.
After projection drainage, `MysqlDiscussionErasureCompletion` takes the exact
identity barrier/request lock, verifies inventory and checks all remaining canonical
ownership, payload owner/actor attribution, likes/votes, command receipts, review
ownership/history targets/helpful/report/command/audit rows and projection targets.
Only their absence permits the existing request's `completedAt` update in the same
transaction. No new schema or projection event is required for this receipt.

Permanent identity barriers exclude future private records from ordinary writers;
anonymous current payloads, empty object markers and stable schema-3 guards prevent
delayed copies from restoring erased bytes. A concurrent invocation overtaken by
completion rereads the exact durable receipt before returning success. Completed
replays retain the original time and avoid storage cleanup, including during later
object/projection outages. A different deletion revision still conflicts.

This receipt covers Discussion only. Account also requires Editorial's matching
completion and credential cleanup; the enabled portal workflow now passes local
qualification across all participants. Mixed-version rollout,
production fencing/inventory, coordinated restore/rollback and load/soak remain
unqualified. Never restore old authority/projections without preserving identity
barriers, anonymous tombstones and permanent object-retirement guards.

## Discussion: historical object inventory

`InventoryDiscussionPayloads` is an operator maintenance workflow behind SQL and
object-storage ports. Its read-only preview lists the whole dedicated bucket in
byte-ordered pages of at most 32 objects. The reviewed fingerprint binds durable
progress, key/ETag/size and canonical ownership decisions. Apply requires the exact
fingerprint and an explicit stopped-legacy-writer acknowledgement. Unknown keys,
unbackfilled content and inconsistent canonical references block progress; payload
text never establishes identity. An immutable current reference without its exact
registration is corruption, not permission for an automatic repair.

Known-owner immutable history is validated and registered as uploaded with an
unknown actor. Mutable legacy bodies use a deterministic immutable copy key:
reservation commits before PUT, confirmed upload commits before the source marker.
A lost response can replay the exact copy; mismatched bytes or retired reservations
fail. If erasure starts between steps, confirmation stops and the tracked copy
remains available to the owner's pending cleanup. An exact pending erasure barrier
allows obsolete unregistered owner bytes to be retired without retaining a copy.

The SQL adapter pins advisory ownership and mutations to one connection. It takes
owner locks before canonical resource locks, then rechecks the reviewed decision.
Orphan retirement uses repeatable-read locking queries over current references,
nodes, graph relations and registration index ranges. The permanent conditional
marker is written while those locks remain held. A competing registration waits;
a later immutable PUT cannot replace the marker. Current public payload keys,
canonical revisions and outbox rows are never changed by this workflow.

`discussion_payload_inventory` records the monotonic maintenance revision, last
processed key, legacy-writer acknowledgement time, last completed batch fingerprint
and eventual completion. Cursor advancement follows successful work. Partial
failure retains earlier progress and requires a fresh reviewed plan. Exact completed
batch retries return existing progress. Migration validation refuses lost applied
schema/row, malformed progress, incompatible columns/indexes and destructive down.

This is deliberately SQL/object maintenance without a new public projection or
materialization intent: adopted/copied bytes are historical, and the canonical
public payload references do not change. Existing export includes the newly
registered owner history. Inventory completion alone cannot return a service
erasure receipt; canonical anonymity, private-data removal and bounded registered
retirement must still complete. Read visibility during projection lag remains a
separate requirement of the pending public-author mutation.

Operators must fence old mutable/unregistered writers and drain their outstanding
uploads before applying inventory. Current registered writers can continue because
their reservations precede PUT. The acknowledgement is not technical proof of the
cutover. Enabled or suspended bucket versioning is rejected by real-store checks.
Do not enable versioning during inventory/retirement or remove markers afterward.
Restore must preserve compatible SQL checkpoints, registrations and permanent
object markers; a completed SQL checkpoint alongside older unfenced object data
does not prove cleanup. Production cutover/restore/rollback remain unqualified.

## Discussion: registered payload export

The existing private source now captures registered payload versions in its same
read-only SQL snapshot, using 128-row keyset pages. Every current contribution must
match a committed registry record with the same node, owner, tenant, hash and byte
length before any object read. Registered historical/removed and uploaded-but-
uncommitted owner payloads are included even when no canonical node was committed.
These are retained object versions, not a reconstructed domain-event history.

`payload-versions` records contain node/version UUIDs, canonical tenant, registry
state/timestamps, current-reference status, expected hash/size, portable authored
content and a storage observation. Other uploaders are represented only as
`uploadedBy: other`; migration/import records may say `unknown`. The account's
own uploads for somebody else produce `payload-uploads` action metadata without
that owner's identity, content, hash, object key or current-use status. Exporting
the member's action never grants access to another owner's private payload.

Confirmed uploaded/committed bytes must exist and match their immutable reference,
UTF-8 and content envelope. Reserved uploads may have no bytes yet or a lost
confirmation. Only an explicit storage `NoSuchKey` becomes `storage: not-observed`
for a reservation; a generic 404, missing bucket, access denial, timeout or corrupt
body fails capture. A successful read includes the verified content while keeping
the snapshot's reserved state. SQL metadata is consistent; object presence is an
observation within the capture interval, not a cross-store atomic snapshot or a
claim that an absent upload permanently failed. Registrations created after the
SQL snapshot are excluded.

A retiring owner record cannot complete capture. A retired record exports its
completed metadata without reading the permanent marker or inventing old bytes.
Retirement after snapshot acquisition makes old expected bytes fail integrity;
a fresh capture uses the new canonical state. Cancellation wins over a late read
or absence response. Existing record/archive limits, source completion receipts,
deadlines and Account lifecycle checks still apply. No new projection, event,
write mutation or migration is introduced by this capture extension.

Unregistered historical objects and legacy mutable keys are still outside this
capture: their inventory and provable attribution remain required. This change
does not complete erasure, remove registry attribution or activate retirement in
the production participant.

## Account erasure: private Account cleanup

The Account participant first commits its request/barrier, then advances cleanup
behind an application port. A SQL transaction locks the exact inactive canonical
tombstone before the barrier/request, deletes bounded private rows and completes
the receipt only when no Account-owned private data remains. Profiles/contact
data, avatars, preferences, favorites, account commands, follower relations/
receipts and erased-recipient badge history are removed in batches of 128.
Exports remove up to sixteen chunks from each of eight jobs before removing empty
jobs. Canonical deletion rejects late account/export writes. Failed transactions
roll back cleanup and completion together; pending batches resume after restart.

Erased staff attribution, private reasons and command replay credentials are
cleared together on other members' badge events. Their award/revocation facts,
aggregate revisions and current badge state remain unchanged. Staff reads are
canonical, no-store SQL reads; no projection stores this history, so this cleanup
requires no new materialization event. Minimal identity tombstones, permanent
barriers, cleanup journals and existing lifecycle delivery intent remain intact.
The Account receipt is scoped to Account and cannot complete overall erasure
while remote participants or credentials remain pending.

`ProfileBadgeErasure1791840003000` validates the old schema/history before making
actor/reason/key/fingerprint jointly nullable. Re-entry validates anonymized
history against the unchanged badge state. Partial erased-recipient history is
allowed only for an inactive canonical tombstone with the same pending request
and barrier revision; no such rows may remain after Account completion. This is a
bounded-deletion exception, not permission to accept broken active-member history.
Run the additive migration before either updated identity runtime; destructive
rollback is refused. Production rollout and data-preserving rollback remain open.

## Account export: durable private capture

The job/storage/compression foundation, all four real sources, compiled Account
API/pump and portal now pass local service/browser qualification. See the
account-export workflow checkpoint for exact retained-data coverage, exclusions,
failure/recovery evidence and remaining deployment/performance limits.

An export request and its durable job are one canonical SQL insert under the
current identity lock. An exact idempotency-key replay returns that job even after
cancellation or expiry. One live job and six new jobs per rolling 24 hours bound
per-account work. This workflow does not add a disposable read projection or
broker event: the job itself is durable capture intent, and the archive is an
immutable private artifact. It never grants ownership of the source content.

Each attempt uses a new lease token and discards the preceding partial chunks.
All Account, credentials, Editorial and Discussion sources must finish. Strict
begin/record/end framing counts every record and rejects missing completion,
unexpected scope, non-JSON values, excessive depth/text and trailing records.
Gzip NDJSON contains a manifest, records and source receipts with capture times.
The intended source contract is a consistent canonical snapshot within each
owning SQL store, captured in bounded keyset batches; the sources are not a
distributed point-in-time snapshot. Credential capture is the provider's own
current safe account record. Account, Editorial and Discussion use one read-only repeatable-
read SQL transaction with explicit safe fields and bounded keyset batches. The
shared snapshot adapter bounds queries and capture time, destroys only its own
connection on unfinished capture, handles late pool acquisition and commits before
the source completion receipt. No record is accepted as a complete source without
that receipt. Individual source snapshots are not a distributed transaction.

Account capture validates canonical active registered identity, then includes
private profile/contact, saved or explicit default preferences, favorites, current
follow relations, badge state and verified current avatar bytes. Public sharing
does not restrict private self export. Badge staff reasons and actors are excluded.
Credential capture uses an explicit Firebase allowlist, excluding password hashes,
salts, tokens and internal custom claims. Its ten-second caller timeout/cancellation
stops waiting and fences late SDK results; Firebase Admin's underlying request
does not support AbortSignal here and is not claimed to be physically cancelled.

Discussion capture includes owned nodes, immutable current payloads, tombstones,
all retained owner review versions, current own likes/votes/helpful marks and own
reports with resolution state. It spans the same canonical owner's tenants; tenant
IDs and surrounding structural IDs are retained without copying other authors'
private text or staff audit. It validates bounded thread graphs and committed
current references, checking their registry binding, bytes, UTF-8 and hash.
Deleted contributions export tombstones; separately registered owner versions
include retained replaced/removed and unfinished uploads under the registered-
payload contract above. Unregistered historical objects are not an authoritative
edit history and are not recovered by this source. Missing authority or confirmed
objects fail capture; no projection or fabricated empty result replaces them.

Editorial captures current own drafts and every retained immutable submission,
canonical publications/catalog relations, ownership decisions/grants and retained
upload metadata. Authority determines ownership across tenants, including after
application transfer. Reviewers' identities, proof credentials, commands and
leases are excluded. Public projection filtering does not erase private retained
content; scrubbed/deleted rows export their surviving metadata without inventing
content. Current ready owned assets include verified normalized WebP bytes in
256-KiB raw chunks. Original upload bytes and retired historical article covers
are not recovered. Current media bindings must resolve to ready canonical uploads;
foreign-uploader references do not authorize reading their private bytes. An object
retired after SQL snapshot acquisition fails the attempt; retry uses new authority.
This capture introduces no new projection or durable write intent.

Editorial's and Discussion's internal endpoints require a dedicated export secret, exact fixed
service identity/role/scope and an OPA allow. User/profile/ingress credentials,
mixed roles, tenant/query overrides and duplicate credential headers are rejected.
The Account HTTP reader permits no redirects or ambient credentials, limits each
record to one MiB in a fixed buffer, bounds total bytes and validates complete
source framing through EOF. Five-minute stream deadlines and abort signals stop
SQL/HTTP work; object reads have a ten-second deadline and abort their S3 request
or body. A disconnect after partial output cannot produce a ready archive. These
transport tests are supplemented by the integrated four-source runtime/browser
journey. Account requires the same dedicated source secret at startup; the
credential is never included in browser configuration.

Compressed chunks are immutable by export/attempt/position. Duplicate writes
must match bytes and hash; gaps, replacement and appending after a short final
chunk are rejected. Before ready transition, SQL verifies positions, lengths,
individual hashes, overall digest and all four completed source receipts.
Ready metadata commits atomically with the completed artifact reference. Partial
attempts cannot be downloaded. Cancellation/failed retry/expiry cleanup removes
payloads and retains only the command receipt. Purge and mutations consistently
lock identity before job to avoid inverted cleanup lock order.

The 60-second lease renews during a slow capture; attempts are bounded at six and
15 minutes each. Timeout, shutdown, lost ownership, inactive account or storage
failure aborts capture/compression, with append and completion fenced by the
current lease. Crashes recover by starting a fresh attempt, never by combining
records captured at different times. The archive expires 24 hours after request.
Each download chunk checks current account lifecycle and ready/expiry state,
verifies its bytes and validates the complete digest before yielding the final
chunk. Already-transmitted bytes cannot be recalled; subsequent chunks stop after
cancellation or account deletion. Current erasure makes retained bytes unreadable;
the active Account pump purges expired/deleted-owner artifacts. Cross-service
erasure of all other retained account data remains a separate pending workflow.

The public HTTP download stops waiting immediately on disconnect or its 15-minute
deadline, even if a chunk iterator is stalled. MySQL's pending query is not claimed
to be physically cancelled; its download permit remains reserved until iterator
cleanup completes. Four permits bound outstanding archive reads per process.
The browser checks the complete attachment length/type/digest before saving;
session changes unsubscribe and prevent an old archive being saved in a new
session. The browser buffers the archive; large-device/memory qualification remains
part of the open operational load gate.

The migration validates existing schema and stored artifacts rather than silently
repairing corruption or fabricating missing tables already recorded as applied.
No destructive down migration is provided. Operational recovery must retain
canonical job receipts and treat incomplete attempts as restartable work.
The worker polls durable jobs and cleanup every second while idle, draining at
most four jobs per cycle. Each process performs one capture at a time; canonical
leases handle replicas. Public request/status/cancel/download and all four sources
are locally qualified. Production deployment/restore/rollback/load/soak remain open.

## Profile totals: current canonical counts

Local qualification is recorded in the profile-totals checkpoint. No new counter
projection, events, object payload, migration or increment-on-delivery consumer is
introduced. `GET /api/me/totals` and `GET /api/profiles/:id/totals` return exact
`discussions`, `favorites`, `suites`, and `articles` fields. A nonnegative safe
integer is an observed count; `null` means the category is not shared. Failure
never becomes zero. Both endpoints are no-store; public responses vary by
Authorization and accept no query scope.

- Discussions count distinct currently public application topics and article
  comment threads with at least one live public contribution owned by the member.
  Multiple replies in one thread count once. Deleted contributions, deleted roots
  and unavailable public parents do not contribute. Reviews and votes are excluded.
- Favorites count saved canonical relations whose owning services currently
  resolve a public target. This matches the shared-favorites collection, including
  its independent Show Favorites switch. Unavailable target services cause failure.
- Suites count currently published suites owned by the member, using approved
  submissions and current canonical lifecycle/ownership. Private drafts, pending
  submissions, rejected submissions and withdrawn publications are excluded.
- Articles count currently published authored articles with matching canonical
  ownership and tenant. Later private draft edits do not alter this count.

The public endpoint first enforces profile audience, then Show Discussions, Show
Favorites, Show Suites, and Show Activity History (for articles), respectively.
Owner public preview follows those same switches. Hidden categories do not call
content dependencies. The private endpoint uses self-profile authorization and
current account lifecycle, irrespective of sharing. Private totals still count
public contributions and public favorite targets; they do not count private drafts.

Account resolves the content owner privately. Editorial and Discussion accept
`POST /api/internal/profile-totals` only through the fixed profile-reader identity,
service credential, configured public tenant and dedicated OPA action. Bodies
contain only `ownerIdentityId` and owned `categories`; extra scope and mixed user
headers are rejected. The response must contain exactly the requested categories.
Public gateways block these internal endpoints.

Editorial reuses complete canonical SQL counts and publication integrity checks,
not catalog page lengths or projection counters. Count facts can be available
while the corresponding content projection is rebuilding. Each category is a
current owning-store read; this is not a distributed frozen snapshot. Discussion
counts distinct SQL roots grouped by parent, resolves current public parents in
bounded batches and rereads the groups after parent I/O. Its present limit is 200
distinct parents per member; larger selections fail unavailable rather than return
a partial count. Parent resolution uses existing generation-checked public readers,
so parent projection lag fails unavailable. SQL has a three-second statement bound;
parent calls have bounded concurrency/timeouts and Account bounds remote requests.

Account reconfirms the full public profile stamp after all content reads, including
account revision, audience, follow relation and sharing settings. Private reads
match the profile/favorites account revisions and recheck the profile after I/O.
A privacy, lifecycle or saved-favorite change during a read invalidates its result.
The portal clears old totals on refresh, target/session changes or failure and
cancels obsolete requests. No displayed number grants access to content.

Retries and restarts simply reread canonical facts. Duplicate or reordered broker
messages cannot inflate totals; existing publication/discussion tombstones prevent
resurrection. Deployment must coordinate Account, Editorial, Discussion, OPA and
portal versions. Source outage, profile races, tenant denial, target withdrawal,
large-page counts, browser layouts and restart remain qualification requirements.
The parent bound and production load/restore/rollback remain explicit limitations.

## Published profile articles: current authority and existing projections

`GET /api/profiles/:id/articles?after=uuid` exposes current published articles
authored by the profile's canonical owner in the configured public tenant.
Attribution uses `article_publications.ownerIdentityId`, checked against the draft
and Editorial resource state; byline text and application ownership grants do not
establish authorship. Private drafts, pending/rejected submissions and withdrawn
publications are excluded. Private edits cannot replace approved content.

There is no new projection, event counter, object payload or migration. Editorial
selects at most 21 canonical publications in ascending article UUID order, resolves
each exact published generation through the existing ArticleCatalog, then repeats
the canonical selection. Kind, resource, tenant, revision, submission, slug and
publication timestamps must match. Projection lag/loss/corruption or a changed
selection fails unavailable. The existing monotonic projection writer rejects
older deliveries, and reconstruction uses canonical SQL through the production
snapshot reader/writer. Withdrawal removes eligibility immediately, even while an
older projection remains. Existing publication writes retain their atomic durable
intent and immutable reviewed payloads.

The returned page contains up to 20 summaries: ID, slug, title, excerpt and first
publication time. A continuation contains only the last returned public UUID;
the lookahead item, full content and private owner identifiers are not exposed.
Pages reflect current authority rather than a frozen multi-request snapshot. A
refresh starts again; new publications before an existing cursor appear after
refresh. The chronological Recent Activity stream remains a separate collection.
The existing unpaged owner query still counts all publications for profile totals.

Account enforces current audience and Show Activity History, including owner
preview, privately resolves the owner, and reconfirms the full profile stamp after
content I/O. Hidden sharing avoids Editorial entirely. Editorial's internal
`POST /api/internal/profile-articles` accepts only the fixed profile-reader
identity, service credential, public tenant and dedicated OPA action; injected
scope and mixed user credentials are rejected. Public gateways block the route.
Remote requests are bounded by timeout, response size and redirect rejection.
The portal clears obsolete pages on failure, refresh and session/target changes.

Deploy Account, Editorial, the Editorial OPA bundle and portal together. Local
qualification covers 21 reviewed publications, author/tenant isolation, lag,
loss/reconstruction, stale replay, withdrawal, privacy changes during held real
responses, hidden dependency avoidance, independent browsers and Account restart.
Production topology, workload/soak, backup restoration and rollback remain open.

## Staff profile badges: canonical decisions and audited retries

Badges use the account SQL authority. There is no badge projection, broker
consumer or new object payload. `identity_profile_badges` contains the current
state of each supported kind; `identity_profile_badge_events` is immutable staff
decision history and the exact command receipt. Both are authoritative records,
committed together. Badge labels never grant permissions or billing entitlements.

The application boundary authorizes `identity.profile-badges.read/update` on a
`profile-badges` resource. The dedicated `identity:badge-manager` role and existing
global `admin` role can administer badges. Self-profile access, identity
administration and public audience access do not implicitly grant this power.
Trusted ingress supplies roles; request bodies and query strings cannot supply
actor, ownership or tenant scope. Identities are global under the existing Account
convention. Staff history is never embedded in public or owner badge responses.

The writer locks actor and recipient canonical identities in sorted public-ID
order, consistent with follower commands. It rechecks the actor's lifecycle and
the recipient's existence. Awards require an active recipient; revocation remains
possible for an inactive recipient. Deleted recipients are unavailable. The domain
requires a supported kind, a 3-1000-character reason, an expected badge revision
and a meaningful award/revoke transition. Revocation preserves the original award
time; re-awarding creates a new award time and a new revision.

One transaction writes current state, the immutable event/receipt, the recipient's
next account revision and existing durable `identity.updated` outbox intent.
An outbox failure rolls everything back. Badge aggregate revisions advance
independently of unrelated account edits. The full public profile stamp includes
account revision and Show Badges, so either a badge change or privacy change
invalidates an in-flight public read. Sorted identity locks serialize competing
staff commands without relying on timestamps. Event times never move backward.

An idempotency key is unique for the staff actor. The fingerprint binds recipient,
expected revision, kind, action and reason. Exact retries return the historical
event after current access checks; changed intent conflicts. A successful old
award retry after a later revocation never changes current badge state. The portal
retains the exact pending command/key for uncertain retry, blocks new intent and
clears private state on session changes. It reloads canonical state after success
instead of treating a historical receipt as the current badge list.

Public reads require the current profile audience and Show Badges, including owner
public preview. They return only active kinds and award times. The store reads a
consistent SQL snapshot and the application reconfirms the full profile stamp
after policy and badge I/O. Private owner reads use self authorization and do not
depend on public sharing. Staff history pages contain at most twenty descending
events and a strict numeric revision cursor. They are current reads; paging does
not promise a frozen multi-page snapshot. All badge HTTP responses are no-store.

`ProfileBadges1791676831000` is registered by both identity APIs and maintenance.
Run explicit `--migrate` before starting either API. The additive migration checks
schema/index/collation compatibility, validates owners/actors, replays bounded
audit batches and rejects gaps, invalid fingerprints or disagreement with current
state. Reentry preserves recorded data; a recorded but missing table is an error.
Rollback requires a reviewed data-preserving migration. Existing outbox recovery
continues to deliver account invalidations; broker loss cannot erase decisions.

Account deletion immediately blocks badge reads and commands through canonical
tombstones. Account cleanup now deletes the erased recipient's history and
anonymizes the erased staff actor's decisions on other recipients, including
private reasons and replay credentials, as described above. Full cross-service
erasure, restore, production migration/rollback and operational load qualification
remain part of the open service-wide gates.

## Public profile activity: current public facts across owning services

`GET /api/profiles/:id/activity?after=opaque` requires the current profile audience
and Show Activity History, including owner preview. This is a chronological view
of currently public publications, individual contributions and saved favorites.
It excludes private drafts, credential events and moderation records. It is not an
immutable account audit history or the unfinished home feed. Suite and discussion
sharing apply to their activity families; favorites require Show Favorites and
the corresponding suite/discussion switch when applicable. Reviews remain subject
to activity sharing and their current moderation/withdrawal state.

Account resolves the private owner from a confirmed canonical profile snapshot,
reads Editorial, Discussion and canonical favorites, and confirms the complete
profile stamp again after content I/O. A sharing, audience, follower or account
change discards the in-flight result. Hidden activity returns an empty hidden page
without contacting content services. Denied access is 404; unavailable dependencies,
policy or current generations are 503. Responses are private/no-store and vary on
Authorization. Public summaries contain only public identifiers, kinds, timestamps,
titles and route targets. Service requests and public payloads are strictly parsed.

Editorial selects the latest publication receipt for each current resource. App
publication records are mapped through editing drafts to the canonical app; the
latest reviewed or direct publisher revision supplies the author and time. A later
ownership grant does not itself become a publication. Older approved drafts and
superseded publisher commands cannot create duplicate activity or retain attribution
after a newer author's publication. Suites/articles/releases use their canonical
publication records. Private edits preserve approved metadata and release parents
must remain public. Current catalog readers require the exact projection revision;
the complete canonical selection is repeated after all content reads.

Discussion selects live public roots and individual replies/comments from canonical
nodes in the configured tenant. Roots can use a root-only read; reply contributions
load their existing bounded full thread. Every read requires the current generation
and parent visibility. Review times come from the immutable publish event at the
current content revision, not helpful-mark or moderation timestamps. Current public
parent routes are resolved through Editorial, then the canonical candidate selection
is repeated. Deleted/redacted contributions and withdrawn parents are omitted;
concurrent revision/membership changes return unavailable instead of stale activity.

Owning services select at most eleven candidates per SQL branch, merge to eleven,
scan ten, and load at most five items concurrently. Favorites scan at most ten of
the account's existing bounded canonical relations and keep their original saved
time. Each unfinished source returns an internal scan boundary, including hidden
candidates. Account merges in timestamp-descending/key-ascending order and stops at
the earliest unfinished boundary. Advancing beyond that point would skip unseen
items from another source. A public page contains at most ten entries; an empty
page can have continuation and still progress to older public items.

The `a1.` cursor uses AES-256-GCM with a random nonce, versioned SHA-256-derived key
and the public profile UUID as authenticated context. Skipped identifiers/times
are encrypted. The same secret preserves pagination after restart; rotation,
tampering and use on another profile require a fresh first page. Every page repeats
authorization. There is no frozen distributed snapshot across services or pages,
and previously received content cannot be recalled.

`POST /api/internal/profile-activity` in Editorial and Discussion accepts only the
existing `x-profile-reader` credential and fixed service identity/tenant/OPA action.
It rejects mixed user credentials and scope injection; the existing public gateway
denies the internal prefix. Account's transport has an eight-second timeout, no
redirects, a 128-KiB response limit and a 4-KiB request limit. The existing parent
selection and thread bounds still apply. Deploy Account, Editorial, Discussion,
all three affected OPA bundles and the portal together with the shared ingress
secret and private `EDITORIAL_URL`/`DISCUSSION_URL` addresses.

No new migration, write intent or projection is introduced. Existing canonical
writes/outboxes and exact Editorial/Discussion generations remain authoritative and
rebuildable. Qualification must include projection lag/loss/rebuild, retained-parent
withdrawal, hidden-page progress, in-flight privacy changes and process restart.
See the activity checkpoint for measured evidence and deployment limitations.

## Public profile discussions: current contributions and parent visibility

`GET /api/profiles/:id/discussions?after=opaque` requires the current profile
audience and the separate `read-discussions` policy with boolean Show Discussions
enabled, including owner preview. Account resolves the private owner only from
a confirmed canonical profile snapshot and checks the complete stamp again after
Discussion I/O. Sharing, audience, follower or account changes discard an in-flight
result. Hidden sharing skips Discussion; denied audience is 404 and unavailable
policy/content is 503. Queries and summaries are strictly validated; responses
are private/no-store and vary on Authorization.

Discussion owns participation in both application topics and article comment
threads. Its SQL index requires a current public, published, nondeleted root and
at least one such contribution owned by the member in the configured tenant.
Duplicate replies collapse to one root; deleting the last live contribution
removes participation. The existing reader requires the exact current generation
and current parent visibility. Editorial supplies only current public parent
titles/slugs through bounded public selection contracts. After all content and
parent I/O, Discussion rechecks contribution membership, target, creation time
and aggregate revision against SQL. Missing membership is omitted; revision
changes or missing generations return unavailable. No projection grants access.

At most eleven candidates are selected, ten are scanned in batches of five,
and summaries expose only public root/parent identifiers, canonical parent slug,
public title, root creation time, reply count and author/participant designation.
The final scanned candidate determines continuation when another candidate exists.
Hidden parents can leave a short or empty page with continuation. That cursor
uses AES-256-GCM with a random nonce, a versioned SHA-256-derived key and
authenticated owner/tenant/context scope. It contains no readable hidden IDs or
timestamps. Tokens grant no permission; every page repeats current authorization.
They survive restart with the same secret and become invalid after rotation;
reload the first page to recover. Pagination is a current read, not a frozen
cross-service snapshot. Previously received content cannot be recalled.

The service-only `POST /api/internal/profile-discussions` constructs a fixed
service actor, checks `discussion.profile.participation.read`, and rejects mixed
user/Authorization/ingress headers and tenant overrides. Account and Discussion
reuse `INGRESS_AUTH_SECRET` and must rotate it together. Account's `DISCUSSION_URL`
must address the private service; the public local Nginx listener rejects the
internal prefix. Verify deployed edge isolation separately. Account transport
has a five-second timeout, no redirects and a 128-KiB response limit; each parent
selection has a three-second timeout, no redirects and a one-MiB response limit.

This read adds no migration, projection or durable write intent. Existing
Discussion mutations still atomically commit canonical nodes, immutable payload
references, aggregate revisions, exact receipts and outbox intent. Worker recovery
and projection rebuild remain the existing materialization path. Deploy Account,
Discussion, identity/profile and Discussion OPA bundles and the portal together.
Article links carry the public root UUID in `?thread=` and use the article-bound
thread reader, including when that root is absent from the first comments page.

## Public profile suites: current owner and approved publication

`GET /api/profiles/:id/suites?after=uuid` requires the current profile audience
and the separate `read-suites` policy with boolean Show Suites enabled, including
the owner's public preview. Disabled sharing returns a hidden empty page without
contacting Editorial; denied audience is 404, while unavailable policy or content
is 503. Strict DTOs reject injected scope, duplicate query parameters and invalid
cursors. Responses are private/no-store and vary on Authorization.

Account Management resolves the private canonical owner claim only after policy
approval. Its SQL adapter repeats the complete profile stamp inside a repeatable
snapshot before resolving the owner; it repeats the stamp after Editorial I/O.
Sharing, visibility, follower, account revision or lifecycle changes discard
in-flight content. The private UID is never a public URL, response or cursor field.

The bounded internal `POST /api/internal/profile-suites` accepts only a scoped
service credential, with no user/Authorization/ingress headers or tenant override.
Editorial constructs a fixed service identity and configured public tenant, then
requires `editorial.profile.suites.read` policy before catalog access. This reuses
the existing `INGRESS_AUTH_SECRET` trust domain; Account and Editorial must receive
the same value and rotate it together. The credential grants no ordinary Editorial
mutation through this endpoint. Use a private Editorial origin, never the public
gateway. Local Nginx rejects the internal prefix; the Kubernetes ingress adds
validated user/anonymous headers, which the service-only endpoint rejects. Verify
the deployed edge behavior separately.

Editorial owns suite authorship and publication. Canonical SQL selects current,
nondeleted, approved suites owned by that identity in the configured public tenant,
ordered by public UUID. Existing catalog checks require the exact committed
publication revision, submitted revision, publication time and tenant from Mongo,
then repeat the SQL selection after projection I/O. Private draft edits preserve
approved content. Withdrawal/deletion excludes the suite without waiting for its
projection; replacement lag is unavailable. Corrupt publication authority fails
explicitly. Pages contain at most twenty summaries (UUID, title, description),
using one extra eligible result to determine continuation. No private IDs/counts
or draft/submission metadata are exposed. Transport has a five-second timeout,
no redirects and a 128-KiB response limit.

This read adds no migration, projection or durable write intent. It reuses the
existing atomic suite publication/outbox and recoverable Editorial materializer;
there is no on-demand materialization or distributed snapshot. Each new page
rechecks current authority; previously received data cannot be recalled. The
implemented collection covers owned/created suites. Contributor attribution
requires a separate canonical collaboration model and remains outside this read.
Deploy both OPA bundles, Editorial, Account Management and the portal together.

## Public profile favorites: current canonical relations and target reads

`GET /api/profiles/:id/favorites?after=kind:uuid` shares saved content only after
the application evaluates the normal profile audience and the separate
`read-favorites` policy. The latter requires the current boolean Show Favorites
preference, including for the owner's public preview. Administrative roles do
not override the audience or switch. A denied audience returns 404; disabled
sharing returns `{sharing: 'hidden', items: [], after: null}` without reading
saved relations or making content-service calls. Policy failures return 503.
The whole query is validated and rejects extra scope, duplicate parameters and
malformed cursors. Responses are private/no-store and vary on Authorization.

The existing canonical `identity_favorites` relations remain the authority. Their
write protocol, shared account revision, exact receipts and atomic outbox are
unchanged. A repeatable-read transaction checks the profile snapshot stamp,
current lifecycle, viewer and follower facts, and sharing preference before
reading at most 200 saved relations. Account revision participates in the stamp,
so favorite changes invalidate it as well as privacy and lifecycle changes. After
all target I/O, another SQL snapshot must match before any content is returned.
A changed snapshot discards the payload; no partial successful response is used.

Applications, suites and articles use Editorial's current public selection
contracts; discussion roots use Discussion's public selection and a current
Editorial lookup for their parent application's route. Those endpoints check
canonical visibility and exact permitted projection revisions. Deleted,
withdrawn, private or otherwise ineligible targets are omitted completely.
Unavailable services, malformed responses or pending projections return 503,
not an invented empty list. Metadata is reduced to kind, public UUID, title,
current route slug and optional parent application slug. Private account IDs,
saved timestamps and missing-target identifiers are never public response fields.

Each of four content families uses sequential batches of at most fifty, with
five-second request timeouts, no redirects and a two-MiB response bound. The
bounded result is sorted by ASCII `kind:id` and paged in groups of twenty visible
targets. A continuation contains only the last returned public target. Every
page resolves current visibility again; paging is not a pinned cross-service
snapshot, and concurrent edits can change which items remain. There is no
cross-service transaction and already received content cannot be recalled.

This workflow adds no migration, materialized projection or new write intent.
It reuses existing publication and discussion recovery, and rebuilds no content
on demand. Deploy the audience policy, owning-service selection endpoints,
Account Management and portal together; the existing public-profile ingress
prefix covers the read route. Keep explicit Editorial and Discussion origins.
The local qualification is `WAPPS_PUBLIC_PROFILE_FAVORITES=1` on the discussion
favorites journey; it exercises real SQL/OPA/compiled APIs, publication lag and
withdrawal, mutations during target reads, independent browsers and restart.
Production ingress/provider and restore/rollback/load/soak gates remain separate.

## Profile contact email: explicit canonical sharing

`identity_accounts.contactEmail` is a nullable, member-supplied contact address.
It is never copied from Firebase or inferred from a credential field. A bounded
plain ASCII mailbox is accepted; address lists, display names, controls and mail
headers are rejected. The domain trims outer spaces and normalizes only the
domain part. This field is not verified by Wapps and grants no identity, ownership
or publication rights.

The existing self-authorized profile command writes the field, shared account
revision, original command fingerprint/receipt and `identity.updated` invalidation
atomically. Omitted `contactEmail` preserves the current value, and commands that
omit it keep their existing v1 fingerprint. Explicit null/blank removes it.
Historical replay returns its receipt without restoring an earlier address.
Local account tombstoning erases the address with its canonical account row.
No separate projection, event payload containing the address, provider write,
verification email, retention worker or notification consumer is introduced.

Public profile reads load the contact value and current `privacy.showEmail` in
the same repeatable snapshot as the audience facts. The field is null unless the
switch is enabled; the surrounding profile must also pass the dedicated audience
policy and the post-policy snapshot recheck. Directory responses always omit
contact values. Turning off sharing, changing audience or removing approved
access affects subsequent canonical reads immediately, without broker delivery.
Previously received data cannot be recalled from a reader's device.

Run the additive `ProfileContactEmail1791676830000` migration before both identity
APIs. It validates InnoDB, nullable ASCII/binary column definition, absence of an
implicit default/generated value and canonical stored values in bounded pages.
An already-recorded migration cannot silently recreate a missing column.
Down migration refuses data loss. Backups include the existing account table.
Deploy the API and portal contract together: older clients preserve the field on
text updates, while old public-response validators may reject the new field.
A compatible rollback retains the column and existing canonical privacy controls.

## Public profiles and approved followers: canonical SQL reads

Public profile links use the existing immutable SQL subject UUID, separately from
the Firebase UID used by private account commands. `GET /api/me/profile` adds
`publicId`; public payloads never contain the credential UID, account revision,
credential email, private preferences or legacy external avatar URI. The public
payload contains display name, biography, location, validated social links,
registration date, the current normalized avatar reference and the explicitly
shared contact address described above.

Account profile, privacy, lifecycle and follower facts are read in one repeatable
SQL snapshot. A dedicated OPA policy receives only those canonical facts. Public
visibility permits anonymous readers; private visibility permits only the owner;
followers visibility permits the owner and individually approved followers.
Administrative roles grant no audience override. A restricted followers response
contains no profile payload and permits a request; missing, private, suspended,
deleted and unregistered targets disclose no profile. Invalid or suspended
supplied sessions never fall back to anonymous access. Trusted optional ingress
authentication is limited to the exact public GET paths.

The application rechecks the canonical snapshot after policy I/O. Any changed
account, viewer, relationship or payload stamp withholds the result. Directory
pages select at most twenty current public registered profiles and authorize
each candidate under the separate discovery policy, including a final snapshot
check. Owner preview cannot place a private profile in the directory.
`GET /api/profiles/:publicId/avatar/:avatarId` applies the same audience decision
and exact current association before returning verified SQL bytes. Both text and
photo responses are private/no-store. The portal fetches blobs through its HTTP
client and revokes object URLs on reload, navigation, session change and destroy.
Previously received content cannot be recalled from a reader's device.

`PUT /api/me/profile-follows` accepts owner/requester public UUIDs, action,
expected pair revision and `Idempotency-Key`. Actions are requester request/cancel
and owner approve/remove; removal also declines a pending request. New requests
are accepted only for followers visibility. Request submission deliberately shares
the requester's display name and public link with that owner. It grants no
reciprocal profile access. Approval remains stored through later visibility
changes; private visibility always denies other readers. A member can cancel
through the private outgoing list even after the owner becomes private/suspended.
The outgoing list exposes only relation IDs/status, never a newly private name.

Every pair writer locks both canonical identities in public-UUID order, then
rechecks actor ownership, active caller, saved profiles, exact receipt, expected
revision and the authorized snapshot. The new pair state, actor-scoped historical
receipt, both shared account revisions and both `identity.updated` invalidations
commit together. Concurrent unrelated account changes can therefore require an
explicit reload. `none` tombstones retain pair revisions; replaying an earlier
request or approval returns its original receipt without restoring access.
There are at most 200 outgoing active relations, 200 pending incoming requests,
1,000 approved followers and twenty new requests per requester per rolling day.
Counts execute under the same identity locks. Lists use bounded UUID cursors.

This workflow has no read projection or follower notification consumer. Canonical
SQL is its read source; the existing confirmed identity outbox retains durable
invalidation intent without personal text. No broker delivery is needed to grant
or revoke access. Local account tombstoning deletes all incoming/outgoing relation
rows and associated command receipts in the same transaction; the permanent
identity tombstone prevents a delayed command from recreating them.

Run `ProfileFollows1791676829000` explicitly before either identity API starts.
Migration reentry validates InnoDB, exact binary column definitions and ordered
indexes, existing relation lifecycle and receipts; a recorded missing table is
an error. Include both new tables with identities/accounts/preferences/avatars
in consistent backups. Older binaries cannot erase these relationships, so
rollback requires compatible code or a reviewed data-preserving migration.
No destructive down migration is supplied. Owner approval is the conservative
product-policy assumption used for this workflow.

Public contact email, badges/activity and audience-filtered content collections,
analytics/personalization consumers, full account export/cross-service erasure,
deployed provider/ingress sessions and service-wide recovery/load gates remain
separate required work. This basic profile/audience workflow does not close them.

## Private profile avatars: bounded canonical SQL payloads

A private avatar is one bounded, immutable WebP payload associated with the
canonical account. Unlike publication images, it has no draft/submission history,
shared references or independent public object. The audience-controlled public
read path is described above. The maximum stored image is 256 KiB
and fits within 512 pixels on each side. Keeping this small payload in the same
SQL transaction as its association avoids an additional object-store completion
and cleanup protocol. There is no avatar projection, reservation, background
upload or best-effort publication. Upload and attachment are one explicit command.

`PUT /api/me/profile/avatar` accepts a still PNG/JPEG/WebP body up to 2 MiB, with
`If-Match` containing the quoted account revision, `Idempotency-Key`,
`X-Avatar-Bytes` and `X-Avatar-Sha256`. The application evaluates the existing
explicit self-profile update policy and checks canonical lifecycle/receipt before
the transport buffers data. Both buffering and decoding are limited to two
concurrent operations per process; request reception has a fifteen-second deadline
and decoding has a five-second timeout, 16-million-pixel and 8192-pixel side limits.
The adapter verifies source length, digest, signature and decoded format, rejects
animation and re-encodes without source metadata. Source bytes are never stored.
Processing finishes before the write transaction starts; failed decoding writes
nothing, and a failed process leaves no durable pending upload.

The write transaction locks the canonical identity and repeats active/nonsuspended/
nondeleted state, exact receipt and expected-revision checks. It replaces the
current immutable payload/reference, clears the legacy external URI, advances the
shared account revision, stores the actor/key/fingerprint receipt and appends an
`identity.updated` invalidation atomically. The event contains lifecycle/revision,
not image data or private references. `DELETE /api/me/profile/avatar` uses the same
protocol to remove either the private image or a legacy URI. Retrying a committed
command returns its historical revision without decoder work or rewriting later
content. Source-byte differences or upload/removal reuse of a key conflict.
Concurrent profile/preferences/favorite/lifecycle commands share the revision fence.

The profile snapshot returns a nullable `avatarId` separately from legacy
`avatarUri`. `GET /api/me/profile/avatar/:id` checks the self-read policy and returns
only the current image belonging to the caller in a canonical SQL snapshot.
Foreign, replaced and removed IDs grant no access. Image reads are private/no-store,
WebP-only and nosniff. The portal fetches bytes through its authenticated HTTP
client; no bearer tokens appear in image URLs. Browser object URLs are revoked
on reload, session change and destruction. A failed image read makes the profile
unavailable with a retry action; it never becomes a successful empty photo.

`ProfileAvatars1791676828000` adds a case-sensitive InnoDB table and verifies its
schema, unique keys, enforced bounds, current account/lifecycle associations,
checksums and payload bounds on reentry. A recorded migration cannot recreate a
missing authority table. Both identity services and maintenance register it;
normal startup refuses pending migrations. Account deletion removes image bytes
inside the canonical tombstone transaction. Replaced/removed payloads have no
historical reference; retained command receipts and monotonic account revisions
prevent replay from resurrecting them. Backups must include avatars, accounts,
identities, receipts and outbox as one consistent database backup. Backup retention
and cross-service erasure are separate requirements. Destructive down is refused;
old account binaries do not know how to erase this table, so rollback requires a
reviewed compatible binary or data-preserving migration.

API settings separate photo commands from text saves. Unsaved text disables photo
changes, and an in-flight photo command disables text editing. Failed commands
retain the selected file and original revision for an explicit retry; reload
clears the selection and rereads authority. Browser restart does not restore the
local file, but the committed photo and receipt remain durable. Demo photos retain
their explicitly browser-local behavior. Public-profile audience enforcement and
public media serving remain separate workflows.

## Credential email verification: provider authority

Firebase owns credential email verification. Wapps does not copy its verified
flag into SQL, a projection, profile contact data or an ownership claim. Private
status and request use cases require a nonrevoked Firebase session and a current,
active canonical SQL identity. The current provider lookup must match that UID;
the caller cannot choose a target UID or email. Status reads the current provider
record rather than the potentially stale token claim. Application access and
domain ownership approval remain separate policies.

This workflow has no materialization intent or disposable projection: its only
state mutation belongs to the credential provider. A verification request reads
current status, avoids resending for an already verified credential, and asks the
provider to send a VERIFY_EMAIL action. Acceptance is not proof of inbox delivery.
The request is not automatically retried after an uncertain response. Provider
throttling remains 429, and outages never become unverified or successful states.
All REST calls have a ten-second deadline and a 16 KiB response limit.

Public action-code inspection requires the exact VERIFY_EMAIL type before
completion; reset, recovery and email-change codes cannot be consumed by this
flow. Password reset now also checks its exact action type before mutation.
Completion requires explicit user confirmation and neither returns a session nor
activates a suspended/deleted SQL identity. Codes are one-use provider authority,
not Wapps idempotency keys. A lost completion response can follow a successful
provider mutation; refreshing private status recovers certainty. Used-code replay
does not manufacture a successful receipt.

The portal keeps action codes in memory and replaces the action URL in history.
Its HTML prohibits referrer propagation; the static servers prohibit action-page
caching and suppress action access logs. CSR logs omit query strings/referrers,
and the dedicated email-action ingress disables access logging. Verify equivalent
controls in every deployed edge/proxy; local configuration checks do not certify
a running ingress. Private UI reads/commands are cancelled and cleared when the
session changes. No notification/feed delivery or lifecycle audit consumer is
introduced. Provider backup/export, real email delivery, action-template setup,
time-based expiry and deployment qualification remain separate operational gates.

Local evidence covers actual provider code creation/consumption, wrong-type and
used-code rejection, independent browsers, lost completion response, SQL
suspension, unenrolled identities, provider disable/revocation/outage and compiled
authenticator restart. See the email-verification checkpoint for exact evidence.

## Application discussion previews

Overview and related-topic previews reuse the qualified public application-topic
list. Its canonical SQL selects at most ten roots plus lookahead in pin-first,
newest order; content comes from each root's exact complete generation. Current
SQL lifecycle/binding/revision, ordering and Editorial parent visibility checks
continue to govern each response. The portal shows at most three returned topics,
excluding the current thread on detail pages. No new projection, cache or
authoritative store is introduced. These views grant no permissions and add no
write path. Separate feature state prevents preview refresh from replacing an
open thread or composer, and route/account changes cancel prior reads.

Pending/lost generations and failed dependencies remain unavailable, with old
cards cleared until a successful reload. Deleted topics and withdrawn parents
are hidden even before retained projections catch up. The browser checkpoint
exercises edit, stopped materializer, restart, projection loss/rebuild, deletion
and withdrawal through actual services. Reply counts retain the existing
structural definition including removed posts; chosen names are not verified
profile identities. Full deployment, erasure/retention and operational gates
remain open.

## Member reviews and ratings: canonical SQL variation

Member reviews are a separate pure domain in `sdk/features/review/core`, hosted
by the Review module in the existing Discussion management runtime. They are
not discussion topics or Editorial publication reviews. This workflow uses
canonical SQL reads without a disposable projection: its payload is bounded to
a public name, an integer 1-5 rating and at most 6,000 plain-text characters.
Immutable versions and the small relational facts used by its public summary
fit in the same transactional store. Adding an asynchronous copy would introduce
a second consistency boundary without a required independent read representation.
This choice needs the SQL rollback/restart/consistency qualification recorded in
the implementation progress; it does not waive backup, load or restore gates.

`review_applications` serializes writes to one tenant/application. The canonical
member/application slot in `member_reviews` has a stable UUID, monotonic aggregate
revision, immutable `review_versions` reference, author withdrawal and independent
staff-hidden flags. Publishing immediately exposes a member review when both
flags permit it, consistent with member discussion publication. Editing or
republishing never clears a staff hide. Staff restoration never cancels author
withdrawal. Only the author edits/withdraws; tenant administrators moderate other
members' reviews. App ownership grants no review moderation or purchase badge.
All mutations authorize at the use-case boundary through explicit `review.*`
OPA actions and canonical tenant/author checks under the application lock.

Content versions, helpful membership, reports, aggregate/application revisions,
actor-scoped historical command receipts and the `review_events` journal commit
in one SQL transaction. Every mutation needs `Idempotency-Key` and the expected
review revision (zero only for a new member slot). Identical retries return their
original receipt without reapplying changes; reused keys with different commands
conflict. New accepted commands advance the revision, even for an unchanged
helpful choice. Authors cannot mark their own review helpful or report it.
Reports retain the exact immutable content version; one member can report a
particular content version once. A staff decision resolves all currently open
reports at its expected review revision. Concurrent reports force a stale
moderator to reload. Public responses contain no account or reporter IDs.

The journal is durable change intent for future feed/notification consumers;
those consumers and their delivery are not implemented by this workflow. It
does not claim broker delivery or event-sourced recovery. Any future projection
must follow the complete snapshot, outbox, monotonic revision and reconciliation
rules in this document before it becomes an advertised consumer.

List/detail/report/summary reads use an InnoDB repeatable-read snapshot. Rating
bins and totals derive from current, visible canonical reviews in that snapshot;
the empty average is null. Helpful totals derive from unique membership facts.
There are ten results plus one keyset lookahead, ordered by creation time then
UUID. Public summary uses the same aggregate query without fetching review text.
The current canonical Editorial application gate is checked before and after
reads, then the application revision is rechecked to reject concurrent changes.
This makes current withdrawal/moderation effective without waiting for Mongo or
RabbitMQ. Missing canonical references fail closed; unavailable dependencies
must not appear as empty pages or zero ratings. API responses are no-store.

`MemberReviews1791676827000` is an additive explicit migration; normal API startup
refuses pending migrations. It verifies column types/nullability, transactional
engine, binary collation, ordered full indexes and enforced checks. Rerunning a
completed migration cannot recreate a missing authority table. Destructive down
is refused. Backup/restore must include all seven review tables consistently;
retaining only the journal or the latest content is insufficient. Withdrawn and
hidden records, historical content, reports and receipts remain durable. Global
account erasure/retention policy and deployment qualification remain open.

The API portal selects a separate lazy real review page; demo sample reviews
stay explicit. Overview member scores come from the canonical review summary,
separately from imported Editorial ratings. Uncertain writes retain their exact
request in session memory across route changes, and account changes/full browser
reload clear that local retry. Saved server receipts remain authoritative.

## Private application image uploads

Editorial owns private image reservations in `application_image_uploads` and
durable intents/receipts in `application_image_commands`. Creation binds one
draft, logo/banner purpose, declared format, byte count and SHA-256 digest.
The shared application workspace lock serializes upload mutations with draft
deletion and capacity checks. Actor/tenant authority comes from trusted ingress,
explicit self-workspace policy and canonical SQL; catalog projections grant none.

This private workflow has no projection: reservation/status/preview reads consult
current SQL, and uploading does not change reviewed or public content. Its
materialization variant is immutable object storage followed by fenced SQL
completion. SQL reserves a 30-second processing lease before object I/O, with
three executions per intent and ten per upload. Normalization and object writes
run outside SQL locks. Only the current lease and expected revision can atomically
record ready metadata and its receipt. A failed SQL commit leaves an unreferenced
object; a failed worker cannot make partially uploaded content ready. An observed
failure releases only its own lease; a lost process recovers after lease expiry.

Objects use server-derived immutable keys in a dedicated private bucket. A
conditional PUT conflict is recoverable only when the stored length, format and
complete digest match. No source filename, EXIF/ICC or source bytes are published.
Inputs are bounded PNG/JPEG/WebP still images, re-encoded to bounded WebP. Both
request buffering and decoding have concurrency/size/time bounds. Preview access
is checked again after object retrieval, so draft deletion cannot be bypassed by
an earlier metadata read. Completed command replay requires no decoder/object I/O.

The additive `ApplicationImages1791676814000` migration validates schema, values,
ownership, attempts, leases and receipt relationships on reentry. It refuses
destructive rollback. Editorial now refuses pending migrations during normal
startup; explicit `--migrate` runs all registered migrations first.

Expiration frees pending quota. Revision-bound cancellation and durable cleanup
now retire unreferenced objects as described below. Uploading alone leaves
images private; public references require the submission/approval protocol below.

### Cancellation and retention

`GET /api/me/application-images?draftId=...` lists ready and unexpired pending
uploads for a live draft owned by the current actor and tenant. The list is bounded
by the retained-upload limit. `DELETE /api/me/application-images/:id` requires
`expectedRevision`, `Idempotency-Key` and the dedicated self-workspace cancel policy.
It refuses any draft, frozen-submission or public reference. Cancellation advances
pending revision 1 to cancelled revision 2, or ready revision 2 to cancelled
revision 3. The tombstone, cleared descriptor/processing lease, cleanup intent and
command receipt commit in one SQL transaction. Historical ready receipts remain
replayable but do not restore readiness or bytes; status must be read separately.

`application_image_cleanup` is durable work, not a disposable projection. Automatic
retirement uses the same upload-row lock as reference insertion and upload
completion. It rechecks all three reference tables under the lock. Unreferenced
pending reservations expire at their 24-hour deadline; unreferenced ready uploads
become eligible seven days after upload creation (not after reference removal).
Unreferenced images of deleted drafts are eligible immediately. Any reference,
including historical submissions and inherited publication, retains its image.
Private quota is reclaimed when SQL retirement commits; storage failure leaves
physical bytes pending cleanup. This is not cross-service account erasure.

Cleanup claims a fenced 30-second lease and performs object I/O outside SQL locks.
Failures retry with exponential backoff capped at five minutes and at most eight
attempts per operator-approved run. Process loss recovers after lease expiry;
stale or backwards-clock completion/failure cannot acknowledge another lease.
Failed jobs remain visible through maintenance status and require explicit requeue.
The additive `ApplicationImageCleanup1791676816000` migration validates binary
transactional schema, lifecycle timestamps and receipt/reference relationships.
Completed migration history rejects a missing cleanup table; rollback cannot
erase authoritative tombstones or work.

Retirement replaces private bytes with a permanent zero-byte marker at the same
key. It inspects the current ETag and conditionally writes the marker using
`If-Match`, or `If-None-Match: *` for an absent key, retrying at most three generation
races within a 20-second deadline. An exact existing marker confirms prior success.
All upload writes remain conditional, so a delayed upload cannot recreate retired
bytes even after a lost cleanup receipt. Markers and SQL tombstones must be retained.
The dedicated bucket must remain unversioned: enabled or suspended versioning is
refused because replacing its current object would retain older image bytes.
Do not enable versioning or lifecycle deletion on this bucket; reserve that
configuration authority for operators. Backup/restore consistency still needs
separate deployment qualification.

`EDITORIAL_MEDIA_CLEANUP_ENABLED=true` opts the API into serial one-second ticks,
each scanning at most 50 retirement candidates and processing one cleanup attempt.
It defaults to disabled. `--media-cleanup` performs a bounded one-shot batch;
`--media-cleanup-status` reports counts and up to 20 failed jobs;
`--media-cleanup-requeue <image-id>` retries one failed job. All three require
completed migrations and start no HTTP server or broker consumer. Batch exit 2
reports scheduled/unconfirmed/failed work or retained failures, not successful
reclamation. Provisioning and activation remain explicit operational work.

### Portal image recovery

The API portal separates upload from attachment: a ready private upload becomes
a draft image only after an explicit revision-bound selection. Removing a slot
does not cancel an upload or erase a frozen submission. Retained uploads come
from the canonical scoped list; browser state grants no authority.

Before each reservation, upload, attachment or cancellation, the portal retains
the exact command, revision and idempotency key in session storage. Recovery is
scoped to a SHA-256 fingerprint of the current session; it contains no bearer
token, source filename or file bytes. A storage failure prevents a new command
from being sent. Switching accounts/sessions clears local intent and private
previews, cancels subscribed reads and fences delayed continuations. Route changes
retain an in-flight command; retry continues the original draft's operation.

After reload, a reserved upload needs the original file's matching format, length
and complete digest. Its original key is reused. No-file cancellation first
recovers a reservation receipt when necessary, then reads the current upload
revision. Canonical absence clears that local retry without claiming a server
cancellation. Recovery remains available in the workspace even when the original
draft is unavailable. A historical ready upload receipt is followed by a fresh
canonical status read before the portal presents that image as usable.

An acknowledged attachment rereads the draft. It advances local revision only
when the returned receipt/current revision and saved text agree, retaining any
unsaved form text. Competing changes remain conflicts. Previews use explicit
owner, canonical-source or frozen-submission authority routes; MIME, byte length
and digest must match the loaded immutable descriptor. Blob URLs are revoked on
replacement, account changes, image decode failure and component destruction.
Legacy external references are deliberate links, never automatic private-page
image requests. Canonical merges require a separate saved/canonical choice for
each slot. Unknown legacy submission snapshots require author resubmission and
cannot be approved from the portal.

### Image association and publication

`application_draft_images` stores a complete pair of canonical slots per draft.
An image command accepts only the expected draft revision, purpose and nullable
upload ID. The upload must be ready and belong to that draft's owner/tenant.
It shares the workspace lock, draft revision and command-receipt transaction;
no projection is needed for private SQL image reads. Text saves preserve images.
Verified-owner editing copies current canonical references; explicit rebase can
select draft/canonical content independently for logo and banner. Copied inherited
references remain usable if the original private draft is later removed.

`application_submission_images` freezes both slots at submission. Private edits
do not mutate the reviewed snapshot. During approval, canonical `app_records`
media URLs and `application_published_images` references commit with the decision,
public revision, receipt and existing materialization outbox. The snapshot reader
includes those canonical URLs at the same revision as the published text.
Uploaded public URLs require the configured HTTP(S) `EDITORIAL_MEDIA_PUBLIC_ORIGIN`
and stay within the existing 255-character media URL contract. Only server-derived
legacy external URLs can be copied; the association command cannot provide one.

Reference writers lock uploaded asset rows in sorted ID order and revalidate
tenant and immutable descriptor before writing. This is also the required
serialization point for retention; cleanup must never retire a referenced asset.
SQL transactions never perform object I/O. Objects remain private and unchanged;
publication changes canonical references, not bucket permissions or object bytes.

Private draft, canonical-source and frozen-submission preview readers use their
respective owner/grant or independent-review authority. Public reads join the
current lifecycle, canonical media URL and published reference without consulting
Mongo. They require public tenant, active visibility and the exact current slot
and upload. All readers recheck authority and asset identity after object I/O.
Withdrawal/deletion/suspension and URL replacement therefore deny stale public
URLs during projection lag. Reads are WebP with no-store/nosniff response headers.
Private editing-draft deletion removes its own references without erasing a
separately owned canonical publication.

`ApplicationImageBindings1791676815000` validates binary transactional schema,
physical column lengths, slot completeness, immutable descriptors, purposes,
tenant relationships and public URL/revision bindings. Existing drafts are seeded
with current legacy URLs during initial/interrupted migration. Completed migration
history prevents a reentry from concealing missing draft snapshots. Historical
submissions with no recorded image rows are explicitly unknown (`images: null`);
they cannot be approved. Resubmission atomically retires an old pending submission
and freezes a complete current image set without withdrawing an existing public
version. Destructive migration rollback is refused.

## Private application drafts

Editorial owns private application authoring in canonical SQL. Saving a draft
does not publish a catalog record, reserve a public slug, verify real-world
ownership, or create materialization intent. This workflow deliberately has no
projection: every read selects the current authoritative row for the trusted
owner and tenant. The submission/publication workflow below uses a separate
immutable submitted version and the existing atomic public outbox protocol.

`application_workspaces` serializes all mutations for an owner/tenant, including
first-create races, the 100-live-draft limit and per-owner slug uniqueness.
`application_drafts` stores bounded name/slug/website/description fields, revision
and lifecycle. `application_draft_commands` retains immutable command receipts.
The application boundary evaluates explicit self-access policy before storage;
SQL selects and changes only that owner/tenant. Browser state and catalog
projections never grant access. Trusted ingress remains responsible for current
identity lifecycle, as with the suite workspace.

Create/update/delete commit the private row and receipt in one transaction.
Updates and deletion require the expected aggregate revision. Concurrent writers
serialize; a stale revision or reused key with different intent conflicts.
Identical retries return the original receipt, including after deletion, without
repeating the effect. Deletion clears payload fields while preserving owner,
revision, timestamp and tombstone. A failed receipt insert rolls back the entire
change. No broker or Mongo write is required to persist or reopen private drafts.

`ApplicationDrafts1791676810000` adds binary-collated InnoDB tables and validates
schema/key shape, bounded stored values, receipts, ownership relationships and
capacity on reentry. Normal API startup requires explicit migration first;
rollback needs a reviewed data-preserving migration. Existing browser drafts are
explicit demo data and are never automatically imported. Draft and public URLs
support up to 2,048 characters after the publication migration below.

The API portal uses canonical revisions, strict response contracts and an
unchanged command/key for uncertain retries. Switching accounts cancels old work
and clears private state; even a previously prepared but unsubscribed command
cannot execute under the next account. Cancellation cannot retract a server
commit. Confirmed saves reread the canonical revision, including same-route edits.
Real SQL/OPA/compiled-API/browser qualification covers these failure windows,
capacity/slug races, deletion replay and process restart. Production ingress,
database restart, restore/rollback and account-wide export/erasure remain open.

## Application submission, review and publication

Editorial copies saved name, slug, website and description into immutable
`application_submissions` identified by `(applicationId, submittedRevision)`.
The application UUID is the draft UUID. Later private edits never change the
submitted payload. Assigned reviewers or administrators in the same tenant can
approve/reject; the canonical author cannot review their own submission. A
rejection requires a reason and leaves any previous publication intact.
Publication records the submitter as the catalog author; it does not verify
real-world ownership. Claims, verification and existing-record authoring remain
separate work. Direct Editorial writes still require their existing role policy.

The owner workspace lock serializes draft changes, deletion and decisions.
All commands require an expected aggregate revision and an actor-scoped key;
immutable receipts live in `application_publication_commands`. Public writes
lock the catalog record before its lifecycle row, matching direct Editorial
writes. Canonical owner/tenant checks precede replay under those locks.
Submission records the current public revision. Approval refuses to overwrite
public content changed through another Editorial command since submission.

Approval atomically commits the decision, draft revision, `app_records` content,
public lifecycle/revision, `application_publications` pointer, command receipt
and `editorial_outbox` intent. Public and private revisions are independent.
If a subsequent direct Editorial update changes the public revision, the owner
can still open the public record, but status no longer identifies it as the
previously approved submission. Slug uniqueness is global for public records;
a collision leaves review pending and commits no partial decision.

Withdrawal cancels pending review and tombstones public visibility in SQL before
the projection catches up. Draft deletion also removes submissions and the
publication pointer and scrubs public/private text and media URL fields. Public
slug reservation, ownership, revision tombstones and receipts remain. Replaying
an old successful command cannot republish withdrawn or deleted content.
Never-published draft deletion needs no public event.

Publication uses the existing `app` snapshot, confirmed dispatcher, bounded
consumer, monotonic Mongo store and SQL rebuild/reconciliation pipeline. No new
projection kind is introduced. Snapshot readers use public canonical content,
never the current private draft. Catalog reads check authoritative visibility
and revision around projection I/O; missing/stale content returns retryable 503,
withdrawn/deleted content returns 404. Old events reread current authority and
old projected documents cannot replace a newer tombstone.

`ApplicationPublication1791676811000` adds the three tables and widens the
nullable public website column from 500 to 2,048 without truncation. Command,
snapshot, response and storage limits agree. Reentry validates binary transactional
schema, immutable values, reviewer independence, pointer/receipt relationships
and bounded timestamps/revisions. It rejects corrupt history instead of silently
rewriting it. Explicit migration precedes normal startup; rollback requires a
reviewed data-preserving plan. Account-wide erasure, production ingress, database
restore/rollback and deployment remain unqualified.

`qualify-suites.cjs --application-publication --delivery` exercises this writer
with real MySQL/Mongo/OPA, compiled API, independent browsers and RabbitMQ. It
injects outbox failures, lost responses/acknowledgements, competing reviewers,
corrupt migration input, projection loss and stale delivery. Browser projection
timing is controlled to expose lag; trusted identities and unrelated shell
account responses are fixtures. See the publication checkpoint for exact evidence.

## Application ownership

Claims and grants belong to Editorial's canonical SQL authority. The ownership
policy, confirmed by the user on October 11, 2026, requires an exact-host DNS TXT proof of the recorded application website
and independent `editorial:ownership-reviewer` approval. A claimant cannot replace
the hostname through claim input, and a content reviewer does not implicitly
have ownership-review permission. Domain proof demonstrates website control;
staff must separately judge the claimed relationship to the application. Later
content changes still require independent review before publication.

Private claims have immutable target/evidence/challenge metadata and revisioned
lifecycle. There is no claim projection. `application_ownership_checks` persists
DNS reservations and bounded recovery metadata separately from the claim revision.
Verification runs outside locks and commits the observed result/claim revision
with an immutable receipt only while its lease and expected revision remain
current. A lost process can retry the same key after lease expiry; stale workers
cannot overwrite the replacement check. Three executions per intent, ten per
challenge and the 30-second check interval bound retries. Missing proof is not a
provider outage. Tokens expire after seven days; approval needs proof observed
within 24 hours and the unchanged canonical application revision.

Approval changes the SQL resource owner/revision, current grant, claim, decision
history, receipt and outbox in one transaction. Release/revocation deactivates
the grant and advances revision/intent atomically. Replaying an approval returns
its historical receipt without restoring the grant. The existing application
snapshot/materializer remains authoritative for public projection content;
projected ownership never grants write permissions. Decision reasons and actors
remain in immutable decision history even after release/revocation.

Ownership and editing migrations are registered for API startup and maintenance.
Private `application_editing_targets` bind a separate draft UUID to its immutable
canonical application UUID and claim ID, plus the revision from which its
content was prepared. Canonical source/draft reads use consistent SQL snapshots;
no private claim or editing projection is introduced. Creation and explicit
rebase require the active grant and current revision under the catalog-row then
lifecycle-row lock. Rebase commits user-selected fields, source revision, pending
review cancellation and receipt atomically. It creates no public outbox event.

Publication rechecks the pinned grant under the same canonical lock, independently
of reviewer permission. A later public revision conflicts with stale submission,
approval or withdrawal. Approval commits frozen content to the existing canonical
ID, advances the editing source revision and public/private revisions, and writes
the publication pointer, receipt and outbox in the same transaction. Multiple
private drafts of a canonical application cannot both overwrite one source
revision. Later private edits remain private. Publication tables retain their
historical `applicationId` column name as the private draft ID; editing targets
resolve the actual public ID. Migration preflight follows that relation and
validates historical owner changes against recorded ownership decisions.

Private ownership remains with the draft's author after a transfer. Removing an
editing draft, or a former author's unbound draft, scrubs private payloads and
submissions without withdrawing another owner's public content. Historical
receipts remain replayable without writes. Any grant history retires unbound
publishing authority, even when the claimant and original author are the same
identity. Revoked grants and obsolete claim IDs cannot be reused; a later grant
needs a new editing draft. Direct trusted Editorial publisher/moderator roles
remain separately governed by their existing policy.

Real SQL/Mongo/OPA/native-DNS and compiled HTTP qualification covers these paths,
rollback, competing edits, corrupted bindings, two API restarts and policy outage.
The API portal exposes claim/proof/review/release/revocation and verified editing.
Staff list views explicitly select pending claims or approved grants, remain
tenant-scoped and omit self-claims. They read canonical SQL and create no new
projection. Source refresh preserves unsaved private text; only an explicit merge
accepts the selected fields against the loaded canonical revision. Old claim-bound
drafts remain privately editable after revocation but cannot regain public rights.
Confirmed content publication still uses the immutable submission and existing
canonical application ID. Session changes clear private caches and cancel obsolete
responses. Uncertain commands retain their exact key and intent across routes;
retry completion identifies the original application or staff review target.

Independent browsers now exercise real SQL/Mongo/OPA and the compiled API with
controlled native DNS, process restarts, lost responses, conflict merging,
revocation/reapproval, private cleanup and public projection lag/recovery. The
browser run controls projection publication; prior unchanged broker-recovery
evidence remains separate. Shell account data and ingress identities are fixtures.
Public authoritative DNS, deployed identities, database restart, restore, rollback,
load and soak remain unverified operational gates.

## Release publication

Editorial owns private release drafts, immutable submissions and approved canonical
notes. A draft pins its application UUID, canonical release UUID and original
ownership claim. Creating/opening/rebasing requires the current verified grant;
submission/approval repeat the grant and parent visibility check under the same
catalog-row then application-state lock used by ownership changes. Independent
`editorial:reviewer` permission is separate from ownership-review permission.
The draft's author cannot review it, including as administrator. Revocation leaves
private work editable/removable but permanently retires its publication authority.

`release_workspaces` serializes owner capacity and command receipts. Staff commands
lock the actor and author workspace in sorted order. `release_drafts` contains
bounded private notes and a monotonic private revision. Canonical private reads
require no projection. `release_commands` holds actor/tenant-scoped immutable
receipts. A failed receipt rolls back the write; unchanged retries return the
original outcome without replaying the mutation. Current authorization still gates
the request. Historical receipts do not restore revoked grants or withdrawn notes.

Submission freezes notes and the source public revision in `release_submissions`.
Approval copies only that reviewed snapshot into `release_publications`, advances
the independent `release` lifecycle revision, and commits its decision, draft
revision, receipt and `editorial_outbox` intent in one SQL transaction. Notes are
bounded to 16,000 serialized UTF-16 units, allowing the complete UTF-8 projection
to remain below the shared 128 KiB bound; no mutable object payload is needed.
Version identifiers are bounded URL components, unique per tenant/application.
A published version remains reserved and cannot be renamed, even after withdrawal.

Commands require expected private and public revisions. Concurrent drafts cannot
overwrite an intervening publication; explicit rebase cancels pending review and
accepts the caller's chosen notes against the current canonical revision. A new
ownership grant requires a new private draft. Deleting private work removes its
submission payloads and scrubs its notes while retaining revision/ownership
tombstones and receipts. The canonical copy of already reviewed notes survives;
public removal requires withdrawal. Withdrawal retains approved canonical metadata
and publishes a newer payload-free tombstone.

The standard confirmed outbox, bounded consumer, compare-and-replace Mongo store
and SQL rebuild/reconciliation support `release`. Snapshots read canonical notes
and lifecycle in one consistent transaction; they never read current draft fields
or rely on broker history. Parent metadata and visibility are deliberately absent
from the release projection: otherwise a parent change could produce different
content behind the same release revision. Public reads select the active parent
and exact release revision from SQL, load the validated projection, then repeat
the SQL selection. Parent withdrawal/deletion/suspension therefore denies access
despite stale public release documents. Missing/stale projections return retryable
503, absent/hidden content 404, and all responses are `no-store`.

Public browsing accepts a validated channel and an exclusive earlier-release-date
bound. Both filters and their page totals are selected from canonical notes and
rechecked around projection I/O. A previous-release list therefore uses real
pagination, not a filtered subset of the latest page. Private publication status
adds current public parent labels for owner/reviewer context; hidden parents
return null context. Those labels are not immutable submission fields and do not
change the release snapshot or grant permission.

The API portal uses `/my/releases` for private drafts, source comparison and
explicit merge, and `/editorial/releases` for independent frozen-snapshot review.
Public `/apps/:appSlug/devlog` and version routes use the release API; fixtures
remain confined to explicit demo mode. Write intent and retry keys stay in the
feature service across client navigation. An unconfirmed command prevents another
mutation until resolved; a session change fences pending reads/writes and clears
private state. This recovery is in memory and does not survive a full document
reload or browser termination. Private drafts and receipts remain durable in SQL.
Reload/merge actions are explicit; source refresh preserves unsaved fields.
Confirmed late writes refresh visible lists without replacing another editor.

`ReleaseWorkspace1791676817000` adds case-sensitive InnoDB storage and validates
physical schema/indexes, ownership grants, immutable snapshots, timestamps,
capacity and receipts on reentry in bounded batches. An already recorded migration
refuses to recreate missing tables. Destructive rollback is refused. Upgrade
consumers to understand `release` before enabling these publication routes;
old writers/workers are not rollback qualification. Local API/store/broker evidence
is recorded in the backend checkpoint; portal and gateway evidence is tracked in
the release portal checkpoint. Deployment, database restore/rollback and load/soak
remain separate operational gates.

## Article publication

Editorial owns account-scoped article drafts at `/api/me/articles`, immutable
submitted revisions and the canonical reviewed publication. Article creation
does not require an application ownership grant. Its byline is deliberately
supplied public text reviewed with the article; private account/profile identity
is never copied into public content. Structured headings and paragraphs are plain
text, with bounded lengths, section counts and total serialized content. There is
no HTML rendering or fallback to fixture bodies. Reviewed covers follow the
protocol below; article comments remain separate required work.

The `ArticleWorkspace1791676818000` migration creates `article_workspaces`,
`article_drafts`, `article_submissions`, `article_publications` and
`article_commands`. It verifies case-sensitive columns, InnoDB, exact indexes,
bounded valid payloads, receipt/authority relationships and independent reviewers.
It refuses silent recreation of a missing completed table and destructive down
migration. Apply it explicitly before API startup; normal startup performs no DDL.

Every mutation binds an idempotency key to the actor/tenant and complete command.
Private updates/deletion bind the saved draft revision; submission, review and
withdrawal additionally bind the expected public revision. Sorted owner/reviewer
workspace locks serialize cross-author review receipts without crossed lock order.
The private draft, its mutation receipt and any submission change commit in one
SQL transaction. Private edits need no projection: their reads use SQL directly.
Later private edits never change the immutable submitted snapshot or approved
public payload. Rejection retains the prior approved content and records an
author-visible review reason. Staff, including administrators, cannot review their
own submissions.

Approval freezes the reviewed payload in `article_publications` and atomically
advances `editorial_resource_states`, inserts an `article` outbox intent and
records the command receipt. Withdrawal atomically advances the same public
lifecycle and outbox while cancelling any pending review. The first publication
date remains stable; later approval changes the update date. The article UUID is
also its private draft ID. Its public slug becomes permanent after first approval
and remains reserved after withdrawal and private deletion.

Deleting a private article requires withdrawing published/pending content first.
Deletion scrubs private fields and submission rows, retaining reviewed canonical
payload, receipt identity, reserved URL and lifecycle tombstone. An old create,
approve or withdraw receipt returns its historical outcome without reapplying it.
Account-wide erasure remains a distinct unfinished workflow; private draft
deletion must not claim that all retained records have been erased.

The existing Editorial snapshot reader, outbox publisher, projection consumer and
reconciler understand `article`. A snapshot comes from one consistent SQL read;
the resulting complete Mongo document follows the common revision/hash/tombstone
protocol. Publisher confirms and consumer acknowledgements remain separate.
Lost acknowledgements, duplicates, reordering and rebuilding deleted projections
must preserve canonical revisions, including withdrawal tombstones. Upgrade
workers before enabling article publication; compatibility with older workers is
not established rollback evidence.

Public `/api/catalog/articles`, `/:slug` and `/api/catalog/article-selection`
perform bounded current SQL selection, require exact matching tenant, lifecycle,
revision and publication metadata in Mongo, then repeat SQL selection before
returning. Search matches titles; category and tag filters are exact. Browse pages
contain at most 20 articles and ID selection at most 50. Projection lag/corruption
returns unavailable, and current withdrawal prevents disclosure even while Mongo
still holds an older public document. Private drafts never supply public results.

Account favorites save only canonical article UUIDs. New additions consult the
same public selection boundary. Existing references remain removable after
withdrawal or an Editorial outage; they grant no visibility. Metadata uses current
approved article previews and displays unavailable references without stale text.
Favorites relation/revision/receipt/outbox changes remain in the account transaction;
there is no cross-service transaction or additional article projection.

The API portal composes article behavior through feature services and ports at
`/my/articles`, `/editorial/articles` and public `/articles` routes. The workspace
retains exact unconfirmed commands and keys across client navigation and fences
continuations on account changes. Full document reload/browser termination does
not preserve this in-memory retry state. Drafts and receipts remain durable in
SQL. Explicit demo routes retain the previous fixture pages. Local qualification
evidence and remaining comment/deployment gates are tracked in
`IMPLEMENTATION-PROGRESS.md`.

### Article covers

Article covers use an article-specific contract: a reservation accepts only the
article ID and exact source MIME, byte count and SHA-256. It accepts no application
draft, purpose, object path or owner. Article fields optionally contain
`cover: { imageId, alt }`, with a canonical UUID and 1-300 characters of plain-text
alternative text. Absence of a cover remains absent in serialized text-only
payloads, preserving earlier hashes and projection compatibility.

`ArticleCovers1791676819000`, `ArticleCoverReferences1791676820000` and
`ArticleCoverCleanup1791676821000` add uploads/commands, references and cleanup.
Apply them before normal startup. Reentry validates descriptors, ownership,
references, processing leases, cleanup and receipts; destructive down migrations
are refused. The private bucket and decoder are shared with application images,
but cover keys use the server-owned `article-covers/v1/<uuid>.webp` namespace.
PNG/JPEG/WebP inputs are bounded to 8 MiB, 20 million pixels and 8,192 pixels per
dimension; normalized WebP fits 2,560 by 1,440 pixels. Source metadata is stripped.

Reservations expire after 24 hours. Per owner/tenant limits are 20 pending, 100
new reservations per rolling day and 200 retained ready/unexpired uploads.
The processing lease lasts at most 30 seconds, with three executions per command
and ten attempts per upload. Normalization and immutable conditional object PUT
occur outside SQL transactions. Only the current lease can complete ready metadata
and its durable receipt. Failed SQL completion can leave an unreferenced object;
an exact retry verifies and reuses it. Private upload commands need no projection.

`article_cover_references` has one row per article and reference kind: draft,
latest submission, and canonical publication. Saving fields, freezing a submission
and approving publication replace their corresponding reference in the existing
article transaction. Reference insertion locks and validates the ready upload's
exact article/owner/tenant; cleanup takes the same upload lock. Approval still
commits publication, lifecycle, receipt and outbox together. Later private edits
cannot replace either the frozen submitted image/description or approved cover.

The latest submission reference survives approval/rejection/cancellation until a
new submission replaces it or private deletion removes it. Older submission
metadata does not permanently retain image bytes. Canonical publication retains
its reviewed cover even after withdrawal/private deletion, alongside the retained
reviewed payload. Publishing a replacement cover releases the previous canonical
reference. No public access is granted by retention, browser state or Mongo.

Owner upload previews require a live private article. Owner/reviewer submission
previews require the exact latest submitted revision and the appropriate current
authority; staff cannot review their own articles. Public
`/api/media/articles/:articleId/:imageId` reads require the configured public
tenant, current live canonical publication and exact approved cover. All readers
repeat authority checks after object I/O. Withdrawal with stale Mongo therefore
withholds already-loaded bytes. Responses use no-store, nosniff and a sandbox CSP.

Unused ready uploads become eligible seven days after creation; unused pending
uploads at expiry; unused uploads of deleted drafts immediately. Any reference
blocks cancellation/retirement. Retirement atomically commits a tombstone and
durable cleanup intent. Cleanup uses a 30-second fenced lease, bounded backoff
and eight attempts before explicit operator requeue. The shared unversioned
private bucket keeps permanent empty markers at retired keys to fence delayed
uploads. Run `--article-cover-cleanup`, `--article-cover-cleanup-status` or
`--article-cover-cleanup-requeue <cover-id>` for bounded maintenance. The existing
`EDITORIAL_MEDIA_CLEANUP_ENABLED` setting also controls cover cleanup ticks;
activation and deployment restore/rollback remain unqualified.

The lazy API portal provides upload/resume/list/preview/cancel, required alternative
text, draft cover selection/removal, frozen staff review and approved public
images. Selection is an unsaved article edit until the article is saved. Before
upload mutations, session storage records the exact intent/key under a hashed
session scope without bearer tokens, filenames or file bytes. Reload recovery
requires the exact original file; unresolved reservations can be recovered and
cancelled without it. Account changes clear private retry state, fence late
results and revoke preview URLs. This durable local retry applies to cover upload
commands; article field saves retain the earlier in-memory retry contract.

### Article comments

Article comments use the existing Discussion write/receipt/outbox, immutable
MinIO payload, RabbitMQ and Mongo generation protocol. A top-level comment is a
Discussion aggregate; its replies are comment nodes. The authoritative aggregate
stores an immutable `subjectKind = 'article'` and canonical article `subjectId`.
This is separate from an ordinary discussion's optional subject association.
The root, target binding, revision, command receipt and materialization intent
commit in one SQL transaction. Failed SQL commits may leave an unreferenced
immutable object, never a visible partial comment.

`GET/POST /api/article-comments/:articleId`, `GET/PUT/DELETE /:id`, and
`POST /:id/replies` are the only routes that expose or mutate linked comments.
Generic Discussion list/detail/reply/edit/delete paths refuse these aggregates.
Generic Mongo head selection excludes article bindings before its bounded limit,
so article activity cannot crowd ordinary discussions out of that listing.
Read responses expose chosen public names, plain text, timestamps, structural
redactions and application-computed edit/remove controls. They never expose
private account IDs. An entered public name is not a verified profile identity.

The Discussion application calls Editorial's canonical SQL-backed
`GET /api/catalog/article-visibility/:id` authority before reads and mutations,
again after object/projection I/O, and checks tenant scope. The adapter uses a
bounded three-second request and 4 KiB response, refuses redirects and sends no
identity credentials. Missing/withdrawn parents deny access; an unavailable or
malformed authority response fails closed. An article projection is unnecessary
to determine eligibility. Retained comments become readable again if that same
canonical article is republished. No distributed transaction spans Editorial
and Discussion: a write can race withdrawal after its final authority observation.
Subsequent reads still check current authority and deny while withdrawn.

Authenticated members use explicit `discussion.article-comment.*` self-workspace
actions; no generic discussion-writer role is needed. Application and locked SQL
checks enforce canonical ownership/tenant scope. Authors may edit their own text;
the existing tenant-scoped `admin` role may remove another member's comment but
cannot edit it. Root removal hides the entire thread. Reply removal preserves a
redacted structural entry; the article reply count includes these placeholders
so readers can still open the conversation. Deletion never resurrects through an
older event or historical command receipt. Withdrawal retains the comments; it
does not constitute account erasure or object retention cleanup.

Every write requires `Idempotency-Key`; edit/removal also require the expected
aggregate revision. Fingerprints include the article binding. Concurrent replay
converges on the original receipt, and successful receipts say projection
`pending`. The generation fingerprint/head includes `subjectKind` only when
present, preserving unbound legacy fingerprints. A changed binding at the same
revision conflicts. Article reads require an exact subject kind/ID, tenant and
revision, with complete authoritative membership. Existing bounded retries,
complete snapshots, broker confirmations, retained tombstones, rebuild and
reconciliation remain in force.

Public root listing uses authoritative keyset pagination ordered by creation
time descending and UUID ascending: ten roots and one lookahead. Only root
payloads load for this list; opening a thread loads its bounded generation.
Comments accept up to 4,000 plain-text characters and an explicit public name of
up to 80 characters. The existing limits of 2,000 total nodes and depth 64 apply
to each thread. Bodies are limited to 32 KiB at the local gateway. These bounds
are not an abuse-rate policy or a load qualification.

The API portal keeps an unconfirmed exact command and key in session-scoped
memory across route destruction/navigation. It blocks a new command until that
attempt resolves, clears private intent/forms on account changes, and fences late
responses. Full page reload loses this local retry intent; it does not undo a
committed write. Definite conflicts preserve text for comparison and require
explicit selection of a current revision. Accepted writes and unavailable public
projections are presented separately, with explicit reload controls.

Run `DiscussionArticleTargets1791676822000` via explicit Discussion `--migrate`
before starting the updated API or materializer. Normal API startup refuses
pending migrations; demo seeding requires `DISCUSSION_SEED_DEMO_DATA=true`.
Populated migration reentry validates the binding schema and canonical IDs;
destructive down migration is refused. Compose includes a migration prerequisite
and configures `EDITORIAL_URL`/`DISCUSSION_PUBLIC_TENANT`. Upgrade materializers
before enabling bound comment writes; old workers are not rollback-compatible
with article bindings. Kubernetes migration/runtime provisioning and production
rollout/recovery qualification remain open. Local evidence and its substitutions
are recorded in the article-comments checkpoint when accepted.

### Application discussions

Application topics use the same authoritative Discussion write protocol and
complete-generation materializer as article comments. Their immutable aggregate
binding is `subjectKind = application` plus the canonical application UUID in
`subjectId`. The slug is only a portal route lookup. Generic Discussion and
article-comment routes reject this binding, and generic projection head queries
exclude both bound families before applying their limit.

`/api/application-discussions/:applicationId` lists ten canonical roots per page
and accepts member topics. `/:id` reads, edits or removes a topic/post;
`/:id/replies` creates replies to a live post. Root payloads contain `title`
(1-120 characters), chosen `displayName` (1-80), plain `text` (1-5,000), and up to
eight distinct normalized tags (1-40 each). Replies contain only public name/text.
The committed node kind chooses the edit schema; a caller cannot turn a reply
into a topic, change its binding, or supply ownership, pinned status or counters.

The application layer checks explicit `discussion.application-topic.*` OPA self
actions, tenant scope and current canonical ownership. Authors edit/remove their
own posts; tenant admins can remove but cannot replace another author's text.
Public reads disclose chosen names without private identity IDs. Root deletion
hides its entire thread; reply deletion preserves a redacted structural entry.
The reply count includes these placeholders. List reads load root payloads only;
detail traversal retains the existing 2,000-node/64-depth bounds.

Editorial's no-store `/api/catalog/application-visibility/:id` reads current SQL
catalog eligibility and revision without requiring an application projection.
Discussion checks it before and after projection/payload I/O. Withdrawal,
suspension, deletion, another tenant or unavailable authority denies access;
retained generations never grant permission. Restored publication of the same
application UUID restores the association. As with articles, the last successful
authority observation and the Discussion SQL commit do not share a distributed
transaction. A withdrawal racing after that observation may coexist with a
committed post; subsequent reads still check current visibility.

Command receipts, binding, revision and outbox intent remain atomic; MinIO
payloads remain immutable and unreferenced objects can remain after a failed SQL
write. The materializer retains the actual kind in snapshot fingerprints and
heads, converges duplicate work, rejects inconsistent same-revision snapshots,
and rebuilds after complete projection loss using canonical SQL and payloads.
No projection is generated in a portal request.

Run `DiscussionApplicationTargets1791676823000` through explicit `--migrate`
before API startup. This protocol-upgrade marker revalidates the existing target
column/index and populated bindings; no new DDL is needed after the article
migration. Index validation reads MySQL's explicit `SEQ_IN_INDEX` order instead
of relying on unordered ORM introspection, and rejects wrong key order, unique
or prefix indexes. Startup refuses an unrecorded migration; destructive rollback is
refused. Upgrade materializers before enabling application-topic writes. Older
workers that only understand article bindings are not rollback-compatible.

The API portal keeps pending request content/key in session memory across route
changes, clears it when the session changes, and fences obsolete reads/receipts.
Full reload loses the local retry intent. Confirmed receipts and projection lag
have separate states; conflicts preserve text until explicit current-revision
selection. The discussion form lives behind feature ports; pages resolve the
application UUID and compose routes. Demo providers remain explicit. Voting,
the quick dialog and My Discussions extend this protocol as described below.
Topic pinning is also described below. Related-topic ranking and cross-service export/erasure remain separate;
none is inferred from sample statistics.

### Application discussion votes

`PUT /api/application-discussions/:applicationId/:id/vote` accepts only
`{ value: -1 | 0 | 1, expectedRevision }` plus `Idempotency-Key`. Each canonical
actor has at most one signed choice per application-topic root or reply; zero
removes that row. Identity and tenant come from the trusted request actor. The
explicit `discussion.application-topic.vote` self policy, immutable application
binding, current parent eligibility and live public root/post are checked before
writing. Members may vote on their own posts. Generic/article routes cannot
bypass the binding, and legacy `comment_likes` remains a separate protocol.

`discussion_votes` stores authoritative `(nodeId, actorIdentityId)` membership
with binary identity comparison. The existing aggregate lock rechecks the exact
authorized resource and expected revision. Desired choice, next thread revision,
immutable command receipt and outbox intent commit together. Even a new command
requesting the same choice advances the revision once; an exact replay returns
its historical receipt without reapplying the choice. An old add receipt cannot
resurrect a later removal. Vote writes neither upload payloads nor change post
content timestamps. Outbox insertion failure rolls back the choice and receipt.

This is a deliberate variation: there is **no separate vote projection**. A
REPEATABLE READ SQL transaction verifies the exact application-thread revision
and calculates totals and the requesting actor's own choice from canonical rows
in that same snapshot. Reads return at most the existing 2,000 thread nodes plus
one overflow sentinel. Public responses disclose totals and `mine`, never voter
identities; anonymous `mine` is zero. Removed replies disclose no totals or
choice. These traversal bounds do not qualify a high-volume voting workload.

Content still comes from the existing complete Discussion generation at that
exact revision. Vote writes advance its outbox/revision even though content is
unchanged. Reads then recheck current SQL lifecycle, tenant, revision and actual
application binding, followed by current parent visibility. Missing generations,
vote snapshot mismatch, canonical drift or dependency failure produce a truthful
failure rather than combining revisions or inventing counters. SQL votes survive
projection loss; the existing materializer rebuilds content at the latest
canonical revision without replaying votes. No generation schema/fingerprint
change or counter increments per delivery are introduced. The existing final
visibility-observation race remains; there is no distributed parent transaction.

Run additive `DiscussionVotes1791676825000` explicitly before API startup. It
validates InnoDB, signed values, binary identity columns, exact ordered full
primary key, the enforced value constraint and populated row integrity. A lost
completed table, incompatible schema or unrecorded migration fails; destructive
down migration is refused. Deploy the updated Discussion OPA bundle before
enabling vote commands and coordinate the API/portal release because strict
application-post responses now require vote state. Existing application-aware
materializers remain compatible. Any rollback must preserve vote rows and
receipts and use compatible API/portal contracts; operational rollback is still
unqualified.

List, full-thread and quick-dialog controls use real totals and preserve unfinished
composer text when voting succeeds. Uncertain commands retain the exact original
choice/revision/key in memory; conflicts require explicit reload, and account
changes clear private choice/retry state. Full reload loses only local uncertain
intent. Local qualification covers concurrent replay/conflict, atomic rollback,
case-distinct actors, restart, projection loss/rebuild, migration corruption,
withdrawal/deletion and independent browsers. Cross-service erasure, production
identity/ingress, deployment, database restore/rollback and load/soak remain open.

### Application topic pinning

`PUT /api/application-discussions/:applicationId/:id/pin` accepts
`{ pinned: boolean, expectedRevision }` and `Idempotency-Key`. Only an
administrator in the topic's tenant may pin/unpin a live public application-topic
root. Ownership alone grants no pin permission; replies and generic/article
bindings are refused. The application boundary checks canonical tenant/root/
lifecycle/binding, current parent visibility and explicit OPA
`discussion.application-topic.pin`. The policy is role-restricted, not a member
self action. Public `canPin` is a UI hint and never grants mutation authority.

The `pinned` column on `discussion_write_aggregates` is authoritative structural
state, defaulting to false for existing and new records. Pin commands acquire the
existing aggregate lock, recheck the authorized resource and commit pin state,
the next revision, immutable receipt and outbox intent together. A new command
advances once even when requesting the existing state; exact retry returns the
original receipt. Historical receipts cannot restore a pin removed later. Content
payloads and post timestamps do not change. Deletion retains structural pin state
under the existing tombstone but removes the topic from every public pin read.

Pinning adds no projection fields or generation schema/fingerprint changes. The
existing content generation must match the current aggregate revision, then the
public application presentation reads pin state from the rechecked canonical
root. This deliberately keeps small structural state in SQL; pin state survives
projection loss and ordinary content rebuild. Missing generations and changed
authority return pending/unavailable rather than invented or stale pin badges.
Current parent visibility still fences retained generations and pin state.

Application topic pages are bounded to ten roots and one lookahead. SQL orders by
pin state descending, immutable creation time descending and UUID ascending, with
an index matching those directions. Cursors encode `0|1.timestamp.UUID` and
reject unknown groups, unsafe timestamps and noncanonical IDs. There is no
unbounded scan or arbitrary pin-count cap. Each projected topic must agree with
its selected pin group; a second bounded index query rejects order changes during
the page read. Across separate requests a cursor is a position, not a frozen
snapshot: pin changes can move a topic between pages. Reload latest discovers
current ordering. Article and My Discussions pagination retain their existing
chronological contracts.

Apply `DiscussionPins1791676826000` explicitly before API startup, then deploy
the updated Discussion OPA bundle and compatible API/portal together. The strict
application response adds `pinned`/`canPin` and changes its page cursor. Existing
application-aware materializers remain compatible. The additive migration
validates the column/default/engine, enforced boolean constraint and actual full
ordered nonunique index including descending directions. Populated invalid pins,
lost completed schema and incompatible indexes fail; destructive down migration
is refused. Rollback must retain canonical state/receipts and compatible clients.

Lists, full threads and quick dialogs expose moderator controls and public pin
badges. Exact uncertain retries, conflicts, session cancellation and composer
preservation reuse the discussion application service. Account/role changes clear
private intent and refresh permissions. Full reload loses local uncertain intent,
not a committed pin. Local service/browser evidence includes concurrency,
rollback, paging across both groups, migration reentry, withdrawal/deletion,
restart and projection rebuild. The final-observation visibility race and
production deployment, database restore/rollback, load/soak and erasure limits
remain the same as the underlying Discussion protocol.

### Quick discussion dialog

API-mode quick discussions resolve the current application slug through the
catalog port, then use the canonical UUID and existing application-topic API.
Each lazy dialog owns an independent application state service; HTTP bindings
are provided by the portal composition root. The ordinary thread form supplies
reply, author edit/removal and moderator removal behavior. List buttons use
verified service reply counts; an absent count is unknown, not a fabricated zero.
The browser-local dialog is selected only by explicit demo mode.

There is no additional write store, event or projection. Modal commands reuse
the existing canonical authorization, immutable payloads, revision checks,
receipts and durable outbox. Reads still require exact Discussion generations
and current parent visibility. Loading, unavailable metadata, projection lag,
conflict and missing content remain separate truthful outcomes.

The shared memory-only recovery service retains the original uncertain command
and idempotency key across closing/reopening the dialog and route changes.
Each dialog cancels obsolete subscriptions on destruction. Account changes clear
private form/retry state and re-read permissions; full reload loses local retry
intent. Navigation disposes the modal, including navigation during lazy import.
Closing refreshes the originating topic list or My Discussions page so canonical
edits and removed participation are reflected. These UI lifecycle changes do not
alter the existing final-observation race or deployment/recovery limitations.

### My Discussions

`GET /api/me/discussions` is a private, no-store read workflow. The application
boundary authorizes `discussion.my-topics.read` against the authenticated
identity's own tenant-scoped workspace. The query accepts only an optional
cursor; neither a caller-selected identity nor an administrator role permits
reading another account's participation.

Membership comes from `discussion_write_nodes.ownerIdentityId`, joined to the
current aggregate and content-node lifecycle. A live published public topic or
reply qualifies its owner. Multiple replies collapse to one thread; deleting the
last live contribution removes participation, and removing the root hides the
thread immediately. Only immutable application bindings qualify; article and
generic Discussion records remain separate. Identity and tenant comparisons are
binary. Titles and reply counts reuse the existing exact-revision root projection
read. SQL membership and revisions are checked again after those reads; missing
membership is omitted and a changed revision returns retryable pending failure.

This deliberately adds no projection, event, or best-effort persistence path.
The participant index is an ordinary SQL index over existing authoritative
records; all writes, receipts, outbox events, complete generations, tombstones
and rebuilds retain the existing Discussion protocol. Apply the additive
`DiscussionParticipation1791676824000` migration explicitly before startup. It
validates transactional binary ownership and the actual ordered, full-column,
nonunique index; a missing previously completed index or incompatible index
fails. No owner backfill or record rewrite is performed.

Pages examine at most ten eligible SQL candidates plus one lookahead, ordered by
immutable topic creation time descending and UUID ascending. Current canonical
application visibility is checked through the existing Discussion read path.
Hidden parents can produce fewer than ten results, including an empty page with
a continuation; the service never scans without a bound to fill a page. SQL
queries use a three-second execution limit. A cursor is a position, not a frozen
snapshot: subsequent pages can omit removed contributions and Refresh latest
discovers newer topics. Existing cross-service final-observation races apply;
there is no common snapshot spanning every application's visibility check.

The API portal resolves each page's unique application IDs through the real
catalog selection endpoint and validates its current names/slugs before linking.
Missing applications are omitted; unavailable or pending metadata fails the page
without retaining stale cards or replacing them with demo data. The page replaces
each bounded result set instead of accumulating unbounded or stale records.
Account changes cancel old reads, clear private items and reset pagination;
late results are also fenced by the current session. Reload after restart reads
SQL and the existing rebuilt generations. This view covers application topics
with live participation, not historical deleted posts or article-comment history.

## Private suite workspace

Private draft reads deliberately use canonical SQL with no draft projection or
broker dependency. Editorial owns this collection domain;
identity/account preferences and the content-node registry do not duplicate it.
`private_suites` stores the owner/tenant, title, description, ordered application
UUIDs, revision and lifecycle. `suite_commands` retains immutable command receipts.
The owner-scoped `suite_workspaces` row serializes capacity and command retries.

Each command commits the aggregate and receipt in one SQL transaction. Draft
creation/editing emits no intent because the draft has no projection to update.
Deletion also revokes any existing publication in that transaction, as specified
below. Reads select canonical rows scoped to the trusted actor and tenant;
authorization never uses target metadata. A failed receipt insert rolls back the
aggregate. Duplicate commands return the original receipt, and deletion clears
the payload while retaining ownership, revision and tombstone. An old create
receipt cannot restore a subsequently deleted suite. These are the failure/recovery
grounds for this deliberate variation from the projected-content protocol below.

Membership contains stable application IDs, with a limit of 50 per suite and
100 live suites per owner. New references require current public eligibility in
the same SQL transaction. Existing references remain editable/removable after
the application becomes unavailable. Names and links are resolved separately
through the authority-checked catalog API and are never copied into the suite.

Saving or editing a private suite does not publish it. The separate publication
workflow below now owns that transition. Account-wide export/erasure remains open;
suite favorites use the canonical account protocol below.

## Suite submission, review and publication

Editorial owns the private draft, submitted content and approved public version.
Submission copies the saved title, description and ordered application UUIDs into
`suite_submissions`, identified by `(suiteId, submittedRevision)`. This is the draft
revision before submission. Content is immutable during review; only decision,
reason, reviewer and decision time change. At most one submission is pending.
Later draft edits do not alter submitted or approved content.

Owner read/submit/withdraw policies use the trusted self-workspace. Review requires
`editorial:reviewer` or administrator permission in the same tenant. The canonical
owner cannot review their own suite, even as administrator. Reviewers see submitted
content, not later private edits. Rejection requires a reason and preserves the
previous publication. Submission and approval check every member application's
current eligibility under SQL locks. Later unavailable members keep stable IDs;
the portal resolves current metadata without inventing labels or links.

The owner workspace lock serializes draft writes, deletion and review. Every
publication command requires an expected aggregate revision and idempotency key.
Receipts use a separate actor-scoped namespace in `suite_publication_commands`.
Submit/review/withdraw also advance the aggregate revision, rejecting stale editors
and reviewers. Identical retries return their original receipt, including after
withdrawal/deletion, without repeating effects. The portal preserves uncertain
intent and clears private state/feedback on account changes.

Approval atomically commits the decision, aggregate revision, copied approved
title/description/ordered member IDs and submitted revision in `suite_publications`,
separate public revision in `editorial_resource_states`
(`resourceKind = suite`), receipt and `editorial_outbox` intent. Public revisions
advance only on public lifecycle changes; unrelated draft edits cannot invalidate
the approved projection. Withdrawal cancels pending review and immediately
tombstones the public version in SQL. Deletion also removes submitted payloads and
the approved pointer while retaining ownership, aggregate/public tombstones and
receipts. A never-published draft needs no public event when deleted/withdrawn.

The existing confirmed Editorial dispatcher, bounded consumer retries, failed
queue, Mongo compare-and-replace store and rebuild/reconciliation support `suite`.
Workers read one coherent SQL snapshot of the copied public content and lifecycle;
public reads, selection/search, profile activity and publication export do not
depend on private drafts or submissions. Withdrawn/deleted publications
produce payload-free tombstones. Old requests reread current authority, duplicate
delivery converges, and older documents cannot replace newer tombstones. Rebuilds
need neither retained broker history nor the old projection.

`GET /api/catalog/suites` uses bounded title search and 20-item pagination; detail
reads use canonical suite UUIDs. Both require the current public projection revision,
tenant, schema and fingerprint, then repeat SQL selection after projection I/O.
Missing/stale/corrupt projections return retryable 503; canonical withdrawal/deletion
returns 404. Missing authoritative relations fail explicitly. The final SQL check
defines the visibility observation; it cannot prevent a later commit. Responses
use `Cache-Control: no-store`.

`SuitePublication1791676809000` adds the three tables, validates schema/ownership
relationships and preserves private suites. API startup and maintenance CLI register
it. Upgrade consumers to understand the new kind before exposing publication
commands. Rollback requires a reviewed data-preserving plan; old publication-unaware
writers are not qualified. No production migration or deployment was performed.

`SuitePublicationSnapshots1791840009000` now freezes the existing approved fields
into the public row. Before DDL, every pointer must resolve to an independently
approved submission with consistent tenant/owner, draft revision, valid content and
exact publication/review time. Copies commit in batches of 128; a restarted migration
accepts an already copied row only when it matches that approval. Required columns
become non-null after backfill. Once migration history confirms completion, reentry
validates public content and lifecycle without requiring retained private history.
Missing applied columns, inconsistent partial copies and destructive down fail closed.

Run explicit Editorial `--migrate` with writers fenced before starting the updated
API. Old approval writers omit the now-required fields and cannot be rolled back
unchanged. Preserve copied content and migration history through backup/restore and
use a reviewed compatible forward migration for rollback. This representation-only
backfill preserves public revisions, payloads and fingerprints, so it requires no
new outbox event. Normal approvals still commit content, revision and outbox together.
The copied public authority is an erasure prerequisite; it does not anonymize owners
or itself authorize private-data deletion.

`qualify-suites.cjs` exercises compiled APIs with real MySQL/Mongo/OPA and independent
owner/reviewer/public browsers. `--delivery` adds actual RabbitMQ confirms, redelivery
after acknowledgement loss, duplicates, projection-loss reconciliation and old
events after withdrawal. Browser projection timing is controlled for lag checks;
trusted ingress identities and unrelated shell account responses are fixtures.
Production identity/ingress, database restart, backup restoration and deployment
qualification remain open.

## Responsibilities

| Boundary             | Owns                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Domain               | Meaning, invariants, allowed content transitions and relationships.                                                            |
| Application use case | Trusted actor/tenant, authorization, validation, sequencing and persistence through ports.                                     |
| MySQL write model    | Committed nodes/relations, domain-owned ownership/lifecycle metadata, aggregate revision, payload reference and outbox intent. |
| Object storage       | Immutable payload versions referenced by committed metadata. It does not grant visibility or ownership.                        |
| Outbox dispatcher    | At-least-once transport of committed materialization requests with broker confirmation.                                        |
| Materializer         | Consistent authoritative snapshot, derived representation, revision checks and durable completion.                             |
| MongoDB read model   | Disposable query representation, never the basis for granting write permissions.                                               |

The generic `ContentNode` remains content-agnostic. Discussion-specific revision,
payload and ownership metadata belongs to the discussion feature's write adapter,
not to the kernel's node model.

## Write protocol

1. Validate actor, tenant, authorization and domain input. No persistence occurs
   after a denial or policy outage. Revalidate authoritative ownership/lifecycle
   under the write transaction where concurrent changes can affect permission.
2. Create an immutable payload object with a unique version key and content hash.
   An uploaded object is not yet visible product content.
3. In one MySQL transaction, lock the discussion aggregate, check the expected
   revision, update nodes/relations and payload references, advance the aggregate
   revision, and insert an outbox event. Replies, edits, likes and deletion share
   that revision boundary when they affect the same projected discussion.
4. Report the committed ID and revision to the caller. The response distinguishes
   accepted writes from completed materialization. Repeating a command with the
   same idempotency key returns the same committed outcome; a conflicting reuse
   is rejected.
5. A dispatcher publishes retained outbox events and waits for broker confirmation
   before marking them delivered. A crash after publish but before marking creates
   a duplicate, which the materializer must handle safely. Pending events survive
   broker outages and process restarts.

There is no cross-store transaction between MySQL and MinIO. Upload-before-commit
can leave an orphan object on failure. A cleanup job may remove old objects only
after proving that no committed payload reference uses them; age alone is not
proof. Never mutate an object referenced by an already committed revision.

## Projection protocol

Discussion projection schema 3 stores one revision-protected document per stable
node ID. Generation IDs still pin complete consistent snapshots for readers.
This replaces schema 2's immutable copies of every node for every generation:
those copies could retain private bytes or be recreated by a delayed worker after
cleanup. The schema-3 conditional single-document update preserves a newer value,
including tombstones, when an older worker resumes. It needs no MongoDB
multi-document transaction in the standalone development topology.

1. Validate event envelope/schema and aggregate identity. A request is a hint to
   re-read current committed facts, not authority to invent or modify them.
2. Read an internally consistent MySQL snapshot, including the aggregate revision,
   nodes, relations, ownership/lifecycle metadata and immutable payload references.
   Resolve ancestry with a bounded traversal. Missing/cyclic relationships fail
   explicitly; do not manufacture an alternative root.
3. Read the referenced object versions and validate their hashes/shape. A missing
   object is a failed materialization, not an empty successful view.
4. Write at most 100 stable node documents per batch, with the deterministic
   `(aggregate, revision, fingerprint)` generation on each record. An atomic
   replacement only accepts a newer revision; the same revision must have the
   same generation. A delayed older batch cannot retain or restore older bytes.
   Counts, last activity and other summaries come from the snapshot; delivery
   count never changes product statistics.
5. After every document is durable, atomically advance the small aggregate pointer
   only if its existing revision is older. A duplicate revision is a no-op and a
   different fingerprint at that same schema/revision is a conflict. A schema-2
   head can upgrade to schema 3 at the same canonical revision after rebuilding
   from authority. Readers pin the selected generation and require its complete
   node set and current canonical revision.
6. Acknowledge after successful publication/no-op. Retriable failures have bounded
   backoff; malformed or exhausted work goes to a durable, observable dead-letter
   destination. Confirm any republish before acknowledging the original delivery.

During a partial batch write the old head remains, but some stable nodes may
already carry the next generation. Readers must return projection-pending for an
incomplete/mismatched generation; they never combine versions or fall back to
older payloads. Existing API current-revision checks already reject stale heads
after a canonical write. A retry/rebuild finishes the current generation from
authority. This explicitly replaces the old internal-cache guarantee that a full
previous generation remains stored during partial writes.

Node tombstones and their revision guards must remain. Reconciliation treats
schema-2 heads as stale and requeues an authoritative schema-3 rebuild. Older
schema-2 documents are not automatically deleted by this change: the owning erasure
participant must purge relevant historical copies before reporting completion.
Drain/fence old-schema materializer processes before activating erasure, because
an old binary can still write obsolete generation-keyed copies. A destructive
projection drop/restore must also drain in-flight workers first, then rebuild from
current authority; do not erase revision guards beneath a paused old snapshot.

## Deletes, privacy and lag

Deletion commits a tombstone and a newer aggregate revision, then requests
materialization. Preserve enough authoritative identity/ancestry to prevent stale
delivery from resurrecting data and to rebuild reply structure. Domain behavior
decides whether a deleted parent remains as a placeholder or removes its subtree.

Authorization and immediate privacy restrictions consult current authoritative
metadata. A lagging public projection must not expose content after it becomes
private or deleted. Reads may omit an outdated list item or return a retryable
projection-pending response until the permitted generation is available. Never
substitute fixtures to conceal this state.

## Rebuild and operations

- Enumerate authoritative aggregate IDs/revisions in bounded batches and enqueue
  idempotent rebuild requests. Include tombstones. Rebuild uses the same projector
  as live delivery; it must work after deleting every derived collection.
- A failed aggregate remains independently retryable; rebuilding one aggregate
  must not block or erase another tenant's views.
- Reconciliation compares write revisions with published read revisions and
  requeues missing/outdated work. Broker retention is not the recovery source.
- Expose pending/outbox age, projection lag, failures, retries, dead-letter count
  and rebuild progress. Readiness must distinguish an unavailable dependency from
  a healthy process with a bounded backlog.
- Version database migrations and event/projection schemas. Provide explicit
  migration/backfill for legacy unversioned MinIO objects and existing graph
  records. Do not silently assign an owner to legacy content.

## Acceptance evidence

| Scenario                                                 | Required result                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| Explicit deny / unavailable policy                       | Zero node, payload, outbox or projection mutations.                        |
| Crash before SQL commit                                  | No visible mutation; any uploaded object is unreferenced.                  |
| Crash after commit / before publish                      | Retained outbox eventually schedules projection.                           |
| Publish confirmed / process dies before delivery marking | Duplicate delivery produces the same view.                                 |
| Two concurrent writers                                   | Serialized revisions or explicit conflict; no lost accepted update.        |
| Duplicate / reordered events                             | No inflated counts or revision regression.                                 |
| Failure during generation write                          | Reads return pending for incomplete generations; retry completes the next. |
| Edit / delete / privacy change                           | Current access is enforced and projections converge without resurrection.  |
| Missing payload / corrupt graph / poison event           | Visible failure with bounded retries and recovery, no fake content.        |
| Drop all read collections and rebuild                    | Equivalent permitted content/counts from authoritative stores.             |
| Restart broker, materializer and database                | No accepted write lost and no silent acknowledgement of unfinished work.   |

Reference semantics: RabbitMQ's consumer acknowledgements and publisher confirms
are distinct, and recovery can duplicate publication. MongoDB provides atomic
single-document writes with conditional filters; multi-document writes are not
one atomic operation. These mechanisms support the protocol but do not replace
the application-level revision, outbox and rebuild invariants.

Official references:

- RabbitMQ: `https://www.rabbitmq.com/docs/confirms`
- RabbitMQ reliability: `https://www.rabbitmq.com/docs/reliability`
- MongoDB atomicity: `https://www.mongodb.com/docs/manual/core/write-operations-atomicity/`

## Discussion generation integration

The implementation uses `discussion_write_aggregates`, `discussion_write_nodes`,
`discussion_commands` and `discussion_outbox` alongside the structural tables.
MinIO keys are `discussions/<node-id>/versions/<version-id>.json`. Each committed
reference contains its SHA-256 digest and byte count. The aggregate limits are
2,000 nodes, 64 reply levels, 256 KiB per payload and 16 MiB of live payloads.

The worker consumes `discussion-projection-v2` and quarantines failed work in
`discussion-projection-v2.failed`. Both are durable quorum queues. It retries
while retaining the original unacknowledged delivery, then waits for confirmed
failed-queue publication before acknowledging. Unknown transfer outcomes stop
that worker; the broker retains unfinished delivery. The outbox independently
retains unconfirmed requests and retries publication.

Read collections are `discussion_generation_nodes` and
`discussion_generation_heads`. Node `_id` is its stable canonical ID under
projection schema 3; its generation field contains the aggregate ID, revision and
deterministic snapshot fingerprint. Each atomic replacement is monotonic and a
same-revision different generation fails. Such inconsistency is an error, not a
last-writer-wins update. External subject metadata is not folded into a fingerprint
unless it is governed by that aggregate revision. The existing queue names retain
their v2 transport version; transport and projection schemas are separate.

The API commits asynchronously relative to projections. Mutations require a
trusted ingress actor and `Idempotency-Key`; edits/deletes also carry
`expectedRevision`. The response contains `id`, `discussionId`, `revision` and
`projection: "pending"`. A pending read returns HTTP 503 with `Retry-After`.
Clients must preserve a key when retrying the same command and use a new key for
new intent. They must reload after a revision conflict. Root privacy restricts
the thread; individual node privacy also protects that node's body.

To request a full rebuild after a successful build, run the materializer entry
point with its usual MySQL environment and `--rebuild`:

```sh
node dist/sdk/features/discussion/applications/materializer/main.js --rebuild
```

The management service's dispatcher and normal materializer must run to complete
those queued requests. This command schedules work; it does not assert that the
resulting projections are ready. Failed queue operations, retention and process
restart/restore qualification remain tracked in implementation progress.

### Legacy discussion backfill

The management entry point now has explicit maintenance modes. They do not start
Nest, the API, seeds, or the dispatcher. Run versioned migrations separately;
planning and applying a backfill never run schema synchronization or implicit DDL.
These modes require all `DISCUSSION_DATABASE_*` settings (host, port, username,
password and name). Backfill also requires the usual `DISCUSSION_STORAGE_*`
settings (host, access key and secret key).

```sh
node dist/sdk/features/discussion/applications/management/main.js --migrate
node dist/sdk/features/discussion/applications/management/main.js --backfill --manifest /secure/path/owners.json
```

An ownership manifest covers one complete legacy thread. Use existing lowercase
UUIDs and externally verified identity claims, including owners of deleted nodes:

```json
{
  "version": 1,
  "discussionId": "00000000-0000-7000-8000-000000000001",
  "tenantId": "verified-tenant",
  "owners": [
    {
      "nodeId": "00000000-0000-7000-8000-000000000001",
      "identityId": "verified-firebase-uid"
    }
  ]
}
```

Replace these example values and include exactly one owner for every discovered
node. Do not derive ownership from a legacy payload's author fields, MongoDB,
or whichever user runs the tool. The tool validates coverage and syntax; an
operator must establish the correctness of the identity and tenant mapping.

Planning reads a consistent SQL graph and bounded legacy `discussions/<id>/content`
objects. It rejects missing/ambiguous/cyclic ancestry, partial prior versioning,
unsupported lifecycle values, missing live payloads and size/depth violations.
It prints counts and a deterministic fingerprint, without copying objects or
changing ownership. It does not print bodies or identity assignments. Deleted
nodes remain tombstones and do not require their old bodies.

Before applying, back up authoritative data, stop every legacy writer to these
tables and mutable object keys, and verify that the maintenance window is in
effect. That includes old APIs, administrative scripts and background writers.
Legacy writers do not honor the new revision/locking protocol. The CLI cannot
prove they are stopped; `--legacy-writers-stopped` acknowledges this operational
precondition and is not a substitute for checking the deployment.

```sh
node dist/sdk/features/discussion/applications/management/main.js --backfill --manifest /secure/path/owners.json --apply <reviewed-plan-fingerprint> --legacy-writers-stopped
```

Apply recomputes the plan, checks its fingerprint, creates immutable copies, and
checks mutable bodies again for drift. Under a SQL transaction it locks the root,
rechecks structural facts and commits ownership/payload metadata, revision 1, the
outbox request and a `discussion_backfills` receipt together. Lifecycle, likes,
relations and tombstones remain intact. A failed upload or SQL transaction cannot
make a partial import visible. Failed attempts may leave unreferenced immutable
copies; this command does not delete them or the legacy objects.

Repeating a committed plan returns its receipt, including when another importer
committed concurrently. A different fingerprint or ownership mapping conflicts.
The new numbered receipt migration is forward-only; do not roll back to a writer
that can mutate the old keys after the new write model becomes authoritative.
Verify materialization and reconciliation before switching traffic. Live migration,
concurrency and rollback qualification is still required before an existing
deployment can be cut over.

### Reconciliation

The materializer entry point supports a read-only inspection and an explicit
outbox requeue mode. These require MySQL and Mongo configuration, but do not
require a broker or object-store connection just to inspect or schedule recovery:

```sh
node dist/sdk/features/discussion/applications/materializer/main.js --reconcile
node dist/sdk/features/discussion/applications/materializer/main.js --reconcile --apply
```

Reconciliation enumerates authoritative aggregates in bounded pages through a
fixed initial upper ID. It compares revisions, tenant/schema metadata, node count,
generation identity and projected ancestry. Missing, older and incomplete
generations can be requeued; the enqueue transaction rechecks the authoritative
revision under lock. Concurrently changed discussions are reported for a later
pass. Tombstoned discussions participate in the same scan.

`current` means the published generation is structurally complete at the inspected
revision. This is not a full payload checksum audit. Normal materialization verifies
immutable object hashes; restoring from suspected projection corruption still
requires an authoritative rebuild. Conflicting metadata or a projection ahead of
an unchanged write revision is reported and never silently overwritten. Per-item
failures do not prevent inspection of the remaining aggregates.

Each result prints the discussion ID, condition and whether work was queued;
the final report separates inspected/current/needs-rebuild/queued/changed/conflict
and failure counts. Exit 1 means failures or conflicts; exit 2 means a read-only
scan found work or a concurrent change needs reinspection. Exit 0 after `--apply`
confirms scheduling, not completed projection. Run the dispatcher and worker,
then inspect again. No retention or destructive repair runs implicitly.

The real-store qualification suite is explicit and fails when dependencies are
unavailable:

```sh
WAPPS_DISCUSSION_INTEGRATION=1 node --test tools/readiness/discussion-recovery.test.cjs
```

It defaults to local Compose ports and accepts explicit `DISCUSSION_TEST_*_PORT`
overrides, `LOCAL_PASSWORD`, random isolated SQL/Mongo databases and queue names.
It removes only its own test resources.
The suite includes ownership backfill, source-drift rejection, atomic rollback,
concurrent replay and reconciliation after partial generation loss. It now passes
using `node tools/readiness/qualify-materialization.cjs`, which launches disposable
loopback MySQL/MongoDB/RabbitMQ/MinIO containers without existing volumes. That
runner also executes both Editorial suites and cleans up its containers. Production
legacy data, standalone worker process crashes/restarts and restoration remain
unqualified; tmpfs qualification storage is not a backup/persistence exercise.

## Editorial write and delivery protocol

Editorial now treats `app_records`, `categories`, `tags` and their SQL relations
as authoritative domain data. `editorial_resource_states` holds verified ownership,
tenant, monotonic revision and deletion tombstones. The domain values are stored
in the same SQL transaction as that metadata, `editorial_commands` receipts and
`editorial_outbox` intent. This slice has no separately uploaded object payload,
so it does not need an upload-before-commit protocol. A future media workflow
must establish its own immutable object-reference and recovery contract.

There is one authority for these catalog records; no duplicate content-registry
record is created. Public CRUD is privileged direct publication, not a private
draft/submission/review workflow. Those lifecycle states remain unimplemented.
Every mutation requires trusted ingress identity and roles, successful OPA
evaluation, tenant/ownership checks and validated input. It also requires an
`Idempotency-Key`; updates and deletes require `expectedRevision`. Ownership is
checked under SQL locks during mutation and receipt replay. Related resources
must be available in the same tenant; hierarchy cycles and removal of actively
referenced taxonomy are rejected. Deletes retain underlying rows and tombstones.

`EditorialOwnership1791676802000` creates a fresh schema or validates the existing
one before DDL. It rejects incompatible resource/reference/join/metadata columns,
missing keys or foreign keys, unexpected required columns, unsafe identity
collations, and non-transactional tables. MySQL DDL is not treated as an atomic
rollbackable migration: a failed partial creation must be inspected before retry.
Normal startup and `--migrate` use the same numbered migration. Runtime schema
synchronization is disabled; demo seeding requires explicit configuration.

Existing rows are not assigned owners. Read access to unbackfilled data is limited
to the configured public tenant; ordinary mutation commands refuse it even for
administrators. A verified legacy ownership backfill is still required before
these records can participate in the new mutation/materialization protocol;
the explicit tooling is described below. It never runs as an implicit startup task.

The production dispatcher leases a due outbox row for 30 seconds using an InnoDB
transaction and `FOR UPDATE SKIP LOCKED`. It sends a version-1 request to the
durable quorum queue `editorial-projection-v1` and waits for mandatory publisher
confirmation. Only then can it mark that row delivered using its lease token.
A crash after confirmation and before marking causes a safe duplicate request
with the same event identity. A stale dispatcher cannot clear a replacement lease.
No ownership or content body is accepted from the queue as write authority.

Transient publication/marking failures use exponential backoff capped at five
minutes. After twelve failed attempts, `failedAt` retains the request in SQL for
operator inspection and explicit requeue. A malformed retained request is
quarantined immediately. An unavailable broker at connection time leaves SQL
requests unclaimed; the coordinator reconnects. Broker connection and publisher
confirmation attempts are bounded. SQL retry persistence failures leave the lease
to expire so a later process can recover it.

Maintenance commands use explicit `EDITORIAL_DATABASE_HOST`, `PORT`, `USERNAME`,
`PASSWORD`, and `NAME` settings (each with the `EDITORIAL_DATABASE_` prefix). They
do not start the API, seed data or connect to the broker. Only `--migrate` runs DDL:

```sh
node dist/apps/services/editorial/main.js --migrate
node dist/apps/services/editorial/main.js --outbox-status
node dist/apps/services/editorial/main.js --outbox-requeue 42
```

Status reports pending/delivered/failed counts, oldest pending creation time and
up to 100 failed request identifiers. Replace `42` with the specific failed SQL
outbox ID after diagnosing the failure. Requeue only resets that failed request;
it does not change content, ownership or revisions. It cannot reset a delivered
row or a live lease. Exit 2 means no eligible failed row was requeued. Requeue
success confirms scheduling, not completed materialization.

### Editorial projections and recovery

The `--materialize` worker reads each resource in one `REPEATABLE READ` SQL
transaction, including ownership, revision, values and bounded relation IDs. It
validates reference existence, tenant/lifecycle compatibility and category ancestry.
Each app/category/tag becomes one complete MongoDB document in
`editorial_projections_v1`, keyed by `<kind>:<resourceId>`. Single-document
publication is sufficient for this bounded representation; it does not use
Discussion's multi-document generation protocol.

Reference IDs are included, but mutable related labels and category children are
not embedded. They belong to other resource revisions. This prevents a tag rename
from producing conflicting app snapshots at the same app revision. Lists of IDs
and fields are canonicalized for a SHA-256 fingerprint. The limits are 50 IDs per
relation, 64 category ancestors, 32 KiB descriptions and 128 KiB snapshots. Exact
SQL calendar timestamps retain six fractional digits in `createdAtSql` and
`updatedAtSql`; no timezone is guessed for legacy data. Public timestamp mapping
must be settled before projected catalog read integration.

Mongo inserts and conditional replacements use majority and journal durability.
Revision/fingerprint compare-and-replace prevents regression; an identical
revision is a no-op. Conflicting same-revision content, tampered fingerprints or
malformed stored documents fail explicitly. A tombstone keeps the resource's
identity and revision with `content: null`, so an old request cannot resurrect it.

The consumer prefetches one message and retries transient failures at most four
times with 1/5/30-second backoff, including its broker redelivery budget. Malformed
requests/snapshots are quarantined immediately. Both `editorial-projection-v1` and
`editorial-projection-v1.failed` are durable quorum queues with broker delivery
limits disabled, so retention is controlled by the application. The original
delivery is acknowledged only after durable publication/no-op or confirmed
failed-queue transfer. An unknown transfer or acknowledgement result stops the
worker with unfinished work available for redelivery. Intentional shutdown leaves
unfinished work unacknowledged and closes connections.

```sh
node dist/apps/services/editorial/main.js --materialize
node dist/apps/services/editorial/main.js --rebuild
node dist/apps/services/editorial/main.js --reconcile
node dist/apps/services/editorial/main.js --reconcile --apply
```

Rebuild requires only SQL. It scans authoritative states, including tombstones,
in bounded keyset pages and requeues their current revisions under locks, without
old projections or broker history. Reconciliation also requires Mongo and compares
complete canonical content fingerprints with current SQL. It rechecks write state
after inspection to distinguish concurrent changes from conflicts. Read-only
inspection performs no writes; `--apply` requeues only missing/stale documents.
Conflicts and corrupt documents require diagnosis and explicit repair. The tool
does not delete them or blindly overwrite a projection ahead of SQL.

Reports separate inspected/current/needs-rebuild/queued/changed/conflict/failure
counts. Exit 1 means a failure or conflict; exit 2 means a concurrent change needs
reinspection, or read-only reconciliation found missing/stale views. Exit 0 after
requeue/rebuild confirms scheduling, not completed materialization. Run the API's
dispatcher and worker, then reconcile again. An active dispatch lease invalidated
by requeue cannot mark the replacement request delivered.

**Public API reads still consult authoritative SQL.** No read path grants access
from Mongo. Mutation receipts continue to say `projection: "pending"`; a delivered
outbox row confirms broker transfer only. Projected catalog integration must retain
current authoritative tenant/lifecycle checks, including related records.

### Verified Editorial legacy ownership

`EditorialBackfill1791676803000` adds durable import receipts with a separate
numbered, forward-only migration and compatibility preflight. After running
`--migrate`, supply one regular JSON file of at most 16 KiB per legacy resource:

```json
{
  "version": 1,
  "kind": "app",
  "resourceId": "00000000-0000-7000-8000-000000000001",
  "tenantId": "default",
  "ownerIdentityId": "externally-verified-identity"
}
```

Use `app`, `category` or `tag`, the existing lowercase UUID, the configured
`EDITORIAL_PUBLIC_TENANT`, and an externally verified owner. The tool checks syntax
and scope; it cannot establish who historically owned a record. It never derives
ownership from payloads, projections or the invoking operator. Ownership adoption
preserves the existing public tenant. Tenant relocation is a separate migration
because other legacy records may still reference the resource.

```sh
node dist/apps/services/editorial/main.js --backfill --manifest /secure/path/owner.json
node dist/apps/services/editorial/main.js --backfill --manifest /secure/path/owner.json --apply <reviewed-plan-fingerprint> --legacy-writers-stopped
```

Planning is read-only and fingerprints the mapping and complete supported source
snapshot. It rejects missing data, invalid relations/ancestry, already-versioned
resources and partial prior command/outbox/receipt state. Output includes resource
IDs and hashes, without bodies or owner assignments. Before applying, back up SQL,
stop all legacy writers and demo seeding, and review the plan. The maintenance
flag acknowledges this precondition; the tool cannot prove those writers stopped.

Apply recomputes the fingerprint, locks the base resource row, checks again and
atomically commits verified ownership, revision 1, an outbox request and a durable
receipt. It preserves source values, relations, timestamps and suspension flags.
Failure rolls back every authoritative change. Concurrent importers serialize on
the base row. Repeating the same committed plan returns the receipt without
resetting subsequent edits or tombstones; a different mapping or plan conflicts.
Backfill schedules normal materialization and can be followed by reconciliation.
Live migration, concurrency and rollback qualification remain required before
using this on an existing deployment.

Editorial uses `QUEUE_HOST`, `QUEUE_USERNAME`, `QUEUE_PASSWORD`, optional
`QUEUE_PORT` and `QUEUE_VHOST`. Worker/reconciliation modes also require
`MONGO_HOST`, `MONGO_PORT`, `MONGO_USERNAME`, `MONGO_PASSWORD`, `MONGO_DATABASE`.
Compose now includes `editorial-materializer`. The API Kubernetes manifest
references queue credentials and the ingress secret; worker deployment, production
secret provisioning and topology qualification remain open. Nothing has been
deployed by this work.

Run the explicit SQL qualification suite with local MySQL available:

```sh
WAPPS_EDITORIAL_INTEGRATION=1 node --test tools/readiness/editorial-recovery.test.cjs
WAPPS_EDITORIAL_PROJECTION_INTEGRATION=1 node --test tools/readiness/editorial-projection-recovery.test.cjs
OPA_BINARY=/path/to/opa node --test tools/readiness/opa-policies.test.mjs
```

The SQL suite creates and drops only its own fresh localhost database. It includes
migration re-entry, relation/tenant filtering, ownership, concurrent commands,
rollback on outbox failure, tombstones, fenced concurrent leases, explicit retry
and connection restart. It now includes ownership source drift, import rollback,
concurrent import replay, and subsequent owner mutations. The projection suite
uses isolated SQL/Mongo databases and queues to exercise confirmed-publication
replay, tombstones, adopted legacy content, lost projection/history rebuild,
corruption detection and failed-transfer redelivery. Both now pass in the isolated
four-store runner. Migration preflight reads physical column lengths/collations so
maintenance works without entity metadata or an assumed database collation. Real
RabbitMQ shutdown completes the channel handshake before closing its connection.
Policy ports are substituted in these store tests; OPA has separate evidence.
Neither suite proves standalone worker startup, server restart or backup restore.

## Canonical identity and account authority

Both Authenticator and Account Management now use the shared
`sdk/features/identity/packages/infrastructure/mysql` adapter. Firebase owns
credentials; the exact, case-sensitive Firebase UID is the application actor ID.
The SQL `identities.id` UUID is a separate credential subject ID. Management no
longer generates a second identity or writes an independent Mongo identity graph.
Current SQL lifecycle gates authentication, ingress validation and account access.
Administrator commands evaluate OPA before mutation. Self-service account commands
are bound to the trusted request UID and recheck its lifecycle in SQL.

`identity_accounts` stores the private profile in the same authoritative database.
`GET /api/me` is a consistent, side-effect-free read and returns an explicit STUB
when registration has not been completed. `POST /api/registration/complete` requires
`expectedRevision` and `Idempotency-Key`. The identity row is locked while profile
values, incremented revision, command receipt and event intent commit together.
Receipt replay checks current access first and never overwrites later edits.
This completes a profile, not credential registration or email verification.

Creation, authentication, suspension, registration completion and deletion retain
immutable event JSON in `identity_events_outbox`. The existing `identity-events`
durable queue and version-1 envelopes remain. Lifecycle payloads contain the
canonical UID, subject, revision and complete active/suspended/deleted state;
registration does not put private profile fields into the event. Authentication
notifications include the checked revision and provider. No consumer may infer
current permission or reconstruct a profile solely from these messages. Future
projections must reread a consistent authoritative snapshot, compare revisions,
retain tombstones and provide independent rebuild/reconciliation. There is no new
identity projection consumer in this checkpoint: `/me` reads SQL directly.

Event workers use 30-second fenced SQL leases and confirmed broker publication.
After confirmation, marking may fail; replay sends the same retained event ID and
body. Consumers must deduplicate appropriately. Invalid journal work is retained
in quarantine, without preventing the next row from being claimed. Transient
failures have exponential backoff capped at five minutes and become retained
failures after twelve attempts. Workers reconnect after broker loss, drain at most
100 rows per tick, avoid overlapping drains and await active work at shutdown.
Outbox delivery confirms broker transfer, not downstream projection completion.

Deletion first commits the canonical tombstone, increments the revision, deletes
the SQL private profile, inserts `identity_deletion_jobs` and records the deletion
event in one transaction. The API returns HTTP 202 and `status: "accepted"` with
`cleanup: "pending"`. An authorized repeated request reports the existing cleanup
state (`pending`, `completed` or `failed`), without reviving the identity. A
compatible tombstone from before the outbox can schedule its missing cleanup
journal without changing its revision. Historical subject/UID, command receipts
and lifecycle records remain; this is not full erasure across other Wapps domains.

The cleanup worker verifies current inactive/deleted SQL authority before removing
Firebase credentials. Already absent provider accounts count as successful cleanup;
other failures retry and then remain in SQL quarantine. Lease fencing prevents a
stale process from completing replacement work. Remote calls are bounded, and a
crash after removal but before marking is handled by idempotent retry. Suspension
and enable commands change application lifecycle in SQL; they do not claim to
change Firebase's `disabled` flag. Token revocation and credential changes use the
Firebase adapter after authorization. Generated admin links must match the
specified target UID's provider email.

Public recovery calls Firebase's password-reset delivery operation, with bounded
requests and no returned reset link. An unknown email has the same acknowledgement
as an accepted request; provider failures produce a service error. Local and
Kubernetes gateways have a separate, rate-limited recovery route. Reset-code
verification and consumption now use bounded provider adapters and real portal
forms. Credential reset does not change SQL identity lifecycle or grant application
access. Local emulator qualification passes; production email delivery and Firebase
email-template action URL configuration remain unverified. These checks send no
email to real users.

### Credential enrollment boundary

`POST /auth/register` validates email, nickname, password confirmation and the
required `Idempotency-Key` before contacting Firebase. The provider supplies the
verified UID. Only an `EMAIL_EXISTS` response permits recovery of an interrupted
signup through password authentication; the client cannot supply an identity ID.
The application ensures canonical identity without undoing restrictions, then
enrolls its initial profile through the SQL account port. Enrollment locks current
identity state and commits profile/revision/receipt/outbox together. It cannot
overwrite a later profile edit; a conflicting command replay is rejected.

Firebase credential creation and SQL enrollment are separate operations, without
a cross-service transaction. A failed SQL step can leave credentials that a retry
or sign-in recovers. No session is returned until canonical enrollment and durable
authentication intent succeed. The portal retains an enrollment key for the form
lifetime, never a password in browser storage, and reports ambiguous outcomes
truthfully. Signup completion asks the user to sign in.

### Identity migrations and retained-work operations

Normal startup never synchronizes schemas or runs migrations. Both services refuse
pending migrations. The base identity migration and
`CanonicalIdentity1791676804000` are forward-only. Canonical preflight checks engine,
columns, keys, revision/lifecycle data, binary journal collations, required defaults,
pending indexes and unexpected constraints/triggers before its DDL. Identifiers
and lifecycle values are also checked in bounded pages with the runtime parser.
The maintenance entrypoint serializes migration runs with a MySQL advisory lock.
MySQL DDL is not rollbackable as one transaction; inspect partial DDL before retry.

The migration refuses any nonempty legacy `identity_subjects` table. It does not
invent a mapping between an old generated identity and the Firebase UID, import
old Mongo profiles, or rewrite content ownership. Preserve those stores. Verified
legacy planning/import and its audit/rollback procedure remain required before an
existing deployment can cut over. Back up authority and stop old writers before
migration; no production data has been migrated by this work.

Both built services expose the same SQL-only maintenance modes, requiring explicit
`MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USERNAME`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`:

```sh
node dist/sdk/features/identity/applications/authenticator/main.js --migrate
node dist/sdk/features/identity/applications/authenticator/main.js --outbox-status
node dist/sdk/features/identity/applications/authenticator/main.js --cleanup-status
node dist/sdk/features/identity/applications/authenticator/main.js --outbox-requeue <event-uuid>
node dist/sdk/features/identity/applications/authenticator/main.js --cleanup-requeue <uid>
```

These modes start no API, Firebase app or broker. Status reports counts, oldest
pending creation time and up to 100 failed IDs, without bodies. Requeue affects
one retained failed row, refuses completed work or a live lease, and invalidates
old leases. Cleanup requeue also requires a matching current tombstone. Exit 2
means no eligible row was requeued. Requeue schedules work, not completed recovery.
Compose uses a separate `identity-migrate` job that must succeed before either
identity service starts. Kubernetes migration orchestration, runtime secret
provisioning and live ingress qualification remain release work.

The explicit real-SQL harness creates and cleans up only a random localhost
database. It exercises migration re-entry, case-sensitive lookup, concurrent
provisioning, atomic rollback on outbox failure, registration replay, lifecycle
restrictions, lease fencing, confirm/mark crashes, deletion and connection restart:

```sh
WAPPS_IDENTITY_INTEGRATION=1 node --test tools/readiness/identity-recovery.test.cjs
```

The initial execution failed at `ECONNREFUSED 127.0.0.1:3306`. Qualification now
passes against isolated MySQL 8.4 using
`node tools/readiness/qualify-identity-mysql.cjs`. This runner creates a temporary
container with tmpfs data and a random loopback port, and removes it afterward.
Publisher and credential-removal ports in this SQL harness remain substituted.
Database/broker process restart, real Firebase cleanup, projection consumers,
backup restoration, verified legacy migration and full cross-domain deletion are
not proven by unit or HTTP tests. OP02, OP09 and OP10 remain open.

## Public catalog read protocol

The catalog contract uses UUID strings, resolved reference labels and nullable
review aggregates. `CatalogReadPort` and its transport validators are pure domain
contracts. Editorial composes `MysqlCatalogAuthority` with a Mongo projection
reader; the BFF consumes that port through a bounded HTTP adapter.

1. Parse bounded search/facet/sort/pagination input. Public catalog reads always
   use the configured `EDITORIAL_PUBLIC_TENANT`; caller headers cannot choose a
   different catalog tenant.
2. In one repeatable-read SQL transaction, select visible taxonomy, filter/count
   eligible app rows and fetch a stable ordered page of UUIDs, slugs and revisions.
   Suspension, deletion and tenant eligibility come from SQL. Legacy rows without
   a verified revision produce pending/unavailable reads when selected.
3. Read at most ten app projections concurrently. Each must have a valid schema,
   content fingerprint, UUID, tenant, slug and the exact selected SQL revision.
   A missing, stale, corrupt, tombstoned or suspended projection fails the whole
   page with HTTP 503 and `Retry-After: 2`; it never silently removes an item or
   supplies a fixture. Current SQL absence is a 404 for a detail request.
4. Hydrate app relation IDs using the current SQL taxonomy snapshot. Missing,
   cross-tenant, deleted or cyclic taxonomy fails explicitly. Traversal is bounded
   at 64 levels and taxonomy at 2000 values per dimension.
5. After Mongo I/O, obtain a fresh authoritative SQL snapshot and compare a hash
   of tenant, page IDs/slugs/revisions, total, pagination and all resolved taxonomy.
   Any change rejects the response as retryable. This checks current visibility
   at the final SQL read; it cannot prohibit a new commit after that check.

### Canonical relation target resolution

Editorial and Catalog BFF expose
`GET /api/catalog/app-selection?ids=<uuid>,<uuid>`. The pure `CatalogReadPort.select`
contract accepts one to 50 canonical lowercase UUIDs, bounded before deduplication.
It returns `{ items: CatalogApp[] }` in first-requested ID order. The separate route
does not reserve any application slug. Both HTTP boundaries reject missing,
malformed, repeated/nested query parameters, extra fields and oversized selections.

SQL applies the same public tenant, suspension and deletion predicates to this
bounded ID set. Each eligible row requires its exact current projection revision,
and the complete SQL selection is rechecked after Mongo I/O. Ineligible and absent
IDs are omitted without disclosing the reason or projected metadata. Missing,
stale or corrupt eligible projections fail the entire request with retryable 503;
an upstream 404/outage is also a failure, never an empty successful selection.
The BFF rejects responses containing unrelated, duplicate or reordered records.

This supports durable relations that retain target IDs across slug changes and
slug reuse. Saved names, links or projection documents must not become target
authority. A returned public snapshot is an observation at the final SQL check,
not a permission grant or a lock on future target changes. Each mutation still
needs its own account/resource authorization and canonical lifecycle checks.
Cross-service favorite membership and content visibility do not share a transaction.
Reads of a future favorites/collections API must resolve current target eligibility;
removing an unavailable saved target must not require that target to become public.

No favorite relations are persisted by this endpoint, and no new projection or
outbox is introduced for the read. The canonical account favorites section below
documents the separate relation API and its application-favorites portal.
Collection storage and other content families remain open.
Real-store selection tests cover rename/reuse, deletion during projection I/O,
lag/loss/rebuild, service restart and upstream outage. See the canonical selection
checkpoint in `IMPLEMENTATION-PROGRESS.md` for the qualification limits.

### Deliberate synchronous variation

SQL handles selection/pagination and supplies taxonomy labels; Mongo supplies
versioned application content. Taxonomy labels are not duplicated into app
projections. A category/tag rename therefore takes effect without an app fan-out
rebuild, while the second SQL snapshot rejects changes during an individual read.
The dedicated facets endpoint reads only the coherent SQL snapshot and remains
independent of application projection availability. These reads do not modify
write models or materialize on demand. Every app projection is still independently
rebuildable through the existing authoritative snapshot/recovery pipeline.

Current filtering uses parameterized SQL with literal LIKE escaping and a
three-second execution hint for each select. Results use stable name/UUID or
creation-time/UUID ordering; category filters include descendants and all selected
tags are required. The BFF has bounded transport time/size and no eligibility
cache. HTTP responses use `Cache-Control: no-store`. This is offset pagination
with per-request consistency; it does not provide an immutable snapshot across
several separate page requests.

New Editorial commands encode DATETIME fields explicitly as UTC text, independent
of host/driver timezone; SQL entity readers also use UTC. Public DTOs expose
millisecond UTC ISO dates, while projection fingerprints retain all six SQL
fractional digits. Existing unverified legacy DATETIME values require an operator
review of their source timezone before backfill/cutover. If normalization is
necessary for already versioned data, it must advance affected revisions and
retain rebuild intent; rewriting timestamps behind a fixed revision is invalid.
The ownership-backfill receipt alone does not prove legacy timestamp provenance.

### Runtime and verification

The Editorial API now requires the materializer's `MONGO_HOST`, `MONGO_PORT`,
`MONGO_USERNAME`, `MONGO_PASSWORD` and `MONGO_DATABASE` for catalog content reads.
The lazy reader shares connection attempts, bounds selection/socket/pool waits,
cleans up failed attempts and closes on shutdown. A projection outage does not
prevent authoritative command startup. Compose and the Kubernetes API manifest
carry these settings. The Editorial workflow requires explicit Mongo, ingress
and queue configuration instead of creating an incomplete runtime secret.
Target-environment secrets and a deployed standalone materializer still require
qualification.

`tools/readiness/catalog-journey.test.cjs` exercises the compiled Editorial and
BFF HTTP processes against isolated stores, including SQL filtering, public
visibility, projection lag, edits/deletion, process restarts and Mongo loss/rebuild.
Its fixtures invoke real command/write adapters with substituted policy approval;
suspension is explicitly seeded because its moderation command is unfinished.
The catalog test invokes the production snapshot/projector/store functions for
controlled projection publication. Separate materialization suites exercise the
real broker/consumer path. Neither test substitutes for an integrated browser
journey, production policy/ingress checks, a database restart or backup restoration.

### Catalog portal qualification

The Aggregator catalog adapter validates the canonical response and preserves UUIDs,
revisions and nullable aggregates. It does not infer missing records from a failed
read: authoritative 404 maps to not-found, while projection lag and dependency
503 map to retryable failure. Failed listing/taxonomy requests do not select demo
providers. API/demo choice is explicit, independent of the configured API origin.
Frontend records and rendered views do not grant permission for any mutation.

`qualify-materialization.cjs --catalog-browser` extends the real-store catalog test
with the compiled portal and a loopback catalog gateway. It demonstrates a current
record becoming unavailable after an authoritative revision change, becoming visible
after projection publication, remaining available after API process restart, failing
after projection deletion and recovering from authoritative snapshots. Authoritative
delete hides the record before its old projection is replaced. Upstream outage shows
a catalog failure, not an empty catalog. It also verifies real listing, taxonomy,
filters, pagination and detail routes in both themes at 390/768/1440 pixels.

Home search previews use the same authority-checked read path with a page size of
three per supported content kind. A failed projection read invalidates the preview;
it does not produce an empty result or a mixture of fixtures and service data.
Query changes cancel old reads and a user retry issues a fresh request. Browser
qualification now includes preview lag, recovery, deletion and outage, as well as
success/empty/error layouts. Search totals remain the authoritative query totals,
not the number of displayed preview cards.

These checks use substituted fixture command policy and explicitly controlled
projection publication; existing separate recovery suites exercise the broker.
They do not qualify the public publication/moderation workflow, account sessions,
production gateway, standalone worker deployment, backups or whole-product recovery.
See the portal checkpoint in `IMPLEMENTATION-PROGRESS.md` for remaining scope.

## Private profile text commands

`GET /api/me/profile` reads a consistent canonical SQL snapshot; private settings
are not a materialized projection. It returns canonical UID, current identity
revision, registration/update times and nullable profile fields. An unregistered
account is explicit and does not provision fabricated profile data. Self-profile
read/update actions are evaluated at the application boundary using the trusted
identity. Policy denial/outage prevents storage access; the write adapter rechecks
current active/nondeleted/nonsuspended lifecycle under the identity lock.

`PUT /api/me/profile` replaces display name, bio, location and supported social
links. It requires `expectedRevision` and `Idempotency-Key`. SQL commits profile,
identity revision, command receipt and `identity.updated` invalidation together.
The event carries identity/revision/lifecycle, not private text. An outbox insert
failure rolls back every part. Duplicate commands return their original revision;
a different intent with the same key or a stale revision is a conflict. Lifecycle
checks precede receipt replay, so deletion cannot be bypassed by an old command.
Initial registration no longer overwrites an existing profile. Historical initial
registration fingerprints remain readable; the new edit fingerprint has its own
operation discriminator and deterministic normalized social-link order.

Text editing preserves the existing avatar reference and registration timestamp.
The new nullable social-link JSON column is introduced by a separate explicit
migration. Existing null values mean no social links; invalid stored content
fails the read. No public profile projection or media ownership protocol is implied
by this private SQL API. Future public projections must independently obey the
revision, tombstone, current-visibility and rebuild requirements in this document.

API portal mode never imports browser-local demo profile data. It retains a key for
retry of unchanged intent, clears retry/profile caches on session change and
cancels obsolete reads/saves. Cancellation cannot retract a server commit; the new
session reloads canonical state. Conflicts retain form edits until explicit reload.
Profile text APIs do not accept data-URI avatars. The separate canonical avatar
command described above now owns private upload, replacement and removal.

`qualify-identity-mysql.cjs --profile-browser` uses the compiled portal/account
service, real OPA and disposable MySQL. It proves independent-session persistence,
SQL rollback/concurrency, policy denial/outage, retained intent during broker
unavailability and account-process restart. Credentials are substituted at a local
ingress, unrelated APIs are unavailable, external browser requests are blocked,
and Firebase operations point at an unavailable loopback emulator. This is not
production identity, media, database-restart, backup or rollback qualification.

## Canonical account preferences

`GET/PUT /api/me/preferences` uses authoritative SQL, not a preference projection.
The application first evaluates explicit `identity.preferences.read/update` self
policies. The actor comes from trusted ingress; callers cannot select another
account, including through an admin role. Reads use a repeatable-read snapshot of
canonical lifecycle/revision and the preferences row. Missing preferences return
documented account defaults with a null update timestamp and do not write a row.
Malformed stored values fail the read rather than selecting defaults.

The preference JSON contract covers display, content filters, notifications,
privacy and accessibility. It is strict and bounded, with filter sets normalized
before fingerprinting. Account defaults keep profile visibility private and do
not opt into email delivery, analytics or personalization. Those defaults are
separate from browser demo settings. Contract evolution requires an explicit
migration of stored data; unknown or missing fields are not silently repaired.

The account revision is shared with profile and lifecycle commands. A preference
replacement locks the canonical identity and verifies active/nondeleted/
nonsuspended state before receipt replay. `expectedRevision` and `Idempotency-Key`
are required. The `preferences-update-v1` fingerprint is separate from profile and
registration commands. Preferences, account revision, receipt and the
`identity.updated` outbox event commit together. Failure at any step rolls back
all four. The event contains lifecycle/revision metadata, never private preference
values. Replaying a committed command returns its original revision without
overwriting a later profile or preference change.

`AccountPreferences1791676806000` creates the independent `identity_preferences`
table with a case-sensitive canonical UID key. Its preflight verifies InnoDB,
columns and key shape, and validates existing data against nondeleted canonical
identities in bounded batches. It can resume after DDL and does not provide a
destructive down migration. Both identity services must run after the explicit
maintenance migration. Account deletion removes preference/profile rows while
committing its tombstone, cleanup job and deletion event. A failed deletion leaves
the prior preferences intact; later reads and receipt replay are denied after
successful deletion.

Future public-profile materialization must read profile and privacy preferences
in one consistent canonical snapshot, publish that account revision, and enforce
current visibility from authority while its projection lags. This backend does
not yet supply that public projection, follower graph or notification consumers.
Persisting those choices alone is not delivery or public-access enforcement.

The isolated identity qualification now tests preference concurrency, rollback,
reconnect and lifecycle deletion. Its optional built-service journey tests the
preference API with real OPA, process restarts and policy outage, alongside the
profile browser regression and account settings screens. The API portal never
imports guest/demo choices into canonical data; commands bind to a loaded account
revision and retries preserve their idempotency key. A confirmed receipt triggers
a canonical reread. Account changes cancel pending work and stale UI feedback;
dirty forms cannot silently overwrite reloaded snapshots. Real browser checks
include a committed preference write with a lost response and an identical retry
that does not advance the revision twice. All earlier ingress/provider/restore
qualification limits still apply.

## Canonical account favorites

`GET/PUT /api/me/favorites` owns private saved relations in SQL. Each relation
contains account UID, target kind, stable UUID and added time. Names, slugs and
projection data are not persisted as target authority. The application evaluates
explicit self-read/update OPA policy before storage or target-service access.
SQL repeats active/nondeleted/nonsuspended lifecycle checks; reads use a consistent
snapshot. Raw saved references do not reveal target payloads or grant visibility.
The portal must resolve displayed content against current owning-service eligibility.

Changes require `expectedRevision` and `Idempotency-Key`. Profile, preferences,
lifecycle and favorites share the canonical account revision and receipt namespace;
favorite fingerprints use a distinct operation discriminator. The identity lock
serializes mutations and enforces the 200-relation bound. Relation mutation,
revision, receipt and `identity.updated` outbox event commit together. The event
contains identity/revision/lifecycle, not private favorite IDs. Even a desired-state
no-op advances the revision once. Identical retries return the original receipt;
they cannot resurrect a relation removed by a later command. Existing additions
retain their original added time. Account tombstoning removes favorite relations
in the same transaction; lifecycle checks prevent old receipts bypassing deletion.

Before remote eligibility lookup, a read-only inspection checks lifecycle,
receipt and expected revision. The write transaction repeats these checks under
the account lock. Thus completed add retries survive target deletion/outage and
removal never requires target availability. New adds support applications, suites and articles
through Editorial's authority-checked selection endpoints, and application-topic
discussions through Discussion's public selection endpoint. Hidden/deleted/missing
targets are indistinguishably unavailable; projection lag or dependency failure
fails the add.

`GET /api/discussion-selection?ids=...` accepts one to fifty distinct canonical
topic UUIDs and no other query fields. It uses SQL to resolve each immutable
application binding within `DISCUSSION_PUBLIC_TENANT`; replies, generic/article
threads, private, deleted and foreign-tenant roots are omitted. It reuses the
root-only exact-generation reader, then rechecks current root lifecycle/revision
and canonical Editorial application visibility after loading the batch. Changed
revisions, absent generations and unavailable dependencies fail truthfully; there
is no fallback to an old title. The no-store response contains only topic ID,
application ID, revision, title and reply count, without bodies or private owner
identities. This read introduces no projection, migration or durable intent.

Suite metadata uses `GET /api/catalog/suite-selection?ids=...`, bounded to 50
UUIDs with no tenant/visibility override. Canonical selection supports more than a
20-item browsing page; it returns only the approved public version, exact projection
revision and consistent publication metadata. A final SQL recheck rejects changes
during projection I/O. Private draft edits preserve displayed approved metadata.
Withdrawal/deletion immediately omit the target, even with old Mongo documents.
Saved relations survive as removable references, without a copied title or content.

Target eligibility is an observation across services, not transactional referential
integrity. A target may change after observation; a saved relation grants no content
access. No new projection exists and no materialization is performed on demand.
`AccountFavorites1791676807000` introduces case-sensitive canonical storage and
validates schema/key order, IDs, account lifecycle, timestamps and capacity in
bounded batches. Its rollback requires a reviewed data-preserving migration.
Account Management requires explicit `EDITORIAL_URL` and `DISCUSSION_URL` HTTP
origins. Deploy the Discussion selection endpoint and its gateway route before
enabling discussion saves in Account Management and the portal. Configure the
Discussion origin before starting the updated Account service; startup rejects
missing or invalid origins. The new unsigned lookup has a five-second timeout,
no redirects, a one-MiB response cap and strict response validation. The existing
account relation/revision/receipt/outbox transaction remains unchanged. Account
rollback requires no new schema migration; old clients/services cannot add this
favorite kind but can still remove existing canonical references.

Real SQL qualification proves atomic rollback, case isolation, duplicate/competing
commands, shared revision conflicts, capacity races, reconnect and lifecycle
cleanup. `qualify-materialization.cjs --favorites` adds compiled account APIs and
real OPA to the catalog journey, covering target rename/delete/lag, receipt replay,
removal during target outage, policy denial/outage and process restarts. Ingress
claims and fixture command policy are substituted, catalog projection publication
is controlled, and account broker/Firebase are unavailable. Separate recovery
suites exercise real broker delivery. Production credentials/gateway, database
restart, backup restore and deployment are not qualified by these checks.

The API portal uses those raw IDs for membership and configured catalog selection
endpoints for current application/suite/article metadata. Discussion metadata
uses its separately configurable origin (defaulting to the explicit API origin),
then resolves deduplicated application IDs through catalog selection to obtain
current canonical slugs. The catalog origin must
route `suite-selection` and `article-selection` to Editorial; a bare
application-only BFF is insufficient. It issues at most eleven selection requests
of at most fifty IDs across the four families and the discussion-parent join for
the 200-relation account limit, and rejects malformed/duplicate/unrequested records.
Each batch has the
catalog's per-request consistency, not a global snapshot across all batches.
Missing targets have no invented link or payload. Projection/transport failure
invalidates displayed metadata, but does not erase canonical membership or block
removal. No client-side cache grants target visibility; reload checks the owning
service again. Demo data is selected explicitly and never seeds account storage.

Portal writes bind to a loaded revision and keep the same key for unchanged
uncertain intent. Confirmed receipts trigger a canonical reread. Session/target
changes cancel obsolete UI work and discard feedback; cancellation cannot retract
a server commit. Concurrent writes are blocked within the feature while SQL
revision checks arbitrate other clients/profile/preferences. Canonical discussion
controls share membership in topic lists, full threads and quick dialogs. Missing
or withdrawn targets have removable references without links; failures expose
unknown details. All four canonical kinds are supported; malformed target IDs
never become add controls. The optional
`--favorites-browser` runner proves these flows using the compiled portal and
real services, including lost receipt, independent sessions, account restart,
rename/delete/lag and target-metadata outages. Existing qualification limits apply.
`qualify-suites.cjs --favorites` extends it through actual suite publication,
replacement/withdrawal/deletion, frozen draft-vs-public content, bounded selection,
outbox-failure rollback and suite-filtered browser routes. No new projection or
best-effort cross-service write is added by this workflow.

`qualify-suites.cjs --application-discussions --article-comments --delivery
--my-discussions --discussion-favorites` extends the real Discussion recovery
journey with compiled Account Management/OPA and independent portal sessions.
It covers current root/parent eligibility, exact replay, competing account
revisions, API restart, missing generations, owning-service outages, withdrawal,
deletion and removable references. The eligibility observation, account commit
and later metadata join are separate service operations, with no global snapshot
or distributed referential guarantee. Reads continue to enforce current authority.
