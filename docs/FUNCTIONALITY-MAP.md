# Wapps functionality map

F20/F21/F28 favorite preference update (October 13, 2026): favorites and the
auxiliary sidebar now use completed current-account choices. Applications, articles
and suites retain approved classification; discussions inherit their current public
parent's classification. Excluded names/images/links disappear, selected-kind
counts stay accurate, and saved references remain removable during preference or
metadata outages. Real settings saves, account changes, independent browsers,
keyboard retry/removal, Account/BFF restart and reviewed reclassification pass local
qualification. Evidence: 775 tests / 84 suites, affected builds/checks, 16 integrated
groups and 42 responsive/theme layouts with seven inspected screenshots. See
`favoritesContentPreferencesCheckpoint`. This supersedes F21's original missing
favorite-suite filter assessment. Profile/notification preference integration and
all operational gates remain open. The requested review checkpoint is reached;
the broader autonomous goal remains paused.

F01/F03/F15/F28 individual feed update (October 13, 2026): Explore, Digest and
application timelines now filter each item's approved classification before
ranking. Suites keep their own classification inside a General application timeline;
topics/reviews/releases inherit current application classification. Real saved
choices, same-document settings changes, account isolation, preference outages,
late replies, hidden counts and all-hidden continuation are locally qualified.
Private edits, frozen staff approval and projection lag/rebuild are covered.
Evidence: 1,800 tests / 173 suites, affected builds/checks, 21 integrated groups,
78 responsive/theme layouts and ten inspected screenshots. See
`feedContentPreferencesCheckpoint`. Favorites/profile/notification consumers,
remaining privacy behavior and all full-service gates stay open. Earlier updates
retain their original checkpoint scope.

F01/F02/F28 Home preview update (October 13, 2026): Home now uses one real grouped
Discover request for up to three applications/articles/suites each. Exact totals,
bounded hidden counts, canonical tag names and detail/group/full-search links are
locally qualified. Current-account choice changes clear/cancel the same phrase;
preference and search retries preserve keyboard focus and an open results menu.
Blank, empty, invalid, unavailable and all-hidden states stay distinct. Evidence:
474 tests / 65 suites, affected checks/builds, zero architecture findings and 234
real-service browser layouts across discovery/catalog runs. See
`homeGroupedPreviewCheckpoint`. Individual feed/timeline items, favorites, profile
and notification consumers and all operational gates remain open. Earlier entries
retain their checkpoint scope; no deployment occurred.

F10-F15/F28 parent preference update (October 13, 2026): API application
discussions/reviews, quick dialogs, release notes, HTTP health and timelines now
hide their parent application's metadata and child views when its classification
is excluded or current preferences cannot be read. Account/route changes cancel
old work; previous-release reads and periodic health refresh cannot restore hidden
content. Shared reader and page/dialog tests, real-service browser runs and
responsive theme checks pass; see `applicationSubpagePreferencesCheckpoint`.
Individual feed/timeline item classification, Home preview refresh/grouping,
favorites/profile/notification consumers and all OP gates remain unfinished.

F05/F06/F07/F09/F28 public preference update (October 13, 2026): application
catalog listings/overviews, public article/suite lists/details and suite members
now hide Mature and unclassified content when the current member's choice is off;
guests use the off default. Lists preserve source totals and report hidden counts.
Hidden details retain no title/body/image/comment/favorite controls. Session and
preference changes, failures and retry pass local service/browser qualification;
private author/reviewer screens remain usable. See `publicContentPreferencesCheckpoint`.
Home previews only inherit filtering on new catalog requests; full refresh/grouping,
application subpages, feeds, favorites, profiles, notifications and all OP gates
remain unfinished. Earlier statements retain their historical checkpoint scope.

F28 classification update (October 13, 2026): applications/articles/suites now support
author proposals and independent staff approval bound to frozen submissions.
API-mode Discover consumes the mature-content preference and hides both Mature and
unclassified records when disabled. Publication, export, recovery and real-browser
checks are locally qualified; see `classificationDiscoverCheckpoint`. Public
listings/details, suite members, feeds/Home, profiles/favorites and notifications
still need preference integration. No service-wide completion is claimed.

Source assessment: October 11, 2026, baseline `c965790e`, branch
`codex/operational-readiness`. This describes the checked-out implementation,
including its current provider choices. It does not certify a running deployment.
This is the assessment baseline; subsequent changes are tracked in
[implementation progress](IMPLEMENTATION-PROGRESS.md).

F02 Discover update (October 13, 2026): API-mode `/discover` now reads real public
applications, articles and suites through a strict grouped BFF contract. Independent
bounded pages, name/newest order, supported type-specific filters, legacy aliases,
real links, saved display choices and explicitly page-local category exclusions
pass local service/browser qualification. Missing projections and source outages
remain unavailable; private edits and withdrawals cannot leak through old results.
Six inspected layouts cover 390/768/1440 and both themes. See
`discoveryWorkflowCheckpoint`. Home search previews remain application-only; mature
classification and the remaining full-service/operational requirements stay open.
Classification policy is agreed: author proposal, staff approval, and unclassified
content hidden when mature content is disabled. Earlier rows remain assessment history.

F10 health update (October 13, 2026): API-mode health now uses staff-configured public
HTTP endpoints and durable observations, with current application visibility,
immutable configuration generations, exclusive/retry-bounded leases and no fabricated
uptime. Latest response evidence, thirty UTC day history, measured coverage and
unknown/stale/failed states pass local real-service and independent-browser checks
at three widths in both themes. Owner notices are excluded by product policy.
See `healthWorkflowCheckpoint`; production probing is default-off and public
DNS/TLS/egress and all operational gates remain unverified.

F15 timeline update (October 13, 2026): API-mode application timelines now read five
current public activity kinds through application-scoped canonical source selection
and exact public readers. Approved suite membership, parent visibility, encrypted
application-bound paging, real links, saved choices, Back navigation, account/route
cancellation and recovery pass local service/browser qualification. Six timeline
layouts plus twelve Digest/Explore regression layouts cover both themes and three
widths. See `timelineWorkflowCheckpoint`. This is current activity, not immutable
event history; unassociated articles and unobserved health events are excluded.
Status observations and the remaining full-service/operational scope stay open.

F03 Digest update (October 13, 2026): `/digest` now reads independent current public
activity, article, application and discussion selections through the BFF. Compact
3/2/2/1 sections retain actual summaries/covers and current detail links. Saved
exclusions, selection-local ranking, personalization opt-out, account switching,
restart and service/cover recovery pass real-service/browser qualification. Six
Digest layouts and six renewed Explore layouts cover both themes and three widths,
with keyboard controls and inspected screenshots. No new projection/migration is
needed. See `digestWorkflowCheckpoint`; no OP gate is closed. Application timelines,
status observations, mature classification, remaining channels/preferences and
deployment/operational gates remain open. Earlier statements remain assessment history.

F01/F28 Explore update (October 13, 2026): API-mode Home reads six real public
content kinds through canonical source selection and current projection revisions.
Bounded encrypted pages, actual detail links, Back navigation, saved exclusions,
real page-local popular/recommended order, personalization opt-out, account switching
and restart/outage pass local service/browser qualification. Six inspected layouts
cover both themes and three widths, with keyboard-operated controls and prescribed
card spacing. Mature classification, API Digest/timeline, external channels and
operational/deployment gates remain open. See `exploreWorkflowCheckpoint`; no OP
gate is closed. Earlier descriptions are retained as assessment history.

F29 mention update (October 13, 2026): members explicitly select public profiles in
application topics/replies, quick discussions and article comments; `/notifications`
provides a Mentions inbox with persistent reads and actual conversation links.
Canonical audience resolution, atomic source intent, durable delivery/suppression,
remove/re-add without a second event, current access, bounded recovery, export/erasure
and independent browser sessions pass local qualification. Eighteen layout checks
cover three widths and both themes. The public-read mapper retains mention references
for display and editing. Email, push, system alerts and operational/deployment gates
remain open; no OP gate is closed. See the mention implementation checkpoint.

F29 favorite update (October 13, 2026): `/notifications` now also receives updates
to saved applications, suites, articles and discussions, including releases on saved
applications. Canonical source cursors, fresh save/re-add baselines, durable suppression
and reads, current membership/visibility/preferences, bounded recovery, private export/
erasure and all four public links pass local real-service/browser qualification. Six
inspected layouts cover both themes and three widths. Deployment requires coordinated
source/Account migration and activation. Mentions are next; email, push, system alerts
and full operational qualification remain open.

F29 reply update (October 13, 2026): `/notifications` now receives replies to public
application-discussion posts and article comments through real compiled services.
Canonical recipient/lifecycle/visibility checks, saved in-app/reply opt-out, durable
delivery/suppression/read receipts, retry/quarantine/requeue, export/erasure adapters,
independent session isolation, pagination and real conversation links are locally
qualified. Six browser layouts cover both themes and three widths. Deployment
activation and other event types/channels remain open; OP08 is not complete.

F30 update (October 13, 2026): API users can now verify their current account,
confirm deletion with consent and typed `DELETE`, and receive an accurate accepted
or uncertain outcome. The complete Account/Editorial/Discussion/Firebase workflow
passes local qualification: private data/ownership cleanup, anonymous retained public
content, exact completion, restart/failure recovery, session isolation and 18 erasure
layouts, plus six export regression layouts. Deployment activation and operational
qualification remain open. F30's remaining privacy consumers and OP01-OP10 are not
complete. Customer reply notifications are now locally qualified as recorded above.

Older component checkpoints below preserve historical scope; their disabled/pending
erasure statements are superseded by this complete local workflow checkpoint.

F30's Editorial participant now passes local qualification through the compiled
service-only endpoint. Bounded cleanup joins canonical anonymity, private/media
erasure, audits and projection confirmation, then checks all 36 indexed residual
attribution/target fields before durable completion. Failures, disabled activation,
restart and concurrent retries behave truthfully. Anonymous public content, real
image bytes and successor editing survive; 12 compiled browser layouts pass. The
enabled Account/portal cross-service journey remains unqualified and its control
stays disabled. F30 and all OP gates remain open.

