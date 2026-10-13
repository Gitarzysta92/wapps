# Wapps operational readiness

Favorite content preferences update (October 13, 2026): the favorites page,
type-filtered routes and sidebar now enforce current-account approved General/Mature
classification, including parent inheritance for discussions. Hidden/unavailable
references remain removable. Settings changes, account isolation, preference and
metadata retries, restart persistence, frozen approval and projection lag/rebuild
pass local qualification. Evidence: 775 tests / 84 suites, affected builds/lint/
typechecks, 57 Angular package inspections, zero architecture violations, 16
integrated check groups and 42 responsive/theme layouts with seven inspected
screenshots. See `favoritesContentPreferencesCheckpoint`. Upgrade compatible
Account selection consumers before classified producers; old Account binaries
reject the added field. No new migration or projection is introduced. Work stops
here for the requested review; the broader goal remains paused. Profile and
notification preference consumers and every OP gate remain open. No deployment
or gate closure occurred; earlier checkpoints retain their original scope.

Individual feed preferences update (October 13, 2026): Explore, all four Digest
groups and application timeline items now enforce approved classification using
real saved account choices and the guest default. Same-document saves, account
switches, held responses, preference failure/retry, independent suite classification,
frozen review, projection lag/rebuild and all-hidden page continuation pass local
qualification. Evidence: 1,800 tests / 173 suites, affected builds/compilers/lint,
57 Angular package inspections, zero architecture violations, 21 integrated check
groups and 78 responsive/theme layouts with ten inspected screenshots. Explore's
themed surface preserves readable controls and notices above the decoration.
See `feedContentPreferencesCheckpoint`. Favorites, profiles, notifications and all
OP gates remain open. No deployment or gate closure occurred; older checkpoints
retain their original scope.

Home grouped preview update (October 13, 2026): API-mode Home now previews real
applications/articles/suites with bounded requests, exact source counts, canonical
tag names and actual links. Current-account choices, cancellation, hidden/loading/
failure states, retry focus and keyboard navigation pass local qualification.
Evidence: 474 tests / 65 suites, affected compilers/lint, uncached dependency builds,
57 Angular package inspections, zero architecture violations and two real-service
browser runs with 234 measured layouts and ten inspected screenshots. See
`homeGroupedPreviewCheckpoint`. Upgrade portal consumers before the BFF's added
optional display-label field. Individual feed items, favorites, profiles,
notifications and all OP gates remain open. No deployment or gate closure occurred;
earlier entries retain their original checkpoint scope.

Application subpage preferences update (October 13, 2026): discussions/reviews,
quick dialogs, releases, HTTP health and timelines now enforce the parent
application's approved classification. Route/current-choice binding, generic hidden
metadata, child cancellation and preference outage/retry pass local qualification.
Evidence: 614 tests / 75 suites across affected checks, uncached dependency builds,
57 Angular package inspections, zero architecture violations, two real-service
browser runs with 246 measured layouts and ten visually inspected screenshots.
The Discussion run includes actual broker delivery/rebuild and existing write/retry/
moderation regressions. See `applicationSubpagePreferencesCheckpoint`. Individual
feed/timeline items, Home previews, favorites, profiles, notifications and all OP
gates remain unfinished. No deployment or gate closure occurred. Earlier entries
retain their original checkpoint scope.

Public content preferences update (October 13, 2026): application catalog listings
and overviews, public article/suite lists and details, and individual suite members
now enforce approved classification in API mode. Current-session preference reads,
hidden/loading/failure states, account switching and retry pass local qualification.
Private authoring/review remains usable. Evidence: 529 tests / 71 suites, affected
builds/lint/compilers, clean dependency builds, 57 inspected Angular artifacts,
zero architecture violations, real SQL/Mongo/OPA and compiled-service/browser checks,
114 measured layout states and ten visually inspected screenshots. See
`publicContentPreferencesCheckpoint`. Application subpages, Home/feeds, favorites,
profiles, notifications and all operational/deployment gates remain open. No OP gate
closes and no deployment occurred. Earlier entries retain their checkpoint scope.

Classification update (October 13, 2026): author-proposed, staff-approved General/
Mature classification and API-mode Discover filtering are locally qualified for
applications, articles and suites. Unclassified legacy content is hidden when mature
content is disabled. Real-store checks cover frozen approval, rollback/retry, stale
projections, exports, migration replay and process restart; independent browsers and
verified-owner editing pass. Evidence: 1,718 tests / 156 suites, clean dependency
builds, zero boundary findings, 234 measured layout states and 17 inspected screenshots.
See `classificationDiscoverCheckpoint`. Other public preference consumers, all OP
gates and production qualification remain open. Earlier statements retain their
checkpoint scope; no deployment occurred.

Grouped Discover update (October 13, 2026): API-mode search now returns independently
paged real application, article and suite groups with exact source totals, current
approved content and actual detail links. Strict filter contracts, saved display
choices, current-page category exclusions, restart/outage, projection rebuild and
withdrawal/replay behavior pass local service/browser qualification. Evidence:
1,347 tests / 133 suites, affected lint/build/typechecks, zero architecture violations
and six visually inspected responsive/theme layouts. See
`discoveryWorkflowCheckpoint`. Home previews, mature classification and remaining
preference/channel/operational scope stay open. Author-proposed, staff-approved
classification is now agreed; unclassified content must be hidden when mature
content is disabled. No OP gate is closed and no deployment occurred.

HTTP health update (October 13, 2026): API-mode application health now passes local
qualification with staff-configured approved public endpoints, durable HTTP results,
bounded lease retries, immutable configuration generations, current visibility,
sampled availability/coverage and truthful unknown/stale states. Six inspected
responsive theme layouts and independent browser outage/retry checks pass alongside
real SQL/OPA/HTTP and compiled-service restart tests. Focused evidence includes
1,202 tests / 123 suites, 285 OPA checks, clean dependency builds, 57 Angular packages
and zero architecture violations. See `healthWorkflowCheckpoint`. Probing remains
default-off; public DNS/TLS/egress and production operation remain unverified. The
next workflow is real grouped discovery. All OP gates and the full goal stay open.

Application timeline update (October 13, 2026): API-mode per-application timelines
now pass local qualification for five current public activity kinds, canonical
scope before paging, approved suite membership, current visibility and encrypted
application-bound cursors. Independent browsers cover real links, URL paging/Back,
persistent saved choices, account/route cancellation and failure/restart recovery.
Evidence includes 1,732 tests / 164 suites, affected builds/lint/typechecks, 57 Angular
packages, zero architecture violations and 18 inspected timeline/Digest/Explore
layouts. See `timelineWorkflowCheckpoint` and `IMPLEMENTATION-PROGRESS.md`.
No new projection/migration is needed. Status observations are next; current public
activity does not imply a complete event history. All OP gates remain open.

Digest update (October 13, 2026): API-mode `/digest` now passes local qualification
with independent bounded activity/article/application/discussion selections, actual
summaries/covers/links, saved choices, account isolation and failure/restart recovery.
The shared Explore workflow is requalified. Focused checks pass 1,716 tests / 159
suites, 178 OPA checks, affected builds/compilers/lint, 57 Angular artifacts, zero
architecture violations and 12 inspected browser layouts. See the Digest checkpoint
in `IMPLEMENTATION-PROGRESS.md` and the dated evidence JSON. No OP gate closes;
application timelines and the remaining product/operational scope still follow.

Assessment date: October 11, 2026. Branch: `codex/operational-readiness`.
Baseline commit: `c965790e` (existing recording-related working changes preserved).

Implementation has started on `codex/full-operation`. This document and its dated
JSON retain the original measured baseline. See
[implementation progress](IMPLEMENTATION-PROGRESS.md) for fixes and current
evidence, and [materialization](MATERIALIZATION.md) for the consistency contract.

Previous checkpoint (October 13, 2026): real Explore activity now passes local
qualification for six public content kinds through canonical source selection,
revision-checked projections, encrypted bounded paging and actual portal links.
Saved exclusions, real page-local popular/recommended order, opt-out, session
cancellation, restart/outage and current withdrawal are covered. Focused evidence
includes 1,690 tests / 154 suites, 178 OPA checks, affected build/lint/typecheck,
57 Angular packages, zero architecture violations and six inspected responsive
theme layouts. See `exploreWorkflowCheckpoint`. No new feed projection or migration
is introduced. Activation requires matching dedicated credentials, source URLs and
updated OPA. Digest was the next slice, now qualified above; mature classification, timelines, channels,
remaining workflows and every OP gate remain open.

Previous checkpoint (October 13, 2026): explicit discussion mentions now pass local
qualification from member selection and posting through durable delivery, inbox
reads and real conversation links. Current profile/parent access, remove/re-add,
opt-out, source rollback/replay, crash/retry/quarantine, restart/outage, export/erasure
and independent sessions are covered. Focused evidence includes 3,020 tests / 251
suites, 281 OPA tests, affected builds/compilers/lint, 57 Angular package inspections,
zero architecture violations and 18 measured responsive theme layouts. See
`mentionNotificationWorkflowCheckpoint`. Both migrations/OPA bundles, dedicated
credentials, service URLs and fenced writers precede activation. The next workflow
is the real Explore feed with current access and saved preference enforcement.
Email, push, system alerts, remaining product workflows and every OP gate stay open.

Previous checkpoint (October 13, 2026): in-app favorite updates now pass local
qualification for applications, suites, articles and discussions, including published
release updates on saved applications. Canonical source cursors, saved baselines,
subscription generations, atomic delivery/suppression/read decisions, current visibility,
retry/quarantine/requeue, export/erasure and independent browsers pass. Evidence includes
2,509 tests / 215 suites, 174 OPA tests, affected builds/compilers/lint, 57 Angular
packages, zero architecture violations and six inspected responsive theme layouts.
See `favoriteUpdateWorkflowCheckpoint`. Coordinated source/Account migrations, OPA,
credentials and fenced writers must precede activation; favorite creation already
requires the upgraded source APIs while delivery is off. Mentions are the next workflow.
Other channels, deployed activation and every OP gate remain open.

Previous checkpoint (October 13, 2026): in-app application-discussion/article-comment
reply notifications pass local qualification through compiled services and independent
browsers. Atomic source intent, canonical delivery/suppression/read receipts, current
visibility, saved opt-out, bounded retries/requeue, restart/lost acknowledgement,
private export and real conversation links pass. Evidence includes 1,771 tests / 160
suites, 199 OPA tests, affected builds/compilers/lint, 57 Angular package inspections,
zero architecture violations and six responsive theme layouts. See
`replyNotificationWorkflowCheckpoint` in the implementation JSON. Deployment requires
both migrations, dedicated credentials, updated OPA and fenced writers before worker
activation. Remaining event types/channels and every OP gate stay open.

Previous checkpoint (October 13, 2026): the full Account/Editorial/Discussion erasure
workflow and API privacy-page action now pass local qualification, alongside the
four-source account-export regression. Durable global completion waits for all
participant and credential receipts; injected final-journal failure, restart,
retained anonymous public content/media and newer-session protection pass. Evidence
includes 1,205 tests / 117 suites, affected builds/compilers/lint, 57 Angular packages,
zero architecture violations and 24 browser layouts (18 erasure, six export). See
`accountErasureWorkflowCheckpoint` in the implementation JSON. Production activation,
ingress/credentials, writer fencing/inventory, restore/rollback and load/soak remain
unverified. F30's remaining privacy consumers and every OP gate stay open. In-app
reply notifications were the next complete workflow; their local qualification is
recorded in the current checkpoint above.

The following component checkpoints and baseline findings preserve their original
scope. Their statements about disabled/unqualified account erasure are superseded by
the current workflow checkpoint above; they do not describe the current portal action.

Editorial's production erasure participant now passes local qualification through
its compiled service-only endpoint. All cleanup phases precede an indexed final
check of 36 attribution/target fields under the exact permanent barrier. Activation,
authorization, media/Mongo/SQL failures, restart, concurrent completion and retained
public content/media pass. Checks include 751 tests / 55 suites, production build,
compilers/lint, zero architecture violations and 12 compiled browser layouts. The
enabled Account/portal cross-service journey and production rollout remain open;
the portal erasure action is still disabled. F30 and all OP gates stay open.

Editorial projection erasure now passes local qualification across all six content
kinds. It confirms the durable complete Mongo document and unchanged SQL authority
before removing each target. Real-store conflict, corruption, successor races,
duplicate delivery, rollback/restart and migration reentry pass; 734 tests / 53 suites,
production build/compilers/lint, zero architecture violations and 18 compiled browser
layouts pass. Participant composition and final residual checks are now qualified
above; the enabled Account/portal journey remains open, along with all OP gates.

Editorial ownership/audit erasure now passes local qualification. Owned private
claims/proofs/receipts and revoked grants drain in bounded transactions. Peer
decisions keep their reasons, outcomes and times with explicitly anonymous reviewers;
successor grants and permanent restrictions on unbound authoring survive. Legacy
transfer backfill, interrupted pages, rollback, concurrency/restart, unchanged peer
exports, ordinary peer deletion and ownership HTTP regressions pass. Checks include
705 tests / 52 suites, production build/compilers/lint, zero architecture violations
and 12 retained-content browser layouts. See the audit-erasure checkpoint. Production
Editorial participant composition and final completion checks still precede
the enabled Account/portal journey. F30 and all OP gates remain open.

Editorial private workspace erasure now passes local qualification for applications,
suites, articles and releases, including bounded history removal, durable cleanup of
unused uploads, shared-private-image ordering, permanent guards, SQL rollback,
concurrent workers and restart. Canonical public snapshots/outbox and media still
used by public content or other members remain exact. The additive index migration,
686 Editorial tests, build/typechecks/lint, zero architecture violations and 12
compiled browser layouts pass. See the private-workspace checkpoint. The adapter is
not yet composed into Editorial's production erasure participant: ownership/proof/
audit cleanup and exact projection completion remain prerequisites to enabling the
Account/portal journey. F30 and all OP gates remain open.

Editorial canonical anonymity now passes local qualification for all six content
kinds, including retained article text/cover associations, active ownership
termination, atomic revision/outbox/target writes and protection from stale
projections or concurrent ownership transfer. Checks pass 1,130 tests / 107 suites,
builds/typechecks/lint, 57 Angular artifacts, real-store migration/recovery and 18
compiled browser layouts. Architecture reports zero violations across 136 projects
and 1,546 sources. See the Editorial anonymity checkpoint. Private/audit/media
cleanup, projection completion and production participant composition still block
full erasure. F30 and every OP gate remain open; deployment qualification is absent.

Public suites now retain self-contained approved canonical snapshots, removing the
private-history dependency that blocked Editorial erasure. Exact approved backfill,
128-row interruption/restart, detached public reads/activity/export/materialization
and compiled publication/recovery workflows pass local qualification. Checks cover
993 tests / 98 suites, production builds/compilers, 57 Angular packages, 72 browser
layouts and zero architecture violations across 136 projects / 1,541 sources.
Screenshot review also found and fixed mobile suite-title compression. Existing
portal warnings remain. See the suite-publication-snapshots checkpoint. Editorial
author anonymization, private/audit/media cleanup and participant completion still
follow; overall erasure and every OP gate remain open. Rollout requires explicit
migration and writer fencing; production restore/rollback/load/soak remain unverified.

Discussion's production participant now composes all cleanup phases and records
exact durable completion after the final SQL checks. Local qualification passes
402 tests / 32 suites, production build/typecheck/lint, architecture (136 projects /
1,539 sources / zero violations), real-store regression and the compiled
Account-to-Discussion workflow with mixed discussions/reviews, recovery and
concurrent completion. Activation requires explicit legacy-worker fencing and
completed inventory. Editorial cleanup and the enabled portal journey remain open;
Account truthfully stays pending. See the participant checkpoint. No OP gate closes.

Review erasure is now locally qualified: public reviews retain anonymous text,
ratings and peer helpful marks; private reviews become inaccessible tombstones.
Bounded historical/actor cleanup preserves later reports and moderation, using
exact resolution revisions. Checks pass 392 tests / 31 suites, final build/compilers,
lint, real-store erasure, export regressions and 108 compiled browser layouts.
Architecture reports zero violations across 136 projects / 1,537 sources. See the
review-erasure checkpoint. Production Discussion composition/exact completion,
Editorial cleanup and the portal erasure journey remain unfinished; no OP gate closes.

Discussion private SQL cleanup is now locally qualified: erased likes/votes commit
deletion with aggregate revision/outbox updates; private receipts and registry
attribution drain in bounded batches after original bytes retire. Permanent identity
barriers, anonymous retirement guards and other owners' content survive. Checks pass
391 Management tests / 31 suites, build/typecheck/lint, real-store erasure and
upload/inventory regressions, with zero violations across 136 projects / 1,534
sources. See the private SQL checkpoint. Review cleanup and production participant
composition remain unfinished, followed by Editorial and the portal erasure journey.
No erasure completion or OP gate is claimed.

Discussion's retained-projection cleanup is now locally qualified: bounded v1/v2
copy removal waits for a durable anonymous schema-3 record, preserves its tombstone,
and survives a SQL failure after Mongo deletion. Obsolete orphans are drained; unknown
schemas/current attribution block progress. Checks pass 381 Management tests / 30
suites, build/typecheck/lint and real-store erasure regression, with zero violations
across 136 projects / 1,531 sources. See the retained-projection checkpoint.
Review cleanup and participant composition still prevent full erasure;
production fencing, restore/rollback and service-wide gates remain unqualified.