F30's Editorial projection prerequisite now passes local qualification. Exact
durable document confirmation plus a locked SQL revision recheck remove one target
at a time. Six content kinds, stale bylines, tombstones, successor changes, duplicate
workers, failure recovery/restart and 18 compiled browser layouts pass. Participant
composition and final residual checks are qualified above. The enabled Account/portal
journey remains unfinished; F30 and all OP gates stay open.

F30's Editorial ownership/audit prerequisite now passes local qualification. Private
claim/proof/receipt history and revoked grants drain while peer review decisions,
content, exports and successor ownership survive. Explicit anonymous attribution
and permanent ownership restrictions pass migration/rollback/restart/concurrency
checks, ownership HTTP regressions and retained-content browser layouts. Production
participant composition, final completion checks and the enabled Account/
portal erasure journey remain unfinished. F30 and all OP gates stay open.

F30's Editorial private-workspace prerequisite now passes local qualification.
Applications, suites, articles and releases lose private drafts, submissions,
receipts and uploader history through bounded production transactions after
canonical anonymity. Referenced media survives; unused images, including images
shared only by the erased author's private drafts, await confirmed object cleanup.
Real-store rollback, restart, migration, lease/concurrency and 12 compiled portal
layouts pass. Ownership/proof/audit erasure, exact projection completion, production
participant composition and the enabled Account/portal journey remain unfinished.
F30 and every service-wide operational gate stay open.

F30's Editorial canonical anonymity prerequisite now passes local qualification:
all six publication kinds retain public content with null ownership, article
bylines become `Deleted account`, active ownership grants end, and revision/outbox/
projection targets commit together. Real-store rollback/concurrency/restart and
18 compiled public-article layouts pass. This bounded phase is not yet composed
into Editorial's production participant. Private/audit/media cleanup and exact
projection/participant completion remain before the enabled portal erasure journey.
F30 and all service-wide operational gates remain open.

F30's historical Discussion projection cleanup now also has local real-store
qualification: v1/v2 copies and obsolete orphan payloads drain in bounded batches,
current anonymous records/tombstones survive, and interrupted cleanup retries.
Private SQL/audit/review cleanup and automatic participant composition are still
unfinished. This does not enable or complete the portal erasure action.

F30's canonical Discussion contribution-anonymity primitive now passes local
qualification: public/unlisted text, stable links and other members' replies are
retained, author ownership/display names are removed, and private bodies become
pointer-free tombstones. Current reads and materialization respect the new revision.
Real-store crash/concurrency/moderation tests pass. Automatic participant composition,
historical projections, private/audit/interactions, review cleanup, Editorial and
the full portal erasure workflow remain unfinished; F30 erasure stays disabled.

Discussion projection schema 3 now prevents delayed snapshots from restoring old
node bytes over newer revisions/tombstones. Complete-generation reads, schema
upgrade, rebuild and the compiled portal pass real-store recovery and 84 layouts.
This is an F30 prerequisite: canonical authorship and private data still need
cleanup, including retained schema-2 projection copies, before erasure can finish.

Cross-service erasure remains unfinished. Account-triggered durable coordination
and owning-service write barriers now pass local SQL and compiled-API checks,
including outages, retries, restarts and truthful pending completion. Account now
completes its own private-data/export cleanup and anonymizes erased staff badge
history while preserving other members' badges. SQL/runtime recovery and 84 badge
browser layouts pass. Editorial/Discussion cleanup, public-author anonymization,
object retirement and the portal flow remain pending. This does not make F30
erasure operational; see the Account cleanup checkpoint in implementation progress.

Discussion upload ownership is now durable before storage I/O, and publication
requires the exact uploaded reservation within the content/receipt/outbox
transaction. Obsolete-file retirement with permanent empty markers passes real
SQL/MinIO paused-upload and reconnect checks; the ordinary Discussion portal
regression passes 84 layouts. This retirement primitive is not yet composed into
automatic erasure. Reviewed historical-object inventory is now locally qualified
as described below; deployment inventory, public-author anonymization and service
completion remain open. F30 erasure remains unfinished.

F30 account export now also includes registered Discussion payload history:
current/replaced/removed and unfinished uploads, verified lost-confirmation
bytes, explicit absent-reservation observations and retired metadata. Own upload
actions on another owner's content carry only private action metadata without
that owner's identity, text, hash or current-use status. Real SQL/MinIO, compiled
Account archives and actual browser downloads qualify this extension; six portal
layouts and restart/retry/privacy regressions pass. A reviewed maintenance CLI now
accounts for older unregistered/legacy objects in bounded resumable batches. It
registers verified owned history for the same export, copies mutable legacy bytes
before retirement, and blocks unresolved owners or graph references. Proven orphan
cleanup, generation drift, registration/erasure races, migration recovery and
enabled/suspended bucket refusal pass real SQL/MinIO checks. Current public
references/outbox are unchanged. This is a locally qualified erasure prerequisite;
actual deployment inventory and full service cleanup remain required.

The account-export workflow now updates the privacy/settings routes: API users
request and monitor a durable archive, retry the same uncertain request, download
verified gzip JSON Lines and cancel/remove the archive. All four real sources
(Account, credentials, Editorial and Discussion) are required. Source outage,
restart, replay, expiry and current-account authorization pass service/browser
qualification, including six responsive/theme layouts. Preferences-only export
stays separate; demo export stays explicitly local. See the workflow checkpoint
for source coverage, exclusions, per-service snapshot semantics and evidence.
This supersedes earlier limited-export statements in the historical assessment.
Deployment and all OP gates remain open. The next workflow is cross-service
erasure: retain public contributions with anonymized authorship, remove private
data and end ownership access.

The published-profile articles checkpoint updates F19/F30: member profiles now
list current authored public articles, with title, excerpt, date, canonical links
and 20-item UUID paging. Current audience and Show Activity History apply to all
viewers, including owner preview. Canonical ownership/tenant and exact published
generations exclude private drafts/edits, other authors and withdrawals. Hidden,
empty, loading and unavailable states are distinct; session changes cancel old
reads. Real API/browser qualification passes 21-publication paging, privacy races,
projection recovery, Account restart and 60 responsive layouts. No new projection
or migration is introduced. Remaining privacy consumers, export/erasure and the
service-wide operational gates remain open.

The profile-totals checkpoint updates F18/F19/F30: My Profile and public profiles
now show distinct live discussion participation, resolved public favorites,
current owned suite publications and current authored article publications.
Canonical queries count beyond page sizes; private drafts and withdrawn/deleted
content are excluded. Public audience/category switches apply, including owner
preview; article counts follow Show Activity History. Hidden, zero, loading and
unavailable are distinct. Local service/browser qualification passes privacy races,
restart, independent sessions and 48 responsive layouts. No new projection or
migration is needed. The 200-parent Discussion bound, production qualification,
remaining authored-content collections, export/erasure and service-wide work stay
open; this does not complete F18/F19/F30 as a whole.

The staff-badge checkpoint updates F18/F19/F30: staff award/revoke with mandatory
reasons, immutable private audit and twenty-event history pages now work at
`/me/profile-badges`, with a capabilities-gated My Profile entry. Private/public
profiles display real active badges and award dates. Public audience and Show
Badges apply, including owner preview. Canonical SQL state/audit/account revision/
outbox commit atomically, with exact retries and in-flight visibility checks.
Local SQL/OPA/compiled API and independent-browser checks pass, including 78
responsive layouts, restart, migration and gateway routing. Badge labels grant
no authorization or billing entitlements. The additive migration is required;
production rollout, audit erasure/retention and the remaining
service-wide workflows stay open.

The public-profile activity checkpoint updates F19/F30: Show Activity History now
shares current public publications, individual topics/replies/comments, reviews
and favorites under canonical audience and category-sharing policy. Latest
publication attribution follows approved editing drafts to their canonical app
and excludes superseded receipts. Exact projections/current parents and final
canonical checks prevent stale content from being returned. Ten-item chronological
paging supports confidential continuation through fully hidden pages. Local API
and browser qualification includes privacy races, lag/loss/rebuild, restart and
60 responsive state/layout checks. This adds no migration or projection. It does
not implement private account audit history, the home feed, profile totals or full
authored-content collections. The subsequent staff-badge checkpoint implements
the agreed award/reason/revocation policy. Export/erasure and operational gates
remain open. Earlier checkpoint limitations below describe their historical scope.

The discussion-participation checkpoint further updates F19/F30: Show Discussions
shares current authored roots and live participation in both application topics
and article comment threads. Canonical profile audience, owner/tenant scope,
current parent visibility and exact Discussion generations are enforced. Deleted
sole contributions and withdrawn parents disappear without projection delivery.
Ten-candidate paging uses confidential scoped continuations and permits an empty
page with a next page. Article links open the exact thread beyond the first listing,
support real reply/reload, and reject invalid or wrong-parent links. Local checks
include 66 profile and 24 article layouts plus suite/favorites regressions. Profile
activity/badges, remaining privacy consumers, export/erasure and operational gates
remain open; this adds no projection or migration.

The published-profile suites checkpoint further updates F19/F27: Show Suites now
shares the member's reviewed public suites within the current profile audience,
including owner preview. Account privately resolves ownership; Editorial checks
current approved publication and exact projections. Private edits do not change
public metadata, withdrawal hides stale projections and privacy changes during
content I/O discard the response. Twenty-item pagination, detail links, real
settings, independent sessions, follower revocation, failure/retry and restart
pass 60 local browser layouts, with shared-favorites and discussion regressions.
Contributor attribution requires a separate collaboration model. Other authored
content, badges/activity, export/erasure and operational gates remain open.