Canonical Discussion contribution anonymity now has a locally qualified bounded
application/adapters workflow. Public/unlisted text, IDs and replies survive with
null ownership and a neutral public author; private pointers are cleared into
tombstones. Copy reservation and canonical revision/outbox commits pass real-store
crash, moderation and concurrency checks, with 424 tests / 33 suites, both builds,
compiler/lint checks and zero architecture violations across 136 projects / 1,528
sources. Registry/inventory and export regressions pass. See the canonical anonymity
checkpoint in implementation progress. This does not yet run automatically from the
production participant: historical projection/private/audit/review cleanup and
participant completion remain pending, followed by Editorial and portal erasure.
No OP gate closes and no deployment qualification is implied.

Discussion's projection prerequisite for erasure now passes local qualification.
Schema 3 stores stable node records with monotonic atomic replacements, preventing
a delayed worker from recreating older payload bytes after a newer tombstone.
Reads require complete pinned generations and return pending during partial writes.
Schema-2 heads rebuild from authority at the same canonical revision. Checks pass
408 tests / 32 suites, both service builds, real four-store recovery and 84 compiled
Discussion browser layouts. See the projection erasure checkpoint in implementation
progress. Canonical anonymity, cleanup of older schema-2 copies, private-data removal
and participant completion remain unfinished. Production worker fencing and
restore/rollback/load/soak are still unqualified; no OP gate closes.

Historical Discussion object inventory is now locally qualified through a reviewed
maintenance CLI. It registers provable old ownership, preserves mutable legacy
bytes in registered immutable copies, and safely retires proven orphans without
changing public content. Unresolved ownership/graph state blocks progress. Durable
32-object checkpoints, generation checks, concurrent writes, crash recovery,
erasure races and real bucket-versioning refusal pass disposable SQL/MinIO checks.
The shared object-reader export regression passes. Focused checks pass 383 tests /
29 suites; architecture reports zero violations across 136 projects / 1,523
production sources. See the inventory checkpoint in implementation progress.
Deployment still requires fenced/drained legacy writers and reviewed backfill.
Discussion/Editorial participant completion, canonical public anonymity and the
portal erasure workflow remain unfinished. No OP gate closes.

Account erasure remains the current workflow. Durable coordination activates
owning-service barriers and keeps overall cleanup pending until every participant
and credential cleanup finishes. Account now completes its own bounded private-
data cleanup, including export bytes and anonymized staff badge history, while
preserving other members' badge state and lifecycle authority. Real SQL,
compiled-service outage/restart and 84 badge browser layouts pass, alongside
1,206 tests / 106 suites; architecture reports zero violations across 136 projects
and 1,515 production sources. See the Account cleanup checkpoint in implementation
progress. Editorial/Discussion cleanup, public-author anonymity, safe immutable-
file retirement and the portal erasure workflow remain unfinished. No OP gate
closes; Account completion does not mean cross-service erasure has completed.

Discussion's upload/retirement prerequisite is now locally qualified: ownership
is reserved before immutable uploads, and canonical content/receipt/outbox commits
require an exact confirmed reservation. Bounded obsolete-object retirement keeps
permanent empty markers that block paused uploads from recreating bytes. It is
not yet composed into the production erasure participant. Qualification passes
582 tests / 44 suites, real SQL/MinIO retirement races, four-store recovery,
compiled Account export/erasure restart and 84 Discussion browser layouts.
Architecture remains at zero violations across 136 projects / 1,518 sources.
The erasure migrations now validate actual MySQL index order independently of
ORM enumeration. Historical object inventory, public anonymization and automatic
service cleanup remain open. See the Discussion
payload checkpoint for exact evidence, the intermittent migration failure's
diagnostic limits and remaining rollout/restore/rollback/load/soak gates.

The registered-payload export gap is now locally qualified through the private
source, compiled Account archive and actual browser download. It includes owned
historical/removed/uncommitted bytes, truthful reserved-upload observations and
completed-retirement metadata. Uploader-only actions exclude another owner's
identity, bytes and current-use status. Qualification passes 323 tests / 26
suites, real SQL/MinIO snapshot/privacy/retirement checks, runtime restart/retry
and six browser layouts; architecture covers 136 projects / 1,519 sources with
zero violations. Unknown unregistered/legacy objects still require inventory.
This expands export coverage without completing erasure or closing any OP gate.

Account export is now locally qualified through the Account runtime, all four
real sources and the privacy page. Durable requests, exact replay, status,
source outage/retry, restart recovery, cancellation, verified download, expiry and
current account lifecycle pass real-service checks. Independent browsers cover
session isolation, lost responses and six responsive/theme layouts. Focused
regression passes 650 tests / 75 suites; 57 Angular packages and the 1,498,188-byte
initial CSR pass. Architecture reports 136 projects / 1,500 sources / zero
violations. See the account-export workflow checkpoint for exact evidence and
substitutions. It supersedes earlier saved-preferences-only export limitations.
Dedicated credentials, coordinated rollout and production operations remain
unqualified. No OP gate closes. Next is cross-service erasure: retain public
contributions with anonymized authorship, delete private data and end ownership
access, as confirmed by the user.

Published profile articles are now locally qualified, with canonical author/tenant
selection, exact published generations, current audience/Show Activity History,
20-item UUID paging and privacy-race rejection. Qualification passes 1,366 tests
in 122 suites, 56 Editorial OPA cases and 60 responsive browser layouts; the live
journey creates 21 reviewed articles and tests private isolation, lag/loss/rebuild,
withdrawal, outage/retry and Account restart. No new projection or migration is
introduced. All OP gates remain open; see the article checkpoint for current
evidence and the 1,812-byte initial bundle headroom.

Profile totals are now locally qualified on private/public profiles, with complete
canonical counts, audience/category sharing, truthful hidden/zero/failure states,
privacy-race rejection and restart. Qualification passes 1,621 tests/143 suites,
189 OPA cases and 48 browser layouts; SQL fixtures exceed collection page sizes.
No new projection or migration is introduced. The current 200-parent Discussion
bound and production rollout/load/restore/rollback remain explicit limitations.
Remaining authored content, export/erasure, feeds/notifications and all OP gates
remain open. See the totals checkpoint for its evidence and the later article checkpoint for
current bundle headroom.

Staff profile badges are now locally qualified: authorized award/revoke with
reasons, immutable private audit, exact retry and public/private display under
current audience and Show Badges. Canonical badge state, audit, account revision
and invalidation commit atomically without a new projection. Qualification passes
1,015 tests/96 suites across seven affected projects, 93 identity OPA cases and 78
responsive layouts. Real checks cover rollback, races, privacy changes during I/O,
restart, migration validation and Nginx routing. The compiled migration check also
fixed the shared runner's rejection of MySQL string-valued advisory-lock success.
Architecture covers 136 projects/1,443 sources with zero violations; 57 Angular
packages pass. CSR initial size is 1,498,089 of 1,500,000 bytes. Explicit badge
migration and coordinated rollout remain required. Audit retention/full erasure,
remaining collections, feeds/notifications and production
operational qualification remain open; no OP gate closes.

The preceding profile activity checkpoint is locally qualified: public publications,
individual community contributions, reviews and saved favorites share one bounded
chronological stream under current audience and category-sharing policies. Canonical
publication attribution includes approved ownership-editing drafts and direct
publisher supersession. Exact projection reads, final authority checks, confidential
hidden-page continuation and recovery are qualified across real services. Latest
valid affected checks total 1,700 tests/146 suites and 170 OPA cases; the profile
portal passes 60 responsive state/layout checks. Architecture covers 136 projects
and 1,428 production sources with zero violations; 57 Angular packages pass artifact
inspection. Its recorded CSR initial size was 1,497,241 of 1,500,000 bytes. The
badge checkpoint supersedes its badge limitation and current build measurements;
other unimplemented workflows and operational gates remain open.

Release publication is locally qualified through verified-owner drafts,
independent immutable review, canonical version notes, withdrawal, recoverable
projections and the API portal. Devlogs support real channel/previous-release
pagination; local gateway routing is checked separately. This narrows OP06/OP07
without closing either gate. Article text drafts, independent immutable review,
real public reading/filtering/pagination and canonical favorites now also pass
local service/browser qualification. Article covers now also pass upload/reload
recovery, frozen review/public binding, reference-safe retention and 78 responsive
browser checks across real SQL/MinIO/OPA/HTTP/Mongo/broker services. Article comments
now also pass local publication-bound reads/writes, author edits, moderator removal,
exact retries, materialization recovery and 78 browser layout checks. Application
discussions now also pass public topics/replies, author editing, moderator
removal, exact retries, current parent visibility and 84 browser layouts. Their
23 service/recovery groups include article/generic Discussion regressions and
explicit migration upgrade. Account-wide My Discussions now also passes
canonical self/tenant-scoped participation, deduplication, deletion, bounded
paging and recovery qualification: 27 service/recovery groups, 60 browser
layouts and the explicit participant-index upgrade. API-mode quick discussions
now also pass real replies/edit/removal/moderation, exact retry after reopening,
account isolation, parent-list refresh and 84 browser layouts. Their 380 focused
tests and 27 service/recovery groups pass. Discussion favorites now also pass
canonical eligibility, durable account saves, exact retry, conflicts, current
metadata and removable unavailable references: 735 focused tests, 31 real-service/
recovery groups and 66 responsive layouts. Account Management requires
`DISCUSSION_URL`; rollout ordering is documented. Real discussion voting now
also passes canonical actor choices/counts, atomic receipt/revision/outbox,
conflicts, exact retry and recovery: 626 tests, 28 OPA cases, 32 real-service groups
and 72 responsive layouts. Votes use SQL snapshots at the exact thread revision,
with no additional projection. Explicit migration and coordinated API/portal
rollout are required. Topic pinning now also passes tenant-admin access, canonical
ordered pages, atomic writes and recovery: 645 tests, 30 OPA cases, 36 service
groups, the separate generic recovery regression and 78 responsive layouts.
It adds canonical SQL metadata and an explicit migration without a new projection.
Member reviews now also pass durable authoring, helpful marks, immutable reports,
independent staff hide/restore, current public ratings and overview summaries:
579 tests, 34 OPA cases, 17 service/recovery groups and 96 responsive layouts.
Their documented SQL variation uses immutable versions, transactional receipts
and a retained change journal, without a review projection or delivery consumer.
Canonical overview/related-topic previews now also pass 394 tests, 12 existing
service/recovery groups and 48 browser layouts, including projection lag/loss,
restart/rebuild, deletion and withdrawn parents. They reuse the existing bounded
topic contract and keep preview state separate from the open composer.
Integrated credential email verification now also passes 570 focused tests,
actual provider action-code checks, compiled identity/account APIs with real
SQL/OPA/Firebase emulator, four service groups and 60 responsive layouts.
Lost completion, independent accounts, suspension/revocation, provider outage and
authenticator restart are qualified. Both static Nginx configurations pass
action-code log/referrer/cache checks. No shadow verified flag or new projection
is introduced. Real mail/template setup and deployed edge controls remain open.
Private profile photos now also pass atomic upload/replacement/removal, private
current-owner reads, retry/reload recovery and account-deletion cleanup. Their
758 tests, real SQL/OPA/compiled APIs, 150-layout profile/preferences regression
and 36 final photo layouts pass. The documented bounded SQL payload variation adds
no projection or object-store dependency. Both identity services require the new
explicit avatar migration. Public profiles and photos now enforce canonical
public/private/owner-approved-follower audiences, with no staff override. Requests,
approval, revocation, exact retries and private outgoing cancellation pass 825
tests, 53 OPA cases, real SQL/compiled APIs, 54 focused browser layouts and the
150-layout profile/preferences/photo regression. The new follower migration,
atomic dual-account invalidations and canonical-read variation are documented.
Explicit contact-email editing and sharing now also pass 846 tests, real
SQL/OPA/compiled APIs, 90 focused layouts and the 150-layout profile regression.
The field is separate from credential email, requires both the saved switch and
current audience, and is omitted from directories. Stable legacy receipts and
the additive contact migration are qualified locally. Badge/activity/content
privacy consumers, notifications and full export/erasure stay open. Lazy private
profile validation brought initial CSR headroom to 4,460 bytes; budget unchanged.
Shared public-profile favorites now enforce current audience plus Show Favorites,
resolve only current public applications/suites/articles/discussions and recheck
canonical access after content I/O. Their 772 tests, 60 OPA cases, 23 service groups,
54 focused layouts, 66 discussion-favorites regression layouts and the 150-layout
profile/preferences/photo regression pass locally.
Withdrawn targets reveal no identifiers, pending projections remain unavailable,
and pagination uses only visible results. No migration or new projection is added.
Published profile suites now also enforce current audience plus Show Suites,
resolve the canonical owner privately and serve only reviewed public versions.
Private edits retain approved metadata; withdrawal and privacy changes invalidate
reads independently of old projections. 1,349 tests, 120 OPA cases, 30 service
groups, 60 suite layouts, 60 shared-favorites regression layouts and 66 discussion
favorites layouts pass locally. Local Nginx denies the internal service endpoint;
private service origin and coordinated ingress-secret configuration are documented.
No new projection or migration is introduced. Current initial CSR headroom is
3,257 bytes. Contributor attribution, remaining profile content/privacy consumers,
export/erasure and all service-wide operational gates remain open.
Shared discussion participation now also enforces the current audience plus Show
Discussions across application topics and article threads. It deduplicates live
contributions, rechecks membership after remote reads, hides withdrawn parents and
uses encrypted continuations across bounded hidden-page scans. Exact article-thread
links support real reply/reload and truthful invalid/wrong-parent states. Local
qualification includes 1,177 tests, 166 OPA cases, 39 combined service groups,
66 profile and 24 article layouts plus suite/favorites regressions. No migration
or new projection is added; Account/Discussion and their policies require coordinated
deployment with matching secrets and private service routing. Current CSR headroom
is 2,780 bytes. Activity/badge privacy consumers, complete export/erasure and the
operational gates remain open.
These checkpoints narrow
OP02/OP05/OP07 without closing them or the full-service goal.
Deployment, restore/rollback/load qualification and the
remaining full-service requirements remain open. See the release and article
checkpoints for evidence and limits.

Wapps is a substantial interactive demo with partially implemented backend
capabilities. It is not yet a complete multi-user product. The main work is
connecting real use cases to durable services, closing authorization defects,
and making builds, architecture checks, and release verification reliable.
Frontend compilation alone does not establish readiness.

The companion [functionality map](FUNCTIONALITY-MAP.md) traces every portal route
family, shared feature, backend API group, worker, and storage boundary. Its
[source inventory](readiness/functionality-inventory-2026-10-11.json) records
25 controllers, 74 HTTP handler declarations, and 29 shared feature directories.
These are coverage counts, not a product-completion score.

This is an engineering assessment of the repository, not a certification of the
running public site. No production configuration, remote data, or deployment was
changed. Docker was unavailable during the baseline assessment. It is now
reachable; isolated MySQL and Firebase Auth emulator qualification pass as recorded
in the implementation evidence. Later catalog and private-profile checkpoints
also qualify specific browser-to-service journeys and application-process restarts.
Complete deployed journeys, database restart, backup restoration and rollback
remain unverified.

## Definition of fully operational

Wapps is fully operational when a new user can discover real applications,
create and recover an account, maintain a profile and personal collections,
participate in discussions and reviews, and submit an application through an
authorized publication workflow. Another authorized user must see the resulting
shared data. An operator must be able to deploy, observe, restore, and roll back
the system using versioned configuration and repeatable checks.

The scope follows the flows advertised in `apps/portals/aggregator/README.md`,
checked against the actual behavior in [FUNCTIONALITY-MAP.md](FUNCTIONALITY-MAP.md).
It includes the supporting identity, editorial/catalog, discussion, media, and
projection services. A separate portal or service need not exist solely to meet
this definition; every component shipped in the release must have a declared
purpose and pass its checks. The content registry's ownership role needs an
explicit decision before depending on it.

AI enrichment, the external scraper, and Discord notifications are optional
integrations. The product must remain usable without their credentials. Billing,
new recommendation algorithms, additional providers, and a new visual design are
not prerequisites. Real review, status, and notification functionality currently
advertised by the portal cannot be counted as finished using sample data.

All of these release gates must pass:

| Gate                | Required evidence                                                                                                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real behavior       | Every released action reaches its actual use case; no fake success or implicit mock fallback. Explicit demo mode remains available separately.                                                                       |
| Identity and access | Registration, verification where required, login, refresh, recovery, logout, suspension, ownership, and deletion work. Anonymous, wrong-user, wrong-tenant, denied-policy, and unavailable-policy cases are tested.  |
| Durable data        | Saves survive service restart and appear in a second independent browser session. Account switching does not leak another user's private data.                                                                       |
| Complete journeys   | Catalog search/detail, favorites, profile/settings, suites, submission/review/publication, discussions/replies, reviews/votes, and enabled notifications have browser-to-service acceptance tests.                   |
| Data integrity      | Versioned migrations, bounded queries, input validation, consistent identities, replay-safe events, deletion propagation, and recoverable partial failures are demonstrated.                                         |
| Engineering quality | Supported builds, lint, type checks, architecture checks, meaningful unit/contract tests, and browser acceptance tests pass from a clean checkout with pinned dependencies. Empty test suites do not satisfy a gate. |
| Portal conventions  | Theme ownership and shared page width/spacing rules pass review. Changed screens work at 390, 768, and 1440 CSS pixels, in light/dark themes, with keyboard navigation, loading, empty, and failure states.          |
| Operations          | Dependency-aware readiness, actionable logs/metrics, queue failure visibility, secret/config validation, backup restoration, and rollback are exercised in a production-like environment.                            |