The public-profile favorites checkpoint adds audience-filtered sharing of existing
application, suite, article and discussion favorites at `/profiles/:profileId`.
API mode requires current profile access and the member's Show Favorites switch;
current public targets produce canonical links, while hidden targets are omitted.
Paging, unavailable/retry, empty/hidden states, independent sessions, follower
revocation and restart pass local real-service/browser checks (54 focused layouts
and the existing 66-layout discussion-favorites regression). This does not close
the remaining profile activity, badges, authored-content, export or erasure work.
The application-discussion checkpoint supersedes the core F13/F14 API-mode
list/detail/post/reply/edit/remove/moderation assessment: those routes now use
canonical application UUIDs, real Discussion storage/materialization and current
Editorial visibility. Independent-browser qualification includes exact retries,
conflicts, account switching and 84 responsive layouts. My Discussions (F25) now
also uses canonical account participation with a self-read policy, current
application visibility and bounded pages; 60 responsive layouts and 27
service/recovery groups pass. The API quick dialog now reuses real thread
reads/replies/edits/removal/moderation, retains exact retry through reopening and
refreshes its originating list; 84 responsive layouts and 27 service/recovery
groups pass. Discussion favorites now also use canonical public-topic eligibility,
durable account relations and current parent/thread links in lists, full threads,
quick dialogs and grouped favorites. Their 31 real-service/recovery groups and
66 responsive layouts include exact retry, conflicts, unavailable removable
references and session isolation. Application-topic/reply votes now also use
canonical actor choices and totals through lists, full threads and quick dialogs:
626 tests, 28 OPA cases, 32 service/recovery groups and 72 responsive layouts pass.
Exact retries, conflicts, switching/removal, restart and projection recovery are
qualified. Topic pinning now also uses tenant-admin policy and canonical SQL
metadata, bounded ordering and exact-revision content reads. Its 645 tests,
30 OPA cases, 36 service groups, generic recovery regression and 78 layouts pass.
Top-author summaries remain open; explicit demo routes retain their local
behavior. See the corresponding checkpoints for
migration ordering, materialization variations and production limits.
The member-review checkpoint supersedes F12 and the F09 member-rating summary in API mode: stable member/app
reviews, public detail/list/ratings, author editing/withdrawal/republishing,
helpful marks, immutable reports and independent staff moderation now use real
canonical SQL. Overview summaries agree with the currently visible reviews.
579 tests, 34 OPA cases, 17 service/recovery groups and 96 browser layouts pass.
No verified-purchase/profile claims or review feed/notification delivery are
introduced. The SQL materialization variation and explicit migration are
documented; service-wide erasure and operational/deployment gates remain open.
The discussion-preview checkpoint further supersedes F09/F14: API overviews show
three canonical public topics, and full threads show other topics about the same
application. Pin-first/newest order, current text/reply counts, canonical keyboard
links, separate composer state and explicit empty/unavailable recovery pass 394
tests and 48 browser layouts against real services. No new projection or ranking
is introduced; top-author summaries and full-service gates remain open.
Editorial's baseline authorization and materialization findings are superseded by
the protected commands, SQL outbox, projection worker, rebuild/reconciliation and
verified ownership backfill recorded there. The catalog backend now performs
bounded authoritative SQL selection and revision-checked Mongo content reads,
with a validated UUID-based BFF contract. Built-service HTTP/restart/rebuild checks
pass on isolated stores. API-mode Aggregator Discover, facet listings/directories
and overview now use that contract, with browser-to-service recovery checks. Home
search previews now also use bounded real catalog reads, with retryable failures
and service totals. Home activity is demo-only pending its service. The real feed,
separate Catalog portal, public submission/review and
deployment qualification remain open; management reads still use authoritative SQL.
The email-verification checkpoint supersedes the verification gap in F17 and
extends F27: Profile Settings reads the signed-in credential's current provider
email/status and requests verification; `/auth/action?mode=verifyEmail` checks
and explicitly completes its one-use code. It does not verify app-domain ownership
or change application access policy. SQL lifecycle and provider revocation still
gate private operations. 570 tests, actual provider checks, compiled APIs and 60
browser layouts pass, including lost completion, independent accounts, restart,
outage and suspended/revoked identities. Deployed email templates/delivery,
provider expiry and ingress controls remain unverified. No new projection is added.

The private-avatar checkpoint supersedes the photo gap in F18/F27: API settings
now upload/replace/remove a normalized private photo through atomic canonical SQL,
revision-bound commands and retained exact receipts. Profile and shell images use
authenticated blobs with session-scoped object URLs. 758 tests, real SQL/OPA/compiled
API qualification, the 150-layout profile/preferences regression and 36 final photo
layouts pass. The small-payload SQL variation and shared identity migration are
documented. Full export/cross-service erasure and
production restore/rollback/load gates remain open.

The public-profile checkpoint supersedes F19 and the basic audience/follower gap
in F18/F27/F30: API profiles use immutable public UUIDs, canonical current
visibility, protected photos and owner-approved followers without a staff override.
Anonymous public reads, owner-only private reads, follower gates, request/cancel,
approve/decline/remove, exact retries and conflicts pass 825 tests, 53 OPA cases,
real SQL/compiled API qualification, 54 focused layouts and the 150-layout profile
regression. Private previews and a bounded public directory use the real contract.
No credential UID, login email or private preferences enter public payloads.
The canonical SQL variation and explicit follower migration are documented.
Badge/activity and content-collection privacy consumers,
analytics/personalization, follower notifications and full-service gates remain
open. Explicit demo routes preserve their separate demonstration behavior.

The contact-email checkpoint further supersedes F18/F19/F27/F30: members explicitly
save/remove a separate contact address, and the public profile shares it only when
the email switch and current audience allow it. Credential email remains private,
directory results omit addresses, and the displayed contact is labeled unverified.
846 tests, real SQL/OPA/compiled API checks, 90 focused layouts and the 150-layout
profile regression pass. Exact retries, conflicts, legacy command compatibility,
sharing changes, erasure with the local account row and restart are qualified.
The additive migration and no-projection variation are documented. Remaining
content consumers, full account export/cross-service erasure and deployment gates
are still required.

The identity backend baseline (B03-B05 and the account/identity persistence row)
is also superseded: both services now share canonical UID/SQL authority, durable
profile registration and lifecycle outboxes. Deletion uses retained provider
cleanup; password recovery requests actual provider email delivery. F17 now has
credential signup, reset verification/consumption and real HTTP forms, plus explicit
API/demo mode. Canonical SQL and credential emulator qualification pass. F18-F19,
public-profile/privacy integration, verified legacy import, actual email delivery and full service
integration remain open. The rows below retain their assessment baseline unless
explicitly marked updated. See the identity checkpoint in
[implementation progress](IMPLEMENTATION-PROGRESS.md) and the identity protocol in
[materialization](MATERIALIZATION.md).
Read [operational readiness](OPERATIONAL-READINESS.md) for release gates, measured
checks, architecture findings, and the OP01-OP10 implementation order.

The release portal checkpoint supersedes the F11 baseline in API mode: grant-bound
drafts at `/my/releases`, independent frozen-snapshot review at
`/editorial/releases`, canonical publication/withdrawal and live devlogs now pass
local SQL/OPA/HTTP/Mongo/broker/browser qualification. Public readers can browse
stable/prerelease channels, paginated older releases and version details with
earlier-release history. Explicit demo mode retains release fixtures. See the
release portal checkpoint for substitutions, in-memory retry limits and remaining
deployment/recovery gates. OP06/OP07 and the full goal stay open.

The article text checkpoint supersedes the editor/publication/favorites portions
of F06 and F20 in API mode: account-owned `/my/articles` drafts, independent
`/editorial/articles` review, permanent public URLs, real list/detail/filter/page
reads and canonical article favorites now pass local SQL/OPA/API/Mongo/broker/
browser qualification. Submitted snapshots and approved content remain separate
from private edits. Withdrawal hides stale projections immediately; saved
references remain removable at `/my/favourites/articles`. Article covers now pass
local upload/reload recovery, required descriptions, frozen review, current public
reads and reference-safe cleanup qualification. Article comments now also pass
local public reading, member posting/replies, author edits/removal, moderator
removal, pagination, exact retries and current parent visibility checks. They
reuse Discussion's authoritative binding/receipt/outbox and actual generation
worker; generic Discussion routes cannot bypass the article boundary. The
comments checkpoint records 11 service/recovery groups and 78 browser layouts.
Production and full-service gates remain open. See the article checkpoint for evidence and
fixture/retry limits. Cover upload intent survives reload in session storage;
article field-command retry remains in memory. Historical text-only evidence is
preserved separately from the cover checkpoint. Comment retry intent is also
memory-only across client navigation, cleared on account changes/full reload.
Public comment names are explicitly supplied, not verified profile identities.
Application discussions, reviews and votes have separate qualified checkpoints
above; their broader feed/notification and operational requirements remain open.

The suite publication checkpoint supersedes F07/F22 in API mode: private drafts
now support immutable-revision submission, reviewer approval/rejection, visible
outcomes, public search/detail and immediate withdrawal/deletion. Assigned reviewers
use `/editorial/suites` and cannot review their own suites. Private edits preserve
approved content. Projections use the recoverable Editorial pipeline. Cross-kind
discovery, suite facets/legacy listing URLs and account-wide export/erasure
remain open. See the checkpoint for real-service/browser/broker evidence and limits.

The suite favorites checkpoint also supersedes F07/F20/F21: public detail/listing
controls save canonical suite UUIDs to Account Management, and the suite favorites
route filters that account's saved suites. Metadata resolves current approved content
with canonical visibility/revision checks. Withdrawn/deleted targets remain removable
without disclosing old metadata. Real-service/browser checks cover independent
sessions, restart, retry/conflict and projection lag. Other favorite types, full
account export/erasure and production qualification remain open.