Initial qualification targets for development are: 10,000 catalog records at
20 read requests/second, p95 catalog response time under 500 ms, ordinary writes
under 1 second excluding external delivery, and projection visibility within
5 seconds under normal operation. These are proposed test targets, not measured
capabilities. Record hardware, dataset, concurrency, error rate, and measurement
window. Keep the existing production bundle limits; document and resolve their
warnings. Exercise a 24-hour mixed-read/write soak, one broker restart, one
database restart, one backup restore, and one application rollback before calling
the release operational. Establish explicit recovery-time and acceptable-data-loss
targets before the restore exercise.

A narrower launch can hide unfinished actions and document its reduced scope.
That is a smaller operational release, not completion of the full scope above.

## Verified baseline

Local tools: Node `22.17.1`, Nx `20.8.2`, TypeScript `5.7.3`, Angular `19.2.17`.
Installed dependencies were used; a clean `npm ci` was not exercised. The graph
contains 132 projects, including the pre-existing untracked recordings project.
Raw logs are local under `/tmp/wapps-readiness`; the portable result snapshot is
[`readiness/baseline-2026-10-11.json`](readiness/baseline-2026-10-11.json).

| Check                                  | Result                                                            | Interpretation                                                                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nx project discovery and graph         | Pass                                                              | Workspace can be discovered; this does not establish valid dependency direction.                                                                  |
| All build targets                      | 128 requested: 71 succeeded, 50 failed, 7 blocked by dependencies | Stale SDK paths, incomplete library packaging, Sass resolution, and TypeScript project references prevent a clean workspace build.                |
| Aggregator production build            | Pass, with warnings                                               | Initial bundle 1.43 MB exceeds the 1 MB warning budget; two component style warnings and two Angular template warnings remain.                    |
| Aggregator application type check      | Pass                                                              | `tsc --noEmit` succeeds independently of the broken full dependency build.                                                                        |
| Aggregator application tests           | 39 suites, 279 tests pass                                         | Useful local/fixture behavior coverage; not a live backend acceptance suite.                                                                      |
| All test targets                       | 117 requested: 55 fail, 62 exit successfully                      | Of the 62 successful targets, 50 report no tests. Failures include missing setup/configuration, module transforms, type errors, and absent tests. |
| Explicit lint targets                  | 119 requested: 21 fail                                            | Includes genuine boundary/graph findings and programming/style errors.                                                                            |
| Additional inferred lint targets       | 11 requested: 3 fail                                              | MinIO, scraper, and editor package dependency checks fail. Recording tools were excluded from this additional run.                                |
| Source architecture audit              | 1,034 production source files; 26 violations                      | 11 domain, 2 UI, 3 feature application, and 10 page dependency violations. Counts are import/target findings, not feature percentages.            |
| Architecture audit self-tests          | 3 tests pass                                                      | Covers allowed directions, aliases, barrel imports, dynamic imports, comment/test exclusions, and invalid workspaces.                             |
| Domain authorization regression checks | 6 pass, 3 fail                                                    | Three explicit-denial tests reproduce writes after denial; allow and policy-error controls pass. All dependencies are in-memory substitutes.      |
| Compose configuration, local and alpha | Pass                                                              | Configuration parses; containers were not built or started.                                                                                       |
| Browser/service acceptance and restore | Unverified                                                        | Docker daemon unavailable; no Nx `e2e` targets exist. Recording scripts do not establish durable multi-user behavior.                             |

Targeted runtime application builds compile, including both identity services
when their prerequisites are built. An initial diagnostic that excluded dependency
tasks failed on missing generated identity-library declarations; the normal
dependency-aware identity build then passed. This is not an unresolved identity
source compilation defect. Those full-workspace failures describe the baseline;
the implementation branch now passes all 129 build targets as recorded under OP03.

## Release blockers

### OP01 Authorization must deny before any write

Priority: P0, before exposing mutation endpoints to real users.

- `sdk/features/discussion/core/src/application/discussion.service.ts` checks
  `isErr(authorityValidationResult)` but never rejects `ok(false)` in
  `addDiscussion` or `addComment`. `AuthorityValidationService.validate` passes
  through the policy result. The new regression tests reproduce node writes,
  payload writes, and materialization requests after explicit denial.
- `libs/domains/catalog/record/src/application/record.service.ts` repeats the
  same denial bug in `addRecord`; an isolated regression check reproduces node
  writes and projection requests. No active Editorial caller was found, so this
  is a domain-service defect to fix before integration, not an additional claim
  about current HTTP exposure.
- `sdk/features/discussion/applications/management/service/src/app/discussions/discussions.controller.ts`
  exposes update/delete without an actor context. Its service performs storage
  mutations without ownership/policy checks. The middleware permits requests with
  no identity headers; it validates header provenance, not permission to mutate.
- `apps/services/editorial/src/app/apps/apps.controller.ts`, and the corresponding
  categories/tags controllers, expose writes without guards or authorization.
  The Editorial module/bootstrap has no application-wide authorization guard.
  Its checked-in ingress has no external-auth annotation. This establishes a code
  defect; public reachability of any actual deployment was not tested.
- `apps/services/catalog-bff/src/app/middleware/auth-validation.middleware.ts`
  exists but is not applied by `AppModule`. Current catalog routes are reads;
  the file must not be mistaken for active protection of future private endpoints.

Finish by enforcing policy and ownership at application boundaries, passing
validated actor/tenant context, and moving permission enforcement out of domain
behavior as required by `architecture-abstract.md`. Validate mutation DTOs rather
than accepting `Partial<ORMEntity>` or unrestricted records. Discussion registers
`CommentLikeEntity` in `forFeature`, but omits it from the root connection's
explicit `entities` list and does not enable automatic entity loading. Include
it in the connection/migration configuration and exercise the like routes.

Acceptance: anonymous and cross-user mutations receive 401/403; `ok(false)` and
policy outages produce zero writes/events; legitimate owner/moderator operations
work; gateway header spoofing fails; malformed payloads receive bounded 4xx errors.

Current implementation: Discussion and all Editorial mutation handlers now use
protected application commands. Editorial has 252 focused tests, including the
actual Nest HTTP module with substituted persistence/policy dependencies. Shared
OPA bundles pass 31 actual policy cases, separately and after deployment merging.
Isolated real-store ownership/backfill qualification passes. Deployment legacy
data, service-caller integration, full account lifecycle and real ingress
qualification remain open. OP01 is not closed.

### OP02 Replace incomplete account flows and reconcile identity ownership

Priority: P0 for account correctness; depends on OP01 and executable test support.

The baseline registration/reset adapters threw or returned synthetic success, and
identity retrieval returned a fixed demo user. These have been replaced with real
API adapters, explicit API/demo configuration, credential enrollment and reset
verification/consumption endpoints, and persistent loading/error/success states.
OAuth callbacks now validate stored state, provider, redirect URI, age and PKCE
through an application port. The aggregator handles password-reset actions and
clears one-time codes from browser history. Profile/settings persistence still
needs complete portal integration; fixed catalog/personal providers remain elsewhere.

Authentication has substantive implementations and passing targeted tests for
Firebase/session/identity behavior. It still needs real registration/recovery
integration and verification against deployed credentials and configuration.

Current implementation: both identity services use the case-sensitive Firebase
UID as canonical actor ID, with a separate credential subject row ID in SQL.
Account reads are side-effect-free SQL snapshots; profile registration commits
values, revision, idempotency receipt and event intent together. Account deletion
commits a tombstone, removes the SQL private profile and schedules provider cleanup
atomically. The HTTP response reports accepted cleanup, not completed erasure.
Suspension controls application access in SQL; it does not claim to disable the
Firebase credential record. Admin credential operations retain explicit OPA
authorization and bind generated links to the authorized target's email.

SQL outbox delivery now uses confirms, fenced leases and bounded retained retries.
Cleanup also retries durably and treats absent provider credentials as success.
Migration/status/requeue CLI modes run separately from normal startup. The canonical
migration refuses nonempty legacy `identity_subjects`; verified import of those
mappings and old Mongo account/profile records is still required before cutover.
No legacy data was remapped or deleted by this implementation. Unit and actual
Nest HTTP tests with substituted ports pass. Canonical identity concurrency,
rollback, enrollment replay and lease fencing now pass against isolated MySQL 8.4.
Credential signup/recovery and reset-code consumption pass against the local
Firebase Auth emulator. Browser checks use the production bundle with HTTP fixtures;
they do not prove an integrated deployment. See
[implementation evidence](readiness/implementation-2026-10-11.json).
The later email-verification checkpoint qualifies integrated registration,
current credential status, request and code completion through compiled identity
APIs, canonical SQL, real policy, the provider emulator and independent browsers.
It also rejects invalid optional-ingress tokens instead of granting anonymous
authority. Actual email action-template configuration/delivery, time-based
provider expiry, remaining account/profile integration, lifecycle audit consumers,
full cross-domain deletion, verified legacy import and deployed process/restore
qualification remain open. OP02 is open.