The application-draft checkpoint supersedes F23 in API mode: `/my/apps` and
`/apps/register?draftId=...` use Editorial's canonical owner/tenant SQL workspace.
Create/list/reopen/edit/delete, revision conflicts, uncertain retries and API
restart work across independent browser sessions. Saved drafts grant no public
visibility, verified ownership or editing rights over existing catalog records.
Explicit demo routes retain the original local draft behavior.

The application-publication checkpoint further supersedes F23 in API mode:
owners use `/my/apps/:applicationId/publication` to submit a saved immutable
revision and see rejection reasons or approved status. Independent assigned
reviewers use `/editorial/apps`; approval atomically publishes the submitted
content through the recoverable Editorial pipeline. Later private edits remain
private; direct public edits conflict with stale approvals. Withdrawal/deletion
revoke public visibility before projections catch up. Public websites now support
the full 2,048-character draft contract. The catalog author association does not
verify real-world ownership.

The ownership portal checkpoint supersedes F24 in API mode. Public application
pages lead to durable claims, immutable evidence and canonical-host DNS proof.
`/my/ownership` tracks private claims and owner release;
`/editorial/ownership` and `/editorial/ownership/grants` support dedicated
independent approval/rejection and revocation. `/my/apps/owned/:applicationId`
opens a separate grant-bound private draft with per-field comparisons and explicit
stale-content merging. Content review publishes to the existing public identity;
later private edits stay private. Revocation and later grants cannot revive old
drafts, and their cleanup cannot delete public content. Real-service/browser checks
qualify retries, isolation, restarts, projection lag/recovery and responsive layouts.
Explicit demo mode still uses local preparation. Media deployment, cross-service export/erasure
and deployment gates remain open. See publication and ownership portal checkpoints
for evidence and fixture limits.

Private application media now has a locally qualified reservation/upload/preview
API with canonical owner/tenant isolation, bounded still-image normalization,
immutable MinIO objects and recoverable SQL completion. The API also supports
revision-bound draft attachment/removal, inherited/legacy references, explicit
rebase, immutable review media and atomic approved public references. Image reads
check current SQL authority before and after object I/O. Retained-upload listing,
revision-bound cancellation and durable retention cleanup now have local SQL,
MinIO, OPA and compiled API qualification. Cleanup preserves references, fences
late uploads with permanent empty markers and exposes failed jobs for explicit
operator recovery. The API portal now provides upload/preview/attach/remove/cancel,
session-scoped exact retries after reload, frozen reviewer previews, per-slot
canonical image comparison/merge and legacy-image resubmission. Independent
browser and responsive/theme checks qualify these controls locally; deployment
provisioning and activation remain open. The legacy
external-URL media worker is a separate ingestion path and grants no upload rights.
See the media portal, publication and retention checkpoints for exact scope and exclusions.

All 129 workspace build targets now pass; all 63 Angular packages pass emitted
artifact checks. This repairs the compilation and packaging baseline;
the feature labels below still require their stated real-data integrations.
The clean-install source snapshot also passes 1,120 Jest tests, 24 portable
checks, product/tooling lint and all 13 declared typechecks. Responsibility tags
and release failure gates are enforced in code. There are still 109 projects
without their own behavior specs, 445 lint warnings and 284 untriaged dependency
audit findings. These engineering results do not change the feature integration
labels. See the engineering checkpoint in
[implementation progress](IMPLEMENTATION-PROGRESS.md).

The later catalog checkpoint passes 1,187 Jest tests in 119 suites/25 projects
and 24 portable checks using the refreshed clean-install source snapshot.
107 projects remain without their own behavior specs; seven external suites are
kept separate from portable checks. These figures supersede the test inventory
counts above, without closing the feature integration gaps.

The later portal checkpoint passes 1,219 Jest tests in 122 suites/26 projects,
24 portable checks, affected builds/typechecks/lint and 24 real-service browser
screen/theme/width combinations. 106 projects still lack their own behavior specs.
It covers bounded application discovery, taxonomy and details, plus browser-visible
projection lag/loss/rebuild, restarts and deletion. Demo mode is explicit. This
supersedes the fixture-only evidence for those specific paths, without closing
personal state, directory previews/counts or other OP04 gaps.

The subsequent home-preview checkpoint passes 1,235 Jest tests in 126 suites/26
projects, 24 portable checks and 42 real-service browser screen/state/theme/width
combinations. It adds bounded API previews, explicit failures/retry, demo-only
activity selection and a feed empty/error rendering fix. The 106-project behavior
coverage gap and seven separately qualified external suites remain unchanged.

The subsequent private-profile checkpoint replaces browser-only profile text
editing with canonical SQL reads/commands, self-access policy and atomic outbox
intent. The compiled portal and account API are exercised with real OPA/MySQL,
independent sessions, revision conflicts, account switching and process restart.
Profile metadata remains absent when unknown; demo mode is explicit and separate.
The F18 and profile-persistence baseline rows are superseded for this text-editing
path only. Durable avatars, public visibility/privacy, preferences, favorites,
collections and the remainder of F18-F19 remain open. See the private-profile
checkpoint for current counts, substitutions and recovery limits.
Its final inventory passes 1,327 Jest tests in 132 suites/28 projects, 24 portable
checks and 42 real-service browser combinations. The behavior-spec gap is now
104 projects; seven external suites remain separately qualified. API local-settings
export contains browser preferences only and explicitly excludes the account profile.

The subsequent account-preferences backend provides canonical
`GET/PUT /api/me/preferences`, strict contracts, self-policy and atomic
revision/receipt/outbox writes. Deletion removes preferences transactionally.
Its real SQL/API/OPA checks cover rollback, concurrent writers, replay, profile
revision conflicts and process restarts. The complete test inventory now passes
1,389 Jest tests in 136 suites/29 projects plus 24 portable checks; 103 projects
still lack their own behavior specs. Preferences portal integration, guest/demo
separation and account-scoped UI state remain in progress. F28-F30 are not complete;
notification delivery, public privacy and followers still need their use cases.

The subsequent preferences portal checkpoint replaces browser-wide settings in
API mode with canonical reads/commands. Explicit demo mode and anonymous display
storage remain separate. F28-F30 now have account-scoped saves, revision conflicts,
session cancellation and saved-preferences-only API export. Full account export,
public visibility/followers, delivery and unused preference consumers remain open.
The full gate passes 1,426 Jest tests in 138 suites/30 projects plus 24 portable
checks; 102 projects lack their own behavior specs. Real SQL/OPA/API/Chromium
qualification passes 114 layout states, independent sessions, lost-receipt retry
and account-process restart. The baseline rows below remain historical; this
checkpoint supersedes their browser-only preference persistence/export claims.

The subsequent canonical-selection checkpoint adds bounded application lookup by
stable UUID through Editorial and Catalog BFF. It rechecks SQL eligibility and
projection revision, and preserves target identity through slug rename/reuse.
Real-store checks cover concurrent deletion, process restart, projection
loss/rebuild and dependency outage. This is a prerequisite for F20-F22; those
favorites/collections persistence and portal flows remain unfinished. The full
gate passes 1,466 Jest tests in 138 suites/30 projects plus 24 portable checks;
the behavior-spec gap remains 102 projects. See the checkpoint for the corrected
outbox contention qualification and retained intermediate failure.

The account-favorites backend checkpoint adds canonical `GET/PUT /api/me/favorites`
with self-access policy, stable target IDs, shared account revisions, replayable
receipts, atomic outbox/deletion and a 200-relation bound. Application targets use
the qualified Editorial selection contract; other target kinds remain unsupported
for adds. Real SQL/OPA/compiled-service checks pass isolation, concurrency, capacity,
target rename/delete/lag, outage-safe removal/replay and account-process restart.
The full gate passes 1,544 Jest tests in 143 suites/31 projects plus 24 portable
checks; 101 projects lack behavior specs. F20-F22 remain open: the portal still
uses browser storage, current target display must be resolved by owning services,
and collections and the other favorite content families remain unfinished.

The subsequent application-favorites portal checkpoint connects canonical account
relations to UUID-based toggles, current BFF metadata, the sidebar and scoped
favorite routes. Explicit API/demo providers isolate browser data. Metadata
outages or deleted targets preserve removable saved IDs without invented links;
session changes clear obsolete state and feedback. Real-service browser checks
pass independent sessions, lost-receipt retry, account restart, revision conflict,
rename/delete/lag and outage removal, plus 30 responsive/theme states. The full
gate passes 1,574 Jest tests in 144 suites/32 projects plus 24 portable checks;
100 projects lack behavior specs. This supersedes F20's application-favorites
browser-storage limitation. Suite/article/discussion adds and collections remain
unfinished, so F20-F22 and OP05 are not complete.

## Product and implementation boundaries

Wapps combines application discovery, editorial content, curated application
suites, community discussions/reviews, and personal profiles/collections. Three
portals expose different subsets. Catalog ingestion and development reporting run
as separate workers. There is no complete billing, organization administration,
customer notification delivery, or general chat product merely because related
types, navigation declarations, or UI components exist.

The inventory covers all three route files and their active pages/providers,
25 controller classes with 74 declared HTTP handlers, all 29 shared feature
directories (28 Nx projects and one platform re-export), backend use cases,
workers, persistence adapters, and domain scaffolding. The companion
[source inventory](readiness/functionality-inventory-2026-10-11.json) records
controller paths/lines, route expressions, and shared feature roots. Its 56
aggregator route declarations include wrappers, redirects, auxiliary routes, and
the dynamically inserted Digest route; they are not 56 distinct features. Legacy
redirects are spread from a separate file and described below.

Status labels describe evidence, not a completion percentage:

| Label    | Meaning                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------- |
| Browser  | Real behavior provided by the browser, such as sharing or theme selection.                        |
| Local    | Interactive behavior saved in browser storage, not synchronized to a user account or other users. |
| Sample   | Bundled or generated content, including plausible ratings/statuses that are not observations.     |
| Backend  | A service implementation and/or HTTP adapter exists; live integration remains unverified.         |
| Partial  | A visible flow is missing a required operation, connection, or enforcement.                       |
| Scaffold | Declarations, types, placeholder providers, or empty routes without a completed use case.         |