Acceptance: a fresh account works in two independent sessions; registration,
login, `/me`, ownership, events, suspension, and deletion agree on identity;
simultaneous first sign-ins converge; password-reset messages are actually
delivered and usable; revoked/deleted users cannot regain access through refresh.

### OP03 Repair the build and release checks

Priority: P1 foundation; start alongside OP01.

The all-target build/test/lint failures in the baseline are not release-ready.
Examples include references to removed `libs/foundation/standard` paths,
missing `ng-package.json`/production tsconfigs, missing Jest setup files,
unconfigured Angular ESM transforms, and `npm test` being a failing placeholder.
Choose intentionally which libraries are source-only and which are independently
buildable; implement that choice consistently instead of advertising broken
targets or suppressing compiler errors.

At baseline, `eslint.config.mjs` allowed every tag to depend on every tag. The stricter-looking
`enforceModuleBoundaries` field in `nx.json` is not the ESLint rule's
`depConstraints`. Existing Nx checks still detect cycles and other conditions,
but the intended layer matrix is not configured there. Normalize tags and enforce
the matrix in the actual lint configuration. The reported theming/preferences
cycle is introduced by `theming.service.spec.ts`; it is not evidence of a runtime
service cycle. Move the integration test to an appropriate composition test.

At baseline, the aggregator workflow had no pull-request check and its path filter omitted
shared features, SDK, and root dependency/config changes. The Catalog BFF build
explicitly permits `success() || failure()` after its test job. The shared action
adds `--passWithNoTests`. Several deployments use mutable `latest` tags and
source-text environment patching. Production and local build paths also differ.

Acceptance: a clean checkout installs reproducibly and passes supported builds,
lint, and meaningful tests; shared dependency changes trigger affected checks;
failed gates prevent release; images use immutable revisions; no test/build is
made green by deleting coverage, increasing budgets, or disabling strictness.

Current checkpoint: the aggregator and its 82 prerequisites pass an uncached
dependency build after clearing 52 repaired outputs; `ui-chat` was cleared again
for an additional ESM fix. All 56 Angular packages pass emitted-artifact checks.
Nine test targets pass 389 tests in 56 suites; 52 lint targets pass with 370
warnings. The CSR production build and eight fixture browser layouts also pass.
A subsequent complete workspace run passes all 129 build targets after repairing
four remaining failures and packaging seven additional Angular libraries. All 63
Angular packages pass artifact inspection. Nine additional lint targets pass with
11 warnings; their empty test targets are not coverage. The original all-workspace
baseline stays historical.

The subsequent clean-install source snapshot passes `npm ci` with normal install
scripts, all 129 builds, all 63 package inspections, 1,120 Jest tests in 114 suites,
24 portable checks, 131 product lint targets plus readiness tools, and all 13
declared typechecks (with an affected aggregator rerun). Lint retains 445 warnings.
The 133-project graph now enforces responsibility tags through ESLint and a tag
audit; kernel/domain external adapter imports are forbidden. Removed 95 empty
test targets; 109 projects without behavior specs remain documented gaps.

All 15 image-build workflows depend on the reusable engineering gate. Every PR
is checked without path filters; aggregator publishing excludes PRs and ArgoCD
sync/health failures propagate. Local regression tests cover these gates. Actual
GitHub execution/branch protection, Linux/runtime-image qualification, immutable
deployment, complete feature coverage and warning resolution remain open. The
clean-install audit reports 284 findings (22 critical, 146 high, 102 moderate,
14 low), including development/transitive dependencies; exposure and compatible
upgrades need triage. The copied source is uncommitted, not a released checkout.
OP03 remains open. See
[implementation progress](IMPLEMENTATION-PROGRESS.md).

### OP04 Connect the production portal to one real catalog contract

Priority: P1; depends on OP01 and OP03.

`application/src/environment.ts` defaults to demo mode. The alpha Dockerfile
intentionally builds that demo. The other workflow patches the environment name,
but a flag alone cannot turn the current portal into a live product:

- `ResultsPageComponent` runs `browseCatalog` over `CATALOG_ENTRIES`; global search
  uses `searchDiscoveryCatalog`, and home uses `TempFeedProviderService`.
- Real listing adapters use same-origin `/api/catalog` while the checked-in
  aggregator Nginx/ingress routes serve the SPA and the catalog ingress uses a
  different host/path. Local Compose supplies a gateway; the deployed route
  contract needs an equivalent explicit solution and an HTTP acceptance test.
- The BFF accepts category/tags/search, while the portal offers platform, device,
  monetization, multiple categories, and additional sorting. Editorial returns
  all records and the BFF filters/paginates in memory. Validate and bound queries,
  implement equivalent semantics in storage, and define error/404 behavior.
- BFF full records manufacture review totals from a slug hash; previews always
  return zero reviews. Its numeric/hashed response IDs are also incompatible with
  the overview page's fixture-based category/tag lookup assumptions. Use canonical
  IDs, actual reference data and measured aggregates throughout the read contract.

Acceptance: creating/editing a real catalog record changes search, filters,
pagination, details, and feed consistently; direct links/reloads work; all visible
filters affect results; API requests return JSON rather than SPA fallback HTML;
backend failure displays a failure state without substituting fixtures.

Current implementation checkpoint: the backend portion now passes. The canonical
UUID contract validates query/response shapes and preserves unknown review totals
as null. Editorial selects/counts/pages current public records in SQL, reads app
projections at the exact authorized revision and rechecks SQL after Mongo I/O.
Taxonomy uses current SQL labels. Missing/stale/corrupt projections yield retryable
503 responses. Built Editorial/BFF HTTP processes pass isolated filter, edit,
delete, service-restart and projection-loss/rebuild tests, including UTC timestamps
under a non-UTC process timezone. Existing materialization recovery tests still
pass. See [implementation progress](IMPLEMENTATION-PROGRESS.md) for substitutions,
commands and limits.

The earlier bullets describe the assessed baseline; its BFF fake/unbounded path
has been replaced. A subsequent portal slice now connects API-mode Discover
(including `/app` redirects), facet listings/directories and application overview
to that contract, with explicit demo builds, service labels and truthful failures
and unknown values. The real-store runner can exercise the compiled browser
journey with `--catalog-browser`; see the portal checkpoint and its evidence.
Home search previews subsequently moved to the same bounded catalog port, including
real totals and distinct loading/failure/retry states. Home activity now selects
bundled content only in demo mode; API activity remains explicitly unavailable.
The actual feed, separate Catalog portal, legacy taxonomy adapters, directory
counts/previews, other content types and deployed ingress still require work.
Legacy timestamps need provenance review before cutover. OP04 remains open;
this checkpoint is not permission to deploy the unfinished product.

### OP05 Make personal data and collections durable and account-scoped

Priority: P1; depends on OP02 and OP04.

Suite favorites now use canonical account relations and current approved-suite
metadata through bounded Editorial selection. Add/remove, filtered/grouped portal
views, independent sessions, retries/conflicts, API restart and withdrawal/deletion
are locally qualified. This extends the private-suite/publication checkpoints;
remaining target families, export/erasure, privacy enforcement and deployment
qualification keep OP05 open. See the suite favorites checkpoint and dated JSON.

At assessment, profile, favorites and preferences all used browser storage.
Profile text editing now uses the canonical SQL `GET/PUT /api/me/profile` contract,
explicit self-access policy, revision/idempotency checks and transactional outbox.
The API/demo provider choice is explicit. Independent sessions, restart, conflicts,
rollback and account-cache isolation are exercised against local real services;
see the private-profile checkpoint and dated evidence. Photo ingestion, public
profile visibility/privacy and complete export/deletion remain unfinished.

The canonical preferences backend now provides `GET/PUT /api/me/preferences`,
self-access policy, shared account revisions, deterministic receipts and atomic
outbox/deletion behavior. Real SQL and built-service/OPA restart qualification
pass. The subsequent portal slice now connects the three settings forms to this
contract with explicit API/demo modes, separate guest storage, session cancellation,
revision-bound drafts and canonical saved-preferences export. Independent browsers,
lost-receipt retry, profile revision conflicts and account-process restart pass
against real local services. Notification delivery, public visibility/followers
and other unconsumed preferences remain unfinished. Favorites now explicitly
select the canonical API or the isolated `MyFavoritesDemoService` browser adapter.
The `wapps.favorites.v1` key is demo-only and is never imported into an account.
`EntryDetailsDataService` retains browser-local suites only for explicitly selected
demo routes. API-mode private suites now use canonical Editorial collections
through `GET/POST /api/me/suites` and `GET/PUT/DELETE /api/me/suites/:id`, with
owner/tenant checks, revisions, retry receipts and tombstones. Create/list/reopen/
edit/delete passes real-store and browser qualification; public publication, suite
favorites, export and account-wide erasure remain unfinished.
The account-export workflow checkpoint supersedes the earlier preferences-only
API limitation: full retained-data archives now pass local API/portal qualification.
Demo export includes browser profile/preferences only when both providers are demo.
Cross-service deletion, notification delivery and deployment remain unfinished.
The favorite-app and favorite-suite routes now select their own kinds through
the shared favorites page. The general route normalizes missing route input to
the all-kinds view. API suite favorites report their unavailable implementation.

The canonical-ID selection prerequisite is now implemented in Editorial and
Catalog BFF. `GET /api/catalog/app-selection?ids=...` resolves up to 50 IDs against
current SQL eligibility and exact-revision projections, preserving identity across
slug rename/reuse. Real-store checks cover concurrent deletion, service restart,
projection loss/rebuild and outage. This selection endpoint does not itself persist
relations. The subsequent canonical favorites backend adds account-scoped
`GET/PUT /api/me/favorites`, self-access policy, shared account revisions, idempotent
receipts, atomic outbox/deletion and a 200-relation bound. Real SQL and combined
account/Editorial/OPA qualification pass for rollback, concurrent writers,
rename/delete/lag, outage-safe removal/replay and process restart. Adds currently
support applications only. Raw saved IDs grant no target visibility and require
current owning-service resolution for display. The portal now resolves metadata
through the BFF in bounded ID batches, preserves removal during metadata outages,
uses revision-bound/idempotent commands and cancels private state on session change.
Real-service Chromium checks pass canonical toggles, lost-response retry,
independent sessions, restart, conflict, rename/delete/lag and truthful error
states. Thirty layout states pass in both themes at mobile/tablet/desktop sizes.
The private suite workflow now has canonical ownership and persistence; public
suite publication and suite/article/discussion favorite target contracts remain
unfinished.

Finish the remaining profile/media, preference consumers, favorites and suite use cases,
identity-scoped persistence, authorization, validation, and typed HTTP adapters.
Move reusable behavior out of pages. Define migration or deliberate separation
of existing demo data, cache invalidation on account switching, and conflict rules.

Acceptance: save in browser A, observe in browser B after signing in, restart
services, and observe the same state; user B cannot access user A's private data;
failed saves are not reported as successful; export/deletion cover their stated
scope and asynchronous cleanup is observable/retryable.

### OP06 Finish submission, ownership, editorial publication, and media

Priority: P1; depends on OP01, OP02, OP04, and OP09.

Suite submission/review/publication is now locally implemented and qualified through
owner/reviewer/public portal journeys. Immutable submitted content, rejection reasons,
separate approved versions, withdrawal, canonical visibility, atomic outbox, retry
receipts and rebuildable projections are implemented. This closes that implementation
workflow, not OP06: application ownership, media, other content families
and deployment qualification remain open. See the publication checkpoint in
`IMPLEMENTATION-PROGRESS.md` for evidence and fixture boundaries.

API-mode registration and My Apps now use canonical Editorial application drafts.
The additive SQL migration, self-access policy, expected revisions, immutable
receipts and scrubbed deletion tombstones are locally qualified through real
SQL/OPA/compiled APIs and independent browsers. Saving a draft creates no public
record or projection intent. The explicit demo retains browser-local drafts;
ownership evidence is still local preparation and grants no editing rights.
Application submission/review/publication is now implemented through immutable
submissions and independent review. Approval atomically commits canonical public
content, lifecycle, receipt and outbox; private edits remain private, and changed
public revisions reject stale approval. Withdrawal/deletion enforce current SQL
visibility during projection lag. The full 2,048-character website contract now
agrees across SQL, commands, snapshots and public responses. The catalog author
association does not verify real-world ownership. Canonical DNS claims,
independent ownership review and grant-bound existing-record authoring are now
locally qualified through SQL/OPA/native DNS and compiled APIs, including
transfer/revocation, explicit stale-content merging and API restart. Startup and
maintenance include their additive migrations. API-mode ownership and verified
editing now have an independently qualified browser workflow: public claim entry,
DNS proof, staff decisions, active grants/revocation, owner release, private
editing, immutable content review and explicit canonical conflict merging.
Revocation/new grants cannot revive old drafts, and private cleanup preserves
public content. The ownership portal checkpoint records 752 affected tests,
21 real-service groups and 180 responsive layout states with its fixture limits.
The private media upload/preview API is now locally qualified against real
SQL/MinIO/OPA and the compiled service: bounded still-image normalization,
owner/tenant isolation, immutable object recovery, fenced SQL completion, exact
receipts, API restart and current-authority preview denial. Revision-bound draft
attachment/removal, inherited images, explicit rebase, frozen reviewed media,
atomic public references and authority-checked public/private reads are now
locally qualified. Migration reentry detects missing/corrupt bindings; legacy
unknown media requires resubmission. Existing ownership/publication/browser flows
pass regression. Retained-upload listing, cancellation and bounded durable
retention cleanup are locally qualified, including actual conditional MinIO marker
writes, late uploads, SQL rollback, reference races, fenced lease recovery,
bounded retries, requeue and the compiled background/maintenance worker. The
dedicated bucket must stay unversioned; activation is explicit and defaults to
disabled. API portal media controls now pass real-service browser qualification:
upload/preview/attach/remove/cancel, exact retries after reload, preserved private
text, frozen review images, explicit per-slot rebase and unknown legacy
resubmission. Media, publication and ownership regression captures cover 348
layout states across three widths in both themes. Deployment provisioning and
full-stack activation remain unfinished.
Other content families and operational
qualification remain required. See the application-publication and ownership
portal checkpoints and the media portal/publication/retention checkpoints for exact evidence
and exclusions.
OP06 remains open.

Define ownership evidence, allowed draft/submitted/reviewed/published transitions,
moderation roles, audit records, duplicate handling, and the source of content
node identity. `content-node-registry` currently wires only health/platform
controllers and no entities: implement its required role or explicitly keep
content ownership in another service. Avoid two competing sources of truth.

Acceptance: a submitter creates a durable draft, submits, receives a review
outcome, and sees approved content in catalog/feed; unapproved content stays
private; another account cannot claim/edit it; retrying submission/media work
does not duplicate records and failed uploads are recoverable.

### OP07 Finish shared content and community behavior

Priority: P1; depends on OP01, OP02, OP04, and OP09.

Current implementation: article text/covers/favorites and public comments are
locally qualified through the API portal. Comments enforce canonical parent
visibility and tenant scope, expose no private account IDs, and support ordinary
member replies/edits, moderator removal, exact retries and real broker recovery.
The article-comments checkpoint records 11 service/recovery groups and 78
responsive browser layouts. Application discussion lists/details, topics/replies,
author editing/removal and admin removal now also pass 84 browser layouts and
23 service/recovery groups. The ordered-index migration check and explicit
upgrade are qualified. Release publication is also locally qualified.
Account-wide discussions, quick dialogs, votes/pinning and discussion favorites
are also locally qualified as recorded in their checkpoints. Member reviews now
qualify author/member/staff permissions, current public summaries, atomic SQL
revision/receipt/journal writes, conflicts/retries, restart and 96 browser layouts.
Overview ratings come from canonical member reviews; imported Editorial ratings
are distinct. Reviews now appear in the locally qualified Explore feed; further
review notification consumers remain separate work.
Canonical overview previews and same-application related topics are now locally
qualified, with current visibility, independent composer state and recovery checks.
The real Explore feed now qualifies six content kinds, current visibility, bounded
encrypted paging, saved exclusions/ranking and actual detail links. API-mode Digest
now independently selects four real content families, preserves summaries/covers,
and qualifies saved choices, actual links and failure/restart recovery. Top-author
summaries, application timelines, observed service status and
the broader operational gates remain open. The following paragraphs retain the
assessment baseline; they are not claims about the now-qualified article routes.

Portal discussions use `LocalDiscussionsService`, reviews/status are generated
sample data, and development logs use fixed `RELEASES`. Articles/suites/feed
content also depends on bundled fixtures. These features require actual read and
write contracts and consistent application/content IDs.

The Discussion backend has creation and materialization foundations, but edit and
delete do not request projection updates/removal. The core has `addComment`,
while the checked controller has no corresponding comment-creation route.
Read APIs must enforce visibility and tenant access as well as write ownership.

Acceptance: two users exchange a discussion/reply through the portal; edits,
deletes, likes, reviews, and moderation agree in detail/list/feed after projection;
private/deleted content does not leak; articles and releases come from actual
published content. Service status is backed by observations with timestamps and
an explicit unknown/stale state, or the unimplemented status action is hidden.

### OP08 Deliver notifications and enforce saved preferences

Priority: P1 for the full advertised scope; depends on durable accounts and events.