## Runtime composition

| Component                              | Responsibility and current composition                                                                                                                                                                                                        | Source                                                                                                                                                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aggregator portal                      | Main product experience. Empty `ENVIRONMENT_NAME` selects mock authentication and local catalog providers. Deployed environment selection enables some catalog/auth HTTP adapters, but many pages still read fixtures/local storage directly. | [root](../apps/portals/aggregator/application/src/root.ts), [environment](../apps/portals/aggregator/application/src/environment.ts)                                                                                                          |
| Catalog portal                         | Small read-only application listing/detail client using real HTTP calls to Catalog BFF. API URL is derived from hostname or a `wapps-catalog-api` meta override.                                                                              | [API client](../apps/portals/catalog/application/src/services/catalog-api.service.ts), [environment](../apps/portals/catalog/application/src/environment.ts)                                                                                  |
| Discussion portal                      | Separate sample discussion list/detail experience with configured real authentication. Discussion content is still bundled data.                                                                                                              | [routes](../apps/portals/discussion/application/src/routes.ts), [root](../apps/portals/discussion/application/src/root.ts)                                                                                                                    |
| Editorial and Catalog BFF              | Editorial owns application/reference records in MySQL. BFF reads Editorial and shapes public catalog responses; it is not the write/publication service.                                                                                      | [Editorial app service](../apps/services/editorial/src/app/application/editorial-commands.ts), [BFF service](../apps/services/catalog-bff/src/app/catalog/catalog.service.ts)                                                                 |
| Authenticator and Identity Management  | Firebase authentication/session validation and account administration/provisioning, respectively. They currently provision different internal identity representations.                                                                       | [auth controller](../sdk/features/identity/applications/authenticator/service/src/controllers/auth.controller.ts), [account service](../sdk/features/identity/applications/management/service/src/app/services/public-account-app.service.ts) |
| Discussion management and materializer | MySQL content nodes/relations and likes, MinIO payloads, RabbitMQ materialization requests, MongoDB read projections.                                                                                                                         | [discussion service](../sdk/features/discussion/applications/management/service/src/app/discussions/discussions.service.ts), [materializer](../sdk/features/discussion/applications/materializer/service/src/index.ts)                        |
| Content node registry                  | Intended content infrastructure, currently health/platform metadata and an empty entity registration. No content CRUD controller.                                                                                                             | [module](../apps/services/content-node-registry/src/app/app.module.ts)                                                                                                                                                                        |
| Acquisition and operational workers    | Store.app scraping, AI enrichment, media download/storage, and Discord development reports. These are distinct from customer-facing product flows.                                                                                            | [worker inventory](#workers-and-integrations)                                                                                                                                                                                                 |

The private suite checkpoint supersedes F22 for API mode: create/list/reopen/edit/
delete now uses owner-scoped canonical Editorial SQL, revision conflicts, retry
receipts and tombstones. Routes are `/my/suites`, `/suites/create`, and
`/my/suites/:suiteId`. Membership stores application UUIDs; display metadata comes
from the current catalog. Demo routes remain explicitly browser-local. Focused
real SQL/OPA/compiled-service/browser qualification passes, including independent
sessions, process restart and 36 layout states. F07 public publication, suite
favorites, account export and full erasure remain open. See the private suite
checkpoint for evidence and substitutions; this is not a full product release.

## Aggregator: discovery and reading

The authoritative route/nav sources are [routes](../apps/portals/aggregator/application/src/routes.ts)
and [navigation](../apps/portals/aggregator/application/src/navigation.ts).

| ID / routes                                                                     | What a user can do                                                                                                                                                                            | Data, limitations, and completion dependency                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 `/` (Explore) | Read real public applications, suites, articles, releases, topics and reviews; follow details and return to the selected page; search and revisit recent searches. | API feed is locally qualified through BFF and owning services with current visibility, encrypted ten-item pages, saved exclusions and page-local popular/recommended order. No invented views or health events. Explicit demo feed and local recent search history remain separate. Mature classification and deployment gates are open. OP04/OP07/OP08. |
| F02 `/discover`                                                                 | Search applications, articles, and suites in grouped results; select type/category/platform/device/monetization/tag facets; navigate to result details.                                       | `DiscoverySearchService` calls the pure fixture-backed `searchDiscoveryCatalog`. This grouped view collects all matching result pages internally; it is not server pagination. No live search index. OP04.                                                                                                     |
| F03 `/digest`                                                                   | Browse curated latest activity, articles, applications, and discussions; open their details. Broken article images have a fallback.                                                           | `buildDigestContent()` composes bundled content. No scheduled digest generation or email subscription is implemented here. OP04/OP07.                                                                                                                                                                          |
| F04 `/categories`, `/tags`                                                      | Search the facet directory, choose grid/list view, show 24 more entries, open a category/tag.                                                                                                 | `catalogDirectory()` and `searchCatalogDirectory()` use local catalog data. Default view comes from local preferences. OP04.                                                                                                                                                                                   |
| F05 `/categories/:categorySlug`, `/tags/:tagSlug`, plus each `/search/` variant | Browse entries constrained to that facet; search/filter, sort, paginate, switch grid/list, and clear filters.                                                                                 | `ResultsPageComponent` and `browseCatalog` operate locally. Supported query fields: `search`/`q`, plural content `type`, category, platform, device, monetization, `tag`/`tags`, sort, page/pageSize, view. Sort supports name/name-desc, plus newest except suites. These differ from the BFF contract. OP04. |
| F06 `/articles`, `/articles/:articleSlug` | Browse/filter/page reviewed articles; read supplied text and covers; save favorites; post/read replies, edit owned comments and remove them; moderators remove comments. Author drafts and independent review use `/my/articles` and `/editorial/articles`. | Updated: API mode uses canonical publication/favorites plus article-bound Discussion writes and recoverable generations. Text, covers and comments are locally service/browser qualified. Demo fixtures remain explicit. Profile names are user-supplied, comment retry is memory-only, and production/erasure/operational gates remain open. See the article checkpoints. |
| F07 `/suites`, `/suites/:suiteSlug`                                             | Browse curated application collections, inspect members, open member apps, favorite a suite, start a personal suite.                                                                          | Fixtures merged with browser-local suite drafts. Suite creation does not publish. No durable membership, editing, deletion, or collaborative curation use case. OP05/OP06.                                                                                                                                     |
| F08 legacy discovery URLs                                                       | Existing `search`, `app`, `apps`, and legacy paginated/category paths redirect to Discover; app variants select application results. Query/fragment context is retained by redirect logic.    | Browser routing. `/suites` and `/articles` also accept `page/:page` and `:category/page/:page` children. Keep these compatibility routes covered when replacing local discovery.                                                                                                                               |

Sources: [Explore](../apps/portals/aggregator/application/src/pages/home/home.component.ts),
[feed sorting](../apps/portals/aggregator/application/src/pages/home/home-feed-sort.ts),
[Discover](../apps/portals/aggregator/application/src/pages/discover/discover-page.component.ts),
[search algorithm](../apps/portals/shared/features/search/src/application/discovery-search.ts),
[Digest](../apps/portals/aggregator/application/src/pages/digest/digest-content.ts),
[directory](../apps/portals/aggregator/application/src/pages/catalog-directory-page/catalog-directory-page.component.ts),
[results](../apps/portals/aggregator/application/src/pages/results-page/results-page.component.ts),
[entry details](../apps/portals/aggregator/application/src/pages/entry-details-page/entry-details-page.component.ts),
[entry storage](../apps/portals/aggregator/application/src/pages/entry-details-page/entry-details-data.service.ts),
[redirects](../apps/portals/aggregator/application/src/pages/discover/discover-redirect.routes.ts).

## Aggregator: application details and community

| ID / routes                                         | What a user can do                                                                                                                                                                                                                   | Data, limitations, and completion dependency                                                                                                                                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F09 `/apps/:appSlug`, `/overview`                   | Open an app (base path redirects to overview), inspect description, logo, category, tags, platforms, pricing models, ratings, estimated users, recent discussions and suite membership; favorite it and navigate to detail sections. | Overview uses a provider with local/BFF implementations. Its category/tag/platform labels, recent discussions, and included suites still come from local data. BFF numeric/hash IDs do not establish compatibility with fixture IDs. OP04.                                  |
| F10 `/apps/:appSlug/health` | View measured HTTP endpoint states, response evidence, sampled availability with coverage and thirty UTC days of history. | API mode is locally qualified with staff configuration, canonical SQL observations, bounded worker leases, approved-origin/current-visibility enforcement and truthful unknown/stale states. Explicit demo mode retains samples. HTTP checks only; no owner notices. Probing requires explicit activation. Public DNS/TLS/egress and production gates remain open. OP07/OP09/OP10. |
| F11 `/apps/:appSlug/devlog`, `/devlog/:version` | Browse stable/prerelease channels, paginated older notes, version details and previous releases. Verified owners draft/submit/merge/withdraw through `/my/releases`; independent staff review at `/editorial/releases`. | API mode is locally qualified against canonical SQL, OPA, Mongo, RabbitMQ and independent browsers. Demo fixtures remain explicit. Deployment/recovery/load gates and OP06/OP07 remain open; see the release portal checkpoint. |
| F12 `/apps/:appSlug/reviews`, `/review/:reviewSlug` | Publish/edit/withdraw/republish a member review; browse real rating summaries and paged reviews; mark helpful, report, and let independent staff hide/restore with immutable reported text. Detail selects the canonical review UUID. | API mode is locally qualified through canonical SQL, explicit OPA, compiled APIs and independent browsers. Current parent visibility and independent author/staff flags govern visibility. No verified-purchase/profile claims; explicit demo mode remains separate. Feed/notification consumers, erasure and deployment/operational gates remain open. OP07. |
| F13 `/apps/:appSlug/discussions` | Browse bounded real topic pages, create application-bound topics, vote using real counts, and let tenant administrators pin/unpin roots. Pinned topics sort first. Explicit demo mode retains local topics. | Locally qualified against canonical UUID/SQL authority, OPA, immutable payloads, broker materialization and independent browsers. Votes and pins support exact retries/conflicts, restart and projection recovery. View/author summaries and deployment gates remain open. OP07. |
| F14 `/apps/:appSlug/discussions/:discussionSlug` | Read/reply/edit/remove/moderate real topics and replies. Topic lists and My Discussions open the lazy API quick dialog. Lists, threads and dialogs save favorites and change member votes; tenant admins pin/unpin roots. | Locally qualified with current parent visibility, conflicts, exact retry, session isolation, redacted replies and originating-list refresh. Favorites, votes and pins survive restart; canonical state joins exact content revisions. Metadata changes preserve composer text. Same-application related previews are qualified with independent read state and current visibility. Top-author summaries and operational gates remain open. Demo mode remains explicit. OP07. |
| F15 `/apps/:appSlug/timeline` | Read current public application updates, approved suite publications, releases, topics and reviews; open real content, page/back/refresh and apply saved choices. | API mode is locally qualified through canonical application scope, current public revisions, application-bound cursors and independent browsers. No new projection. Explicit demo mode retains fixtures. Complete immutable history, article associations, real status observations and deployment qualification remain outside this checkpoint. OP07/OP09. |
| F16 shared feed actions                             | Favorite supported content, share/copy its link, and toggle local feed votes.                                                                                                                                                        | Favorites/votes use browser storage. Native share/clipboard are real browser actions; cancellation is handled and manual-link fallback exists. The sharing adapter restricts links to same-origin HTTP(S). No server voting/reputation system. OP05/OP07 for durable state. |

Sources: [overview](../apps/portals/aggregator/application/src/pages/application-overview-page/application-overview-page.component.ts),
[health](../apps/portals/aggregator/application/src/pages/application-health-page/application-health-page.component.ts),
[devlog](../apps/portals/aggregator/application/src/pages/application-devlog-page/application-devlog-page.component.ts),
[reviews](../apps/portals/aggregator/application/src/pages/application-reviews-page/application-reviews-page.component.ts),
[discussion list](../apps/portals/aggregator/application/src/pages/application-discussions-page/application-discussions-page.component.ts),
[thread](../apps/portals/aggregator/application/src/pages/application-discussion-page/application-discussion-page.component.ts),
[local discussions](../apps/portals/shared/features/application-overview/src/infrastructure/local-discussions.service.ts),
[API quick dialog](../apps/portals/shared/features/discussion/src/presentation/quick-discussion/quick-discussion-api-dialog.component.ts),
[timeline provider](../apps/portals/aggregator/application/src/pages/application-timeline-page/application-timeline-feed-provider.service.ts),
[sharing](../apps/portals/shared/features/sharing/src/infrastructure/sharing-api.service.ts),
[local feed votes](../apps/portals/shared/features/feed/src/presentation/actions/feed-local-vote.component.ts).

## Aggregator: identity and personal workspace

Guards below describe client navigation only; they do not prove server-side access
control. Most personal routes use `AuthenticationGuard`. `/me/profile` does not;
`/profiles/:profileId` does, despite being presented as a public-profile page.

| ID / routes                                                                      | What a user can do                                                                                                                                                 | Data, limitations, and completion dependency                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F17 auxiliary `identity` dialog: authenticate/register/recover; `/auth/callback`; `/auth/action` | Create an account, sign in, request recovery, consume a reset link, complete OAuth, refresh and sign out. | Updated: explicit API/demo mode, real HTTP signup/recovery/reset, scoped token refresh, validated OAuth state/age/provider/redirect/PKCE, persistent form states. Signup ends with sign-in instructions. Production-bundle fixture browser checks and Firebase Auth emulator checks pass separately; integrated sessions, actual email delivery/template configuration and email verification remain open. OP02. |
| F18 `/me/profile` | View profile, badges/stats, social links and workspace shortcuts; edit or sign out. | Updated: shared identity retrieval now calls canonical `/api/me`; the separate profile feature and profile page still use local profile defaults/changes. Identity correctness does not make profile/settings persistent across accounts and browsers. OP02/OP05. |
| F19 `/profiles/:profileId`                                                       | View a member of the demo directory and navigate between members.                                                                                                  | `EXAMPLE_PROFILES`, with local current-profile replacement for a matching ID. No remote lookup, follow/unfollow system, or enforced audience restrictions. OP05/OP08.                                                                                                                                                                       |
| F20 `/me/favorite`, `/my/favourite/apps` | See canonical saved applications, suites, articles and discussions; resolve current links, remove references and retry failed loading. | API mode uses account-scoped SQL relations, shared revision/receipt/outbox and owning-service eligibility. All four kinds and the sidebar now enforce current-account content choices. Hidden metadata has no names/images/links; references remain removable during preference/metadata outages. Independent browsers, retries, reclassification and API restarts are locally qualified. Demo mode stays explicit; deployment and OP05 remain open. |
| F21 `/my/favourites/suites` | See only saved suites, with current approved classification, selected-kind hidden counts, real links and removal controls. | The shared favorites page uses the suites predicate. Independent-browser qualification covers filtering, hidden/unavailable references, removals and restart persistence. This supersedes the original ordinary-suite-list placeholder. Deployment and OP05 remain open. |
| F22 `/my/suites`, `/suites/create`                                               | List this browser's suite drafts; create a suite with title, optional description and selected bundled apps; open the saved detail.                                | Title up to 100 and description up to 1,000 characters; at least one app. Slug conflict suffixing and reserved `create` handling exist. No edit/delete or server publishing. OP05/OP06.                                                                                                                                                     |
| F23 `/my/apps`, `/apps/register?draftId=...`                                     | Create, edit, list and delete local application drafts; save name, slug, website and description; follow ownership preparation.                                    | Versioned local store validates input and surfaces storage failures; existing corrupt storage is not blindly overwritten. Names 2-100, slug up to 80, description 20-2,000, HTTP(S) website up to 2,048 characters without credentials. No application submission API. OP06.                                                                |
| F24 `/apps/ownership/:appSlug`                                                   | Save evidence URL and notes for an ownership claim; revisit/delete those notes from My Apps.                                                                       | Local preparation only, notes 20-2,000 characters. Does not verify domain ownership, submit a claim, or grant editing rights. OP01/OP06.                                                                                                                                                                                                    |
| F25 `/me/discussions` | List real application topics with an owned live root/reply, newest topics first; open canonical app/thread links and traverse bounded pages. | API mode is locally qualified through SQL membership/tenant scope, self-read OPA, exact Discussion generations and current catalog visibility. Duplicate replies collapse; deletion revokes membership; account changes clear private lists. Explicit demo mode retains local-reader data. Deleted-post/article-comment history and deployment gates remain outside this view. OP02/OP07. |
| F26 `/organization`                                                              | Guarded route declaration exists.                                                                                                                                  | Empty child list; no organization membership, ownership administration, or usage-plan screen. Scaffold.                                                                                                                                                                                                                                     |

Sources: [identity feature](../apps/portals/shared/features/identity/src/login.providers.ts),
[BFF authentication](../apps/portals/shared/features/identity/src/infrastructure/bff/bff-authentication.service.ts),
[interceptor](../apps/portals/shared/features/identity/src/infrastructure/authentication.interceptor.ts),
[profile](../apps/portals/aggregator/application/src/pages/my-profile-page/my-profile-page.component.ts),
[directory profiles](../apps/portals/aggregator/application/src/pages/profile-page/profile-page.component.ts),
[favorites](../apps/portals/aggregator/application/src/pages/favorites/favorites.component.ts),
[suite page](../apps/portals/aggregator/application/src/pages/suites/suites.component.html),
[My Apps](../apps/portals/aggregator/application/src/pages/my-apps/my-apps.component.ts),
[application store](../apps/portals/aggregator/application/src/pages/my-apps/local-application-drafts.service.ts),
[ownership](../apps/portals/aggregator/application/src/pages/ownership/ownership.component.ts),
[My Discussions](../apps/portals/aggregator/application/src/pages/my-discussions/my-discussions-api-page.component.ts).

## Settings and shell behavior

`/me/settings` redirects to `profile`. All four settings pages support local
save/cancel feedback and loading/error handling. Saving a switch does not prove
that the corresponding behavior is enforced elsewhere.

| ID / route                       | Available controls                                                                                                                                                   | Actual behavior and missing connection                                                                                                                                                                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F27 `/me/settings/profile`       | Name, biography, location, website, Twitter/X, LinkedIn, GitHub; avatar selection and preview.                                                                       | Browser profile storage, including image data URI. JPEG/PNG/WebP up to 1 MB, decoded-image validation and stale read protection. No remote avatar upload/profile API integration. OP05/OP06.                                                                                                      |
| F28 `/me/settings/preferences`   | Light/dark/system theme; date format; grid/list; 10/20/50/100 items per page; recent/popular/recommended feed order; mature-content switch.                          | Theme, preferred-date pipe, listing defaults and Explore sorting have consumers. Mature-content enforcement was not found in active catalog/feed consumers. Language/timezone, preferred/excluded facets and accessibility fields also exist in DTOs but are not all exposed/consumed. OP05/OP08. |
| F29 `/me/settings/notifications`, `/notifications` | Save channel/event preferences; receive replies, explicit discussion mentions and updates to current favorites across all four target types; page through the self inbox, mark read and open public content. | API preferences, in-app replies, mentions and favorite updates are locally qualified through real services and independent browsers, with canonical access, durable delivery/suppression/read receipts, bounded recovery and export/erasure cleanup. Mention removal/re-add preserves the original event; favorite re-add creates a fresh subscription baseline. Email, push, system alerts and deployed activation remain unfinished and explicit. OP08 remains open. |
| F30 `/me/settings/privacy` | Public/followers/private visibility and sharing; analytics/personalization settings; full retained-account export, saved-preferences export and confirmed account deletion. | API preferences, canonical audiences/approved followers and sharing consumers have local qualification. Four-source export and complete cross-service erasure now pass compiled-service/browser qualification, including durable completion, anonymous retained public content, lost responses, restart and session isolation. API deletion requires explicit consent and typed DELETE; demo deletion stays unavailable. Remaining privacy consumers, deployed activation and OP02/OP05/OP08 remain open. |
| F31 app shell and navigation     | Desktop/mobile navigation, route-specific shell sections, breadcrumbs, search context, routable dialogs, theme toggle, shared content states and not-found handling. | Real UI composition. Shell owns width; shared mixins own page spacing; aggregator theme rules belong in `theme.scss`. Saved theme follows OS preference in auto mode. Responsive/browser acceptance remains unverified in this assessment.                                                        |

Sources: [profile settings](../apps/portals/aggregator/application/src/pages/settings-profile/settings-profile.component.ts),
[preferences settings](../apps/portals/aggregator/application/src/pages/settings-preferences/settings-preferences.component.ts),
[notification settings](../apps/portals/aggregator/application/src/pages/settings-notifications/settings-notifications.component.ts),
[privacy settings](../apps/portals/aggregator/application/src/pages/settings-privacy/settings-privacy.component.ts),
[preference consumers](../apps/portals/shared/features/preferences/src/application/preferences.service.ts),
[theme service](../apps/portals/shared/cross-cutting/theming/src/theming.service.ts),
[shell](../apps/portals/aggregator/application/src/shells/app-shell/app-shell.component.ts).

The additional `me/settings/user` navigation declaration also has no matching
settings route. The wildcard presents Not Found. Route declarations, breadcrumbs,
and button labels must be reconciled as each use case becomes durable.

## Other portals

| ID / portal routes                                                                                                  | Implemented capability                                                                                                                                | Limits                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F32 Catalog: `/` -> `/catalog`, `/apps/:appSlug`, wildcard -> catalog                                               | Real BFF HTTP listing/detail requests, loading/error/404 states, app cards with logo/name/description/rating/reviews/PWA/date and detail information. | Listing requests up to 1,000 records without visible search/filter/pagination controls. Detail prints category/tag/platform IDs rather than resolved labels. No account or write workflow. BFF review totals are synthetic. Live service behavior unverified. |
| F33 Discussion: `/` -> `/discussions`, `/discussions/:discussionSlug`, `/login`, `/auth/callback`, wildcard -> list | Sample discussion cards, totals, pinned topics, opening post, tags and top-five comments; configured authentication and callback.                     | List/detail use `DISCUSSION_PREVIEW_DATA`/`DISCUSSIONS`, with simulated loading. No discussion API read/write integration. Identity management remains demo-backed.                                                                                           |

Sources: [Catalog routes](../apps/portals/catalog/application/src/routes.ts),
[Catalog detail](../apps/portals/catalog/application/src/pages/app-details/app-details.component.html),
[Discussion pages](../apps/portals/discussion/application/src/pages),
[Discussion environment](../apps/portals/discussion/application/src/environment.ts).

## HTTP capabilities

Paths here include service `main.ts` prefixes, before any ingress/gateway rewrite.
The [source inventory](readiness/functionality-inventory-2026-10-11.json) contains
every declared handler and its source line. These are implementation contracts,
not verified public deployment URLs.

| ID / service                  | Operations                                                                                                                                                                                                                | Implementation and gaps                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B01 Catalog BFF               | Under `/api/catalog`: GET `apps`, `apps/:slug`, `apps/:slug/preview`, `categories`, `categories/tree`, `tags`, `tags/:slug`.                                                                                              | Reads Editorial; filters category/tags/search, then paginates. Resolves slug by fetching records, builds category hierarchy, maps platform slugs and hashes UUIDs to numeric response IDs. No write endpoints. Full records get a synthetic slug-based review count; preview reviews are always zero. Bounds, ID contracts, fresh category metadata, and cycle handling need qualification.                                                                                                                           |
| B02 Editorial                 | Under `/api`: list/get/create/update/delete `apps`, `categories`, `tags`. Under `/api/reference`: GET `platforms`, `devices`, `socials`, `stores`, `monetization-models`, `user-spans`.                                   | TypeORM/MySQL records and relation handling, reference seeding. Actual implementation is NestJS, despite stale Strapi wording in documentation/comments. No authorized draft/review/publish workflow; mutation controllers lack guards and accept ORM-shaped inputs.                                                                                                                                                                                                                                                  |
| B03 Authenticator | Under `/auth`: POST `register`, `signin`, `signin/anonymous`, `signin/oauth`, `refresh`, `signout`, `password-reset/verify`, `password-reset/complete`; GET `methods` and configured OAuth authorize routes. GET `/validate`, `/validate-optional`. | Updated: Firebase credentials plus canonical UID/SQL lifecycle and retained events. Initial enrollment uses idempotent SQL transactions; provider operations are separate and recoverable. Public enrollment/reset DTOs and responses are bounded. Local credential emulator checks pass; production provider configuration and email verification remain open. |
| B04 Public account management | `GET /api/me`; `DELETE /api/me`; `POST /api/registration/complete`; `POST /api/password-recovery`. | Updated: side-effect-free canonical SQL account read, revision/idempotency-checked profile enrollment and retained lifecycle intents. Deletion returns accepted cleanup after an atomic tombstone/profile removal/job/event commit. Recovery requests provider delivery without exposing reset links. Isolated SQL qualification passes; verified legacy import, actual provider cleanup and full cross-domain deletion remain open. |
| B05 Account administration    | Under `/api/admin/users/:uid`: POST `disable`, `enable`, `revoke-tokens`, `unlink-providers`, `generate-password-reset-link`, `generate-email-verification-link`; PATCH `email`, `password`; DELETE user; GET `identity`. | Application service, Firebase administration ports, OPA authorization and identity events/mapping. There is no matching administration portal. Roles/policies, canonical internal identity, auditability and lifecycle convergence remain release requirements.                                                                                                                                                                                                                                                       |
| B06 Discussion management     | `GET /api/discussions`, `GET /api/discussions/:id`, POST collection, PUT/DELETE by ID; POST/DELETE `/api/discussions/comments/:id/like`.                                                                                  | List reads at most 100 Mongo aggregates ordered by activity; detail returns aggregate and nodes. Create uses the domain service; core also has `addComment` but no HTTP comment creation handler. Update patches MinIO payload; delete removes payload/node without projection cleanup. Likes use an idempotent unique actor/comment record and enforce explicit denial, but its entity is missing from the root connection's entity list. No portal integration or complete tenant/visibility/ownership enforcement. |
| B07 Service metadata/docs     | Most Nest services: `GET /api/health`, `/api/platform`, Swagger `/api/docs`. Catalog and registry also expose `/api/health/ready`. Authenticator: `/health`, `/api/platform`, `/api-docs.json`.                           | Platform endpoints describe capabilities; static health/ready responses do not verify dependencies. Registry has no other business controller.                                                                                                                                                                                                                                                                                                                                                                        |

Sources: [BFF controller](../apps/services/catalog-bff/src/app/catalog/catalog.controller.ts),
[BFF composition](../apps/services/catalog-bff/src/app/catalog/catalog.service.ts),
[Editorial client](../apps/services/catalog-bff/src/app/catalog/clients/editorial.client.ts),
[Editorial controllers](../apps/services/editorial/src/app),
[authentication/validation controllers](../sdk/features/identity/applications/authenticator/service/src/controllers),
[account controllers](../sdk/features/identity/applications/management/service/src/app/controllers),
[account administration](../sdk/features/identity/applications/management/service/src/app/services/account-management-app.service.ts),
[discussion controller](../sdk/features/discussion/applications/management/service/src/app/discussions/discussions.controller.ts),
[discussion connection](../sdk/features/discussion/applications/management/service/src/app/app.module.ts),
[discussion repositories](../sdk/features/discussion/applications/management/service/src/app/discussions/discussions.module.ts).

## Workers and integrations

| ID / worker                 | Trigger and behavior                                                                                                                                                                             | Dependencies and unfinished behavior                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W01 Store.app scraper       | Puppeteer reads the application list and details; emits raw records and media jobs. Standalone list/detail developer entrypoints can write local JSON. Kubernetes job/cronjob manifests exist.   | External Store.app DOM/data, browser runtime, RabbitMQ. Build entrypoint is `apps-scrapper.ts`, not the separate V2 detail utility. Needs source-change handling, bounded retries, duplicate/update policy and pipeline acceptance. Optional to core product operation.                                                                                                                   |
| W02 Editor agent            | Consumes `catalog-raw-record-processing`; loads Editorial reference maps; uses AI-selected slugs to associate category/tags/platforms/devices/monetization; creates or updates a record by slug. | RabbitMQ, OpenAI, Editorial. One consumer item at a time, at least 30 seconds between processing; retries up to five with backoff. Rejection before republish and no broker confirms leave a loss window; exhausted jobs are discarded without a demonstrated DLQ. String-matching fallback exists if enrichment fails. No human review stage or validated provenance of generated facts. |
| W03 Media ingestion         | Consumes raw media jobs, downloads bytes, deduplicates using URL hash/object existence, uploads metadata and content into MinIO `media-storage`.                                                 | RabbitMQ, external source URL, MinIO. Failure is rejected without requeue; download code lacks explicit size/time bounds. No complete portal upload/ownership flow or media-to-published-record lifecycle is proved.                                                                                                                                                                      |
| W04 Discussion materializer | Consumes `discussion.materialization.requested` envelopes; resolves MySQL relations/root/depth, loads MinIO payload, upserts Mongo nodes and aggregates, records applied event ID.               | MySQL, RabbitMQ, MinIO, MongoDB. Applied-event guard and counters are separate operations; retries can repeat effects. Invalid messages are unconditionally requeued; edit/delete don't emit matching updates. Rebuild/replay, bounded retries and shutdown remain unfinished.                                                                                                            |
| W05 Discord notifier        | `!devstatus`, `!register`, `!unregister`, `!channels`; scheduled development reports; JSON channel registry with provisioned persistent volume.                                                  | Discord, GitHub commits/workflows/PRs, ArgoCD health/sync, RabbitMQ statistics, OpenAI summarization. Fetch errors fall back to empty datasets, which can be mistaken for no activity. External integrations unverified. This is an operator tool, not user notification delivery.                                                                                                        |

Sources: [scraper entry](../apps/scrappers/store-app/src/apps-scrapper.ts),
[scraper targets](../apps/scrappers/store-app/project.json),
[editor entry](../apps/agents/editor/src/index.ts),
[enrichment](../apps/agents/editor/src/application/services/data-enrichment.service.ts),
[media worker](../apps/services/media-ingestion/src/application/media-ingestion.service.ts),
[downloader](../apps/services/media-ingestion/src/infrastructure/image-downloader.ts),
[materializer](../sdk/features/discussion/applications/materializer/service/src/index.ts),
[Discord entry](../apps/agents/discord-notifier/src/index.ts),
[report generation](../apps/agents/discord-notifier/src/note-generator.ts).

The two principal asynchronous paths are:

```text
Store.app -> scraper -> raw-record queue -> editor -> Editorial/MySQL -> Catalog BFF
                    -> raw-media queue -> media worker -> MinIO

Discussion command -> policy -> MySQL node/relations + MinIO payload
                   -> projection queue -> materializer -> MongoDB read model
```

These arrows describe code connections. They are not atomic transactions or proof
of successful live delivery. Identity events are published separately from
account/provisioning writes and need the same recovery discipline.

## Shared features, domain contracts, and UI support

This table accounts for every directory in `apps/portals/shared/features`. A
feature name or an injectable `ApiService` does not by itself mean a live API.

| Feature directories                                         | Responsibility and present status                                                                                                                                                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `application-overview`                                      | Overview port/local/BFF adapters, display components, local discussion store. Mixed Backend/Sample/Local.                                                                                                         |
| `articles`, `attribution`, `changelog`, `review`, `suite`   | Rating/author/attribution/release/review/member presentation; not authoring or publishing services.                                                                                                               |
| `categories`, `tags`, `listing`                             | Reference/listing ports, providers, DTO/view mappings; local/BFF alternatives. The active generic results page still bypasses the HTTP listing provider.                                                          |
| `compatibility`, `platform`, `pricing`, `social`, `metrics` | Platform/device/pricing/social/estimated-user options and badges backed largely by static data. `platform` is a re-export of compatibility. Pricing here describes listed apps, not Wapps subscriptions/payments. |
| `filtering`                                                 | Route-driven filter models, URL mapping and option tokens; no search persistence engine.                                                                                                                          |
| `search`                                                    | Fixture search, query processing, local recent searches.                                                                                                                                                          |
| `multi-search`                                              | Grouped search input/result presentation wired to mock search data.                                                                                                                                               |
| `smart-search`                                              | Mock service constructs query-named results, random counts and fixed recommendations; not semantic/AI search.                                                                                                     |
| `discovery-search-result`                                   | Result containers/mappers; adapters are empty-result stubs or an `api.example.com` placeholder. Not the active Discover engine.                                                                                   |
| `discussion`, `feed`, `health-status`                       | Thread/feed/status presentation and actions; pages supply local/sample content. No customer-wide event, monitoring or notification backend.                                                                       |
| `identity` | Updated: authentication state/guards/scoped refresh, explicit API/demo configuration, validated OAuth callback port, real registration/recovery/reset/account adapters and asynchronous form state. Complete profile/settings integration, email verification and cross-domain deletion remain open. |
| `my-profile`, `my-favorites`, `preferences`                 | Local persistence, state and form orchestration. Configurable API URLs currently do not supply durable server implementations.                                                                                    |
| `user-profile`                                              | Badges and profile state contracts; adapter returns default profile and synthetic update success. Active profile directory uses fixtures directly.                                                                |
| `sharing`                                                   | Browser share/copy/link generation with fallback and error handling.                                                                                                                                              |
| `voting`                                                    | Signal-based up/downvote interaction. Feed local storage and backend comment likes are separate mechanisms; no unified durable vote service.                                                                      |

See the [directory manifest](readiness/functionality-inventory-2026-10-11.json)
for source roots. In addition, portal boundaries provide HTTP/navigation/routing;
cross-cutting code provides configuration/environment/theming. The notification
cross-cutting project remains scaffolding. Its export to absent presentation code
has been removed; notification presentation and delivery remain unimplemented.
`libs/ui` supplies reusable layout, cards, filters, search, forms, navigation,
dialogs, profiles, status, discussion, voting and chat primitives. Generic chat
and chat-input components are not evidence of a messaging service.

Domain and SDK code separates modeled intent from delivered capability:

| Area                                                 | Existing concepts and implementation boundary                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Catalog domains                                      | Records, categories, tags, compatibility, pricing, media, metrics, contact, ownership, references, search and versioning DTOs/ports. `RecordService.addRecord` builds graph relations and requests projection, but no active Editorial caller was found. It also writes after `ok(false)`, reproduced by the readiness checks. |
| Customer domains                                     | Profile/favorite/preference models and ports. Their breadth exceeds the active server APIs; Angular dependencies in some domain contracts violate the intended boundary.                                                                                                                                                       |
| Publication/discovery/feed/reliability               | Article/attribution, grouped discovery results, seven feed item types and health status models. No complete article/review/release/monitoring backend follows merely from these types.                                                                                                                                         |
| Acquisition/publishing/monetization/filter scaffolds | Acquisition names event concepts; publishing/monetization/filter exports are largely empty. No billing, payment, or workflow engine should be counted as delivered.                                                                                                                                                            |
| SDK kernel                                           | Result/application shell, primitives, event envelopes, identity/content/authority/governance/workflow nodes and relations. These are shared contracts; they do not implement a complete registry or administration product.                                                                                                    |
| SDK identity/discussion                              | Authentication and management use cases, Firebase/OPA integrations, discussion creation/comment domain logic and backend applications. Policy bundles distinguish supported actions/roles; resource ownership and tenant enforcement must be completed in application use cases.                                               |
| Infrastructure                                       | MySQL/Mongo/MinIO clients; older platform-queue adapter and newer queue port/RabbitMQ adapter coexist. Each consumer's acknowledgement, durability and recovery behavior requires verification.                                                                                                                                |

Sources: [domain layout](../libs/domains), [record use case](../apps/services/editorial/src/app/application/editorial-commands.ts),
[kernel](../sdk/kernel), [SDK conventions](../sdk/README.md),
[discussion policy](../sdk/features/identity/packages/infrastructure/opa/src/discussion.policy.ts),
[architecture](../architecture-abstract.md).

## Data ownership and persistence

| Data                                            | Current location                                                                                                | Engineering consequence                                                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Application/catalog reference records           | Editorial MySQL; independent portal fixture sets                                                                | Choose canonical IDs/contracts and make all reads agree with authoritative updates.                                    |
| Account/identity                                | Firebase; authenticator identities; separate management identity nodes/subjects and Mongo account/profile stubs | Reconcile canonical identity and lifecycle before attaching new private data.                                          |
| Portal profile/preferences/favorites            | `wapps.my-profile.v1`, `wapps.preferences.v1`, `wapps.favorites.v1` in localStorage                             | Same-browser persistence, not account isolation or cross-device sync.                                                  |
| Suite drafts/application drafts/ownership notes | `wapps.suite-drafts.v1`, `wapps.aggregator.application-drafts.v1`                                               | Local-only authoring; private draft lifecycle/publication still needed.                                                |
| Local topics/replies                            | `wapps.local-discussions.v1`                                                                                    | Fixed local author; separate from the server discussion graph and projections.                                         |
| Search/vote/helpful state                       | `aggregator.recent-searches`, `wapps.feed-vote.<id>`, `wapps.review-helpful.<slug>`                             | Local personalization/interactions; no global counts or account privacy guarantees.                                    |
| Server discussions                              | MySQL nodes/relations/likes, MinIO payload, Mongo projections                                                   | Authoritative vs derived ownership is recognizable, but multi-store failure/replay/edit/delete behavior is incomplete. |
| Media                                           | MinIO objects keyed by source URL hash                                                                          | Asset ingestion exists; publication association, ownership and retention lifecycle remain to be proved.                |

## Functionality acceptance handoff

The implementation order in the readiness report is now grounded in these feature
groups. For each group, the next evidence must cross its missing boundary:

1. **Security and executable checks (OP01/OP03):** denial must stop writes for
   discussion/comment/record use cases; protected Editorial/discussion mutations
   must reject unauthorized actors; supported workspace checks must be reliable.
2. **Identity and real discovery (F01-F05, F09, F17-F19; OP02/OP04):** create a real
   user, authenticate/recover, then search/open the same real catalog data with
   agreed filters and IDs, including direct URLs and outage states.
3. **Durable personal state (F20-F25, F27-F30; OP05/OP06):** change data in one
   authenticated session and verify it from another after restart; exercise
   isolation, draft transitions, ownership review and rejection paths.
4. **Shared content (F06-F16, B06, W04; OP07/OP09):** publish/read actual content,
   exchange replies, moderate/edit/delete and observe convergent lists/feed;
   ratings and status must derive from real records/observations.
5. **Preferences and notifications (F28-F30; OP08):** demonstrate enforcement and
   intended delivery rather than merely saved settings. Decide explicitly which
   currently modeled-only fields are in release scope.
6. **Deployment qualification (OP10):** exercise the selected portals/services,
   migrations, restart/replay, backup restore, rollback and measured workload.
   Optional workers get separate qualification before being enabled.

No percentage of product completion is inferred from route counts, handler counts,
or passing fixture tests. A feature closes when its stated user journey and failure
cases meet the operational definition with recorded evidence.