Account preferences persist canonically, and profile audiences plus supported
sharing switches have locally qualified consumers. In-app replies, discussion mentions
and favorite update subscriptions now pass complete local qualification through canonical delivery,
suppression and read receipts, current access/preferences, bounded retry/requeue,
restart, export/erasure and independent browsers. See the current checkpoints.
Email/push delivery and system alerts remain unfinished. Real Explore and Digest consume
saved category exclusions, favorite/preferred-facet recommendations and personalization
opt-out; popular/recommended order is explicitly within bounded chronological selections.
The Discord deployment agent is not a customer notification service.
Theme/date/listing settings have consumers; mature classification/filtering,
analytics and remaining content choices still need their integrations. Do not count modeled-only
language/timezone/accessibility fields as implemented settings. Deployed activation,
real channel delivery and full operational qualification remain open.

Acceptance: an enabled event produces exactly the intended visible notification;
disabled channels and private content remain suppressed; delivery failures have
bounded retry and diagnostics; unsubscribe and permission changes take effect.

### OP09 Make persistence and event processing recoverable

Priority: P1, before real customer data.

Editorial, Discussion, and the registry configure `synchronize: true`. Replace
runtime schema synchronization/seeding with versioned migrations and explicit
seed modes. The authenticator already uses migrations; extend the discipline to
the other stores and document upgrade/backfill behavior.

Discussion writes a node, an object payload, and a queue message separately.
The original identity publication was also not atomic with database writes. RabbitMQ used
`createChannel`, and the projection publisher does not wait for broker confirms.
Design an outbox or an equally explicit recovery protocol and reconciliation.

The materializer checks an applied-event record, updates projections/counters,
then inserts that record as separate operations. A crash/concurrent delivery can
repeat counter effects. Its catch block unconditionally `nack(true)`s, including
malformed events, with no bounded retry/dead-letter path in that consumer. Media
ingestion rejects failures without requeue; demonstrate a configured recovery
destination instead of losing work. The optional editor discards the original
message before republishing retries and lacks demonstrated dead-letter recovery.
Test failures during each side effect.

Acceptance: duplicate delivery, crash after a partial write, unavailable storage,
and malformed messages do not cause silent loss, duplicate visible records, or
endless hot retries; projections rebuild from authoritative data; edit/delete
events converge; migrations work on empty and existing databases; backup restore
preserves ownership and user data.

Current implementation: both Discussion and Editorial disable schema synchronization
and commit durable outbox intent with mutations. Editorial now publishes confirmed
requests with fenced leases and retained SQL failure recovery. Its complete-document
projection worker, rebuild/reconciliation and verified legacy ownership backfill
are implemented. Discussion's generation/rebuild/backfill and both Editorial
recovery suites now pass against isolated real stores. The checks include actual
rollback, concurrent replay, tombstones, confirmed transfer and projection-loss
rebuild, while policy ports remain substituted. Process restart, backup/restore,
retention, operations and integration still keep OP09 open; see the current
materialization contract and implementation evidence.
Identity now also commits SQL lifecycle/profile mutations with outbox intent and
uses confirmed delivery, fenced retries and retained deletion cleanup. It exposes
explicit migrations and journal status/requeue commands. Existing legacy mappings,
projection consumers/rebuilds, cross-domain deletion, process recovery and restore
remain unqualified; identity events alone are not proof of a materialized account.

### OP10 Prove deployment and operations

Priority: P1, final release gate; configuration work starts with OP03/OP04.

The checked alpha deployment is intentionally portal-only. Compose has a broader
development stack, emulator, and smoke test, but it is not a production deployment.
Catalog and registry `/health/ready` handlers return static success. The existing
smoke script checks liveness, authentication, one catalog call, policy loading,
and consumers; it does not exercise most durable product workflows.

Finish one declared deployment topology with valid API routing, service identities,
secrets, migrations, dependency readiness, metrics, alerts, restore and rollback
procedures. Align CI environment names/overlay paths and immutable image versions.
Update stale Strapi/old SDK references in operational documentation.

Acceptance: bring up a fresh production-like stack; execute all released journeys
from independent browsers; restart dependencies; detect degraded readiness;
recover queues; restore backup; roll back the application and verify compatibility.
Record measured performance against the qualification targets.

## Architecture findings and implementation conventions

The existing architecture remains the baseline: framework-independent domains,
application orchestration, ports and adapters, generic UI, thin entrypoints,
route-composed shells, and disposable projections. No replacement framework or
large architecture rewrite is needed to begin.

The baseline source audit found 10 Angular imports in customer domains plus a domain
export of a storage bucket constant; UI imports a portal navigation contract and
re-exports a portal feature mapper; three feature application files reach into
infrastructure; and pages import 10 concrete adapter targets, including via public
barrels. The complete locations are in the JSON baseline. Move DI tokens to the
consuming Angular feature, infrastructure constants to adapters, and reusable UI
contracts to a lower-level presentation boundary. Introduce feature services/ports
before replacing local adapters with HTTP implementations.

The implementation branch now resolves those 26 findings: the current scoped
audit scans 1,101 production files with zero violations. The aggregator dependency
chain passes an uncached build and artifact checks; all 24 changed domain build
targets pass. The baseline above remains historical. See the implementation
evidence for commands and limitations. Runtime authorization, complete CI gates,
durable product flows and live recovery still keep OP01-OP10 open. Follow the
separate [library-build conventions](../rules/library-builds.md) for further repairs.

The audit has deliberately limited scope. It scans production TypeScript sources
under `apps`, `libs`, and `sdk`, resolving literal imports/re-exports and named
adapter imports through barrels. It excludes specs, declarations, test setup and
test-helper directories. Computed dynamic
imports, namespace-based adapter access through barrels, method-level business
rules, authorization, validation, CSS ownership, and browser behavior still need
compiler, lint, tests, or review. Zero audit findings alone is not readiness.

The current `_page-layout.scss` and `_settings-page.scss` encode the documented
spacing conventions. Sampled page styles consume shared tokens/mixins. This pass
does not certify every selector or responsive layout. Preserve the three existing
portal rules and add browser visual checks to each affected UI slice rather than
redesigning the portal during backend integration.

## Autonomous development order

| Milestone                           | Work                                                  | Exit evidence                                                                                                                                        |
| ----------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Secure and measurable baseline    | OP01 and OP03; boundary cleanup needed by those fixes | Denial regressions pass, mutation authorization tests exist, supported build/test/lint targets have a trustworthy result, CI cannot bypass failures. |
| 2 One real user journey             | OP02 and OP04, then profile/favorites portion of OP05 | Register, log in, search real data, save a favorite/profile, read it from another session, refresh/logout/recover.                                   |
| 3 Durable publication               | OP06 and OP09, plus suite persistence                 | Submit/review/publish, persistent ownership, migration checks, media recovery, event replay.                                                         |
| 4 Complete exposed product behavior | OP07, remaining OP05, OP08                            | Articles/feed, discussions/replies, reviews, suites, privacy and enabled notifications work with real data.                                          |
| 5 Release qualification             | OP10 and the complete acceptance matrix               | Clean install/build, browser journeys, measured load/soak, restore and rollback evidence; no unresolved P0/P1 in release scope.                      |

Implement one use case at a time through its port, domain behavior, application
authorization, durable adapter, API, portal provider, and tests. Keep changes on
this branch reviewable. Update blocker status with evidence rather than estimating
a completion percentage from file counts. Start with the three failing denial tests
and the unprotected mutation routes; changing only the UI provider flags would
expose unfinished behavior.

## Repeatable commands

Run from the repository root with dependencies installed. The first two commands
are expected to fail against the assessed baseline; they are checks, not fixes.

```sh
node tools/readiness/check-architecture.mjs
node --test tools/readiness/authorization.test.cjs
node --test tools/readiness/check-architecture.test.mjs

NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx run-many -t build --all --parallel=2 --skip-nx-cache --outputStyle=static
NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx run-many -t test --all --runInBand --parallel=2 --skip-nx-cache --outputStyle=static
NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx run-many -t lint --all --parallel=2 --skip-nx-cache --outputStyle=static
NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx run-many -t eslint:lint -p sdk-features-identity-applications-authenticator,sdk-identity-infrastructure-firebase,utils-opa,media-ingestion,discord-notifier,platform-queue,store-app,editor-agent,sdk-extras-minio,sdk-extras-mongo,sdk-extras-mysql --parallel=2 --skip-nx-cache --outputStyle=static

npx tsc -p apps/portals/aggregator/application/tsconfig.app.json --noEmit
NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx build aggregator-csr --configuration=production --skip-nx-cache
docker compose config --quiet
docker compose -f compose.alpha.yaml config --quiet
```

Once Docker is available, use the documented local stack and
`node deploy/local/smoke-test.mjs`, then add/run the missing browser-to-service
acceptance suite. Do not interpret the current smoke script as the whole release
gate. External scraper, AI, and Discord profiles are separate integration checks.
