# Full operation implementation

Branch: `codex/full-operation`, created October 11, 2026 from `c965790e`.
The assessment and existing recording-related working changes were carried
forward without reverting them. Historical evidence remains in
[the readiness assessment](OPERATIONAL-READINESS.md) and its dated JSON snapshot.

## Completion target

Implement the full operational scope in [readiness](OPERATIONAL-READINESS.md)
and [the functionality map](FUNCTIONALITY-MAP.md). Materialization follows
[the explicit contract](MATERIALIZATION.md) and the separate repository rule.
Local/unit evidence does not close live integration or recovery gates.

## Work sequence

1. Authorization, application/domain boundaries and safe materialization (OP01,
   OP09); establish executable checks for each change.
2. Repair workspace/CI checks and canonical identity/account flows (OP03, OP02).
3. Real catalog and durable personal workflows (OP04, OP05).
4. Authorized submission, ownership, editorial publication and media (OP06).
5. Complete content/community and notification/preference behavior (OP07, OP08).
6. Qualify deployment, migrations, restart/rebuild, restore and rollback (OP10).

## Current slice

Account export and cross-service account erasure are now locally qualified end to
end, including the API-mode privacy page. Erasure closes the account, ends ownership
access, removes private data and credentials, and retains public contributions with
anonymous attribution. Completion requires exact durable receipts from Account,
Editorial and Discussion plus credential cleanup. The checkpoint below supersedes
older statements that the portal action is disabled or that Editorial still blocks
the complete workflow. Those statements remain historical evidence of earlier slices.

**In-app reply, favorite update and discussion mention notifications are locally
qualified end to end.**
The canonical account inbox now also receives public application, suite, article
and discussion updates, including releases on saved applications. Baselines,
subscription generations, durable suppression/read decisions and current visibility
prevent historical, removed or hidden content from resurfacing. Explicit member
selection now delivers mentions from topics, replies, quick dialogs and article
comments, preserving one notification per post/recipient through edits and retries.
**The real Explore activity feed is now locally qualified**, with six public
content kinds, current visibility, saved category exclusions and page-local ranking.
**API-mode Digest is also locally qualified**, with independently selected real
activity, articles, applications and discussions, saved choices and current links.
**API-mode application timelines are now locally qualified**, with five current
public activity kinds, application-bound paging and real content links.
**HTTP-only application health is now locally qualified**, with durable observations,
staff configuration, current visibility, coverage and truthful unknown/stale states.
**API-mode grouped Discover is now locally qualified**, with real application,
article and suite groups, bounded independent pagination and current public links.
Mature-content classification is now locally qualified through author proposal,
frozen submission, independent approval and Discover preference filtering. Public
application catalog listings/overviews and article/suite lists/details now also
enforce it, including individual suite members and account/preference changes.
Application discussions/reviews, quick dialogs, release notes, health and timelines
now also enforce their parent application's classification through the shared
current-session reader. Their child content and metadata clear when the parent is
hidden or preferences are loading/unavailable. **Home grouped search previews are
now locally qualified**, including current-account refresh, canonical tag labels,
bounded source counts, keyboard links and preference/search retries. **Individual
Explore, Digest and application timeline items now also enforce approved content
classification**, with real saved preferences, hidden counts, all-hidden page
continuation and session/failure recovery locally qualified. **Favorite content
preferences are now locally qualified**, including all four saved kinds, filtered
routes, the sidebar, account isolation and removal while details are hidden or
unavailable. Profile and notification classification integrations remain open.
Other event types/channels,
remaining content/privacy preference consumers and discovery work
and all required operational gates remain in the full-service goal.

Previously qualified publication, ownership/media, community, favorites, account,
public-profile/audience, activity and badge workflows retain their dated evidence
below. No OP01-OP10 gate is closed by this checkpoint. Production ingress/credentials,
legacy inventory and writer fencing, coordinated restore/rollback, load/soak and the
complete release gate still require qualification. No production activation occurred.

Confirmed product policies remain unchanged: application ownership needs domain
proof and independent staff approval, with future content changes reviewed; followers
need owner approval; staff award/revoke badges with reasons; account erasure retains
public contributions anonymously while removing private data and ending ownership.
Application health uses HTTP checks only, without owner-written incident notices.

## Favorite content preferences checkpoint (October 13, 2026)

Status: **implemented and locally qualified; stopped for the requested review**.
The broader autonomous goal remains paused. See
`favoritesContentPreferencesCheckpoint` in the dated evidence JSON. Earlier feed
and Home checkpoints retain their original evidence and scope.

The favorites page and auxiliary sidebar now apply the current account's completed
content preferences to applications, suites, articles and discussions. Discussions
inherit their current public application's classification. With mature content
disabled, only approved General metadata appears; excluded references retain a
generic label and removal control without names, images or target links. Counts
respect the selected favorite kind. Same-document settings saves update both
consumers. Session/account checks cancel old reads and synchronously mask stale
snapshots, without comparing independent feature session counters.

Preference loading/failure, metadata failure, hidden selections and empty favorites
stay distinct. Retry reloads the current choice, and removal remains available when
preferences or target services fail. Removals of all four kinds survive Account/BFF
restart and an independent browser. Private suite edits do not change approved
classification; frozen staff approval, projection lag and canonical rebuild are
covered. Parent reclassification changes discussion visibility without rewriting
its projection.

- **775 distinct tests / 84 suites** pass: favorites 58/2, shared feed 30/8,
  aggregator 349/53 and Account Management 338/21. Affected lint and source/spec
  typechecks pass. Account HTTP tests pass with local-listener permission after a
  retained sandbox failure. Corrected test expectations and lint failures remain
  in the earlier logs; final favorites checks pass.
- Uncached favorites/aggregator/CSR builds plus **87 prerequisite tasks** pass,
  with their three outputs preserved/cleared. Account was separately rebuilt with
  **25 prerequisite tasks**; its previous output is preserved. Final artifact
  inspection passes **57 Angular packages** after dependent builds finish.
  Architecture/inventory pass: **137 projects / 1,704 sources / zero violations**.
  Existing warning debt remains; Angular templates were hand-edited.
- Final local qualification passes **16 service/browser check groups** and
  **42 measured layouts**, including 36 favorites layouts across six states at
  390/768/1440 in both themes. Header gaps are 24px, controls fit and no horizontal
  overflow occurs. **Seven final screenshots were inspected**, covering all six
  favorites states, three widths and both themes.
- The **3,808-file** executable/config snapshot matches the isolated installation:
  SHA256 `6966d18dea7170c3cb3c1041f6ea3b483d9ee09fb5c7cdc3fdff79c7a59f4be4`.
  Earlier successful builds/tests are reused for unchanged behavioral inputs;
  later changes are sidebar formatting, tests and qualification harnesses. Final
  runtime qualification uses the recorded source and compatible Account binary.

Evidence: `/tmp/wapps-readiness/favorites-content-preferences-runtime-3/` and the
`favorites-content-preferences-*` logs/source verification. Runtime 1 exposed an
old Account binary rejecting classified selection responses. Rebuilding Account
resolved it. Runtime 2 passed the earlier scenarios but its final parent-change
assertion used the original classification; that expectation was corrected. Its
first light capture also preceded theme settling; final captures wait for theme
scopes and card surfaces. All failed runs are retained.

Materialization: canonical account references and ordinary authorized removal
commands remain unchanged. No new write format, migration, projection, outbox,
worker, secret or backup dataset is introduced. Selection APIs still enforce
current public authority and exact projection revisions. **Account is a strict
classification consumer too**: upgrade compatible Account/BFF/portal consumers
before producers or coordinate activation; rollback must preserve a compatible set.

Limits: real local Account/Editorial/Discussion/BFF, SQL/Mongo/MinIO and OPA are
covered. Trusted ingress identities are substituted, materializers run directly
and external browser traffic is blocked. Production identity, broker delivery,
provider delivery, restore/rollback/load/soak and the complete release gate remain
unverified by this slice. No OP gate closes, and no deployment, commit or push
occurred. Review this checkpoint before starting profile/notification preference
consumers or the remaining full-service work.

## Individual feed content preferences checkpoint (October 13, 2026)

Status: **implemented and locally qualified; remaining consumers and all
full-service gates remain open**. See `feedContentPreferencesCheckpoint` in the
dated evidence JSON. This supersedes the earlier next-step statements about
individual Explore/Digest/timeline classification, while preserving their evidence.

Applications, articles and suites retain their own approved classifications in
activity responses. Releases, topics and reviews inherit the current application
classification, with final parent checks protecting reads from concurrent changes.
General application timelines preserve the separate classification of each suite.
Private changes stay private until independent approval of the frozen submission;
projection lag fails closed and canonical rebuild exposes the approved result.

One shared current-session choice service binds all three feed readers to completed
preferences and to favorites only when personalized recommendation ordering uses
them. Saved changes inside the same running portal, account switches, preference
loading/failure and late responses clear or replace content correctly. Filtering
precedes ranking, preserves bounded source continuation and reports hidden counts.
Digest filters four independent source groups; an empty latest group does not erase
its General articles, applications or discussions. An all-hidden ten-item Explore
or timeline page retains Older activity and browser Back. Settings describe these
consumers. The API feed has a themed surface above Home's decorative frame so its
controls, hidden notices and empty/error states remain readable.

- **1,800 tests / 173 suites** pass across feed domain/shared feature, Editorial,
  Discussion Management, BFF and aggregator, with affected lint/typechecks and
  explicit BFF source/spec compilers. Later changes are harness corrections,
  settings wording and presentation styles; behavioral TypeScript stays unchanged.
- Seven requested uncached builds plus **95 prerequisite tasks** pass after
  preserving/clearing their outputs. Settings wording is rebuilt in the portal;
  the final surface change is rebuilt through the shared feed, aggregator and CSR
  plus **87 prerequisite tasks**, with their three outputs preserved/cleared.
  Final inspection passes **57 Angular packages**. Architecture/inventory pass:
  **137 projects / 1,704 production sources / zero violations**. Existing lint,
  Angular and bundle warnings remain debt; Angular templates were not formatted.
- Final integrated qualification passes **21 service/browser check groups** and
  **78 measured layouts** at 390/768/1440 in both themes, including 60 new mixed,
  hidden, preference-failure and reclassified-parent states. New page headers have
  the required 24px content gap; controls fit and no horizontal overflow occurs.
  **Ten final screenshots were visually inspected**, covering every new state.
- The **3,806-file** executable/config snapshot matches the isolated installation:
  SHA256 `89a6be9b682440e7778fc2844c9642075772583058db93f89edcca22a083b428`.
  Earlier passed checks are reused only for unchanged inputs; final frontend
  artifacts and runtime evidence include the surface fix.

Final evidence: `/tmp/wapps-readiness/feed-content-preferences-runtime-4/`, the
`feed-content-preferences-*` logs and source verification under the same evidence
root. Run 1's failure is retained: an old timeline cancellation test selected a
removed breadcrumb. Runs 2 and 3 passed functional checks; subsequent screenshot
review corrected capture position and found the Explore surface readability defect.
Only run 4 is the final visual qualification. Previous Home evidence is unchanged.

Limits: Account preferences, author/staff commands, Editorial/Discussion reads,
SQL/MinIO/Mongo and policy use real local services. Gateway identities are trusted
test substitutions, external browser traffic is blocked, and production
materializer functions run directly; this does not requalify broker delivery or
production ingress. Original fixtures stay unclassified; new variants use real
submission and independent approval. Legacy release inheritance is checked as
unclassified; focused service tests cover release parent changes/confirmation races.
Production migration, restart/restore/rollback/load/soak and all OP gates remain open.

No new write, migration, projection, journal, worker or secret is introduced.
Updated consumers accept missing classification, but older strict consumers reject
the added field: deploy compatible feed consumers before producing services or
coordinate activation, and keep rollback versions compatible. No deployment,
commits or pushes occurred. Next: favorites content choices, then profile and
notification content choices and the remaining privacy consumers.

## Home grouped preview checkpoint (October 13, 2026)

Status: **implemented and locally qualified; remaining preference consumers and
all full-service gates remain open**. See `homeGroupedPreviewCheckpoint` in the
dated evidence JSON. This supersedes older statements that Home previews are next.

API-mode Home uses the existing public-discovery port for one bounded request with
up to three applications, articles and suites. It preserves exact source totals,
reports hidden entries on that bounded page and keeps all-hidden groups navigable.
Links open the actual application/article and canonical suite UUID. Display tags
come from optional canonical `tagNames`, never filter IDs/slugs. Missing names in
older responses produce no invented badges. Explicit demo mode remains separate.

Current-session preferences and category exclusions invalidate the same search
phrase. Loading, failure and account changes cancel old reads and clear content;
late replies cannot restore it. Blank/empty/invalid searches are distinct. Retry
keeps focus on the search input, and a removed retry button no longer triggers the
outside-click handler and closes the results. Device-local recent searches remain
unchanged. This is read composition with no new write, projection, migration or worker.

- **474 distinct tests / 65 suites** pass across discovery, BFF, search, multi-search
  and aggregator, with affected lint/source/spec compilers. The BFF HTTP suite
  passes after rerunning with local-listener access; its sandbox failure is retained.
- Five requested uncached builds plus **86 dependency tasks** pass after preserving
  and clearing five outputs. Inspection of **57 Angular packages**, inventory and
  architecture checks pass: **137 projects / 1,703 sources / zero violations**.
  Readiness-tool lint passes with two existing warnings; other recorded warnings
  remain debt. Angular templates were not formatted.
- Final discovery qualification passes **10 service groups, 21 browser checks and
  192 measured layouts**, including 42 Home states. The catalog regression passes
  persistence, live taxonomy, rename/deletion, outage, restart/rebuild and **42 layouts**.
  Ten final screenshots were visually inspected, including readable tag labels,
  keyboard access to the last suite and both error states.
- The **3,803-file** executable/config snapshot matches the isolated installation:
  SHA256 `d3b2ee0a0ac9483a2dfd0661f6d51a0b4f811c9d023f3c581716e877e7c2d058`.
  Discovery/build checks used the preceding `69c2c28a...` snapshot; the only later
  source change sorts the catalog test's badge labels before exact comparison.
  Production sources and the discovery harness are identical; the affected catalog
  run was repeated. The exact delta is recorded with the evidence.

Final reports: `/tmp/wapps-readiness/home-grouped-preview-discovery-runtime-8/`
and `/tmp/wapps-readiness/home-grouped-preview-catalog-browser-5/`. Earlier failed
runs remain available and are not counted as passes. They identified two real retry
interaction bugs, the tag-ID presentation defect and corrected harness assumptions.

Limits: trusted ingress identities and shell/profile/preferences remain fixtures;
this does not requalify Account preference persistence or production identity.
Catalog materialization is invoked directly, and external browser traffic is blocked.
The discovery harness has no Explore/Discussion/health/timeline child sources; their
failure states are expected and do not qualify those feeds. Catalog fixtures use
controlled General classification; independent approval is tested in the discovery
run. New portals accept responses without `tagNames`, but older strict consumers
reject the added response field: upgrade consumers before BFF or coordinate activation.
No deployment, commits, pushes or OP gate closure occurred.

Next: approved classification on individual Explore/Digest/timeline items, followed
by favorites/profile/notification and remaining privacy consumers.

## Application subpage preferences checkpoint (October 13, 2026)

Status: **implemented and locally qualified for parent application filtering in
discussions, reviews, quick dialogs, releases, health and timelines; individual
feed items, other preference consumers and all full-service gates remain open**.
See `applicationSubpagePreferencesCheckpoint` in the dated evidence JSON.

A shared host-owned reader composes `ApplicationOverviewService`, preserving the
existing classification rule and API/demo provider boundary. Results bind to the
exact route and current preference choice. All six hosts now mask old parent
metadata and child views during loading, account changes and failed preferences;
late results cannot restore them. Missing, hidden, preference failure and catalog
failure have separate states and appropriate retry. Discussion titles are also
gated. Closing the release reader cancels both current and previous-release reads;
clearing health selection prevents the periodic refresh from restoring its data.
Private author/staff use cases and canonical API authorization are unchanged.
There is no new authoritative write, projection, migration, outbox, worker or secret.

- Targeted evidence across the affected projects: **614 tests / 75 suites**,
  source/spec compilers and lint. The added five-page composition suite initially
  lacked the routes' breadcrumb fixture; correcting that fixture passes all five
  tests and the final aggregator spec compiler. The retained failed run is not a
  passing gate. Release cancellation and cleared health refresh have dedicated tests.
- Five affected Angular outputs were preserved and cleared. Uncached builds pass
  for five requested projects and 85 prerequisites; all **57 Angular packages**
  pass artifact inspection. Existing lint and bundle/style warnings remain debt.
- Architecture and inventory checks pass: **137 projects / 1,703 production
  sources / zero violations**. Readiness tooling lint passes with two existing
  unused-variable warnings. Manual review confirms pages compose the shared reader,
  adapters retain HTTP concerns, and display classification grants no permission.
- The discovery/public-content run passes ten real-store check groups and sixteen
  browser checks with **150 measured layouts**, including 36 new subpage states.
  Approved General/Mature/unclassified parent reads use actual Editorial/BFF APIs;
  hidden parents make no child-content requests. Account switching, preference
  outage/retry, generic metadata and author/reviewer regressions pass.
- The separate Discussion run passes **27 real-service check groups**, seven browser
  checks and **96 measured layouts**, including twelve new hidden/preference-error
  dialog states. It uses real MySQL/Mongo/RabbitMQ/MinIO/OPA and compiled services.
  Reviewed classification changes, exact reply retry, conflicts, moderation,
  account switching, process restart, broker rebuild, withdrawal and article-comment
  regressions pass. Ten screenshots across both runs were visually inspected.
- The **3,802-file** executable/config snapshot matches the isolated Node 22.17.1
  installation: SHA256 `d1a64582a514264f12ed717308fe2eebf031a381253c04c3d88f9275a433db50`.
  Reports and logs use `/tmp/wapps-readiness/application-subpages-`; the preceding
  completed public-content snapshot remains unchanged.

Limits: ingress identities and shell/profile/preferences remain local fixtures;
this does not newly prove Account preference-save persistence. The discovery run
does not configure the Discussion/health/timeline services and tests their allowed
failure states; the separate Discussion run qualifies real child interactions.
Earlier release/health/timeline service evidence remains scoped to those workflows.
Catalog materialization uses the production materializer directly, while Discussion
delivery/rebuild uses the real broker. External browser traffic remains blocked.
Production activation, restore/rollback, load/soak and OP01-OP10 remain open. No
deployment, commits or pushes occurred. Angular templates were not formatted.

Next: complete Home previews with current-account/preference refresh and grouped
application/article/suite results, then individual feed/timeline items and
favorites/profile/notification consumers.

## Public content preferences checkpoint (October 13, 2026)

Status: **implemented and locally qualified for application catalog listings and
overviews, article lists/details and suite lists/details; remaining consumers and
all full-service gates remain open**. See `publicContentPreferencesCheckpoint`.

The shared public-content preference service requires a completed read for the
current session. API consumers clear previously visible content on account changes,
preference loading/failure and changed choices, and reject late responses. Application
listing/overview adapters now preserve the approved classification. Disabled members
and guests see only General publications; Mature and unclassified detail pages show
generic hidden states without the title, body, images, comments or favorite controls.
Lists retain source totals and explain the number hidden on the current bounded page.
General suites resolve each member separately and distinguish hidden member metadata
from unavailable applications. Private authoring and staff review remain accessible
under their existing authorization. No new authoritative write or projection is added.

Qualification uses the isolated Node 22.17.1 installation and compiled portal,
Editorial and BFF against real MySQL/Mongo/OPA. All three public catalogs and detail
views pass independent enabled/disabled/guest sessions, account changes, preference
outage/retry and mixed suite members. Existing frozen-approval, denial, rollback/retry,
stale projection, export, migration and process restart checks pass. The fixtures add
taxonomy through its authorized API and restore reviewed classification through fresh
submission/approval. Author/reviewer and grouped Discover regressions also pass.

- **529 tests / 71 suites** pass across the affected features and aggregator, with
  affected lint/source/spec compilers and builds. The suite spec compiler was run
  explicitly, and its final 19-test/two-suite regression passes after a literal-type
  fixture correction. No runtime production fix was needed after these checks.
- Eight Angular outputs were preserved and cleared; uncached builds pass for ten
  requested projects and 90 prerequisites. Inspection of 57 Angular packages passes.
- Architecture checks: **137 projects / 1,701 production sources / zero violations**.
  Inventory and the final readiness-tool lint pass. Existing warnings remain debt.
- Real-store report: ten groups; browser report: thirteen checks and **114 measured
  layout states**, including sixty new public-consumer states across three widths
  and both themes. Ten final screenshots were visually inspected; no blocking
  layout findings. The exact inspected files are recorded in the dated JSON.
- Final executable/config snapshot: **3,794 files**, SHA256
  `ae58826c74a9721bdf68f3b7c24d8636421654f73c9014a1d789b4c970f4d6ef`.
  Independent source verification matches the workspace and isolated installation.

Reports: `/tmp/wapps-readiness/public-content-runtime-final/{qualification,browser}.json`.
Logs and clean-output/source metadata use the `public-content-` prefix. Earlier
failed runs remain recorded: wrong formatter/checker paths, missing required template
inputs, a missing test import and widened fixture literals, a correctly denied
taxonomy fixture actor and a nonadjacent listing-spacing measurement. Corrected
checks pass; failed runs are not counted as passing evidence. Templates were not
formatted. No deployment, commits or pushes occurred.

Substitutions remain explicit: local trusted ingress identities, shell/profile/
preference fixtures, direct production materializer invocation and blocked external
browser traffic. Member choices here are fixtures, not renewed proof of Account
preference persistence. Discussion comments on allowed articles are unavailable in
this harness; the check proves that hidden articles do not mount them. Production
credentials/ingress, broker delivery, restore/rollback/load/soak and all OP gates
remain open.

Next: complete preference enforcement in application subpages and dialogs, then
Home previews, Explore/Digest/timeline, favorites/profile/notification consumers.
Home previews now inherit filtering on a new catalog request, but their complete
account/preference refresh and grouped-preview behavior remain unfinished.

## Content classification and Discover checkpoint (October 13, 2026)

Status: **implemented and locally qualified; other public consumers and all
full-service gates remain open**. See `classificationDiscoverCheckpoint`.

Applications, articles and suites now preserve optional General/Mature classification
through private authoring, frozen submission, staff approval and exact-revision
publication. Missing classification remains unclassified. Discover shows only
General when mature content is disabled, including for guests, with unchanged
source totals and explicit per-page hidden counts. Other public consumers remain
unfinished; this is not service-wide enforcement.

Real-store qualification passes against MySQL/Mongo/OPA and compiled Editorial/BFF:
owner/tenant denial, independent review, private edits after submission, approval
transaction rollback after an outbox failure, identical retry, projection lag,
stale replay, canonical account export, direct privileged writes invalidating
classification, migration replay/recorded-loss refusal and service restart.
The browser run passes 54 layout states and independent-session author/reviewer
journeys. Member mature choices in this harness are explicit preferences fixtures;
the run does not newly qualify Account preference persistence. Reports are in
`/tmp/wapps-readiness/classification-runtime/{qualification,browser}.json`.

The existing ownership workflow also passes, including real DNS proof, frozen
classification through verified-owner editing, canonical comparison, conflicts,
grant changes and 180 layout states. Reports are in
`/tmp/wapps-readiness/classification-ownership-runtime/`. Seventeen screenshots
across the changed forms/results, three widths and both themes were visually
inspected. Automated checks cover 234 layout states across the two workflows.

Real-store checks found and fixed omitted classification columns in private/public
account-export SQL and a fixed-field article submission/approval copy that dropped
classification. The corrected Editorial build/source/spec compilers/lint pass.
The previous full Editorial test run passes 800 tests/64 suites; the final adapter
copy fix is additionally covered by the real-store journey. Search correction passes
26 tests/four suites and typechecking. Architecture scans 137 projects/1,700 sources
with zero violations; inventory and 57 Angular artifact checks pass. Existing
warnings remain. The initial sandbox HTTP test failure was loopback EPERM; a
permitted rerun passed. All full-service and deployment gates remain open.

The integration run passes **1,718 tests / 156 suites**. Ten affected declared
outputs were moved aside before the uncached five-consumer/39-prerequisite build;
all builds and the final 57 Angular package inspections pass. The final executable
snapshot has 3,790 files, SHA256
`a6818187233c506134dde67e5d1dc0c6958bce74c9c4adb01943e9d03ed874e3`, and matches
the isolated Node 22.17.1 installation after qualification.

Next: enforce classification in public application/article/suite listings and detail
views, including suite members and session/preference changes, then the other public
consumers. The migration/writer-fencing/rollback contract is in `MATERIALIZATION.md`.

## Grouped Discover workflow (October 13, 2026)

Status: **implemented and locally qualified; deployment and full-service gates remain open**.

`/discover` now composes all three public catalogs through BFF
`GET /api/catalog/discover`. Every selected group has an independent page, actual
source total, current identity/revision, summary, date and real detail link. Search
matches application names/descriptions/slugs and article/suite titles, case
insensitively with literal wildcard escaping. Public publication readers now accept
explicit bounded page sizes and name/name-desc/newest order; omitted options retain
their previous defaults. Private drafts and edits cannot replace approved results.

The pure discovery contract normalizes `search`/`q`, singular/plural type names,
repeated facets and legacy page aliases. It bounds search to 100 characters, page
size to 1-100 and each page to 1-10,000. Application facets remain canonical;
articles support one category and tag. Mixed-type facet queries and suite taxonomy,
social/user-count filters and unsupported orders are explicit input errors. No
filter is silently discarded. An out-of-range publication page gets at most one
correction, with a consistency check; no whole-catalog pagination loop is used.

Pages depend on a shared application service/port, with API providers selected at
the root and the existing explicit demo composition retained. Saved page size,
grid/list view and date format apply; explicit URL choices take precedence. Category
exclusions filter the current page and display a hidden count without rewriting
the source total. Preferences loading/failure and account/query changes clear old
results. Recent phrases remain explicitly local device history. Mature filtering
is not claimed. Home search previews still use the existing application-only API
provider and remain a follow-up consumer.

The read workflow introduces no new authoritative write, projection, outbox,
migration, worker or secret. SQL selects current publications and revisions before
projection reads and rechecks selection afterwards. BFF fails the entire selected
search if a source is unavailable or inconsistent. Groups are independent current
reads, not one distributed snapshot. Existing publication/materialization recovery
and tombstones remain authoritative; see `MATERIALIZATION.md`.

Qualification at baseline HEAD `c965790e063139bcd5e6bacc759f289703e4ea9a`, dirty
`codex/full-operation`, Node 22.17.1 and isolated installation
`/tmp/wapps-clean-install-ekk5hezn`:

- **1,347 tests / 133 suites**: discovery 24/1, articles 67/3, suites 36/4,
  Editorial 796/63, BFF 56/6, shared search 25/4 and aggregator 343/52. Source/spec
  compilers, affected lint/builds and separate BFF spec compilation pass. Domain
  discovery now has a working test target and is removed from the coverage gaps.
- Real MySQL/Mongo/OPA and compiled Editorial/BFF/portal: 23 approved records per
  kind, private edits, another tenant, exact totals, literal/case-insensitive search,
  filters, 1/10/20/50/100 sizes, independent paging, sorting and bounded correction.
  Missing projection returns 503; canonical rebuild recovers. Withdrawal stays
  hidden before tombstone materialization and after reordered replay. Both compiled
  services restart and recover from outage without demo/cache fallback.
- Independent browsers verify actual detail links, keyboard paging, Back/search
  restoration, legacy URLs, empty/invalid/outage/retry states. **All six screenshots
  were visually inspected** at 390/768/1440 in light/dark themes: no horizontal
  overflow, 24px page content gap, 16px card gap, 8px heading/description gap.
- Architecture audit: **136 projects, 1,697 production sources, zero violations**.
  Inventory has no errors. Existing lint, Angular, Browserslist and bundle-budget
  warnings remain visible debt. Final package/clean-chain evidence is recorded in
  `discoveryWorkflowCheckpoint`.

The final response parser preserves valid approved title/category line breaks and
rejects other control characters. Its regression test and affected consumers pass.

Evidence: `/tmp/wapps-readiness/discovery-runtime-final/{qualification,browser}.json`,
six `grouped-discovery-*.png`, `discovery-integration-checks*.log`,
`discovery-portal-final.log`, `discovery-bff-spec-typecheck.log`,
`discovery-tooling-lint.log`, `discovery-boundaries.log`,
`discovery-angular-packages-final.log`, `discovery-inventory-final.log` and
`discovery-clean-chain.log`. Source snapshot and final verification are recorded
in the dated JSON. Earlier failed runs are retained; their invalidated checks were
rerun after corrections. Angular templates were not formatted.

Substitutions: local trusted ingress identities and browser shell/profile/preferences
fixtures; direct production materializer invocation; external browser requests
blocked. This does not qualify deployed authentication/ingress, broker delivery,
production restart/restore/rollback/load/soak or the full release gate.

Confirmed next policy: authors propose general/mature classification; independent
staff confirms it with publication. Unclassified content is hidden when mature
content is disabled. This policy is accepted, but is not implemented by this
Discover checkpoint.

## HTTP application health workflow (October 13, 2026)

API-mode `/apps/:appSlug/health` now reads actual endpoint observations through
Editorial and Catalog BFF `GET /api/catalog/application-health/:slug`. Staff can
read/configure up to eight monitors through the authenticated
`/api/editorial/health-monitors/:applicationId` API. Configuration binds to the
current approved website origin and expected application/monitor revisions.
Current parent visibility is checked again after reads. Missing parents return 404;
unavailable or inconsistent evidence returns 503, with no demo fallback.

The worker records one result per five-minute monitor/configuration slot, with
exclusive twenty-second leases and at most three attempts. Same-result replay
converges; stale leases, changed/disabled configuration and withdrawn applications
reject results. A failed monitor does not block later monitors. Configuration and
immutable version history commit atomically. There is no projection/outbox/broker:
canonical enabled rows are scheduling intent and canonical observations are the
evidence. The additive migration validates re-entry and refuses recorded table
loss/destructive rollback. See `MATERIALIZATION.md` for the complete contract.

The portal shows responding/slow/failed/unknown/stale results, latest actual HTTP
codes and response times, thirty UTC calendar days, sampled availability and
measured/expected intervals. Missed/inconclusive checks are never counted as uptime
or outage. Refresh runs every minute; route changes cancel old requests and failures
clear prior evidence. Demo health remains explicit. No owner-written notices,
invented internal service status or continuous-uptime claim is introduced.

Passing focused evidence: **1,202 tests / 123 suites across five tested projects**,
**285 OPA checks across three bundles**, affected production builds/lint and source/
test typechecks (including a separate BFF spec compiler), a cache-disabled clean
reliability/health dependency build, **57 Angular package inspections**, inventory
with no errors, and **136 projects / 1,688 sources / zero architecture violations**.
Existing warnings remain visible. Valid unchanged tests were reused; backend fixes
and the final portal evidence-layout change were rechecked at their affected scope.

The disposable real MySQL/Mongo/OPA and compiled Editorial/BFF workflow passes staff
denial/tenant isolation, approved-origin checks, conflicts/replay, atomic rollback,
migration loss/re-entry, competing claims, expired/superseded leases, duplicate
results, three-attempt bounds, configuration generations, disabled checks, eight-
definition capacity, parent withdrawal during a lease, outage and process restart.
The actual HTTP adapter also passes a slow response and a real ten-second timeout.
Independent guest browsers pass stale/failed/redirect/unobserved states, missing and
unmonitored applications, and keyboard refresh/retry after an outage.

All **six final screenshots** at 390/768/1440 in both themes were inspected. The
24px page gap, 16px card gap and 8px heading gap pass; no horizontal overflow or
clipped controls was found. Evidence is in `healthWorkflowCheckpoint`,
`/tmp/wapps-readiness/health-runtime-final/` and
`/tmp/wapps-readiness/health-runtime-final.log` (exit 0). Final source snapshot:
**3,758 files**, SHA-256
`877aa8fff3aa17a3cf43a7e205cddc4be3023cee8583ef049739c570d2c69c4d`,
verified against the workspace after qualification. Node 22.17.1; documentation is
outside the digest. Work remains uncommitted on `c965790e`.

Qualification substitutes public logical DNS/transport routing with a local HTTP
fixture, keeps production private-address rejection enabled, accelerates stale/
lease time in disposable data and supplies trusted staff ingress plus browser shell
fixtures. It does not contact external endpoints or qualify public DNS/TLS/egress.
Apply the migration, updated OPA and compatible binaries before explicitly setting
`EDITORIAL_HEALTH_MONITOR_ENABLED=true`; local Compose exposes the switch. Staff
configuration is through the API, not a new staff portal screen. Production
activation, restore/rollback, load/soak and all OP01-OP10 gates remain open. The next
workflow is grouped discovery with bounded real-source search and saved choices.

## Application timeline workflow (October 13, 2026)

API-mode `/apps/:appSlug/timeline` now reads current application updates, approved
suite publications, releases, public topics and member reviews through
`GET /api/applications/:slug/timeline`. The owning services filter canonical
application relationships before bounded paging; suites use approved membership,
never private drafts. Current public readers check exact revisions and authority
again after I/O. The BFF confirms the selected application before and after reads,
and encrypts continuation cursors with an application-specific binding. Missing
parents return 404; source outages, changed parents and projection lag return 503.

The shared frontend service owns route/account cancellation and saved-choice
loading; the page only orchestrates presentation and URL navigation. The portal
provides replacing ten-item pages, browser Back/refresh, current breadcrumbs and
all five real content links. Saved category exclusions also cover suites through
the selected application's taxonomy. Popular/recommended order is page-local;
favorites and saved choices survive Account restart; personalization opt-out
restores recent recommendation order. Loading, missing, excluded/empty and
unavailable/retry states are explicit.

Focused evidence passes **1,732 tests / 164 suites across six projects**, affected
build/lint/source and test typechecks, including a separate BFF spec compiler check.
The architecture audit covers **136 projects / 1,672 production sources with zero
violations**; **57 Angular packages** and the test inventory pass. Existing bundle
and tool warnings remain visible. The unchanged Explore OPA rules retain the
previous Digest checkpoint's 178 passing tests; real-service policy enforcement
is exercised again by this run. This is not the full release gate.

The real-service qualifier passes application scope before limits, all five kinds,
private suite edit isolation, approved membership removal despite stale projections,
missing parents, invalid/cross-application/Explore cursors, continuation after BFF
restart, topic deletion, parent withdrawal, source outage/restart and absent service
credentials. Independent member, second-session, other-account and guest browsers
pass links, URL paging/Back, persistent choices/favorites, opt-out, exclusions,
held-response cancellation on account and route changes, and keyboard controls.

All **18 final layouts** (six timeline, six Digest, six Explore) were inspected at
390/768/1440 in both themes. Timeline card gaps measure 16px/8px; no horizontal
overflow or clipped controls is reported. The full shared Digest/Explore regression
passes in the same run. No new projection, migration, queue, outbox or writer is
introduced; the read composition and recovery contract is in `MATERIALIZATION.md`.

Evidence: `timelineWorkflowCheckpoint` in the dated implementation JSON;
`/tmp/wapps-readiness/timeline-runtime-run1/` and
`/tmp/wapps-readiness/timeline-runtime1.log` (exit 0);
`/tmp/wapps-readiness/timeline-checks2.log`. The final isolated snapshot has
**3,727 files**, SHA-256
`f00bde9f9492790e3bc2298cf7a547b308fad9ee8413d4d633a75ca634d68b27`,
verified against the workspace after qualification. Node is 22.17.1; documentation
is outside the source digest. The earlier build predates the final frontend tests
and guards; the passing combined check covers them.

Qualification uses a local trusted-identity gateway, blocked external browser
traffic, existing publication fixtures and direct production materializer calls.
Controlled SQL fixture changes isolate approved suite membership reads; they do
not requalify publication commands or broker delivery. Activation needs compatible
Editorial/Discussion/BFF binaries and the existing Explore credential/OPA/source
configuration. The gateway's existing BFF fallback serves the endpoint.

This timeline shows current public facts, not every historical edit. Articles have
no canonical application association; health events await real observations. The
next workflow is real application status observations with truthful unknown/stale
states. Discovery, classification/preferences, remaining notification channels and
all deployment/recovery/performance gates remain open. No OP gate closes and no
production activation occurred.

## Digest workflow (October 13, 2026)

API-mode `/digest` now displays independent recent activity, article, application
and discussion selections through `GET /api/digest`, with at most 3/2/2/1 cards.
Real article excerpts, bylines and covers remain visible alongside application
metadata and current conversation links. Busy discussion/review activity cannot
crowd articles/applications out. Saved category exclusions apply before display
limits; popular/recommended order is selection-local. Recommendation opt-out,
saved-choice failure, loading, selection-specific empty states and explicit retry
are supported. Account switches cancel pending responses. Failed covers retain
article text/links and have their own retry control.

The BFF composes existing revision-checked public readers. The owning application
services validate the optional discussion-only source selection, enforce existing
service authentication/OPA and recheck authority. Required-source failure,
projection lag or missing legacy revisions returns unavailable; current parent
withdrawal hides stale content. No new projection, migration, outbox, queue or
writer behavior is introduced. Materialization remains defined by the existing
owning services; the documented Digest variation is read-only composition.

Focused evidence passes **1,716 tests / 159 suites across six projects**, **178 OPA
checks**, affected production builds/lint/source and test typechecks, **57 Angular
artifact inspections**, inventory with no errors, and the architecture audit with
**136 projects / 1,664 sources / zero violations**. Valid passing suites are reused;
changed Digest/route tests and portal builds were rerun after fixes. The production
CSR is about **1.36 MB**, under the unchanged 1.50 MB error limit, with existing
warnings still visible. These focused checks do not replace the full release gate.

Real-service qualification includes four bounded selections, strict query rejection,
real covers/summaries, canonical gaps, projection lag, parent withdrawal,
source outage/restart and missing credentials. Independent member, second-session,
other-account and guest browsers qualify actual links, preferences/favorites across
Account restart, opt-out, exclusions, held-response cancellation and service/cover
recovery. Refresh/retry controls use keyboard activation. The same final run repeats
Explore's six-kind links, paging/Back, current visibility and recovery checks.

All **12 final layouts** (six Digest and six Explore) at 390/768/1440 in both themes
pass and their screenshots were inspected. No horizontal overflow or clipped controls
was found. Card headers measure 16px; article supporting text and Explore descriptions
measure 8px. The existing shell widths, theme appearances and footer are preserved.
Qualification found and fixed missing article-cover composition and relative content
links that resolved under `/digest`; regression tests cover both. The qualifier's
initial single-application assumption was corrected to retain other members' public
content. The image fixture contains generated texture for verified storage bytes.

Evidence: `digestWorkflowCheckpoint` in the dated implementation JSON;
`/tmp/wapps-readiness/digest-runtime-run4/` and `/tmp/wapps-readiness/digest-runtime4.log`
(exit 0); focused logs use the `digest-` prefix. The final isolated snapshot has
**3,710 files**, SHA-256
`5097d93df5c533a2c45dbff5e9f43b6a01729438265e79a36ea485e2afee1987`, verified against
the workspace after qualification. Node is 22.17.1. Documentation is outside the
source digest. Earlier failures remain diagnostic evidence.

Activation needs compatible Editorial/Discussion/BFF binaries, existing Explore
credentials/OPA/source URLs and public catalog readers. Local/development gateways
already route Digest to the BFF. The test gateway supplies trusted identities,
browser external traffic is blocked, publication fixtures come from export setup
and production materializer functions run directly. No production activation or
new broker-delivery qualification occurred. Global popularity, mature classification,
timelines/status, discovery, remaining notification channels/preference consumers
and all deployment/operational gates remain open. The next workflow is the real
application timeline; it has only been inspected, not implemented.

## Explore activity workflow (October 13, 2026)

API-mode Home now reads real applications, approved suites/articles, published
releases, application topics and member reviews through Catalog BFF. Ten-item pages
replace prior content; the opaque URL cursor preserves the page when returning from
a detail. All six target links resolve actual public content. Saved exclusions apply
to each page, popular order uses real helpful marks/net votes, and recommended order
uses favorites and preferred categories/tags. Personalization opt-out makes
recommendations use recent order. Account changes cancel pending requests; loading,
empty, saved-choice failure, unavailable and explicit retry states are truthful.

Each owning service selects current canonical SQL candidates, reads the exact
existing public projection revision, and rechecks authority after I/O. Discussion
also reconfirms parent visibility/metadata after the whole page loads. Required
source failures and selected legacy applications without canonical revisions return
unavailable. Current withdrawal hides stale projected content. Bounded merging
retains hidden scan boundaries without skipping later visible items; AES-256-GCM
protects those boundaries in expiring public cursors. No new projection, migration,
queue, outbox or writer change is required. See `MATERIALIZATION.md`.

Focused checks pass **1,690 tests / 154 suites across six projects**, **178 OPA
checks**, affected builds/lint/source and test typechecks, **57 Angular package
inspections**, inventory with no errors, and **136 projects / 1,655 sources / zero
architecture violations**. Valid earlier focused evidence is reused; changed
backend checks and final portal builds were rerun. Production CSR remains about
**1.35 MB**, below the unchanged 1.50 MB error budget, with existing warnings visible.
This is not the complete workspace release gate.

The compiled-service qualifier passes real SQL/Mongo/MinIO/OPA selection, all six
kinds, nonduplicating traversal, canonical revision gaps, projection lag, scope and
mixed-credential rejection, cursor tampering and BFF restart. Current topic deletion,
parent withdrawal, hidden pages, source outage/restart and missing secret are covered.
Independent member, second-session, other-account and guest browsers cover actual
detail bodies/membership, Back navigation, persisted favorite/preference ranking
after Account restart, opt-out, outage/retry and cancellation after account switch.
Paging, refresh and retry controls are activated by keyboard.

All **six layouts** at 390/768/1440 in both themes pass and their final screenshots
were inspected. Controls fit, no horizontal overflow occurs, the card-header gap
is 16px and supporting text has an 8px gap. Qualification fixed missing test-command
idempotency, an incorrect last-page expectation, an omitted legacy-authority case
and card-library spacing that overrode the portal conventions.

Evidence: `exploreWorkflowCheckpoint` in the dated implementation JSON;
`/tmp/wapps-readiness/explore-runtime-run6/`; focused logs under
`/tmp/wapps-readiness/explore-*`. The final isolated snapshot has **3,693 files**,
SHA-256 `043cf3e5b1ee2bbb8830bf8c36efe64e81a36ebb5df3a4c07827cd46731f5a5f`.
Node is 22.17.1. Documentation is excluded from the source digest. Earlier failed
runs remain diagnostics. The local gateway supplies trusted identities, external
browser traffic is blocked, public publication fixtures come from export setup and
production materializer functions run directly; this does not qualify deployed
authentication or broker delivery anew.

Activation needs matching distinct `EXPLORE_SERVICE_SECRET` values, updated
Editorial/Discussion OPA bundles and BFF source URLs. No production activation
occurred. Page-local ordering is not global popularity. Exact taxonomy matching is
limited to supplied catalog IDs/slugs or article text; suites have no taxonomy.
Mature filtering, Digest, application timelines, status observations, remaining
notifications/preferences and operational gates remain open. Static BFF health does
not prove dependency readiness. No OP01-OP10 gate is closed.

Next: replace API-mode Digest's bundled `buildDigestContent()` with bounded reads
of actual public activity, articles, applications and discussions, preserving saved
choices, current visibility, real detail links and truthful empty/failure states.
The Digest page has only been inspected; it is not yet implemented or qualified.

## Discussion mentions workflow (October 13, 2026)

Members can select up to ten public profiles while composing application topics,
replies, quick-dialog replies or article comments. Selection is explicit; typing a
name alone sends nothing. Existing references survive editing, unavailable profiles
remain removable, and public posts resolve accessible member names on demand.
The Mentions inbox provides bounded pages, persistent read status and real links,
with explicit opt-out, loading, empty, unavailable and retry states.

Discussion atomically records per-post/per-recipient source events with authoritative
content/revision/receipt/outbox writes. Account privately resolves public profile
references under current audience rules and records exact delivery/suppression/read
decisions. These journals are canonical SQL authority, included in private export
and bounded erasure. Remove/re-add preserves the original event; current privacy,
content removal and parent withdrawal take effect despite stale projections. Leases,
crashed attempts, bounded backoff, twelve-attempt quarantine and exact requeue retain
recoverable work. See the mention contract in `MATERIALIZATION.md`.

Focused evidence totals **3,020 tests / 251 suites across twelve projects**, with
unchanged passing evidence reused and affected checks repeated after fixes.
**281 OPA tests**, affected source/test compilers, lint and production/library builds
pass. All **57 Angular packages** pass artifact inspection; inventory errors are
empty and architecture reports **136 projects / 1,634 sources / zero violations**.
The production CSR is about **1.34 MB**, below the unchanged 1.50 MB error threshold.
Existing warnings remain visible. This is not a complete workspace release-gate run.

Real SQL/MinIO tests qualify rollback, replay, competing/expired leases, receipt
recovery, suppression, current access, quarantine/requeue, exports, >128-row erasure,
stale recipient fencing and migration validation. Compiled Account/Discussion/
Editorial with real OPA additionally qualify delivery, multiple root recipients,
service restart/outage, lost acknowledgement after inbox commit, exact replay during
Account outage, current privacy, remove/re-add, read persistence, four-source export,
post/parent withdrawal and disabled-worker unavailability.

Independent browsers qualify the complete member-selection/posting/inbox/link path
for application roots, replies, quick dialogs and article comments, plus edit removal/
re-add, lost read response, bounded paging, saved opt-out, unavailable/retry states
and cancellation of a held response after account switch. Eighteen measured layouts
cover the inbox, picker and public member display at 390/768/1440 in both themes;
screenshots were also inspected. No horizontal overflow or clipped controls was found.

Browser qualification caught a real read-path defect: canonical mention references
were persisted/delivered but discarded when mapping public comments. The shared
read mapper now preserves them, with article/application root/reply/list regressions.
Prerequisite fixes also retain lazy profile-request cancellation, satisfy strict
validator typing, and inspect an existing application-editing index in physical SQL
order instead of trusting ORM array order. That migration still rejects incompatible
keys; Editorial's 763-test regression and the real fresh-store startup pass.

Evidence: `mentionNotificationWorkflowCheckpoint` in the dated implementation JSON,
`/tmp/wapps-readiness/mention-sql1.log` and
`/tmp/wapps-readiness/mention-runtime-run5/`. The final frozen snapshot has **3,658
files**, SHA-256 `b96ce0188d92b50459a8e8cedd4e9932878edd4ddf79a3343f07eff8d5a64951`;
its contents were rechecked after qualification. Node is 22.17.1. Documentation is
excluded from the digest. Prior failed runs remain available as diagnostics.

The gateway supplies local trusted identities, the Firebase Auth emulator replaces
production credentials, public parents use canonical fixtures and production
materializer functions run directly. External browser traffic is blocked. These are
local results, not deployed authentication, activation, restore/rollback or load/soak.
Apply both mention migrations and OPA bundles, configure bidirectional service URLs
and the dedicated secret, and fence old writers before enabling the default-off
`MENTION_NOTIFICATION_WORKER_ENABLED`. Email, push, system alerts, feeds, other
preference consumers and all required operational gates remain open. No OP gate is
closed and no production activation occurred.

## Favorite updates workflow (October 13, 2026)

The API portal's `/notifications` page now provides Replies and Favorites categories,
current public links for all four favorite types, ten-item pages and persistent read
status. It distinguishes saved opt-out, empty/loading/unavailable states and uncertain
read responses. Category selection uses existing theme appearances and the shared
header navigation slot; settings describe the available channel accurately.

Canonical source cursors advance atomically with public changes, separately from
projection revisions. Private edits and replay remain silent. Account commits each
new favorite with a captured baseline and fresh subscription generation, and each
observed change with an immutable delivered/suppressed receipt. Remove/re-add cannot
revive old receipts or leases. Changes between polls coalesce as stated in the UI.
The worker enforces current visibility, lifecycle and saved preferences, with bounded
leases/backoff, twelve-attempt quarantine and exact operator requeue. These journals
are canonical facts and join private export/erasure; they are not Mongo projections.
See the favorite subscription section in `MATERIALIZATION.md` for the full contract.

Local evidence passes **2,509 tests / 215 suites** across nine affected projects,
**174 OPA tests**, affected production/library builds, source/test compilers and lint.
All **57 Angular packages** pass artifact inspection; inventory has no errors and
architecture reports **136 projects / 1,606 sources / zero violations**. The production
CSR remains about **1.33 MB**, below the unchanged 1.50 MB error threshold. Existing
lint/template/style warnings remain visible. Portal checks were repeated after the
category appearance and settings-copy fixes; unchanged backend evidence was reused.

Real MySQL/MinIO tests pass source/receipt rollback, command replay, coalescing,
baseline capture, current visibility, remove/re-add, opt-out, competing/expired leases,
twelve crashed attempts, quarantine/requeue, paging, export, row validation and erasure.
Compiled Account/Editorial/Discussion with OPA additionally pass all four deliveries,
release publication/replay, private-edit silence, self isolation, restart/read
persistence, source outage, projection-lag recovery, four-source account archive,
withdrawal despite old projections and disabled-worker unavailability.

Independent compiled-portal browsers pass all four actual content links, lost read
response without automatic replay, independent account/session isolation, preference/
loading/failure/retry states, session cancellation and bounded page replacement.
Six inspected screenshots cover 390/768/1440 in both themes: no overflow, aligned
columns, visible category selection and the required 16px card header/content gap.

Evidence: `favoriteUpdateWorkflowCheckpoint` in
`docs/readiness/implementation-2026-10-11.json`,
`/tmp/wapps-readiness/favorite-updates-sql1.log` and
`/tmp/wapps-readiness/favorite-runtime-run4/`. The final isolated snapshot has **3,609
files**, SHA-256 `61df450a6e7a008f0595bec0a2a3495398ef78dfdb9b1d3e218cb1fd981bdde9`.
Node is 22.17.1. Each qualifier consumed frozen sources/artifacts; documentation is
excluded from the source digest. Earlier failed runs retain diagnostic evidence:
missing fixture materialization, an expected route redirect and demo-only test
selectors were corrected without weakening canonical access or assertions.

The local gateway supplies trusted identities, parent/ownership records use canonical
fixtures, materializers run directly, and only disposable watch due times are
accelerated. External browser requests are blocked. This is local qualification,
not production credentials, ingress, rollout, database restore/rollback or load/soak.
Deploy all three additive migrations, source OPA and dedicated credentials, and fence
older public-content/favorite/erasure writers before enabling
`FAVORITE_UPDATE_WORKER_ENABLED`. Account favorite creation needs the upgraded source
APIs even while delivery is disabled, requiring a coordinated rollout. No production
activation occurred. Email, push, mentions, system alerts and all remaining service
workflows stay open; this checkpoint closes no OP gate.

## Reply notifications workflow (October 13, 2026)

The API portal now provides `/notifications`, linked from authenticated navigation.
It shows replies to the immediate author's public application-discussion posts and
article comments, supports ten-item pages and persistent mark-read, and opens the
actual conversation. Loading, empty/hidden pages, opt-out, unavailable services,
uncertain read responses and explicit retry are distinct. Session changes cancel
outstanding work and clear private items and cursors. Demo delivery stays explicit.
Notification settings describe this channel while keeping unfinished channels clear.

Discussion atomically stores ID-only notification intent with the canonical reply,
payload binding, revision, command receipt and materialization intent. Identity
barriers exclude erased recipients; self/unbound/private replies do not notify.
The compiled Account worker uses a dedicated authenticated/OPA-protected Discussion
endpoint, checks current visibility and canonical lifecycle/preferences, commits an
immutable delivered/suppressed receipt, and only then acknowledges the source lease.
Claims count crashed attempts; thirty-second leases, bounded backoff, twelve-attempt
quarantine and exact failed-receipt requeue cover recovery. No Mongo inbox projection
is needed: delivery, suppression and read decisions are canonical Account facts.
Both journals join private export and bounded account-erasure cleanup.

Local qualification passes **1,771 tests / 160 suites**, **199 OPA policy tests**,
affected source/test compilers and lint, both service builds, the independently
packaged aggregator dependency chain, and its production CSR. Inspection validates
all **57 Angular packages**. Inventory has no errors; architecture reports **136
projects / 1,587 sources / zero violations**. Existing lint/template/style warnings
remain visible. Home now loads on its route, reducing the initial bundle to about
**1.33 MB** within the unchanged 1.50 MB error budget. Public package alias alignment
also fixes independent identity packaging; no compiler root or budget was widened.

Real MySQL/MinIO checks pass atomic rollback, duplicate commands, competing/expired
leases, crash-after-inbox-commit, permanent suppression, quarantine/requeue, bounded
paging, both exports, >128-row erasure, anonymous recipients and strict physical/row
migration replay/refusal. The separate compiled-service qualification passes actual
application/article delivery, cross-account denial, restart/outage, lost settlement
with one durable receipt, persistent/idempotent reads, four-source archive export,
current deletion/withdrawal and disabled-worker behavior. Missing parent projection
in an initial fixture correctly delayed delivery; production materialization repairs
the fixture without relaxing source checks. A SQL count assertion was also corrected
to account for MySQL's string representation of COUNT.

Independent compiled-portal browsers pass both real conversation links, uncertain
read recovery without automatic replay, account/session isolation, preference and
failure states, bounded older-page navigation and Home/OAuth routes. Six layouts
cover 390/768/1440 in both themes, with no overflow, aligned columns and the required
16px card header/content gap. Screenshot inspection prompted that spacing correction.
Trusted ingress is a local fixture; parent data uses canonical fixtures and production
materializers; source lease expiry is accelerated only in disposable SQL. External
browser requests are blocked. These substitutions do not prove deployed behavior.

Evidence: `replyNotificationWorkflowCheckpoint` in
`docs/readiness/implementation-2026-10-11.json`, the SQL run5 log, and
`/tmp/wapps-readiness/reply-runtime-run6/`. The final isolated snapshot has **3,582
files**, SHA-256 `f20a5abea8bafa75986a554411603061a35b6f40c0afe1a5cef1971c793fbc26`.
Node is 22.17.1; sources/artifacts were frozen during each qualifier. Documentation
is excluded from the source digest. Earlier failed checks remain in the evidence
record; final corrected checks supersede them within the affected scope.

Deploy both additive journal migrations, provision the distinct notification secret
in both namespaces, update OPA and fence older reply/erasure writers before enabling
`REPLY_NOTIFICATION_WORKER_ENABLED=true`. Default activation is off and returns
unavailable. No production activation occurred. Restore/rollback must retain both
journals and erasure barriers; production ingress/credentials, legacy/writer fencing,
load/soak and the complete release gate remain unqualified. Email, push, mentions,
favorite/system updates and the other full-service workflows remain open. This
checkpoint closes no OP gate and does not complete the autonomous goal.

## Account erasure workflow (October 13, 2026)

The API privacy page now provides current-account verification, explicit consent,
typed `DELETE`, cancellation and one authenticated self-deletion request. A strict
HTTP acceptance parser distinguishes pending/completed/failed cleanup. Preparation
failure says no request was sent; a lost, invalid or rejected sent response reports
an uncertain outcome without automatically replaying DELETE. Only the originating
session is cleared. A background 401 or an already-running refresh cannot replace
that session or navigate away during deletion; a later login is not cleared or shown
the previous account's outcome. Terminal notices survive page recreation and the
settings guest branch, but not a full reload. Operators inspect canonical journals
for completion; there is no new post-deletion authenticated receipt endpoint.

The frontend keeps behavior in a root application service behind a port, with a
lazy HTTP adapter and API-only composition. Theme rules stay in the aggregator theme;
the existing shell owns width and settings spacing. The lazy adapter is necessary to
stay within the unchanged initial-bundle error budget. The final CSR build passes at
approximately **1.50 MB**, leaving virtually no headroom; its existing 1 MB warning
and other existing template/style warnings remain visible debt.

The expanded real-store qualifier drives every participant through the compiled
Account pump. A final coordinator-journal SQL fault proves that completed participant
receipts and removed Firebase credentials cannot manufacture global completion.
Removing the fault and restarting converges to exact `cleanup: completed`. All three
APIs restart without changing the tombstone or receipts, even with Editorial cleanup
subsequently disabled. All 36 Editorial attribution/target fields drain; full Mongo
documents match current canonical snapshots, revisions advance once, foreign owners
survive, and retained application/article image bytes remain readable. Discussion
outage, partial cleanup, projection waits and its recovery regressions also pass.

The integration found one production defect: suite/article/release drafts validly
allow epoch-zero lifecycle times, but Editorial erasure rejected them. Erasure now
uses each family's actual timestamp minimum; applications keep their positive-time
restriction. Eight focused regressions cover zero timestamps, tombstones and invalid
or reversed lifecycles. Two older export fixtures also lacked required retirement
and permanent ownership records. They now use the production retirement/history
helpers; no cleanup barrier or completion requirement was relaxed.

Validation passes **1,205 tests / 117 suites** (Editorial 759/56, frontend identity
113/12, aggregator 333/49), affected production/library builds, source/test compilers,
57 Angular artifact inspections, inventory, and architecture (**136 projects / 1,570
sources / zero violations**). Affected lint has no errors; the aggregator's 273 prior
warnings and two readiness-tool warnings remain. Unchanged participant/recovery tests
and compiled Account/Discussion artifacts are reused.

The complete qualifier exits successfully with **18 erasure layouts plus six export
layouts** across 390/768/1440 and both themes. Browser checks include independent
old-session denial, accepted and lost receipts, a background 401, an actual cross-tab
login while the old receipt is delayed, exactly three intended DELETEs and completed
cleanup/credential removal for all three browser-created requests. Mobile light,
tablet light and desktop dark screenshots were inspected. An initial browser timeout
was animation-frame polling in a background tab despite the expected text being
present; returning focus fixed the harness. Screenshot capture now waits for theme
transitions. These were harness corrections, not suppressed application failures.

Evidence: `accountErasureWorkflowCheckpoint` in
`docs/readiness/implementation-2026-10-11.json` and
`/tmp/wapps-readiness/account-erasure-workflow-run6/`. The isolated source snapshot
contains 3,552 files, SHA-256
`db09607b1016d8f2884bd8edc100afbb924e91eb45aafe31bf40af1e39faffd6`,
with no source differences after the run. Node is 22.17.1; MySQL, Mongo, RabbitMQ,
MinIO, OPA and the local Firebase Auth emulator are real. Trusted ingress headers,
fixture content and accelerated unleased disposable scheduling are explicit
substitutions. No source copying or artifact rebuild occurred during qualification.
Documentation is excluded from that source manifest.

Deployment must still apply the migrations, fence old writers, review legacy payload
inventory and enable the documented cleanup workers. The run does not qualify deployed
ingress/credentials, actual writer fencing, production database restore/rollback or
load/soak. Public free-text content is retained under the confirmed policy and is not
scrubbed for arbitrary personal details. F30's remaining privacy consumers and every
service-wide operational gate remain open. Next: the reply-notification workflow
identified above, followed by the remaining full-service requirements.

## Editorial erasure participant (October 13, 2026)

The compiled Editorial service now advances all erasure phases through its real
service-only endpoint: canonical anonymity, private workspace/media cleanup,
ownership/review audits, projection confirmation and durable completion. The final
SQL transaction checks **36 attribution/target fields** under the permanent identity
barrier. Each field independently blocks completion in real SQL tests, and the
coverage list matches the physical schema. The additive
`EditorialErasureCompletion1791840014000` migration supplies the three missing author
indexes; all final checks use leading indexes.

`EDITORIAL_ERASURE_WORKERS_FENCED` defaults off; invalid values prevent startup.
Activation requires all migrations, fenced old writers, Mongo write permissions
and active media cleanup. With cleanup disabled, the endpoint records/replays only
pending requests. With activation enabled, unavailable Mongo, unfinished object
cleanup, private SQL failure and failure to save the final receipt remain pending.
After restart, concurrent requests converge to the exact completed receipt. Later
replay works even with activation off and Mongo unavailable; stale request revisions
remain rejected. The flag itself is not evidence that deployment writers are fenced.

Checks pass **751 Editorial tests / 55 suites**, the production build and 32
prerequisites, source/test compilers, Editorial/tools lint, inventory and architecture
(**136 projects / 1,563 sources / zero violations**). Tools retain the two prior
unused-variable warnings. The real MySQL/Mongo/OPA/MinIO/Sharp/compiled HTTP run
covers all six content kinds, all four private authoring families, both upload
families, copied/private/reviewer attribution, >128 histories, authorization,
disabled/invalid activation, failure/retry/restart, duplicate final calls, physical
schema inventory, missing/invisible indexes and preserved peer decisions. Public
content and exact image bytes remain readable; successor editing/submission still
works. **12 compiled browser layouts** pass across independent sessions/restart,
390/768/1440 and both themes. Mobile light and desktop dark were inspected.

Evidence is in `editorialParticipantCheckpoint` in
`docs/readiness/implementation-2026-10-11.json` and
`/tmp/wapps-readiness/editorial-participant-*`. The initial run completed the service
workflow but its final coverage assertion found no direct Editorial command sample;
adding real category/tag creation closed that fixture gap and the full qualification
passed. No production correction was needed after the successful build/tests.

Next is the enabled Account/portal journey across all participants and credentials.
Its control remains disabled until that qualification passes. Registry-only orphan
retention, real DNS and deeper individual-phase failure cases retain their separate
qualified evidence; this harness uses controlled proof/ingress/shell fixtures and
does not run Discussion comments. F30, all OP gates and the full-service goal remain
open; production rollout, restore, rollback, load and soak are still unqualified.

## Editorial projection erasure (October 13, 2026)

Editorial now has bounded projection cleanup for applications, categories, tags,
suites, articles and releases. It rebuilds the complete canonical snapshot through
the existing revisioned publisher, reads the durable Mongo document back, and
rechecks SQL before removing the exact erasure target. A publish acknowledgement
alone cannot complete cleanup. Successor edits and newer publishers retain the
target for another pass; corruption and same-revision conflicts fail closed.
Restart after Mongo success/SQL failure replays safely, duplicate workers converge,
and old snapshots cannot restore the previous article byline or deleted content.

Checks pass **734 Editorial tests / 53 suites**, the production build and 32
prerequisites, source/test compilers, lint, inventory and architecture (**136 projects /
1,560 sources / zero violations**). Editorial lint has no warnings; tools retain
the two previously recorded unused-variable warnings. Real MySQL/Mongo/OPA and
compiled HTTP qualification covers exact requests, missing/corrupt/stale/ahead
projections, all six kinds, multiple tenants, tombstones, concurrent successor
changes, duplicate workers, SQL rollback after Mongo success, restart and migration
reentry. **18 compiled browser layouts** verify lag, anonymous retained text and
independent restart at 390/768/1440 in both themes. Mobile light and desktop dark
screenshots were inspected. Cover bytes and Discussion comments are excluded from
this projection harness; prior media checks remain separate evidence.

Evidence is in `editorialProjectionErasureCheckpoint` in
`docs/readiness/implementation-2026-10-11.json` and
`/tmp/wapps-readiness/editorial-projection-erasure-*`. Initial failures were test
harness issues: an existing read-option expectation and a synchronous validation
exception passed incorrectly to the rejection assertion. Both were corrected and
the affected checks rerun. The final source and isolated snapshot match.

This phase is **not yet composed into the production erasure participant**. The
next step joins the qualified phases and adds the final SQL residual check, then
qualifies the enabled Account/portal journey. F30, OP01-OP10 and the full-service
goal remain open. No deployment, restore, rollback or load qualification is claimed.

## Editorial ownership and audit erasure (October 13, 2026)

The `EditorialAuditErasure` production adapter now removes owned claims, proof
checks, private receipts and revoked grants after canonical anonymity and private
workspace cleanup. It preserves a later owner's grant and keeps permanent,
identity-free ownership history so erasure cannot reopen old unbound editing.
Other members' application, suite, article, release and ownership decisions retain
their outcomes, reasons, timestamps, content and revisions. Their erased reviewer
becomes null with an explicit erasure timestamp; a latest ownership decision and
its claim change atomically. Historical approval is not relabeled as a system act.
Outbox intent and delivery metadata remain intact while actor identifiers drain.

`EditorialAuditErasure1791840013000` adds the nullable attribution stamps, physical
indexes and permanent ownership history. Backfill uses the earliest surviving
approval across legacy transfers, rather than only the newer current grant. It
resumes after a committed 128-row page and performs no DDL on successful reentry.
Applied history/index/stamp loss or inconsistent claim/decision attribution fails
closed. Publication and ownership predecessor validators now use explicit MySQL
index order instead of ORM enumeration. No public revision or new materialization
event is needed for these private changes.

Final checks pass **705 Editorial tests / 52 suites**, the production build and 32
prerequisites, source/test compilers, Editorial/tools lint, inventory and architecture
(**136 projects / 1,558 sources / zero violations**). Editorial lint has no warnings;
tools retain two preexisting unused-variable warnings. The real-store qualifier
passes reviewed/rejected content in all four families, deleted peer history,
ownership approval/rejection/revocation, successor preservation, delayed DNS
completion, exact request fencing, SQL rollback, >128 receipts/outbox actors,
concurrency, restart, unchanged peer exports and ordinary peer withdrawal/deletion.
It proves missing permanent history blocks cleanup and new independent proof/approval
can grant ownership again afterward. The separate ownership HTTP regression passes
real local DNS, policy outages, grant-bound editing and revision recovery.

Combined workspace/media-retirement qualification and **12 compiled browser
layouts** pass, including independent restart, all three widths and both themes.
Mobile light and desktop dark screenshots were visually inspected. The final
legacy-transfer migration correction reran build/tests/lint and the complete
audit/workspace real-store workflow; unchanged media-retirement/browser results
are reused. Frontend source and its previously qualified Angular artifacts are unchanged.

Evidence is in `editorialAuditErasureCheckpoint` in
`docs/readiness/implementation-2026-10-11.json`; logs/screenshots are under
`/tmp/wapps-readiness/editorial-audit-*`. Initial setup/fixture failures are retained
with their corrections and evidence limits. The new adapter is **not yet composed
into the production participant**. Exact projection completion, final Editorial
composition and the enabled Account/portal erasure journey follow. F30, OP01-OP10
and the full-service goal remain open; no deployment qualification is claimed.

## Editorial private workspace erasure (October 13, 2026)

The production `EditorialWorkspaceErasure` adapter now removes owned application,
suite, article and release drafts, submissions, command receipts, editing targets
and private uploader history. It requires the exact pending identity barrier and
prior canonical anonymity. Every transaction handles one draft, one upload or a
batch of at most 128 history/workspace rows, preserving valid intermediate states.
All owned live drafts release their private references before any uploader history
is removed. This also retires an image shared only by two of the erased author's
private drafts without losing its cleanup authority or waiting seven days.

Public snapshots, publication revisions, outbox records, anonymous article content
and media still used by public content or another member remain unchanged. Unused
pending/ready uploads gain permanent registry guards and durable cleanup intent;
private metadata remains until object retirement has a confirmed SQL receipt.
Lost receipts, failed jobs and missing/corrupt authority cannot produce completion.
The additive `EditorialWorkspaceErasure1791840012000` migration installs validated
owner/parent/live-draft indexes and refuses incompatible or missing applied indexes.
No new public materialization event is needed for these private-only deletions.

Qualification passes **686 tests / 51 Editorial suites**, Editorial production build
and 32 prerequisites, source/test compilers, Editorial/tools lint, inventory and
architecture checks (**136 projects / 1,554 sources / zero violations**). Editorial
lint has no warnings; tools retain two unrelated existing warnings. The new real
MySQL/Mongo/OPA/MinIO qualifier drives the actual cleanup adapter after real HTTP
publication and uploads, replacing the earlier fixture private-history deletion.
It covers all four families, validated 131-submission and >128-command histories,
multiple tenants, case-distinct accounts, staff receipts on another member's article,
owned editing targets, SQL rollback, concurrent workers, restart, completed/stale
request rejection, corrupt media history, object-success/receipt-loss recovery,
lease takeover, permanent markers and late-upload denial. The full erasure receipt
correctly remains pending.

Combined media-retirement regressions also pass, including controlled reference
races, quarantine/requeue, registry/backfill recovery and both compiled maintenance
commands. The compiled public article portal passes **12 layouts** at 390/768/1440px
in light/dark themes and independent sessions after restart. Mobile light and desktop
dark screenshots were visually checked. Frontend sources/dependencies are unchanged;
previous Angular/CSR/compiler and 57 artifact checks remain valid.

Large histories, corruption and additional orphan records are explicit SQL fixtures;
ordinary publishing, uploads, cleanup and inherited-media access use real stores and
APIs. DNS proof/ingress and browser shell/account/preferences are controlled fixtures.
Lease/retention clocks advance in selected recovery checks. This is direct adapter
qualification, not an enabled Account erasure journey or production deployment.

Evidence: `editorialWorkspaceErasureCheckpoint` in
[implementation evidence](readiness/implementation-2026-10-11.json). Diagnostic logs,
source manifest and browser captures are under
`/tmp/wapps-readiness/editorial-workspace-erasure-*`.

Next: remove ownership claim/proof history and anonymize erased staff attribution,
confirm all target projections, then compose exact Editorial participant completion
and enable/qualify the Account/portal erasure journey. The full-service goal remains
active; F30 and all OP01-OP10 gates remain open, including deployment, restore,
rollback, load and soak qualification.

## Editorial media retirement without private history (October 13, 2026)

Application-image and article-cover cleanup now retire unreferenced registry assets
even after the original private upload rows have been erased. They preserve the
existing seven-day unused-media threshold and bounded batches. Retirement locks
optional upload then registry, rechecks all associations, and atomically clears the
descriptor with durable cleanup intent. Claiming cleanup locks upload, registry and
job; exact guard/time and any remaining private metadata must agree. Missing
authority or conflicting references quarantine work before object I/O.

Existing workers and compiled `--media-cleanup` / `--article-cover-cleanup` commands
use the updated stores. Permanent SQL guards and empty object markers prevent
resurrection. Bounded retries, lease takeover, stale completion rejection and
explicit requeue work without recreating uploader history. Earlier cleanup
migrations recognize registry authority while preserving validation of private
rows/receipts that remain. No additional schema or materialization event is needed:
an eligible orphan has no public or retained private association.

Qualification passes **686 tests / 51 Editorial suites**, production build plus
32 prerequisites, source/test compilers, Editorial lint, tools lint and inventory.
Architecture reports **136 projects / 1,549 sources / zero violations**. Tools lint
retains its two unrelated existing warnings. Frontend source/dependencies are
unchanged; previous Angular package/CSR/compiler and 57 artifact checks remain valid.

The real MySQL/Mongo/OPA/MinIO qualifier covers both families, one-item batch and
age boundaries, cleanup-intent rollback, process loss after durable object
retirement, lease takeover, stale receipts, object-success/SQL-completion failure,
quarantine/requeue and non-reviving markers. A deterministic held registry lock
proves cleanup waits for and preserves an inherited reference; releasing the last
reference then permits retirement and fences a stale attachment. Missing registry
and corrupt-reference fixtures never authorize object deletion. Both compiled
maintenance commands reclaim real objects and persist completion across restart.
Registry and predecessor migration reentry pass, including corruption rejection.
Existing application publication/retention and article-cover regressions pass.

Public and inherited image bytes remain exact after cleanup. The compiled article
portal passes **12 responsive/theme layouts** across independent sessions/restart;
mobile light and desktop dark screenshots were visually inspected again. Additional
orphans and the held reference are SQL fixtures with real normalized objects. The
harness advances time for retention/lease tests; compiled maintenance uses actual
time. Original private-history removal remains an explicit disposable fixture.
DNS proof and portal shell data remain controlled; Discussion comments are outside
this harness. An initial race fixture supplied raw MySQL JSON rather than the
parsed domain descriptor; the corrected qualifier passes and its failed log is kept.

Evidence: `editorialMediaRetirementCheckpoint` in the dated JSON and
`/tmp/wapps-readiness/editorial-media-retirement-*`. Work remains uncommitted on
`codex/full-operation` at base `c965790e`.

**Next:** bounded production Editorial private/audit/media erasure, projection
target completion and exact participant composition, then the enabled Account/portal
journey. F30, all OP gates and deployment/restore/rollback/load/soak remain open.

## Editorial retained media (October 13, 2026)

Public application images, anonymous article covers and a legitimate successor's
inherited editing images now resolve immutable descriptors independently of private
uploader history. `editorial_media_assets` contains tenant/article scope, normalized
metadata and retirement state without uploader identity or source digest. Ready
upload state, descriptor and processing receipt commit atomically. Reference
creation and retirement share the descriptor lock; retired keys retain permanent
payload-free guards and cannot be revived. Private direct image selection remains
bound to the caller's owned draft/upload. Account export uses registry authority
for bindings while retaining uploader scope for private metadata/bytes.

The explicit migration validates uploads, complete associations and retirement
authority before DDL, backfills in transactional pages of 128, and resumes after
interruption. Applied table/index/descriptor loss, inconsistent references and
destructive rollback fail closed. Predecessor association migrations accept valid
references after the original upload history is gone. This representation-only
backfill changes no public content, URLs, revisions, outbox intent or object bytes.

Qualification passes **675 tests / 50 Editorial suites**, production build plus
32 prerequisites, source/test compilers and Editorial lint without warnings.
Tools lint has zero errors and two existing unrelated warnings. Architecture
reports **136 projects / 1,548 sources / zero violations**. The previous aggregator
Angular package/CSR and 57 artifact checks remain valid: frontend source and
dependencies are unchanged in this phase.

Real MySQL/Mongo/OPA/MinIO/Sharp and compiled HTTP prove both upload families,
injected descriptor failure after immutable object creation, rollback/retry,
independent approval, ownership transfer, canonical anonymity and retained exact
bytes after explicit fixture removal of private upload/draft/submission/command
history and API restart. A successor still edits/submits inherited images.
Separate legacy checks cover 262 descriptors/guards, malformed rows beyond one
page, missing references, interrupted backfill and schema corruption. Existing
application publication/retention, article covers and Editorial export regressions
also pass, including real retirement races and permanent object markers.

The compiled public article portal passes **12 responsive/theme layouts** across
independent sessions and API restart; its real cover bytes decode in the browser.
Six retained-detail screenshots were visually inspected at 390/768/1440 widths in
both themes. DNS proof and shell account/profile/preferences remain fixtures;
Discussion comments are unavailable and outside this qualification. The new
qualifier initially lacked its disposable storage bucket and used an undersized
ownership note; both setup issues were corrected. The backfill assertion also
accounts for pending uploads in the first page, avoiding random fixture ordering.

Evidence: `editorialMediaAssetsCheckpoint` in the dated JSON and
`/tmp/wapps-readiness/editorial-media-assets-*`. Work remains uncommitted on
`codex/full-operation` at base `c965790e`.

**Next:** bounded Editorial private/audit/media cleanup, registry-only orphan
retirement, projection target completion and production participant composition,
then the enabled Account/portal erasure journey. Private-history removal here is a
disposable qualification fixture, not production cleanup. Explicit migration and
fencing of older upload/reference/cleanup writers are required before activation.
Full erasure, production restore/rollback/load/soak and all OP gates remain open.

## Editorial canonical contribution anonymity (October 13, 2026)

The bounded erasure adapter now anonymizes at most one canonical application,
category, tag, suite, article or release per call. It requires the exact pending
request/barrier and atomically commits nullable ownership, the next public
revision, actor-free outbox intent and a durable projection target. Articles retain
their content, URLs, cover associations and timestamps with `Deleted account` as
their public byline. Active application grants end in that transaction, with a
validated system revocation decision. Later independent ownership approval remains
possible, and a transfer during candidate selection survives the locked recheck.

Public article reads hide old attributed projections while the new revision is
pending; older snapshots cannot replace the anonymous version. Profile activity
also checks the identity barrier, including application activity derived from old
command receipts. Covers require the exact public association and tenant. The new
explicit migration validates canonical authority before DDL, resumes interrupted
DDL, validates physical indexes and refuses missing applied schema/destructive down.
All legacy migration reentry validations accept the retained anonymous authority.

Qualification passes **1,130 tests / 107 suites**: 661 Editorial, 61 article domain,
332 aggregator and 76 article feature tests. Editorial build plus 32 prerequisites,
aggregator Angular package plus 86 prerequisites, CSR, affected source/test
compilers, lint/tools lint, inventory and **57 Angular artifact checks** pass.
Architecture reports **136 projects / 1,546 sources / zero violations**. Existing
CSR template/bundle warnings remain; the initial bundle is still approximately
1.498 MB against the 1.5 MB error budget.

Real MySQL/Mongo/OPA and compiled APIs pass request/revision isolation, rollback
of outbox/target/ownership-decision failures, bounded concurrent progress, restart,
cross-tenant erasure, case-distinct peer isolation, tombstone retention, legitimate
ownership transfer and stale projection rejection. A separate disposable legacy
database checks 130 rows, validation beyond the first 128-row page, interruption
after committed DDL, reentry and applied-schema/index corruption refusal. The
compiled article portal passes **18 responsive/theme layouts** for pending public
projection, retained anonymous content and an independent session after restart.
Six retained-detail screenshots were visually inspected. Cover metadata/processing
receipts are fixtures; media bytes and Discussion comments are unavailable in this
browser harness and are explicitly outside this phase's qualification.

Preserved failures include sandbox HTTP binding refusal, intermediate compiler
errors, and an incomplete cover fixture missing its processing receipt; corrected
runs pass. Existing broker protocol evidence is reused because its implementation
and event shape are unchanged; this phase checks SQL intent and direct Mongo
publication, not a new RabbitMQ delivery run.

Evidence: `editorialAuthorErasureCheckpoint` in the dated JSON and
`/tmp/wapps-readiness/editorial-author-erasure-*`. The final 3,507-file snapshot has
SHA-256 `841b5ade17fcd4ec0fe1bbfe1bc3b1906a0e17e510abcbb4cf985ff498051462`.
Work remains uncommitted on `codex/full-operation` at base `c965790e`.

**Next:** bounded Editorial private/audit/media cleanup, projection target
completion and exact production participant composition, followed by the enabled
Account/portal erasure journey. This primitive is not yet composed into production.
Production fencing/migration, restore/rollback, load and soak remain unqualified.
F30 and OP01-OP10 remain open; the full-service goal stays active.

## Independent suite publication snapshots (October 12, 2026)

Suite approval now atomically copies the approved title, description and ordered
application IDs into `suite_publications`, alongside the public revision, command
receipt and outbox. Canonical reads/search, profile activity, public export and
materialization use that snapshot. Removing private draft/submission history no
longer destroys the public suite. Later private edits still cannot change approval.

`SuitePublicationSnapshots1791840009000` validates the exact independent approval,
tenant/owner, draft revision, content and matching review/publication time before
DDL. It copies in 128-row transactions and resumes interrupted backfill without
accepting inconsistent partial content. Applied-schema corruption, missing approval
history, invalid content and destructive rollback fail closed. Public revisions
and fingerprints are unchanged; this representation-only migration needs no extra
materialization event. Explicit migration and real writer fencing precede rollout;
old approval writers cannot populate the new required fields.

Qualification passes **993 tests / 98 suites** (661 Editorial and 332 portal),
Editorial/Angular-package/CSR production builds, both source/test compiler pairs,
57 Angular artifact checks, lint and inventory. Architecture covers **136 projects /
1,541 sources / zero violations**. Existing portal lint warnings (273), template
warnings and size warnings remain. Initial CSR size is **1,498,188 / 1,500,000 bytes**.

Real MySQL/Mongo/OPA/RabbitMQ checks cover 131 legacy publications, interrupted
backfill/restart, public reads/scoped activity/export/fresh materialization after
private history removal, outbox rollback, duplicates, lost acknowledgements,
projection loss and old events after withdrawal. Compiled independent-browser
owner/reviewer/public journeys pass **72 responsive/theme layouts**, including
immutable approval, stale review, exact retry, restart and withdrawal. The separate
Editorial export regression passes all content families, 140 retained submissions,
SQL snapshot isolation, media integrity/retirement and compiled HTTP restart/policy.

Screenshot review found an existing mobile defect missed by overflow checks:
favorite actions compressed the suite title to one character per line. Favorite
controls now sit below the description, leaving workspace navigation beside the
title. The browser guard checks allocated title width; its first intrinsic-text
measurement produced a false failure on short headings and was corrected. Final
browser checks pass and six public-detail screenshots were visually inspected.

Evidence: `suitePublicationSnapshotsCheckpoint` in the dated JSON and
`/tmp/wapps-readiness/suite-publication-snapshots-*`. The final 3,500-file snapshot
has SHA-256 `4d16e5a255cf2d42a30bb07d78c321447e96112985858337a517d8697b7361d9`.
Work remains uncommitted on `codex/full-operation` at base `c965790e`.

**Next:** Editorial nullable canonical authorship, retained public contribution
anonymization, ownership termination, bounded private/audit/media cleanup and exact
projection/participant completion, then the enabled portal erasure journey. Account
still waits for Editorial. Production fencing, migration, coordinated restore/
rollback, load and soak remain unqualified. No F30 or OP gate closes; the full-service
goal remains active.

## Discussion participant completion (October 12, 2026)

`DiscussionsModule` now wires `CleanDiscussionAccount` behind the existing
authenticated/OPA-protected service endpoint and `CleanAccountErasureParticipant`.
Application ports sequence canonical anonymity, object retirement, private SQL,
reviews and historical projections. Each invocation performs bounded work and
returns pending until all phases drain. The final SQL transaction rechecks the exact
barrier/request, completed inventory, remaining owned/private data and cleanup
targets before recording completion. A phase failure cannot become a completed
receipt; a concurrent completed request is accepted only after its durable receipt
is revalidated. Replays retain the original completion time.

`DISCUSSION_ERASURE_WORKERS_FENCED=true` explicitly acknowledges the prerequisite
drain/fence of old writers and materializers. Absent/false leaves accepted requests
pending without destructive work; invalid values refuse startup. All explicit
migrations and reviewed object inventory must be complete. Current schema-3 workers
must fulfill anonymous projection targets. Composition ensures the cleanup indexes
and uses the actual generation/legacy collections. No additional SQL schema is
needed; permanent barriers, object markers and projection guards remain retained.

Qualification passes **402 Management tests / 32 suites**, production build plus
33 prerequisites, source/test compilers and service/tool lint. Architecture covers
**136 projects / 1,539 sources / zero violations**; test inventory passes. One
existing test non-null assertion warning remains. An initial sandboxed test attempt
could not bind localhost; the authorized run passes. Nx labels the differing runs
as a flaky task, but the recorded failure was the sandbox denial.

The real-store erasure regression passes all existing canonical, projection,
private SQL and review checks. The compiled Account/Editorial/Discussion runtime,
real OPA, disposable stores and existing Firebase emulator qualify mixed public
discussions/reviews, private payload/history cleanup, actor reports/helpful removal,
peer content preservation, activation/inventory gates, materializer-lag pending,
restart during cleanup, a failed final SQL completion write and concurrent exact
completion. Real compiled materializer delivery/rebuild establishes convergence.
Account stays pending because Editorial has no completion yet. Integrated export,
source outage/recovery, cancellation and policy regressions also pass.

The first runtime fixture incorrectly assumed `--rebuild` itself materialized data;
it now runs the compiled consumer and waits for canonical revisions in Mongo.
The corrected runtime passes, followed by a final mixed-review run. Production code
is unchanged across these fixture refinements, so build/compiler/unit/real-store
evidence is reused. No UI/public read code changed; the prior 108-layout review
browser evidence remains applicable, without claiming an enabled erasure portal.

Evidence: `discussionParticipantCheckpoint` in the dated JSON and
`/tmp/wapps-readiness/discussion-participant-*`. Final source: 3,496 files, SHA-256
`13afaa4e84ee90b80e9efdb37e5c260fe68cfe283241365ecf6e444391d31f70`.
Work remains uncommitted on `codex/full-operation` at base `c965790e`.

**Next:** Editorial public-author anonymity, ownership termination and private/audit/
media cleanup, then the complete portal erasure journey. Production fencing,
deployment inventory, coordinated backup/restore/rollback, load and soak remain
unqualified. F30 and all OP gates remain open; the full-service goal remains active.

## Review erasure (October 12, 2026)

`MysqlReviewErasure` advances under the exact pending Discussion request/barrier
and completed object inventory. Public reviews retain IDs, text, ratings and other
members' helpful marks through a new immutable anonymous version. Hidden/withdrawn
reviews become pointer-free tombstones, unavailable even to staff. The atomic owner,
content/review/application revisions and durable history target prevent partial
anonymity. Current reads hide old reports immediately; old versions, reports,
commands and events then drain in bounded 128-row batches. Later reports and
independent moderation survive. Erased actor interactions and private audit reasons
on other members' reviews also drain without changing their ownership or decisions.

`ReviewErasure1791840008000` adds nullable ownership/content, tombstone time, history
targets and exact report-resolution revisions. Legacy provenance follows event
revision order, including identical timestamps/reasons. Missing applied schema,
invalid chronology/provenance and destructive rollback are refused. Ordinary review
writes serialize against actor and current-author barriers before application locks;
moderators cannot restore an author's private content during pending erasure or
acquire ownership of an anonymous review. Reviews read canonical SQL snapshots and
application revisions directly; they need no projection/outbox for these changes.

Qualification passes **392 Management tests / 31 suites**, the production build
and 33 prerequisites, both compilers, service/tool lint, inventory and architecture
checks (**136 projects / 1,537 sources / zero violations**). One existing test lint
warning remains. The final real-store erasure regression covers rollback, bounded
history, concurrent instances, in-flight reads, migration/provenance and chronology
refusal. Export regressions pass. The compiled API/browser workflow passes **108
responsive/theme layouts**, including retained anonymous and erased private reviews;
six representative screenshots were visually inspected. Browser/export evidence
predates only the final corrupt-chronology guard, separately qualified against SQL.

Evidence: `reviewErasureCheckpoint` in the dated implementation JSON and
`/tmp/wapps-readiness/review-erasure-*`. The frozen 3,492-file source manifest has
SHA-256 `b6b586859022f5dd8a974b9f824671ca4129f0fb4a6305d79381c38938dc59b9`.
Work remains uncommitted on `codex/full-operation` at base `c965790e`.

**Next:** compose and qualify Discussion's production cleanup and exact durable
completion, then Editorial and the portal erasure journey. Browser cleanup is
fixture-triggered; it does not qualify Account-triggered service completion.
The production participant still returns pending and the portal control remains
disabled. No F30 erasure or OP gate is complete. Production fencing, deployment,
coordinated restore/rollback, load and soak remain unqualified.

## Discussion private SQL cleanup (October 12, 2026)

`MysqlDiscussionPrivateErasure` implements an application port and advances only
under the exact pending erasure/barrier, a completed object inventory and finished
canonical author removal. It removes the erased actor's likes/votes for one node
per call, taking the aggregate lock and committing the next revision and outbox
intent with deletion. A failed outbox insert rolls everything back. Concurrent
peer reactions survive, old vote snapshots are rejected, and delayed materializers
cannot restore old counts. Authored content and timestamps are unchanged.

Command receipts drain in batches of 128 across tenants. Registry ownership is
cleared in batches of 128 only after every original owned object is retired and
unreferenced. Anonymous retired registry guards and permanent empty object markers
remain. Delayed retirement acknowledgements replay safely after attribution clears;
late PUTs cannot replace markers. Staff attribution on another owner's upload is
removed without changing its owner, state or bytes. The permanent identity barrier
continues to reject old command retries after receipts are deleted.

`DiscussionPrivateErasure1791840007000` adds actor-first indexes through explicit
API/maintenance migrations, validates transactional case-sensitive identities and
full lookup keys/order, and refuses missing applied/invisible indexes or destructive
rollback. An unmapped legacy interaction blocks cleanup for authoritative repair.
`drained` describes this SQL phase only; it never completes the service request.

Qualification passes **391 Management tests / 31 suites**, the uncached production
build and 33 prerequisites, source/test compilers, service/tool lint and inventory.
The existing test non-null-assertion warning remains. Architecture checks cover
**136 projects / 1,534 production sources / zero violations**. Real MySQL/MinIO/Mongo
checks pass outbox rollback, aggregate-lock concurrency, current count rebuilding,
stale-materializer refusal, bounded cross-tenant cleanup, duplicate workers, restart
between batches, retirement guards, other-owner preservation and schema refusal.
The immutable-upload/retirement/historical-inventory regression also passes.
Two initial qualifier failures concerned expected MinIO error/MySQL BIGINT return
formats; the assertions were corrected and the final run passes. Public UI/read
paths are unchanged, so the earlier compiled 84-layout browser evidence is reused.

Evidence: `discussionPrivateErasureCheckpoint` in the dated JSON and
`/tmp/wapps-readiness/discussion-private-erasure-*`. The 3,488-file source manifest
has SHA-256 `73763bb7455e43c2f82ebef67d72a62de297ecbefaa78a10ca634504497981f9`.
Work remains uncommitted on `codex/full-operation` at base `c965790e`.

**Next:** review author/history/interaction/moderation cleanup, then production
Discussion participant composition and exact completion. Editorial cleanup and the
portal erasure workflow follow. These primitives remain uncomposed; the portal
control remains disabled. No F30 erasure or OP gate is complete. Deployment,
production fencing, coordinated restore/rollback, load and soak remain unqualified.

## Discussion retained-projection cleanup (October 12, 2026)

`EraseDiscussionProjections` now consumes canonical anonymity's SQL cleanup targets.
It requires the exact pending erasure, completed object inventory, completed
canonical author removal and an explicit old-materializer fence/drain acknowledgement.
The SQL adapter locks owner/request before aggregate/node authority. The Mongo
adapter requires a majority-confirmed current anonymous schema-3 node at or beyond
the target revision, removes historical copies in batches of 100 with journaled
majority acknowledgement, and keeps the current stable record/tombstone permanently.
Projection lag leaves the SQL target pending; wrong attribution/scope fails closed.
The target is removed only after cleanup and a second stable-node check. A SQL
failure after the Mongo deletion leaves a replayable target.

The obsolete v1 `discussion_nodes` collection and leftover schema-2 copies are also
drained in bounded batches, including orphaned payloads whose ownership cannot be
established from that old cache. Current schema-3 records and canonical content are
preserved. Unknown generation schemas and leftover current attribution block the
phase. An unrelated old-schema head may be pending until authoritative reconciliation
rebuilds it; production activation therefore still requires the documented old-worker
fence and compatible restore discipline. Projection cleanup alone never completes
the service erasure request.

Qualification passes **381 Management tests / 30 suites**, the uncached production
build plus 33 prerequisites, source/test compilers, service/tool lint and inventory.
The existing test non-null-assertion warning remains. Architecture checks cover
**136 projects / 1,531 production sources / zero violations**. The real SQL/MinIO/
MongoDB author-erasure qualifier now additionally proves 205 historical copies are
removed across bounded batches, missing projections retain targets, crash replay
after Mongo deletion, current tombstone/other-member preservation, obsolete orphan
cleanup, unknown-schema refusal and truthful service-pending status. The earlier
compiled browser evidence remains applicable to unchanged public read/runtime paths;
no new UI or production participant activation is claimed.

Evidence is recorded as `discussionProjectionCleanupCheckpoint` in the dated JSON
and under `/tmp/wapps-readiness/discussion-projection-cleanup-*`. The 3,483-file
qualified source manifest has SHA-256
`109313ed8d575d19a4821aa93bbdfc3a54b3d220fbaae548ccae6d8f1d50770f`.
Work remains uncommitted on `codex/full-operation` at base `c965790e`.

**Next:** bounded private interaction/audit and review cleanup, registry attribution
removal, then production participant composition and exact durable completion.
Editorial and the portal erasure journey follow. No F30 erasure or OP gate is complete;
rollout, real fencing, restore/rollback, load and soak remain unqualified.

## Canonical Discussion contribution anonymity (October 12, 2026)

`AnonymizeDiscussionContributions` and its SQL/object adapters now process one
owned contribution per call under an exact pending erasure and completed historical
inventory. Published public/unlisted content keeps its IDs, authored text and reply
relationships. The replacement immutable payload removes envelope attribution and
structured display names; current public reads present `Deleted account`. Private
and deleted contributions clear their payload pointers and retain structural
tombstones. Other members retain their ownership and can continue replying.

The new additive `DiscussionAuthorErasure1791840006000` migration permits null
canonical/registry ownership and installs durable projection-cleanup targets.
Ordinary writers still require real owners; staff cannot edit an anonymous
contribution into new ownership. A deterministic `anonymizing` reservation precedes
conditional PUT. Its copy cannot be retired while still needed by an owned node,
and a worker overtaken before reservation does not upload unregistered content.
Canonical commit revalidates current node/root state under the aggregate lock,
clears ownership and commits pointer/revision/cleanup-target/outbox changes together.
Current locking reads prevent an earlier repeatable-read snapshot from hiding a
moderator deletion. Replies committed during object I/O are preserved.

The public read paths recheck authority after target/projection/vote I/O and after
assembling a topic list. Stale revisions produce pending; null current ownership
neutralizes stale attribution. Schema-3 stable records keep delayed materializers
from restoring the previous author/payload. The public label is presentation-only
so replacing a short name cannot push stored content over aggregate size limits.

Focused qualification passes **424 tests / 33 suites** (Management 376/29 and
Materializer 48/4), both uncached production builds and 33 prerequisite projects,
both source/test compiler pairs, service/readiness-tool lint and the test inventory.
One existing test non-null-assertion warning remains. Architecture checks cover
**136 projects / 1,528 production sources / zero violations**. Real SQL/MinIO/MongoDB
checks prove migration/re-entry/refusal, request/inventory prerequisites, retained
public/unlisted content, private tombstones, independent replies, upload/commit
replay, active-copy retirement exclusion, outbox rollback, moderator races in both
reserve and commit, concurrent retries and a paused worker overtaken before reserve.
Registry/inventory and export-source regressions pass separately.
The compiled ordinary Discussion API, real outbox/broker/materializer and
independent-browser regression also passes **84 responsive/theme layouts**, with
edit conflicts, moderation, exact retry, session isolation, restart, projection
lag/loss/rebuild, pagination and parent withdrawal. This is regression coverage of
the existing public workflow, not the unimplemented portal erasure action.

Evidence is recorded as `discussionAuthorErasureCheckpoint` in the dated
implementation JSON; source manifest and logs are under
`/tmp/wapps-readiness/discussion-author-erasure-*`. The qualified source manifest
contains 3,478 files with SHA-256
`1915c8433745368dadd25be7ee0d67b56cca0e1ff5308f68b08ccabea0a2294a`.
The work remains uncommitted on `codex/full-operation` at base `c965790e`.

**Completion limit:** this qualifies the application/adapters directly. They are
not yet composed into Discussion's production erasure participant, and the portal
erasure action remains disabled. Historical schema-2 projection copies, obsolete
object/registry attribution, private commands/audit/interactions and review history
still need bounded cleanup before a durable completion receipt. Then Editorial
cleanup and the complete portal erasure journey remain. Old writer/materializer
fencing, production rollout, restore/rollback, load and soak are unqualified. F30
erasure and OP01-OP10 remain open.

## Discussion projection erasure prerequisite (October 12, 2026)

Projection schema 3 replaces per-generation stored node copies with one stable
document per canonical node. Atomic conditional replacement only accepts newer
revisions, including deletion tombstones. Same-revision fingerprints must agree.
A delayed worker that already loaded an older payload cannot recreate those bytes
after the newer node is durable. Canonical MySQL snapshots, immutable MinIO payloads,
revision/outbox transactions and queue delivery remain unchanged.

Generation IDs still describe the complete snapshot. Readers require that exact
generation, node count and current canonical revision. During partial multi-batch
writes the old head may reference an incomplete generation, so reads return pending;
they never mix nodes from different revisions. Existing authority checks already
reject an old head after a canonical mutation. This documented protocol change is
needed to remove retained projection bytes safely, rather than merely hide old
generations from readers. Schema-2 heads are marked stale by reconciliation and
can upgrade at the same canonical revision through an authoritative rebuild.

Qualification passes **408 tests / 32 suites** across Management and Materializer,
both uncached production builds with 33 prerequisites, source/test compiler pairs,
affected lint and architecture (136 projects / 1,523 sources / zero violations).
One existing service lint warning remains. Real MySQL/MinIO/Mongo/RabbitMQ checks
cover duplicate/out-of-order work, same-revision schema upgrade and conflicts,
bounded stable storage, deletion, an old worker paused before its first write,
reconciliation, complete projection loss and rebuild. Broader Editorial/catalog
recovery also passes at this materialization integration point.

The compiled Discussion API, real delivery path and unchanged portal pass independent
members, public reads, replies/edit conflicts, moderation, exact retries across
navigation, session isolation, process restart, lag, pagination, parent withdrawal
and **84 responsive/theme layouts**. Local ingress identities are controlled
fixtures; production authentication/topology are not established by this test.
Evidence is recorded in `discussionProjectionErasureCheckpoint` in the dated JSON.

This does not yet remove previously stored schema-2 documents or canonical author
identities. The owning erasure participant must anonymize public content, purge
relevant old projection copies, retire obsolete objects, remove private/audit data
and then complete its receipt. Drain old-schema materializer binaries before
activating erasure. Preserve stable tombstones; destructive projection drop/restore
must drain in-flight workers before rebuilding from current authority. Deployment,
restore/rollback/load/soak, Editorial cleanup and the enabled portal erasure journey
remain open. No OP gate or F30 erasure is complete.

## Discussion historical-payload inventory checkpoint (October 12, 2026)

Discussion now provides `--inventory-payloads` to preview at most 32 objects from
its dedicated bucket, and `--apply <fingerprint> --legacy-writers-stopped` to apply
the exact reviewed batch. `DiscussionPayloadInventory1791840005000` adds a durable
cursor, revision, last completed batch fingerprint and inventory completion time.
Each successful object advances the cursor; an interruption requires reviewing
the remaining batch, while an exact completed-batch replay returns durable progress.
The compiled CLI is exercised across fresh processes, including migration/re-entry.

Canonical ownership determines treatment. Known immutable history is verified and
registered with an unknown uploader; mutable legacy content is durably reserved,
copied to a deterministic immutable key and confirmed before replacing the source
with a permanent empty marker. Unknown keys, unbackfilled content, inconsistent
ownership and surviving graph references block destructive progress. No identity
is inferred from text. Proven unreferenced orphans and obsolete content under an
exact pending erasure request can be retired. Current public references survive.

Apply holds a connection-bound advisory lock. Each mutation rechecks authority
under canonical owner/resource locks; orphan retirement holds registry/reference
gap locks through the conditional object operation. Source ETags must still match
the reviewed generation. SQL reservations precede copy I/O, so late copies remain
attributable if erasure starts. Inventory never modifies current public pointers,
aggregate revisions or outbox rows, and cannot complete account erasure.

Qualification passes **383 tests / 29 suites** across Discussion and MinIO, the
uncached production build with 33 prerequisites, source/test typechecks and
affected lint. One existing service lint warning remains. Architecture passes
136 projects / 1,523 production sources with zero violations; the test inventory
retains its explicit gaps. Real disposable MySQL/MinIO checks cover reviewed CLI
apply/replay, multiple 32-object pages, migration loss/corruption/re-entry,
concurrent inventory exclusion, 34 recovered historical versions, owner export,
unresolved-owner preservation, legacy-copy crash recovery, ETag drift, a blocked
concurrent registration and erasure during copy. Real enabled/suspended bucket
versioning is refused. Existing payload retirement races and the private export
source regression also pass with the shared bounded object reader.

No portal source or projected content changes in this slice; existing browser and
materialization evidence is reused for those unchanged paths. Fixture command
policy is substituted; the maintenance CLI uses isolated operator credentials.
The initial restricted HTTP run was blocked by loopback sandbox permissions;
the approved retry passed. New test mock typings and a fixture restore statement
were corrected before final qualification. Exact commands and the frozen source
manifest are in `discussionPayloadInventoryCheckpoint` in the dated readiness JSON.

**Deployment requirements:** stop/fence older unregistered or mutable writers and
drain outstanding uploads before acknowledging the flag; resolve blocked ownership
through the reviewed legacy backfill; retain markers permanently; keep the bucket
unversioned and SQL/object backups consistent. The flag records an operator
acknowledgement, not technical proof of a production cutover. No deployed inventory
or restore/rollback/load/soak qualification is claimed.

**Next:** compose inventory completion and bounded registry retirement into
Discussion cleanup, anonymize public canonical authors and payload display names,
enforce anonymity while projections lag, remove private/audit data, and issue the
durable participant receipt. Editorial cleanup and the enabled portal erasure
journey remain open. F30 erasure and OP01-OP10 are not complete.

## Discussion registered-payload export checkpoint (October 12, 2026)

Account archives now include the Discussion owner's registered current,
historical/replaced, removed and uploaded-but-uncommitted payload versions. The
existing source captures these in the same read-only SQL snapshot with 128-row
keyset pages. Current contribution bodies require exact committed registry
ownership, tenant, node, checksum and byte size before storage reads. Records
created after the snapshot are excluded. This adds no migration or projection.

The `payload-versions` collection contains portable authored content and its
version/lifecycle metadata. Other actors are labeled `other`, unknown uploaders
`unknown`; private actor IDs, storage keys and envelope fields are excluded.
The account's upload actions for another owner produce `payload-uploads` metadata
without that owner's identity, content, hash or current-use status. They never
read that owner's objects or current canonical content.

An unconfirmed reservation may contain a successfully uploaded body whose response
was lost, or no observed object. Only exact `NoSuchKey` is accepted as
`storage: not-observed`; generic 404s, missing buckets, denials, outages, timeouts
and corrupt bytes fail capture. Uploaded/committed versions require exact bytes.
Retiring records cannot complete capture; retired records export metadata only.
Retirement after the SQL snapshot invalidates the old expected body and requires
a fresh capture. SQL state is consistent; object presence is an observation in
the capture interval, not a distributed atomic snapshot or permanent absence.

Qualification passes **323 tests / 26 suites**, Discussion's uncached build and
33 prerequisites, source/test typechecks and affected lint. Architecture passes
136 projects / 1,519 production sources with zero violations; inventory retains
its explicit gaps. Real SQL/MinIO qualifies 134 contributions, 135 registered
versions and 131 review versions, including bounded paging, edits during capture,
removed content, lost confirmation, uncommitted uploads, exact-case isolation,
foreign-uploader privacy, missing/corrupt obsolete files, a missing bucket,
retirement races, cancellation and reconnect. The source fixture substitutes
command policy; compiled-runtime checks use actual OPA.

The compiled Account/Editorial/Discussion journey creates and edits private
Discussion content over HTTP. Archive checks and an actual browser download both
verify the original and current versions while excluding foreign private text.
Independent sessions, lost responses/exact retry, restart, outage recovery,
cancellation/removal and six responsive/theme layouts pass. Existing erasure
coordination still completes Account's own cleanup and truthfully leaves remote
cleanup pending. Trusted ingress identities and a separate Firebase emulator
project are controlled fixtures; no production authentication/deployment claim
is made. Existing portal artifacts are reused because no UI source changed.
Exact commands, source manifest and evidence are in
`discussionPayloadExportCheckpoint` in the dated readiness JSON.

This supersedes the registry-export gap in the preceding payload checkpoint.
**Still unfinished:** inventory/proven attribution for unregistered historical and
legacy mutable objects, automatic Discussion retirement/anonymization/private-
data cleanup and completion, Editorial erasure and the complete portal flow.
Deployment, restore/rollback, load/soak and every OP gate remain open.

## Discussion payload registration checkpoint (October 12, 2026)

Historical prerequisite checkpoint; the registered-payload export checkpoint
above closes its new-registry export gap. Its other erasure limits remain open.

All ordinary Discussion create/reply/edit writers and the explicit legacy importer
now reserve immutable payload ownership in SQL before uploading to MinIO.
`RegisteredDiscussionPayloads` coordinates registry/object ports. Reservations
bind the node, owner, actor, tenant, exact immutable key, checksum and bounded byte
length. Sorted owner/actor barriers protect registration and upload confirmation;
canonical publication requires the matching uploaded reservation in the same
transaction as content, receipt and outbox. A failed transaction leaves an
attributable uncommitted object and no partial public mutation. Legacy import
records its proven owner and an unknown uploader, never an invented actor.

`RetireDiscussionPayloads` advances at most 32 obsolete references under the exact
pending erasure request/barrier. SQL durably claims retirement and excludes all
currently referenced keys. MinIO conditionally replaces bytes with a permanent
empty marker, or reserves an absent key with that marker. A paused conditional PUT
cannot recreate the bytes. Conflicts, storage outages, reconnect and replay are
safe; versioned/suspended buckets are refused. Markers must never be removed by
lifecycle policies. This primitive returns progress, not an erasure completion
receipt, and is **not yet composed into the production erasure participant**.

`DiscussionPayloads1791840004000` installs the registry and full payload-reference
index in API/maintenance migration lists. It validates schema, indexes, current
authority and retained records, backfills only provable current references, and
refuses lost applied schema or destructive rollback. Unknown historical/orphan
and legacy mutable objects still require inventory. The newly attributable
registry/obsolete bodies also need account-export coverage; the existing export
regression covers its earlier canonical-current scope only.

Local qualification passes **582 tests / 44 suites / four projects**, affected
service/library builds, source/test typechecks and lint. Architecture covers 136
projects / 1,518 production sources with zero violations; inventory passes with
the existing gaps. Real MySQL/MinIO checks cover atomic outbox rollback, foreign
scope/unconfirmed-upload rejection, a PUT paused after reservation, 36 obsolete
objects across two batches, storage failure/reconnect and late-write rejection.
Current public objects, another member and a case-distinct owner remain intact.
The four-store Discussion/Editorial/materialization/catalog regression passes.
The rebuilt Account/Editorial/Discussion runtime passes export, erasure outage,
restart and truthful pending-completion regression. The Discussion portal passes
84 responsive/theme layouts and independent-member retry/conflict/moderation,
pagination, restart, withdrawal and projection-loss/rebuild checks.

Qualification exposed two stale harness assumptions: catalog setup omitted later
Editorial migrations, and Discussion browser controls predated voting. Both were
updated to the current contract. A later browser attempt stopped at a generic
erasure-request schema error; its database had already been cleaned up. An
instrumented run passed and captured valid metadata, so that failed run's exact
metadata is unavailable. Review found that the two erasure migrations depended
on unordered TypeORM index enumeration. They now use MySQL `SEQ_IN_INDEX` order
and reject prefix/extra/unique definitions. Unit and real SQL tests deliberately
reverse ORM metadata over valid indexes, then remove/reverse/truncate actual
indexes and require failure. Corrected builds and compiled-runtime migration
checks pass. The original intermittent failure is not claimed as forensically
reproduced. Browser evidence predates only this migration-validation repair;
unchanged portal/application behavior is reused, with rebuilt runtime evidence
covering the repair. Exact sources, commands and limits are in
`discussionPayloadRegistryCheckpoint` in the dated readiness JSON.

**Still unfinished:** historical object inventory, export of retained registry
data/bodies, automatic retirement composition, canonical public-author and payload
anonymization with current-read protection during projection lag, Discussion and
Editorial private/audit cleanup and completion, and the portal erasure workflow.
Production rollout, restore/rollback, load/soak and all OP gates remain open.

## Account private-data cleanup checkpoint (October 12, 2026)

The composed Account erasure participant now removes Account-owned private data
and records a completed receipt only after all of that work commits. The
application orchestrator first persists the exact request/barrier and validates
identity, deletion revision and participant before advancing cleanup. The SQL
adapter requires the exact inactive canonical tombstone, locks identity before
request/barrier, and preserves those minimal lifecycle records plus credential/
coordination journals and the existing identity outbox. No public projection is
changed by this Account-only cleanup.

Each transaction removes bounded batches of profiles/contact data, avatars,
preferences, favorites, account commands, follower relations/receipts and the
erased recipient's badge state/history. Export cleanup handles eight jobs and
sixteen chunks per job at a time; a job is removed only after its chunks. Larger
histories/archives stay pending and resume safely. Late account/export writes are
denied by canonical deletion. Cleanup does not advance the deletion revision or
disturb lifecycle delivery.

Other members' badge state and award/revocation facts remain intact. The erased
staff actor, private reason, idempotency key and fingerprint become null together.
New decisions still require a staff actor and reason. The staff portal shows
"Deleted staff account" and "Reason removed with staff account." for those
retained events. The additive `ProfileBadgeErasure1791840003000` migration is
registered in both identity runtimes and maintenance. It validates old history
before upgrade, rejects partial nullability/lost applied schema and validates
replay after anonymization. Only an inaccessible erased recipient with an exact
pending request/barrier may have a temporarily partial history during bounded
cleanup. Completed cleanup cannot retain that recipient's badge rows. Destructive
rollback is refused.

Qualification in the isolated Node 22.17.1 installation passes **1,206 tests / 106
suites / six affected projects**, seven source/test typecheck pairs, affected lint,
four service builds and both aggregator library/CSR builds. Angular artifact
inspection passes. Architecture covers 136 projects / 1,515 production sources
with zero violations; inventory passes with existing coverage gaps retained.

Real MySQL checks cover injected rollback, more than one batch of commands/badge
history/export chunks, exact completion after concurrent reconnect, case-sensitive
foreign-account isolation, blocked late export writes, unchanged lifecycle outbox
and migration re-entry during/after cleanup. Compiled Account DELETE during a
Discussion outage now completes the Account participant, removes its private
tables, resumes remote requests after restart and still reports overall cleanup
pending. The integrated account-export runtime regression also passes.

The badge browser journey passes compiled Account/real OPA/MySQL, independent
staff/member/public sessions, retry/conflict, privacy, history, outage and restart.
All 84 responsive/theme layouts pass; the six new erased-author screenshots were
visually inspected at 390/768/1440 in both themes. Erased-staff setup invokes real
canonical adapters; it is not a complete browser erasure journey. The first run
failed before browser startup because OPA was absent from PATH; rerunning with the
verified `OPA_BINARY` passed without a product-code change. Exact manifests,
commands, logs and limitations are in `accountErasureAccountCleanupCheckpoint` in
the dated readiness JSON.

**Still unfinished:** Editorial/Discussion private-data and audit cleanup,
public-author anonymization including payload attribution, current anonymity
during projection lag, safe immutable-file retirement including paused uploads,
their completion receipts and the portal erasure workflow. Production migration/
secrets/rollout, restore, compatible rollback, load/soak and all OP gates remain
open. Next is the owning-service cleanup and retirement work under the existing
durable coordination.

## Account erasure coordination checkpoint (October 12, 2026)

Historical coordination checkpoint; the Account cleanup checkpoint above
supersedes its Account-participant limitation.

Account deletion now records both credential cleanup and cross-service erasure
work in the canonical tombstone transaction. The composed Account worker requests
Account, Editorial and Discussion independently and requires an exact identity,
deletion revision and participant receipt. One unavailable participant does not
prevent requests to the others. Each participant atomically records a permanent
write barrier and pending request; replays preserve the first cutoff and completed
receipts, and a different revision conflicts. The local Account participant also
requires the exact retained inactive tombstone.

The separate `identity_erasure_jobs` journal preserves credential receipts. Its
migration backfills every retained tombstone, including credential-only completed
jobs. Overall cleanup reports completed only when both journals are complete.
Pending participant work defers for 30 seconds and resets consecutive failures;
outages use bounded backoff and quarantine after 12 failures. Lease tokens fence
completion, deferral and failure writes. Explicit `--erasure-status` and
`--erasure-requeue <uid>` maintenance commands inspect and recover this journal.
Neither an accepted request nor credential removal means erasure has completed.

Editorial and Discussion expose `POST /api/internal/account-erasure` only to the
dedicated service principal through `x-account-erasure-writer` and explicit OPA
policy. `ACCOUNT_ERASURE_SECRET` must be 32-128 URL-safe characters, distinct from
ingress and export credentials. Mixed user/service headers, duplicates, extra
body/query fields and nonmatching receipts are rejected. Remote calls forbid
redirects, have a five-second deadline and bound receipts to 4 KiB. Pending and
completed receipts use HTTP 202 and 200 respectively, with private/no-store.

`AccountErasureRequests1791840001000` follows the write-barrier migration in all
three owning databases. `AccountErasureCoordination1791840002000` follows it in
both identity runtimes and identity maintenance. Backfills use bounded keyset
batches; schema/state re-entry checks preserve authority and refuse lost applied
tables or destructive rollback. Local Compose examples and three Kubernetes
manifests reference the dedicated credential; no deployment or secret provisioning
has occurred. All owning-service writers must support barriers before activation.

Qualification uses Node 22.17.1 in the isolated installation. Core, management,
MySQL, Account, Editorial and Discussion regression passes **1,680 tests / 122
suites / six projects**. Four service builds plus 35 prerequisite targets pass;
all seven affected source/test typecheck pairs and affected lint pass. Real OPA
bundles, inventory and architecture checks pass (136 projects / 1,512 production
sources / zero violations); existing lint warnings remain visible.

The real MySQL qualifier covers credential-completed tombstone backfill without
receipt loss, independent participant outage/retry, exact replay/conflict,
case-sensitive barriers, transaction rollback, expired-lease fencing, reconnect,
completion only after every participant receipt, and migration recovery guards.
Its completion receipts are explicit fixtures for future cleanup consumers; it
does not pretend that private data was removed. The compiled-runtime qualifier
uses real MySQL/Mongo/MinIO/RabbitMQ/OPA and an isolated project in the existing
Firebase emulator. An actual Account DELETE removes credentials, reaches available
participants during a Discussion outage, resumes after restart, rejects subsequent
Discussion writes and retains pending cleanup across another restart. Dedicated
HTTP credentials, conflict/query rejection and the existing export workflow pass.
Trusted ingress identities are supplied by the harness; no browser or deployed
authentication qualification is claimed for this prerequisite.

**Still unfinished:** owning-service anonymization, current anonymity during
projection lag, private-data/audit cleanup, immutable-file retirement including
late uploads, and completion consumers. No production participant currently marks
its cleanup request completed. Portal erasure remains disabled. The next slice
implements cleanup behind these durable requests; all OP gates remain open.

## Account erasure write-barrier checkpoint (October 12, 2026)

The confirmed policy remains: retain public contributions with anonymized
authorship, delete private data and end ownership access. This checkpoint delivers
the concurrency prerequisite, **not the account erasure workflow**. The existing
Account deletion pump still removes credentials only; it does not invoke the new
barriers. No erasure control has been enabled in the portal.

Editorial and Discussion now install `IdentityWriteBarrier1791840000000` in their
own databases through both maintenance and runtime migration lists. Canonical
member writes lock the identity barrier before resource/workspace locks and before
receipt replay. Article/release/application/suite publication and ownership review
also lock the affected author/claimant alongside the staff actor in a consistent
order. Review transactions explicitly carry the authenticated actor into the SQL
adapter before acquiring their application lock. Existing generic editorial,
discussion/reply/vote/moderation, draft and image reservation/completion commands
use the barrier; erased actors receive a canonical denial surfaced as HTTP 403.

A barrier begins under that same lock and retains the original Account deletion
revision and service-local cutoff. It survives cleanup and process restart. It
cannot be reset through a writer's upsert, changed by a conflicting deletion
revision, or used outside a transaction. Failed erasure transactions roll back
their marker; completed barriers reject queued writers and old command receipts.
The migration validates InnoDB, case-sensitive identity keys, supported columns,
unique constraints, absence of foreign keys/triggers and bounded stored-state
re-entry. A missing table after a recorded migration fails closed instead of
recreating an empty barrier set. Destructive down migration is refused. This
prerequisite changes no public payload or projection and therefore introduces no
materialization event.

Focused regression passes **1,083 tests / 82 suites / three projects**: identity
MySQL 207/13, Editorial 613/46 and Discussion 263/23. All three builds and their
33 prerequisite targets pass uncached. Affected lint passes with existing warning
debt. The architecture audit covers 136 projects / 1,502 production sources with
zero violations. Source/test typechecks and readiness-tool/inventory results are
recorded with the exact source manifest in the dated evidence JSON.

`qualify-identity-mysql.cjs --identity-write-barriers` passes on disposable MySQL
8.4, observing actual InnoDB lock waits in both race directions, rollback,
replay/conflict, case isolation, sorted concurrent locks, independent reconnection
and migration re-entry rejection. It additionally tests 20 prepared owning-service
mutation/receipt paths against the real barrier before resource I/O. These are
adapter checks, not complete domain workflows.
`qualify-suites.cjs --identity-write-barriers` passes against compiled Editorial,
real MySQL and OPA. It creates application/suite/article drafts and submissions
through HTTP, then verifies owner/actor denial, exact receipt denial, independent
staff publication/ownership denial and API restart without changed canonical
counts or outbox intent. The harness supplies trusted ingress identities and
internal erasure markers; production authentication is not claimed.

Next: authenticated cross-service erasure orchestration, retained-content author
replacement and revision/outbox propagation, current anonymity during projection
lag, private data/receipt/audit cleanup, safe retirement of immutable payloads and
late uploads, durable participant completion, then the confirmed portal deletion
flow and end-to-end recovery/browser qualification. Deployment requires migrating
both owning services before their updated binaries start. Old writer binaries
that do not take these locks must not coexist once erasure activation is enabled;
rollback needs a reviewed data-preserving compatibility plan. All OP gates remain
open.

## Account export workflow checkpoint (October 12, 2026)

API-mode Privacy Settings now requests a durable account export, polls queued/
building/retry state, recovers status after reload, downloads a verified gzip JSON
Lines archive and cancels/removes it. It includes retained Account, Firebase
credential profile, Editorial and Discussion data under each source's documented
allowlist. Private source snapshots are independent, with completion receipts;
there is no distributed point-in-time snapshot. Passwords, tokens, other authors'
private data and staff-only audit details remain excluded. Saved-preferences-only
download remains a separate action. Explicit demo mode retains local export only.

The compiled Account runtime composes the durable SQL store, four real readers,
gzip writer and one capture worker per process. SQL leases arbitrate replicas and
restart recovery. `POST/GET /api/me/exports`, `GET/DELETE /api/me/exports/:id` and
`GET /api/me/exports/:id/download` enforce authenticated self-only access and
current canonical lifecycle. A request takes `{}` and one Idempotency-Key. Latest
status is `{ job: null | AccountExportJob }`. Status/read/query scope is strict.
Downloads are private/no-store, bounded, backpressured and digest-verified. Their
deadline/disconnect interrupts a stalled iterator wait; its capacity permit stays
occupied until pending SQL cleanup completes, bounding outstanding reads at four.
No claim is made that this HTTP cancellation physically interrupts a MySQL query.

The portal uses an application service, port, HTTP/download adapter and reusable
presentation. It retains the same uncertain request key across route changes in
the current session; a full browser reload rereads the canonical latest job.
Session changes cancel old operations and clear private state. An unavailable read
disables stale download actions. The browser verifies length/type/SHA256 before
saving and buffers the archive in memory; maximum-size mobile performance remains
part of the open load gate. The pure identity domain package is marked side-effect
free so export validation stays lazy without raising the initial-load budget.

Current focused regression: **650 tests / 75 suites / three projects** (Account
245/16, portal identity 73/10, aggregator 332/49). Account and aggregator library
builds, source/test typechecks and affected lint pass. The library build covers 87
targets, and all 57 Angular packages pass emitted-artifact checks. Architecture
covers **136 projects / 1,500 sources / zero violations**; test inventory and
changed readiness-tool lint pass. Existing lint/build warning debt remains.
CSR initial bytes remain **1,498,188 / 1,500,000**, with 1,812 bytes headroom.
Earlier separate source and unchanged generated-policy evidence remains applicable.

`qualify-suites.cjs --account-export-runtime` passes ten groups using disposable
MySQL 8.4, Mongo 7, RabbitMQ 4, MinIO, the existing loopback Firebase emulator in a
new project namespace, compiled Account/Editorial/Discussion APIs and real OPA.
Editorial starts from canonical SQL fixtures; Discussion content uses real HTTP
commands. The archive contains all four real receipts and verified owned media.
Checks cover replay, competing requests, cross-owner denial, corruption, source
outage/retry, API restart, recovery from a persisted interrupted lease/partial
chunk, in-flight cancellation, expiry purge and suspension. Fixture timestamps
accelerate lease/expiry boundaries; temporary suspension blocks access without
purging an unexpired archive. Export never reads the disposable Mongo projection.

Independent Chromium sessions pass lost-response retry, restart/reload, actual
four-source download, foreign-owner denial, status outage, session switch during
download and archive removal. Six layouts at 390/768/1440 pixels in both themes
pass automated checks and screenshot review. The local browser gateway substitutes
trusted identity headers; deployed credential validation/ingress is not claimed.
Compose validates and all three Kubernetes overlays render. Provision the same
dedicated `ACCOUNT_EXPORT_SOURCE_SECRET` in Account, Editorial and Discussion,
distinct from ingress credentials, before coordinated rollout. Kubernetes expects
`account-export-secret` / `secret` in each relevant namespace. No secrets were
provisioned and no deployment was performed.

Evidence: `accountExportWorkflowCheckpoint` in the dated readiness JSON and
`/tmp/wapps-readiness/account-export-workflow-checkpoint.json`. The complete live
run and six screenshots are in `account-export-workflow-live-2/`; its log is
`account-export-workflow-live-2.log`. No OP gate closes. Cross-service erasure,
remaining privacy/notification consumers and production restart/restore/rollback/
load/soak remain required by the full-service goal.

## Editorial account export checkpoint (October 12, 2026)

Editorial now captures the exact owner's data across tenants in one cancellable,
read-only repeatable-read SQL snapshot: application/suite/article/release drafts,
retained immutable submissions, publication metadata/content, canonical catalog
fields and relations, ownership claims/decisions/grants, media bindings and retained
upload metadata. Ready owned assets include verified normalized WebP bytes in
bounded base64 records. Original upload bytes are not retained. Retired historical
article covers remain references without invented bytes. Inherited references to
another uploader's images do not grant private byte access. Current binding loss,
missing/corrupt retained objects and inconsistent ownership fail capture.

Private drafts remain separate from reviewed publications. Former application
owners retain their own history without receiving a successor's canonical/private
content. Scrubbed application and suite tombstones preserve only retained values;
export validation does not relax the live public projection contract. Staff actor
IDs, proof tokens, leases, command receipts and outbox payloads are excluded.
No migration, new projection or materialization event is added. Concurrent object
retirement can invalidate a SQL snapshot's byte references: that attempt fails and
a new attempt rereads authority. The completion receipt follows SQL commit.

`POST /api/internal/account-export` uses the shared source-access application
boundary, dedicated `ACCOUNT_EXPORT_SOURCE_SECRET`, fixed service identity/role/
scope and explicit OPA action. It rejects user/profile/ingress credentials, mixed
roles, duplicate headers and scope overrides. HTTP streaming has bounded records,
backpressure, cancellation and a deadline. Configured media adapters now propagate
caller cancellation through S3 request and body reads.

The final Editorial regression passes **613 tests / 46 suites**; its declared
build, source/test typechecks and lint pass. Reused preceding source checks add
962 tests / 76 suites across seven unchanged projects, for **1,575 applicable
tests / 122 suites / eight projects**. Merged real OPA passes **157 cases**.
Architecture covers **136 projects / 1,492 production sources / zero violations**;
inventory has no errors and changed readiness-tool lint passes. Existing warning
debt remains. No portal changes invalidate the preceding visual or CSR evidence.

`qualify-suites.cjs --account-export-editorial --no-browser` passes five focused
groups with disposable MySQL/MinIO, compiled Editorial HTTP and real OPA. Canonical
SQL fixtures cover 140 retained submissions, multiple owner tenants, foreign/case
isolation, current versus approved content, scrubbed tombstones, chunked image
integrity, concurrent edits, cancellation/early return, reconnect, corrupted/missing
objects, media retirement, API restart and policy outage. These are source-capture
checks; they do not requalify publication commands or provide an integrated
four-source Account archive/browser journey. The harness also starts disposable
Mongo through its shared setup; export does not read it.

Evidence is under `accountExportEditorialCheckpoint` in the dated readiness JSON
and `/tmp/wapps-readiness/account-export-editorial-checkpoint.json`. Final logs use
the `account-export-editorial-` prefix, with `live-final/qualification.json` holding
the service results. The source manifest records 3,410 files and SHA256
`88616ae9b8740514e5ef6ac43480d3cdeb2d6e5ea93a8f99da76ad4118b69ad5`.
All four sources are now separately qualified. Account pump/public request/status/
cancel/download APIs, portal acceptance, credential provisioning and deployment
remain open. Full export, cross-service erasure and every OP gate remain unfinished.

## Account export source checkpoint (October 12, 2026)

Historical three-source checkpoint; Editorial's checkpoint above supersedes its
Editorial-capture limitation. Full export remains in progress. Real Account, Firebase credential and Discussion
adapters are now implemented and locally qualified. Editorial capture, Account
job-pump/API composition and portal/download acceptance are still required; the
privacy page continues to export saved preferences only. No OP gate closes.

Account's explicit allowlist captures the registered canonical identity, private
profile/contact, preferences/defaults, favorites, current follow relations, badge
state and verified current avatar bytes in one consistent SQL snapshot. Staff
badge reasons/actors and provider secrets are excluded. Firebase returns safe
profile/provider/MFA metadata and timestamps without hashes, salts, tokens or
custom claims. Its ten-second deadline fences late results but cannot physically
cancel the underlying Admin SDK request.

Discussion reads canonical SQL plus committed immutable objects across the exact
owner's tenants, independently of public-profile visibility. It includes current
owned content, structural context, tombstones, every retained owner review
version, votes/likes/helpful marks and own reports. Other members' private text,
staff report-resolution reasons, outbox/command records and unreferenced objects
are excluded. Bounded graph checks reject cycles, missing parents and inconsistent
authority; byte/hash/UTF-8 checks reject invalid objects. All SQL capture uses a
shared cancellable read-only snapshot with bounded queries and a completion
receipt emitted only after commit. This introduces no projection or migration.

Discussion's `POST /api/internal/account-export` is wired to the real adapter and
requires a dedicated `ACCOUNT_EXPORT_SOURCE_SECRET`, distinct from ingress
authentication, plus the fixed service identity/role/scope and OPA permission.
Requests accept only a canonical owner UID; user credentials, query/tenant
overrides, duplicate credentials and mixed roles fail closed. The Account HTTP
adapter validates bounded NDJSON through EOF, using a fixed one-MiB record buffer,
no redirects and no ambient credentials. SQL/HTTP capture, backpressure and object
reads have cancellation/deadline handling. Source-secret provisioning and Account
runtime use remain pending. No end-user export endpoint is enabled by this work.

Latest applicable unit/HTTP regressions pass **962 tests in 76 suites across seven
projects**. Builds, source/test typechecks and affected lint pass; existing warning
debt remains. Real merged OPA policies pass 149 cases, including exact service-only
export access and admin/mixed-role denial. Inventory has no errors; architecture
covers 136 projects and 1,485 production sources with zero violations.

The isolated Account SQL test proves consistency during profile/preferences/
favorite edits, 140 saved relations across batches, case/owner isolation, private
data, badge-audit exclusion, avatar integrity, reconnect, cancellation, timeout,
corruption and inactive/deleted-owner rejection. Firebase emulator qualification
passes with a disposable account. The isolated Discussion SQL/MinIO test proves
134 owned contributions across tenants, 131 retained review versions, concurrent
edit consistency, tombstones, foreign-content exclusion, relationship export,
reconnect/cancellation and rejection of missing/corrupt objects and structural or
history loss. Its command policy is substituted. Separate HTTP tests cover the
controller/middleware, policy denial/outage, partial-stream failure and client
disconnect; the Account transport tests cover chunk/UTF-8 boundaries, limits,
malformed/mixed/incomplete sources, deadlines and late results.

Evidence is recorded in `docs/readiness/implementation-2026-10-11.json` under
`accountExportSourcesCheckpoint` and `/tmp/wapps-readiness/account-export-sources-checkpoint.json`.
Key logs in that temporary directory are `account-export-real-account-2.log`,
`account-export-real-credentials-1.log`, `account-export-discussion-live-3.log`,
`account-export-source-transport-tests-2.log`,
`account-export-source-transport-build-2.log` and `account-export-source-opa-1.log`.
The checkpoint identifies reused checks and their source manifests; it does not
claim a compiled four-source service journey or browser qualification. No portal
files change, so the previous qualified CSR budget/visual evidence remains valid.

Next: implement Editorial's canonical owned draft/submission/publication/media
capture, then compose all four sources with the Account worker/API and complete
the portal workflow before declaring export delivered. Cross-service erasure
under the confirmed anonymization policy and service-wide operational gates remain
open. Work remains uncommitted on `c965790e`.

## Account export storage checkpoint (October 12, 2026)

The export foundation now persists owner-scoped requests and immutable compressed
chunks in canonical MySQL. Exact command replay preserves the original job,
including cancellation and expiry. One queued/building/ready job is allowed per
account, with six new requests per rolling 24 hours. Cancellation, retry failure,
expiry and deleted-owner cleanup remove payloads; receipts remain for safe replay.
Every download chunk rechecks current account lifecycle and job availability.

All four source adapters are mandatory: Account, credentials, Editorial and
Discussion. A source must supply one start, bounded JSON records and an exact
completion count. Missing, mixed, reordered or truncated sources cannot become
ready. The archive is gzip NDJSON with a manifest and per-source capture receipts;
compressed chunks and the complete archive have SHA-256 checks. Ready transition
verifies all persisted bytes in the same transaction that publishes the artifact.
There is no new projection or broker handoff. This is infrastructure qualification,
not proof that all real personal data is captured.

Workers use renewable leases, six bounded attempts and a 15-minute attempt limit.
Timeout, lease loss, shutdown, lifecycle rejection and storage failure cancel
capture/compression; a late callback cannot write or publish. An abandoned attempt
is discarded before a fresh capture. Resource bounds include 256 KiB compressed
chunks, 1 MiB records, one million records, 1 GiB compressed and 4 GiB uncompressed
data. Limits fail explicitly without yielding a downloadable partial archive.

The additive `AccountExports1791676832000` migration is registered in both identity
runtimes and maintenance. It validates storage engines, columns, case-sensitive
keys, indexes, chunk ownership and existing artifact integrity, supports reentry
after DDL and refuses destructive rollback. The application boundary requires
self authorization through `identity.account-export.manage`; administrators cannot
use it to export another member. No export HTTP endpoint or runtime pump is wired.

Qualification passes 648 tests in 49 suites across five affected projects,
98 identity OPA cases, affected builds/typechecks/lint, test inventory and
architecture checks across 136 projects/1,476 production sources. Existing lint
warning debt remains. The disposable MySQL 8.4 journey verifies concurrent
requests/claims, exact replay, immutable chunks, crash reclaim, reconnect,
corruption rejection, failed-source cleanup/backoff, quota, expiry, cancellation
and erasure during downloads, and SQL rollback. The surrounding identity SQL
regression also passes. No portal UI changes were made in this checkpoint.

Evidence: `/tmp/wapps-readiness/account-export-storage-live-3.log`,
`account-export-identity-regression.log`, `account-export-regression-tests.log`,
`account-export-final-library-tests.log` and `account-export-final-build.log` in
the same directory. The export SQL journey uses real storage and gzip with fixture
source records. Real service readers, retained media/submission coverage,
service-only authorization, credential-emulator integration, Account endpoints,
portal/browser qualification and production operation remain open. Continue this
same workflow through those layers before declaring full export delivered.

The confirmed erasure policy retains already-public contributions with anonymized
authorship, removes private data and ends ownership access. Cross-service erasure
and all OP01-OP10 gates remain open. Work stays uncommitted on `c965790e`.

## Published profile articles checkpoint (October 12, 2026)

Member profiles now list real published articles with title, excerpt, original
publication date and canonical article links. Twenty-item UUID pages provide
refresh and continuation. Loading, hidden, empty, unavailable and retry states
remain distinct; target/session changes cancel obsolete requests. Current profile
audience and Show Activity History apply, including owner preview.

Authorship comes from the canonical publication owner with matching draft and
Editorial tenant/owner state. Other authors, duplicate bylines, private tenants,
unpublished drafts and withdrawals are excluded. Existing published-generation
readers enforce exact revision/submission metadata and recheck canonical selection
following projection I/O. Account reconfirms the full profile stamp after Editorial
responds. Internal reads require the fixed profile-reader identity, private service
credential, configured tenant and dedicated OPA action. No new projection or
migration is introduced. Private edits cannot alter approved public summaries.

Local qualification passes 1,366 tests in 122 suites across six projects, 56
Editorial OPA cases, affected builds/typechecks/lint, architecture checks across
136 projects/1,468 production sources, test inventory and 57 Angular artifacts.
The compiled production CSR passes at 1,498,188/1,500,000 bytes, leaving 1,812 bytes.
Existing warning debt remains. Article response parsing stays in a lazy chunk.

The real SQL/OPA/Mongo/API journey creates 21 reviewed public articles and separate
private, other-author and other-tenant fixtures. It checks 20/1 paging and unchanged
full totals, private edits, immediate withdrawal, projection lag/loss, reconstruction
through the canonical snapshot reader/writer, stale replay and Account restart.
Actual Editorial responses held during sharing/audience changes are rejected by
Account. Hidden sharing avoids unavailable content dependencies; retry recovers.
The surrounding Discussion/favorites recovery and migration regression also passes.

Independent browsers exercise real privacy settings, owner preview, follower
approval/removal, article links, paging, outage/retry, hidden/private/empty states
and restart. Ten states at three widths and two themes produce 60 layouts without
overflow or column misalignment. Representative mobile/tablet/desktop screenshots
were visually reviewed in both themes. Existing section spacing and theme rules
are reused. Real Nginx route selection and internal endpoint blocking also pass.

Evidence: `/tmp/wapps-readiness/profile-articles-live-1/`, the matching log (exit 0),
and `profileArticlesCheckpoint` in the implementation JSON. Source inventory:
3,366 files, SHA-256 `74c1cf92dd16eb9735e7d051ed693b65c87c16f321723f1f6671e694e993a670`.
Work remains uncommitted on `c965790e`; no push or deployment occurred.

Limits: these are current ascending-UUID pages, not a frozen cross-page snapshot
or a newest-publication feed. Recent Activity supplies chronological ordering.
Production ingress/identity, coordinated service/policy rollout, load/soak,
restore/rollback and all OP01-OP10 gates remain open. Remaining privacy consumers,
full account export/erasure, feeds/discovery/notifications and other service
workflows remain in the active goal.

## Profile totals checkpoint (October 12, 2026)

My Profile and public profiles now display real discussion, favorite, suite and
article totals. Discussions count distinct live threads with member contributions;
favorites count current public target resolutions; suites/articles count owned
current publications. Private drafts, rejected/pending submissions, withdrawals,
deleted roots and repeated replies cannot inflate these totals. Canonical SQL
counts cover the complete collection, including records beyond the first page.

Public profile audience and each category's sharing switch apply, including owner
preview. Article totals follow Show Activity History. Self-authorized private
reads ignore sharing while still counting public contributions. Hidden is distinct
from zero; loading, unavailable, retry and session/target changes clear obsolete
numbers. Account reconfirms its canonical profile/favorite revision after content
I/O. Service-only content endpoints reject mixed identities and injected scope.

No new projection or migration is required. Editorial reuses complete canonical
publication counts with integrity validation. Discussion counts distinct roots
by parent, verifies public parents and rechecks the grouped authority. Totals are
independent current owning-store reads, not one frozen distributed snapshot.
Duplicate/reordered deliveries cannot increment these query-derived values. See
[materialization](MATERIALIZATION.md) for exact semantics, bounds and recovery.

Qualification passes 1,621 tests in 143 suites across seven affected projects,
189 independent OPA cases, builds/typechecks/lint, architecture boundaries for
136 projects/1,460 production sources, test inventory and 57 Angular artifacts.
The real local journey creates 21 approved suites, 21 approved articles and 12
threads using production commands, then proves larger-than-page totals, private
draft isolation, deletion/withdrawal, privacy changes during held real responses,
source outage/retry, hidden dependency avoidance and Account process restart.
The surrounding Discussion/favorites recovery regression also passes.

Eight browser states pass at 390/768/1440 in both themes (48 layouts), with
independent sessions, owner preview, follower approval/removal and restart.
Screenshots were visually reviewed. Heading-to-description spacing is measured
at 8px and header-to-content at 24px; no horizontal overflow or column misalignment
is accepted. Real Nginx routing and public blocking of internal totals endpoints
pass. The CSR initial bundle is 1,498,164/1,500,000 bytes, leaving
1,836 bytes; existing warning debt remains.

The first real run exposed private saved-favorite timestamps being passed to a
strict target-only resolver. The application now maps those records to kind/ID,
and the regression uses the actual saved-record shape. Earlier test-fixture and
command-invocation failures are superseded by the final runs, not counted as proof.

Evidence: `/tmp/wapps-readiness/profile-totals-live-5/`, the matching service log,
and `profileTotalsCheckpoint` in the implementation JSON. Source inventory:
3,353 files, SHA-256 `081a03a083b8e74b5e69f419c19242840c8b53fcd60a12d01909fdd99552f7db`. This remains uncommitted
work on `c965790e`; no deployment, commit or push occurred.

Limits: Discussion totals currently allow 200 distinct public-parent groups per
member, failing unavailable above that bound. Larger-scale optimization/load
qualification, coordinated production service/policy rollout, restore/rollback,
load/soak and all OP01-OP10 gates remain open. Authored-content collections,
export/erasure, feeds/discovery/notifications and remaining service workflows are
next. Locally qualified totals do not close those gates.

## Staff profile badges checkpoint (October 12, 2026)

Staff can award and revoke Verified and Premium badges with mandatory reasons at
`/me/profile-badges`. My Profile exposes the entry only after real capabilities
authorization. The screen shows current state, immutable decision history,
twenty-event paging, conflicts and exact uncertain retries. Private owner and public
profile screens show real active badges and award dates, with loading, hidden,
empty, unavailable, refresh and session-cancellation behavior. Public display
respects audience and Show Badges, including owner preview. Badge labels do not
grant permissions or billing entitlements; reasons and actor IDs remain staff-only.

Domain transitions remain framework-independent. Application use cases enforce
staff/self/audience policy before persistence. Canonical SQL adapters lock actor
and recipient, atomically write badge state, immutable receipt/audit, account
revision and durable identity invalidation, and reject stale/no-op commands.
Historical award retries cannot restore a revoked badge. Public reads recheck
the full profile stamp after I/O. No new projection or materializer is introduced.
The separate migration validates schema and audit/state consistency in bounded
batches and refuses destructive rollback. Both identity runtimes register it.

Local qualification passes 1,015 tests across 96 suites/seven affected projects,
93 independent identity OPA cases, affected lint/typechecks, both identity builds,
the Angular application package and production CSR. Existing warning debt remains
visible. Architecture checks cover 136 projects and 1,443 production sources with
zero violations; all 57 Angular packages and the test inventory pass. CSR initial
size is 1,498,089 of 1,500,000 bytes, leaving 1,911 bytes.

Real MySQL/OPA/compiled Account checks cover atomic rollback, concurrent revisions,
exact receipts, re-award/revocation, lifecycle denial, audit pagination, reconnect,
migration reentry/corrupt state/schema/history and inaccessible deleted accounts.
A real policy-response proxy triggers canonical privacy and revocation changes
while a read is in flight; both obsolete reads are rejected. Normal startup refuses
a pending badge migration, then compiled `--migrate` preserves populated history.
The check exposed and fixed a shared migration-runner bug: MySQL can represent a
successful advisory-lock result as string `"1"`. Numeric and string results now
work, and unsuccessful/malformed results never run migrations or release an
unowned lock. Both identity services are rebuilt with that fix.

Independent staff/member/anonymous browsers pass 78 layouts across thirteen states
at 390/768/1440 in both themes. Award/revoke, lost committed response, exact retry,
competing staff writes, private audit, history continuation, saved sharing settings,
session changes, API outage and restart are exercised. Screenshot review corrected
heading typography and public-section spacing. Real Nginx routing checks confirm
staff/own/public badge endpoints reach Account with trusted identity headers;
existing media/publication/community routes also pass.

Evidence: `/tmp/wapps-readiness/profile-badges-portal-4/`,
`/tmp/wapps-readiness/profile-badges-service-4.log`, and `profileBadgesCheckpoint`
in `docs/readiness/implementation-2026-10-11.json`. The checkpoint records the source
digest, commands, latest valid per-project results and failed-run diagnoses.

Credential-to-ingress mapping, policy timing, unavailable unrelated services and
lost-response injection are explicit local substitutions. Production staff claims,
edge routing, coordinated migration/rollout, restore/rollback and load/soak remain
unqualified. Account tombstones deny badge access, but staff audit reasons remain
retained; full export/erasure and retention policy remain open. Profile totals,
remaining collections, feed/notification work and OP01-OP10 remain open. No gate
is closed by this checkpoint.

## Public profile activity checkpoint (October 12, 2026)

API profiles now show recent public application/suite/article/release publications,
individual topics/replies/article comments, reviews and saved favorites. This is
current public activity: private drafts, credential events and moderation history
are excluded. Show Activity History and the profile audience apply even to owner
preview; suite/discussion/favorite sharing also controls the corresponding entries.
The portal handles loading, hidden/empty/unavailable states, retry, refresh and
chronological continuation, and cancels obsolete account/route requests.

Account merges three owning sources and rechecks its complete profile stamp after
I/O. Each content service selects canonical candidates, requires exact current
projections and public parents, and repeats the selection before returning. The
latest app publication is resolved across original and verified-owner editing
drafts plus direct publisher receipts. A later grant alone does not replace the
publication author; newer publications supersede earlier attribution without
duplicates. Review times come from the current immutable publish event.

Ten-entry pages stop at the earliest unfinished source boundary. Hidden candidates
can produce an empty page with an encrypted continuation; older visible sources
are not skipped. Scoped `a1.` tokens survive Account restart with the same secret
and reject tampering/cross-profile reuse. The internal routes require the existing
service credential, fixed actor/tenant and explicit OPA action. Deploy all three
affected APIs/policies and the portal together. No migration, new projection or
new durable write intent is needed; existing authority/outbox/rebuild paths remain
in force. The materialization contract documents concurrency and pagination limits.

Latest valid per-project checks in the isolated Node 22.17.1 installation total
1,700 tests across 146 suites and eight projects. The three independent OPA bundles
pass 170 cases. Affected lint and source/test typechecks pass, with existing warning
debt retained. Editorial, Discussion, Account, the Angular application library and
CSR production builds pass; all 57 Angular packages pass artifact checks. The
architecture audit covers 136 projects and 1,428 production sources with zero
violations, and the test inventory has no errors. CSR initial size is 1,497,241 of
the unchanged 1,500,000-byte limit, leaving 2,759 bytes.

The 25 real-service/recovery groups cover thirteen distinct current activities, approved
editing drafts, direct publication supersession, private edits, deletion/moderation,
parent withdrawal, internal credentials/scope, all relevant sharing intersections,
Account restart, exact-generation lag, projection loss/rebuild and dependency
failure. A delayed real response is rejected after audience/sharing changes.
Eleven withdrawn-parent candidates prove that an empty page advances to older
public entries without exposing hidden identifiers. The activity portal passes
60 layouts across ten states at 390/768/1440 in both themes, with no browser errors,
overflow or profile-width misalignment. Its exact release-version link works with
`+` and loads the real release. Existing discussion-favorites regressions also pass
66 layouts across eleven states.

Evidence is in `/tmp/wapps-readiness/profile-activity-portal-9/` and the
`profileActivityCheckpoint` record in `docs/readiness/implementation-2026-10-11.json`.
It records commands, source digest and retained diagnostics. Qualification found
and fixed missing replies caused by root-only reads, missing canonical app lookup
through editing drafts, and double encoding of release-version links. The fixture
was also corrected to use the actual article-update and ownership-editing APIs,
the canonical plural discussion route, and waits for loaded destination content.
Release summaries use their supplied title, including when parent names and
versions reach their supported maximum length.

Local ingress identities, controlled Editorial projection publication and the
ownership fixture's controlled DNS matcher are explicit substitutions. Existing
native DNS evidence remains separate. Production provider/edge, coordinated secret
rotation, restore/rollback, load/soak and deployment remain unqualified. Staff badge
award/revocation, profile totals, full authored-content collections, export/erasure,
home/feed and other required service work remain open. No OP gate closes.

## Public profile discussion participation checkpoint (October 12, 2026)

Public profiles now share application topics and article comment threads where
the member has a current public contribution. Authored roots and live replies
are included; duplicate replies collapse to one thread. The profile audience and
Show Discussions both apply, including owner preview. The portal handles loading,
hidden sharing, empty pages, unavailable/retry, refresh and next page, and cancels
obsolete requests on navigation, account changes and destruction. An empty page
can retain continuation when its scanned parents are hidden.

Account checks policy and resolves the private owner from canonical profile
authority, then rechecks its full stamp after Discussion I/O. Discussion selects
at most eleven canonical candidates, scans ten, uses exact-generation readers
and current public parent metadata, then repeats the SQL membership/revision
check. Removing the sole live contribution or withdrawing a parent hides retained
projections immediately. Missing/stale generations and dependency failures remain
unavailable. Domain contracts, application ports, infrastructure adapters and
portal orchestration keep their separate responsibilities.

Continuations use authenticated encryption with owner/tenant/context scope; they
do not expose skipped identifiers or timestamps. They survive process restart
with the same ingress secret, and rotation requires reloading the first page.
The narrow internal endpoint accepts only its service credential and policy,
rejects mixed user headers and scope injection, and is denied by the public local
gateway. Account and Discussion need matching `INGRESS_AUTH_SECRET` values and a
private `DISCUSSION_URL`. Deploy both APIs, both policies and the portal together.
No schema migration, new projection or new durable write intent is introduced.
Existing canonical writes/outbox and recoverable Discussion generations remain
authoritative; the documented read variation does not promise a distributed snapshot.

Article links open the exact root through `?thread=uuid`, even beyond the article's
first comments page. Invalid, duplicate, empty and wrong-parent links fail
truthfully. The linked view offers explicit reply/edit controls, reloads that
thread after a mutation and links back to all threads. It cannot silently create
an unseen new thread through the default composer.

Qualification in `/tmp/wapps-clean-install-ekk5hezn`, Node 22.17.1:

- 1,177 tests across 111 suites and eight projects pass. The eight projects cover
  Discussion core/service, identity management/SQL/Account, shared profile/articles
  and aggregator. Identity/profile (74), Discussion (39) and Editorial (53) policy
  cases pass separately: 166 OPA cases. Affected lint and source/test typechecks pass.
- The combined real MySQL/OPA/Editorial/Account/Discussion journey passes 39
  service/recovery groups. It includes last-contribution deletion, tenant and
  credential denial, parent withdrawal, follower revocation/historical receipts,
  lag/loss/rebuild, restart, encrypted paging and key rotation. Actual delayed
  responses prove privacy changes discard content and concurrent contribution
  deletion removes membership before response.
- Shared discussions pass 66 profile layouts across eleven states, plus 24
  article-thread layouts, at 390/768/1440 in both themes. A real member reply
  persists and reloads within the linked thread. Suite and shared-favorites
  regressions each pass 60 layouts; discussion favorites pass 66. Browser errors,
  overflow and profile alignment checks pass. Theme capture waits for finite
  animations to settle before visual inspection.
- The checked-in local Nginx gateway passes internal Discussion/Editorial route
  denial and existing media, publication, account and community routing checks
  with fixture upstreams. Architecture checks cover 136 projects and 1,413
  production sources with zero violations; inventory and all 57 Angular packages
  pass. Discussion, Account, Angular library and CSR production builds pass.
- Initial CSR is 1,497,220 of 1,500,000 bytes, leaving 2,780 bytes. The budget is
  unchanged; existing lint, Angular template and style/bundle warnings remain.

Evidence: combined integration in `/tmp/wapps-readiness/profile-discussions-portal-3/`,
settled discussion captures in `/tmp/wapps-readiness/profile-discussions-portal-4/`,
and `profileDiscussionsCheckpoint` in `docs/readiness/implementation-2026-10-11.json`.
The checkpoint records the source digest, exact commands and diagnostic logs.
Trusted local ingress identities substitute for production provider sessions;
the actual broker/materializer handles Discussion writes and recovery. The parent
publication checks use controlled Editorial projection publication. Production
edge/rotation, deployment, restore/rollback, load/soak and complete export/erasure
remain unqualified. Activity/badge privacy consumers and other required service
work remain open. All OP gates and the full-service goal stay active.

Diagnostic failures are retained: an array helper exceeded the service's configured
TypeScript target, a partial HTTP request test needed explicit mock typing, and a
browser topic-title assertion targeted the wrong host instead of the rendered
heading. A mistaken inventory script name was corrected. The relevant checks
passed after correction. An additional focused capture run waits for settled
theme transitions; intermediate screenshots are not the final visual evidence.

## Published profile suites checkpoint (October 12, 2026)

Public profiles now display reviewed, published suites created by the member.
The current profile audience and Show Suites both apply, including to an owner's
public preview. Anonymous/public and approved-follower reads return only current
approved metadata, with canonical detail links and twenty-item continuation.
Private, unreviewed, withdrawn, deleted, other-owner and foreign-tenant content
cannot appear through this collection. The portal handles loading, hidden sharing,
empty pages, unavailable/retry, refresh and next page; session/route changes cancel
obsolete reads. Settings wording now describes the actual owner collection.

Account Management checks policy, resolves the private owner from a consistent
canonical snapshot, then calls a narrow authenticated Editorial service endpoint.
It rechecks the full profile stamp after content I/O. Editorial retains authority
over authorship/publication and reuses its exact-revision catalog reader with a
final canonical SQL check. Private draft edits cannot alter approved content;
withdrawal hides old projections immediately; republish lag returns unavailable.
There is no new projection, migration or best-effort materialization. The domain,
application ports, adapters and page orchestration retain their separate roles.

Deploy both OPA bundles, Editorial, Account Management and the portal together.
The service read reuses `INGRESS_AUTH_SECRET`; both services need the same value
and coordinated rotation, with Account's `EDITORIAL_URL` pointing to the private
service. The endpoint rejects missing/wrong/mixed user credentials, scope
injection and attempts to use its credential for ordinary mutation. Local Nginx
blocks the internal prefix. Kubernetes optional-auth headers also conflict with
the service-only contract; actual deployed edge/secret behavior stays unverified.

Qualification in `/tmp/wapps-clean-install-ekk5hezn`, Node 22.17.1:

- 1,349 tests across 119 suites and seven affected projects pass. The final
  Editorial rerun includes the three added catalog consistency cases. All 67
  identity/profile and 53 Editorial OPA cases pass independently. Seven project
  lint and source/test typecheck targets pass; changed readiness tools pass lint.
- The combined real MySQL/OPA/Editorial/Account/Discussion journey passes 30
  service/recovery groups. It exercises approved ownership, publication lag and
  withdrawal, tenant/credential boundaries, follower revocation and old receipts,
  strict queries, paging and API restart. Delayed actual Editorial responses are
  discarded when sharing or audience changes. Disabled sharing skips Editorial.
- Published suites pass 60 layouts across ten states at 390/768/1440 in both
  themes, including the actual settings switch and navigation to suite detail.
  Independent sessions, follower approval/removal, loading, unavailable/retry,
  hidden/private/empty states and restart pass. Shared profile favorites also pass
  60 layouts, and discussion favorites pass their 66-layout regression. Browser
  errors, overflow and alignment checks pass; representative captures are inspected.
- The complete checked-in local Nginx gateway passes syntax and actual internal
  route denial with fixture authentication/upstreams. Existing media, publication,
  community, account and catalog routing/body-limit checks remain passing.
- Architecture checks cover 136 projects and 1,403 production sources with zero
  violations. Inventory and all 57 Angular artifacts pass. Editorial, Account,
  Angular library and CSR builds pass. Initial CSR is 1,496,743 of 1,500,000 bytes,
  leaving 3,257 bytes; the existing budget is unchanged. Existing warnings remain.

Evidence: `/tmp/wapps-readiness/profile-suites-portal-2/` and
`profileSuitesCheckpoint` in `docs/readiness/implementation-2026-10-11.json`.
The source digest is recorded with that checkpoint. Controlled local ingress
identities substitute for provider sessions; projection publication is controlled
for the focused suite checks, while the included Discussion regression exercises
the real broker/materializer. No production deployment, restore/rollback, load,
soak or complete export/erasure is qualified. Contributor attribution still needs
a canonical collaboration model. All OP gates and the service-wide goal stay open.

Diagnostic failures are preserved: a heterogeneous test-header inference needed
an explicit string-map type; combining OPA bundles failed because their data roots
overlap; a browser detail-title selector needed to target the rendered heading.
The affected checks rerun successfully. An Angular artifact invocation without
the required Nx environment was interrupted and rerun with it; no blocked or
failed invocation is counted as passing evidence.

## Public profile favorites checkpoint (October 12, 2026)

Profiles now show shared applications, suites, articles and discussions using
existing canonical saved relations. The reader must satisfy the current profile
audience and Show Favorites must be enabled, including in an owner's public
preview. The public page distinguishes hidden sharing, a genuinely empty page,
loading and unavailable content, with refresh/retry and visible-item pagination.
Links use current public routes. Withdrawn, deleted or ineligible saved targets
are omitted without exposing their identifiers or counts.

The application checks separate audience/sharing policy before relation/content
reads. SQL rechecks the complete profile stamp and reads bounded relations in a
repeatable-read snapshot, then checks the stamp again after all target calls.
Privacy, follower, lifecycle and saved-relation changes invalidate in-flight
results. Public-selection adapters use bounded requests and strict contracts;
dependency failure or projection lag is unavailable, never a successful empty
response. The pure domain limits payloads and paginates twenty visible targets
with cursors containing only returned public identities. Pages orchestrate the
shared feature and existing theme/width/spacing conventions remain in use.

No migration, projection or new write intent is introduced. Existing favorite
writes still atomically commit relations, account revision, exact receipt and
outbox invalidation. Existing owning-service publication/materialization
contracts determine current content. Deploy the profile-audience OPA policy,
selection endpoints, Account Management and portal together. There is no pinned
cross-service snapshot and already received content cannot be recalled.

Qualification in `/tmp/wapps-clean-install-ekk5hezn`, Node 22.17.1:

- 772 tests across 77 suites and six affected projects pass, combining the final
  affected reruns with unchanged passing domain/SQL/application suites. All 60
  identity/profile OPA cases pass. Six project lint and source/test typecheck
  targets pass; the changed readiness tools pass lint.
- Real MySQL/OPA and compiled Account/Editorial/Discussion APIs pass all four
  target families, immutable published content, audience/share switches,
  approved-follower revocation, historical receipts, strict queries, paging,
  target withdrawal, publication lag/recovery, outages and API restart. Mutating
  privacy or saved relations while real content responses are delayed discards
  the old payload; hidden sharing makes no target requests.
- The combined journey passes 23 service/recovery groups, 54 focused profile
  layouts across nine states and the existing 66-layout discussion-favorites
  regression. Independent browsers exercise the actual settings toggle,
  public/follower access, current routes, page transitions, unavailable/retry,
  empty state and restart. Captures cover 390/768/1440 in both themes; overflow
  and alignment checks pass and representative screenshots are inspected.
- The broader profile/preferences/photo regression passes all 150 layouts,
  together with actual MySQL/OPA/compiled API checks for contact privacy,
  follower/photo access, exact retries, atomic rollback, migration reentry,
  independent accounts, account switching and restart.
- Architecture checks cover 136 projects and 1,396 production sources, with zero
  violations. Test inventory and all 57 Angular artifacts pass. Account, Angular
  library and CSR builds pass. Initial CSR is 1,495,549 of 1,500,000 bytes, leaving
  4,451 bytes; the budget is unchanged. Existing build warnings remain visible.

Evidence: `/tmp/wapps-readiness/profile-favorites-portal-1/`,
`/tmp/wapps-readiness/profile-favorites-profile-regression-1/`, and
`profileFavoritesCheckpoint` in `docs/readiness/implementation-2026-10-11.json`.
Executable/config/tool source: 3,246 files, SHA-256
`2d8314293923a014e2a0a00f72fca0f77843238cdbf4f2c71fbb89c39eace765`.
Local trusted-ingress identities substitute for provider sessions. These checks
do not qualify deployed edge/provider behavior, notifications, account export or
cross-service erasure, production restore/rollback, load or soak. All OP gates
and the full-service goal remain open.

Diagnostic failures are retained: local HTTP listeners needed sandbox escalation;
Prettier 2 split an Angular `@else if` block and the compiler caught it. The block
is corrected and both Angular builds rerun. The previous contact checkpoint's
Aggregator result preceded the lazy-parser change; this checkpoint fixes the
conflict/reload test to await recreated ngModel bindings and records a fresh
330-test passing Aggregator run. The assertion is unchanged.

## Profile contact email checkpoint (October 12, 2026)

Profile Settings now saves or removes an optional contact email, separate from
the sign-in address. The public profile shares it only when Show Email Address
is enabled and the reader satisfies the current public/private/approved-follower
audience. Directory responses omit addresses. The editor and public display
explicitly identify the address as member-provided and unverified; this workflow
does not send mail, verify a mailbox or grant ownership/identity rights.

The pure domain accepts a bounded plain ASCII mailbox, rejects controls, address
lists and display names, and normalizes only the domain part after trimming outer
spaces. Existing self-profile authorization precedes parsing/storage. Canonical
SQL stores a nullable field on `identity_accounts`; profile content, shared account
revision, exact retry receipt and outbox invalidation commit together. Older
commands that omit the field preserve its value and original fingerprint. Null
or blank explicitly removes it. Historical retries cannot restore old addresses.
Current privacy and contact are read in one snapshot, then audience facts are
rechecked after policy I/O. There is no contact projection or provider write.
Account tombstoning removes the address with the account row; existing hash-only
command history remains retained and cannot bypass deleted-account checks.

`ProfileContactEmail1791676830000` is registered by both identity runtimes,
maintenance and qualification. It adds a nullable ASCII/binary column, validates
actual metadata and stored values in bounded pages, rejects missing previously
applied schema and refuses destructive down. Coordinate the API/portal contract
rollout; retain the column in compatible rollback. The materialization and SDK
contracts document these requirements.

Qualification in `/tmp/wapps-clean-install-ekk5hezn`, Node 22.17.1:

- 846 tests across 85 suites and eight affected projects pass, with no skips.
  Final changed-project reruns are combined with unchanged passing project results.
  The eight lint/source/test-typecheck targets and both identity/portal builds pass.
- Real MySQL proves default-hidden sharing, post-policy snapshot invalidation,
  legacy fingerprint stability, omission-preserves semantics, exact/historical
  retry, outbox-failure rollback, concurrent edits, reconnect, migration definition/
  value validation, removal and local erasure. Compiled HTTP with real OPA proves
  invalid-input rejection, directory exclusion, approved-follower access, policy
  loss and process restart. Existing identity/preferences/favorites/photo checks
  run in the same isolated qualification.
- Final focused browser qualification passes 90 layouts across fifteen states
  at 390/768/1440 in both themes. It includes invalid input, lost-save exact retry,
  independent editor sessions, sharing on/off, public/follower reads, conflicts,
  removal and restart. The broader profile/preferences/photo regression passes
  150 layouts, including guest isolation, unavailable states and account switching.
  Alignment, overflow, theme text and label checks pass; representative screenshots
  are inspected. Run 2 supersedes the earlier contact captures after copy cleanup.
- Private-profile response validation now loads lazily; validation failure is
  explicit, and a response from an old session is discarded while loading. This
  keeps initial CSR at 1,495,540 of 1,500,000 bytes (4,460 bytes headroom), without
  changing the budget. Both the CSR and independent Angular library build pass.
- Architecture checks cover 136 projects and 1,391 production files with zero
  violations. Test inventory and all 57 Angular artifacts pass. The readiness
  tools retain the two unrelated unused-variable warnings recorded previously.

Evidence: `/tmp/wapps-readiness/profile-contact-portal-2/`,
`/tmp/wapps-readiness/profile-contact-regression-1/`, and `profileContactCheckpoint`
in `docs/readiness/implementation-2026-10-11.json`. Final executable/config/tool
source: 3,236 files, SHA-256
`97ec31233ffe136fce07149fb1bb15a98c584e47e25ed520b51c921a6e17f54e`.
Earlier diagnostic failures preserve a missing nullable field in a SQL fixture,
restricted local listeners, a wrong expectation that historical command hashes
were erased, and the initial bundle's 487-byte budget overrun. They are corrected
and the affected checks rerun. An artifact inspection started without the required
Nx environment was interrupted and rerun successfully with that environment.

Local credential-to-ingress mapping is substituted. Real provider sessions,
deployed edge behavior and broker delivery are not qualified by this journey;
ordinary invalidation intent is retained. International/quoted mailbox syntax is
not supported. Badge/activity/content privacy consumers, analytics/personalization,
notifications, full export/cross-service erasure and production restore/rollback/
load/soak remain open. All OP01-OP10 gates and the full-service goal remain open.

Next: current-audience public favorites, resolving only currently public targets,
then the remaining profile content consumers and account export/erasure.

## Public profile audience checkpoint (October 12, 2026)

API-mode `/profiles/:profileId` now reads real canonical profiles by immutable
public SQL UUID. Public profiles allow anonymous reads, private profiles allow
only the owner, and followers-only profiles require individual owner approval.
The gate returns no hidden profile payload. Photos use the same current audience
and revocable browser object URLs. Supplied invalid or suspended sessions never
fall back to anonymous. Neither staff nor administrators bypass this policy.
The private profile links to its public preview. The bounded directory includes
only current public registered profiles; credential UIDs, login email, shared
account revisions, preferences and legacy external avatar URLs are excluded.

Members can request/cancel access; owners can approve/decline/remove it. Incoming
requests disclose the requester's name and public link, with advance UI notice.
Outgoing lists expose only relation IDs/status and allow cancellation after the
owner becomes private or suspended. Exact retries survive lost responses in
session memory; conflicts require reload. Historical receipts never restore
revoked access. Owner approval is the conservative policy assumption pending any
later product direction.

Application ports enforce dedicated OPA audience/action policy, followed by a
canonical SQL snapshot recheck after policy I/O. Pair-state changes lock both
identities in UUID order and atomically write the monotonic relationship revision,
historical command receipt, both shared account revisions and both identity
outbox invalidations. Canonical reads require no profile projection or new worker.
Limits are 200 outgoing active relations, 200 incoming pending requests, 1,000
approved followers, 20 new requests per rolling day and 20 rows per list page.
Local account tombstoning removes both relationship directions and their receipts.
`ProfileFollows1791676829000` validates binary keys, InnoDB, ordered indexes and
lifecycle state in both identity runtimes and maintenance. Destructive down is
refused; old binaries cannot erase these tables, so rollback requires a compatible
binary or reviewed migration. The optional-auth profile ingress and local gateway
are configured and rendered; they are not deployed.

Qualification in `/tmp/wapps-clean-install-ekk5hezn`, Node 22.17.1:

- 825 tests across 85 suites and eight affected projects pass with no skips;
  53 actual OPA cases pass. Affected builds, typechecks and lint pass.
- Real MySQL/OPA and compiled APIs prove canonical visibility, consistent snapshot
  rechecks, actor/case isolation, approval/removal, historical retries, outbox
  failure rollback of both accounts, concurrent/opposite-direction commands,
  daily quota, reconnect, migration validation, erasure, policy loss and restart.
- Final focused browser qualification passes 54 layouts across nine states,
  390/768/1440 and both themes. Independent owner/requester/anonymous sessions
  cover real privacy changes, lost receipts, approval/revocation, stale decision
  conflicts, cancellation after privacy changes, object URL cleanup and restart.
  Broader profile/preferences/photo regression passes 150 layouts. Alignment,
  overflow, label clipping and theme text checks pass; representative screenshots
  are visually inspected. Earlier focused captures are superseded by run 4.
- Architecture checks cover 136 projects and 1,389 production sources with zero
  violations. All 57 aggregator Angular artifacts and test inventory pass.
  Readiness lint retains two unrelated existing unused-variable warnings.
  Initial CSR is 1,499,493 of 1,500,000 bytes (507 bytes headroom); budget unchanged.

Evidence: `/tmp/wapps-readiness/public-profiles-portal-4/`,
`/tmp/wapps-readiness/public-profiles-regression-1/`, and `publicProfileCheckpoint`
in `docs/readiness/implementation-2026-10-11.json`. Final executable/config/tool
source: 3,233 files, SHA-256
`a3735c9e3d69e7fde8722aceb82964d2fe05ea53330b694738a06d1d98451354`.

Credential-to-ingress mapping is substituted locally; provider and broker delivery
are unavailable in this journey, and ordinary outbox intent remains retained.
There is no follower-notification consumer. Public contact email, badge/activity
and content-collection audience consumers, analytics/personalization enforcement,
full export/cross-service erasure, deployed edge sessions and production-like
restore/rollback/load/soak remain open. No OP gate or full-service goal is complete.

Next: explicit public contact-email editing and current-audience sharing, then
remaining profile consumers and full account export/cross-service erasure.

## Private profile avatar checkpoint (October 12, 2026)

API-mode Profile Settings now supports private photo upload, replacement and
removal. A selected file is applied through a separate explicit photo command;
unsaved text disables photo changes, and an in-flight upload disables text edits.
The profile page and shell reuse the saved photo. Independent sessions observe
the same canonical image; account changes cancel pending UI work and revoke old
browser object URLs. Lost upload/removal responses retain the exact request for
retry, while reload recovers the current saved state. Conflicts retain selection
until explicit reload. Invalid images leave the current photo intact.

Pure domain contracts describe bounded photo intent. Application ports enforce
self-profile policy before persistence/decoding. The Sharp adapter verifies source
length/digest/signature/format, rejects animation, bounds request/decode work and
re-encodes without source metadata. Inputs are PNG/JPEG/WebP up to 2 MiB; normalized
WebP fits within 512 pixels and 256 KiB. SQL stores one immutable current payload
per canonical account. Replacement/removal, shared account revision, retry receipt
and identity outbox intent commit atomically under the identity lock. Account
deletion clears bytes in its tombstone transaction. Old receipt replay cannot
resurrect a removed image. The small canonical-SQL payload variation requires no
avatar projection, object store, pending upload or cleanup worker, and is documented
in `docs/MATERIALIZATION.md`.

The profile response separates nullable `avatarId` from legacy `avatarUri`.
Authenticated current-owner reads return no-store WebP bytes; no token appears
in an image URL. Public-profile access is not added by this workflow. Existing
external avatar references are preserved until explicit replacement/removal.
The additive `ProfileAvatars1791676828000` migration is registered by both identity
services and maintenance. It verifies binary keys, InnoDB, bounds and their actual
enforced CHECK expression, current ownership/lifecycle and payload integrity.
An old account binary cannot erase this table; production rollback needs a
compatible binary or reviewed data-preserving migration. Both identity services
must follow explicit `--migrate`; the account ingress/local gateway allow 2 MiB.

Qualification in `/tmp/wapps-clean-install-ekk5hezn`, Node 22.17.1:

- 758 tests across 80 suites and seven affected projects pass, with no skips.
  Both identity APIs, affected libraries and the CSR build; source/test typechecks,
  seven lint targets, readiness-tool lint and test inventory pass.
- Real MySQL 8.4 proves migration reentry and weakened-constraint rejection,
  digest corruption rejection, case/owner isolation, outbox-failure rollback,
  competing commands, historical replay, reconnect, and atomic erasure. Existing
  identity/preferences/favorites regressions also pass.
- Compiled Account API and actual OPA prove normalization/private reads, wrong
  MIME/digest/revision, actual oversized-body rejection, foreign and suspended
  callers, identical retries, policy outage and account-process restart.
- The full profile/preferences browser regression passes 150 layouts. Final photo
  qualification passes 36 layouts across six states, 390/768/1440 and both themes:
  selection, uncertain save, saved photo, invalid input, conflict and removal.
  It also checks independent sessions, lost upload/removal receipts, revoked
  object URLs, text-edit protection and recovery after process restart. Alignment,
  overflow, 16px card gap and button-label clipping pass; screenshots are inspected.
- Architecture scans 136 projects and 1,374 production sources with zero
  violations. All 57 aggregator Angular packages pass artifact inspection.
  Both identity Kustomize overlays render. Initial CSR is 1,499,142 of 1,500,000
  bytes (858 bytes headroom); the budget is unchanged. Profile text-saving code
  now loads lazily, with load failures represented explicitly.

Evidence: `/tmp/wapps-readiness/profile-avatars-portal-5/` and
`profileAvatarCheckpoint` in `docs/readiness/implementation-2026-10-11.json`.
Final source: 3,204 files, SHA-256
`432268328823ebde4cebc631d5f4e5b1dc786fc5409abdaf90e828d68080b8ed`.
The earlier full regression is `/tmp/wapps-readiness/profile-avatars-portal-3/`;
its photo captures are superseded by the final run. Retained failed checks record
fixture timing after lazy loading, the library's missing Sass include path,
MySQL's normalization of OCTET_LENGTH to LENGTH, and a clipped mobile conflict
label. These issues are corrected and the affected checks rerun.

These are local checks with credential-to-ingress mapping substituted. Firebase,
broker delivery and unrelated APIs are unavailable in this journey; ordinary
identity outbox intent is retained. There is no projection or notification-delivery
claim. Deployed ingress, real-provider avatar sessions, full account export/
cross-service erasure, consistent backup/restore, compatible rollback, load and
soak remain open. If stored photo retrieval fails, the profile shows unavailable
and offers reload; this does not claim automated repair of corrupt authority.
No OP01-OP10 gate or full-service goal is complete.

Next: canonical public-profile privacy/audience enforcement, then remaining
account export and cross-service erasure dependencies.

## Email verification checkpoint (October 12, 2026)

Members can now request verification from Profile Settings, open the provider's
email action, explicitly confirm it, and refresh current status in an independent
session. Signup directs members to that workflow. Email verification concerns the
credential address; it grants no app-domain ownership, session, publication right
or SQL lifecycle change. The action page also retains password reset and removes
one-time codes from browser history. Reset and verification reject each other's
codes before mutation.

Pure application ports own self authorization and credential coordination.
The authenticator adapter combines revocation-aware validation with current SQL
identity eligibility; the Firebase adapter verifies the current record's UID and
uses bounded REST calls. Its live status avoids stale token claims. Provider
throttling, invalid codes and uncertain/outage responses remain distinguishable.
Request acceptance does not claim delivery, no unknown send is automatically
retried, and lost completion recovers through current status. The frontend clears
private state and subscriptions on session changes. Pages compose lazy shared
feature components through provider functions.

Optional ingress validation now rejects supplied invalid/revoked tokens without
setting anonymous or trusted-ingress headers. Credential completion remains
possible through its bearer action code while an account is SQL-suspended, but
does not reactivate that identity or permit private operations. There is no new
SQL migration, verified flag, projection or notification consumer; the deliberate
provider-authority variation is recorded in `docs/MATERIALIZATION.md`.

The action HTML prevents referrer propagation. Static servers return no-store,
suppress action access logs, and the production CSR log format omits query strings
and referrers. The exact portal ingress disables action access logging. Updated
authenticator ingress exposes all four endpoints with rate limiting. Deployment
overlays render successfully; neither a cluster nor external email configuration
was changed.

Qualification, Node 22.17.1 in `/tmp/wapps-clean-install-ekk5hezn`:

- 570 tests in 75 suites across authentication application (41), Firebase adapter
  (78), authenticator (60), shared Identity (61) and aggregator (330) pass. The
  shared Identity suite was rerun after the signup guidance change.
- Real Firebase emulator signup, request, code type isolation, consumption,
  one-use replay rejection, live old-token status and password-reset regression
  pass without external email.
- The existing canonical SQL migration/concurrency/rollback/reconnect, account
  preferences and favorites regression passes on disposable MySQL 8.4. Four
  additional service groups exercise actual compiled authenticator/account APIs,
  real OPA and provider state: missing/invalid sessions, foreign target attempts,
  SQL suspension, unenrolled provider users, disable/revocation, outage and restart.
- Independent browsers qualify accepted request, explicit keyboard confirmation,
  uncertain completion, verified refresh, used/invalid/unsupported links and
  provider recovery. Ten states at 390/768/1440 in both themes yield 60 layouts
  with alignment, 24px content gap, 16px card gap, overflow and text-color checks.
  Captures wait only for bounded finite CSS transitions; screenshots are inspected.
- Both checked-in static Nginx configurations pass actual container routing,
  no-store/no-referrer and action-log suppression checks. Browser requests do not
  carry the action code in referrers.
- Affected application/library/CSR builds, source/test typechecks and lint pass.
  Architecture scans 136 projects and 1,361 production sources with zero
  violations; inventory and all 57 aggregator Angular artifacts pass. Initial
  bundle is 1,498,300 of 1,500,000 bytes; the budget is unchanged.

Evidence: `/tmp/wapps-readiness/email-verification-portal-3/`, provider/static
logs and `emailVerificationCheckpoint` in the dated JSON. Source is 3,183 files,
SHA-256 `8a827b04f9e34cee477e55ae248a06bf2abef3b53eb12e436a8b25c60b887f84`.
Earlier failed runs are retained: reused consumed mock response bodies, localhost
sandbox access, missing test identity configuration, strict JSON index access,
and a screenshot wait on scroll-driven animations were corrected. The first
successful journey's transition-time captures were replaced by the final run.

These are local workflow checks. The broker was deliberately unavailable to
retain ordinary identity outbox intent; no downstream notification delivery is
claimed. Firebase templates, actual inbox delivery, time-based expiry, deployed
ingress/rate limits, backup/restore/rollback/load and full-service gates remain
open. Configure both email templates' action handler as `/auth/action`, deploy the
matching authenticator/portal routes, and verify every edge's secret-log/referrer
controls before rollout. No OP01-OP10 gate or full-service goal is complete.

Next: durable private-profile avatar upload, revision-bound association/removal,
private media reads and recovery, followed by public-profile audience enforcement.

## Discussion previews checkpoint (October 12, 2026)

Application overviews now show up to three real public topics, using the canonical
pin-first/newest ordering. Full discussion pages show other topics about the same
application and exclude the current thread. Keyboard links open canonical topic
URLs. Cards show actual chosen names, text excerpts and reply counts, explicitly
including removed posts. They do not invent views, verified profiles or rankings.
Reloading previews cannot replace the open thread or unfinished reply.

The shared presentation component owns a separate instance of the existing
Discussion application service, which depends on its configured port. Pages only
compose the component and canonical route links. API mode uses the existing
bounded ten-topic list, exact content generations and current SQL/Editorial
visibility checks. The view takes at most three entries after exclusion. It adds
no storage, migration, policy or materialization pipeline. Explicit demo behavior
stays separate. Loading, unavailable and empty states remain distinct, and route
or account changes cancel earlier reads.

Accepted evidence:

- **3,155 executable/config files**, SHA-256
  `1bfd867c95a12833c627b68337ce2a3ec88703168075e6fd8f81f30a5a69808b`,
  match the Node **22.17.1** installed snapshot on `codex/full-operation`, base
  **c965790e**. Evidence: `/tmp/wapps-readiness/discussion-previews-portal-1/`.
- **394 tests / 55 suites / two projects** pass: shared Discussion 65 and
  aggregator 329. Preview tests cover current-thread exclusion, canonical links,
  separate read/composer state, mutation refresh, stale route/account cancellation,
  and loading/failure/empty recovery. The corrected feature source/test typecheck
  and aggregator source/test typechecks pass.
- **12 existing service/recovery groups plus the preview browser journey** pass
  against compiled Editorial/Discussion, real OPA, MySQL 8.4, Mongo 7, RabbitMQ 4
  and pinned MinIO. The browser verifies independent public/member reads, actual
  pin/reply data, edit propagation, stopped-materializer lag, API restart,
  projection loss/rebuild, deletion before materialization and parent withdrawal.
- **48 browser layouts / eight states** pass at 390/768/1440 in both themes.
  Keyboard navigation and composer preservation pass. Related sections retain
  the shared 32px divider gap and 24px content spacing. Mobile light overview,
  desktop dark related topics and tablet light outage screenshots are inspected.
- Builds pass for the shared Discussion package, aggregator package and CSR with
  their prerequisites. **57 Angular artifacts**, affected lint, readiness-tool
  lint, inventory and architecture (**136 projects / 1,351 sources / zero
  violations**) pass. Existing warnings remain.

Initial CSR is **1,498,009 / 1,500,000 bytes**, leaving **1,991 bytes** with the
budget unchanged. The new content remains inside existing lazy routes. An initial
test assertion accidentally matched "previews" while checking for invented view
counts; it now checks the numeric metric. Typechecking also found a test-only
NodeList iteration incompatible with the existing compiler libraries; `Array.from`
fixes it. A combined runner command incorrectly forwarded Jest's `--runInBand`
to TypeScript; the direct, correctly invoked compiler subsequently passes. Failed
logs are retained, and the first real browser qualification passes.

No new backend rollout or migration is required beyond the qualified application
discussion/vote/pin protocol. These previews are bounded discovery, not a full
topic count, top-author ranking or personalized recommendation. Shell accounts,
trusted ingress and catalog projection advancement remain controlled fixtures.
The actual Discussion worker performs generation recovery. Deployment, integrated
identity, retention/erasure, restore/rollback and load/soak remain open. Disposable
qualification services are removed without touching unrelated containers.

Next: integrated email verification, a remaining account prerequisite for reliable
notification workflows. Top-author summaries, feeds/digests, observed status and
other full-service requirements remain open. No OP01-OP10 gate or the full goal is
closed by this checkpoint.

## Member reviews checkpoint (October 12, 2026)

Members now publish one stable review per application, with a chosen public name,
integer 1-5 rating and bounded plain text. Authors edit, withdraw and explicitly
republish. Other members mark/unmark helpfulness and report a content version.
Tenant administrators hide/restore other members' reviews and inspect the exact
reported text. Editing cannot remove a staff hide; staff restoration cannot undo
author withdrawal. Public detail, paged lists and rating distributions use current
visible reviews. The overview reads the same real member summary, with explicit
unavailable/reload behavior. No verified-purchase, profile or role claims are made.

The framework-independent Review domain is composed through its own module inside
Discussion management. Application use cases enforce explicit OPA actions,
tenant/author scope and current canonical Editorial parent visibility. Seven SQL
tables retain immutable content, independent visibility flags, helpful membership,
version-bound reports, historical command receipts and a durable change journal.
An application lock commits the mutation, revision, receipt and journal together.
Exact replay returns the original receipt; stale or reused commands conflict.

This is a documented canonical SQL materialization variation: bounded content and
summary facts share one transaction/snapshot, with no review projection. Reads
recheck current parent visibility and the application revision after the snapshot.
Missing canonical authority fails closed. The retained journal is future consumer
intent; it does not deliver feeds or notifications. Existing Discussion runtime
startup dependencies still apply despite reviews not requiring a materializer.

Accepted evidence:

- **3,150 executable/config files**, SHA-256
  `0186d4cc21ffaad2c6a80641b21bcd3f2cef7193ed2aaf9900b159e59ebbb294`,
  match the Node **22.17.1** installed snapshot on `codex/full-operation`, base
  **c965790e**. Evidence: `/tmp/wapps-readiness/member-reviews-portal-5/`.
- **579 tests / 66 suites / four projects** pass: Review core 27, Discussion
  management 199, shared Review 24 and aggregator 329. Discussion OPA passes
  **34/34**, including review member/staff and tenant/identity boundaries.
- **17 real-service/recovery groups** pass through compiled Editorial/Discussion,
  actual OPA, MySQL 8.4, Mongo 7, RabbitMQ 4 and pinned MinIO. Five review groups
  cover exact concurrency/replay, strict validation, private identity omission,
  helpful/report invariants, immutable evidence, hide/edit/withdraw/restore,
  journal-failure rollback, restart with the materializer stopped, missing
  authority, keyset/summary agreement and migration reentry/down refusal. Twelve
  existing application-discussion groups retain outbox, worker/rebuild, lifecycle,
  explicit migration and denied/unavailable-policy regression coverage.
- **96 browser layouts / 16 states** pass at 390/768/1440 in both themes. Independent
  author/member/staff/anonymous sessions cover create/edit/detail, conflict text
  preservation, exact lost-response retry, restart, reports and immutable evidence,
  moderation, withdrawal, unavailable recovery and session isolation. Overview
  totals/link/outage/reload and keyboard composer navigation pass. Representative
  mobile, tablet and desktop images are visually inspected.
- Architecture passes for **136 projects / 1,350 production sources / zero
  violations**. Affected builds/source-test typechecks/lint, **57 Angular
  artifacts**, readiness-tool lint and inventory pass. Existing warnings remain.

Initial CSR is **1,497,989 / 1,500,000 bytes**, leaving **2,011 bytes**; budgets
are unchanged. Real MySQL qualification identified escaped CHECK metadata and
string-valued EXISTS results; the adapter/migration now validate those exact
forms without coercing arbitrary values. Two later browser attempts found harness
sequencing errors (an outdated author revision, then comparing a request key before
the failed response arrived); corrected checks retain concurrency and exact-retry
requirements. Failed logs are preserved; final service/browser qualification passes.

Apply additive `MemberReviews1791676827000` explicitly before Discussion management
startup and update its OPA bundle before exposing the new review routes. The local
gateway routes `/api/application-reviews/` to Discussion with a 32 KiB body limit.
Retain all seven tables consistently for backup/rollback; destructive down is
refused, and rerunning completed migrations cannot invent missing authority.

Shell profiles, trusted ingress identities and catalog projection advancement are
controlled fixtures. Review uncertain intent is memory-only across route changes;
account changes/full reload clear that local retry. Historical content, reports,
receipts and journal remain retained; service-wide erasure/retention is unfinished.
The final-observation race, target deployment/provisioning, integrated identity,
restore/rollback, load/soak and full-workspace release gates remain unqualified.
Disposable qualification services are removed; unrelated containers are preserved.

Next: canonical discussion previews on application overviews and related-topic
discovery, then the remaining content/community and service workflows. This
checkpoint closes none of OP01-OP10; the full-operation goal stays active.

## Discussion pinning checkpoint (October 12, 2026)

Tenant administrators now pin/unpin live application-topic roots from lists,
full threads and quick dialogs. Public/member readers see canonical pin badges;
ownership alone grants no pin authority. Pinned topics come first, then newer
topics within each group. Ten-topic keyset pages support more than one page of
pins. Replies cannot be pinned, and explicit demo mode remains separate.

Pure pin/cursor contracts live in Discussion core. Application use cases enforce
tenant/root/binding/lifecycle, current parent visibility and a role-restricted
OPA pin action. SQL pin state, aggregate revision, receipt and outbox commit
under the existing lock. Exact replay does not reapply a historical pin; failures
roll back every canonical change. Payloads/content timestamps remain unchanged.
The portal preserves composer text and clears private retry/control state when
the account changes. Late or missing generations never fabricate pin state.

No new projection is introduced: pin state is canonical aggregate metadata read
with the current exact content revision. A direction-aware SQL index supports
bounded ordering; application cursors include pin group, creation time and UUID.
The list checks each topic's group and rereads its bounded candidate order after
projection I/O. Article and My Discussions pagination are unchanged. Separate
page requests are not a frozen snapshot; changed pins can move between pages.
The deliberate materialization variation is documented in `MATERIALIZATION.md`.

Accepted evidence:

- **3,114 executable/config files**, SHA-256
  `06ececff00160e59e3e87a385b72fc71da69f861ce398004d7802355bae29950`,
  match the Node **22.17.1** installed snapshot, branch `codex/full-operation`,
  base **c965790e**. Evidence is under
  `/tmp/wapps-readiness/discussion-pins-portal-1/` and
  `/tmp/wapps-readiness/discussion-pins-generic-regression/`.
- **645 tests / 74 suites / four projects** pass: Discussion core 76,
  management 179, Discussion feature 61 and aggregator 329. Discussion OPA
  passes **30/30** cases, including member denial and admin scope restrictions.
- **36 real-service/recovery groups** pass through compiled Editorial/Discussion,
  actual OPA, MySQL 8.4, Mongo 7, RabbitMQ 4 and pinned MinIO. They include topics,
  My Discussions, votes and article comments. Pin checks cover concurrent exact
  replay, stale moderators, foreign scope/replies, atomic rollback, historical
  receipts, thirteen topics/twelve pins across pages, restart, projection
  loss/rebuild, withdrawal/deletion and populated migration constraints/indexes.
- The separate **generic Discussion recovery regression** also passes, alongside
  nine repeated article-comment groups: legacy backfill, atomic writes,
  duplicate/reordered generations, tombstones, rebuild and reconciliation. Its
  fixture migrations now match the shared SQL adapter's current schema.
- **78 browser layouts / 13 states** pass at 390/768/1440 in both themes.
  Independent moderator sessions prove exact lost-response retry and conflicts;
  member/anonymous sessions prove permission boundaries. Modal and keyboard
  pin/unpin, originating-list order, composer preservation, restart, projection
  lag, outage, account/role changes, signout, withdrawal and deletion pass.
  Modal bounds/overflow/control access and representative mobile/tablet/desktop
  screenshots are checked.
- Architecture passes for **135 projects / 1,332 production sources / zero
  violations**. Affected builds, lint and source/test typechecks, **57 Angular
  artifacts**, readiness-tool lint and inventory pass. Existing warnings remain.

Initial CSR is **1,497,236 / 1,500,000 bytes**, leaving **2,764 bytes**; budgets
are unchanged. The initial typecheck found an older quick-dialog fixture missing
the new required response fields. The fixture is corrected and its typecheck
passes; the initial failed log is retained. Both live qualification runs pass.

Apply additive `DiscussionPins1791676826000` explicitly before Discussion
management startup, update the OPA bundle, and coordinate the API/portal release
for strict pin fields and the new application-page cursor. Existing
application-aware workers remain compatible. Migration reentry validates the
default/engine/check and actual full ordered index, including descending
directions; lost completed schema and destructive rollback are refused.

Trusted ingress identities, shell account data and catalog projection advancement
remain controlled fixtures. Discussion uses its actual worker. Canonical pin
state is retained under deletion tombstones; cross-service erasure remains open.
Full reload loses local uncertain intent, and the documented final-observation
race still applies. Production deployment, integrated identity, restore/rollback,
load/soak and the complete workspace gate remain unqualified. Both disposable
environments are removed; unrelated local containers remain intact.

Next: real application reviews and ratings with author/member rules, moderation,
durable writes, public detail/summary and portal qualification. Related/top-author
summaries, feeds/digests, notifications and other service requirements remain open.
This checkpoint closes none of OP01-OP10; the full-operation goal stays active.

## Discussion voting checkpoint (October 12, 2026)

Members now upvote, downvote, switch or remove their own choice on application
topics and replies from lists, full threads and quick dialogs. Counts come from
real canonical rows; anonymous controls are disabled. Accepted votes preserve
unfinished composer text. Conflicts require a current read, uncertain retries
send the original choice/revision/key, and account changes clear private state.

The pure signed-vote contract is shared by backend and portal adapters. The
application boundary enforces explicit self-scoped OPA voting, tenant/actor
isolation, immutable application binding and current live parent/root/post.
Members may vote on their own posts. The existing SQL aggregate lock commits the
choice, next revision, immutable receipt and outbox intent atomically. Historical
receipts cannot reapply a choice after removal. Payloads and content timestamps
are unchanged. Redacted replies disclose neither counts nor a member choice.

The final design deliberately uses **no separate vote projection**: totals and
the requesting actor's choice are calculated from authoritative SQL in one
REPEATABLE READ snapshot at the exact thread revision. Content uses the existing
generation at that revision; final SQL binding/lifecycle/revision and parent
checks reject drift. This supersedes the earlier proposed "materialized counts"
approach. Projection rebuild recovers content while canonical votes remain intact.
The variation and failure/recovery proof are documented in `MATERIALIZATION.md`.

Accepted evidence:

- **3,109 executable/config files**, SHA-256
  `2e9c36e1a3d576d94d579a38391f8cab144cd7fe5c6c38a00d5f7e33e9c62058`,
  match the Node **22.17.1** installed snapshot byte-for-byte, branch
  `codex/full-operation`, base **c965790e**. Evidence is under
  `/tmp/wapps-readiness/discussion-votes-portal-2/`.
- **626 tests / 73 suites / four projects** pass: Discussion core 68,
  management 173, Discussion feature 56 and aggregator 329. The final management
  regression includes changed/missing canonical bindings during vote I/O.
  Discussion OPA passes **28/28** cases.
- **32 real-service/recovery groups** pass against compiled Editorial/Discussion,
  real OPA, MySQL 8.4, Mongo 7, RabbitMQ 4 and pinned MinIO. They cover concurrent
  exact replay, stale writers, case-distinct identities, switching/removal,
  historical receipts, atomic rollback, restart, projection loss/rebuild,
  withdrawal/deletion and populated migration/constraint/key checks. Existing
  application-topic, My Discussions and article-comment regressions also pass.
- **72 browser layouts / 12 states** pass at 390/768/1440 in both themes.
  Independent sessions prove lost-response retry, stale-session conflict, reply
  voting, modal removal/keyboard voting, originating-list refresh, composer
  preservation, projection lag, dependency outage, account switching/signout and
  withdrawal/deletion. Modal bounds/overflow/control access pass. Representative
  mobile modal, tablet conflict and desktop list screenshots are inspected.
- Architecture passes for **135 projects / 1,330 production sources / zero
  violations**. Affected builds, lint, source/test typechecks, **57 Angular
  artifacts**, readiness-tool lint and inventory pass. Existing warnings remain.

Initial CSR is **1,496,199 / 1,500,000 bytes**, leaving **3,801 bytes**; budgets
are unchanged. The first complete live run passed; the second qualifies the final
binding recheck. An intermediate backend test invocation lacked local listener
access; all 173 tests pass when rerun with that access. An artifact check started
without the required Nx environment was stopped and rerun successfully. Those
logs are retained; they are not counted as successful checks.

Apply additive `DiscussionVotes1791676825000` explicitly, deploy the updated
Discussion OPA bundle, then coordinate the API/portal release because strict
application-post contracts now include vote state. Existing application-aware
materializers remain compatible. The migration validates actual column/key/check
constraints and populated integrity, refuses lost completed schema and rejects
destructive down migration. Legacy generic likes remain separate. No production
deployment or operational rollback is qualified by this checkpoint.

Trusted ingress identities, shell account data and catalog projection advancement
remain controlled fixtures. Discussion uses the actual worker. Vote reads have a
bounded node result but voting volume/load is unqualified. Current authority
checks retain the documented final-observation race. Client uncertain intent is
memory-only and clears on account change/full reload. Integrated identity,
deployment, export/erasure, database restore/rollback, load/soak and the complete
workspace release gate remain open. Disposable qualification services are removed
after the journey.

Next: tenant-authorized topic pinning through canonical state, bounded discovery,
portal controls and real-service recovery. Reviews, related/top-author summaries,
feeds/digests, notification delivery and other full-service workflows remain open.
This checkpoint closes none of OP01-OP10; the full-operation goal stays active.

## Discussion favorites checkpoint (October 12, 2026)

Members now save canonical application topics from discussion lists, full threads
and quick dialogs. The grouped favorites page resolves current titles and parent
application slugs, linking to the real thread. This completes the four supported
favorite kinds in API mode. Explicit demo mode remains separate.

Discussion's bounded public selection API accepts only distinct canonical IDs,
uses SQL root/tenant/immutable-parent authority, reads exact generations and
rechecks lifecycle/revision/current parent visibility. Replies, generic/article
threads and hidden/deleted/foreign-tenant roots are omitted. Responses disclose
no private identity or post body. Account saves reuse self-access policy and the
existing atomic relation/revision/receipt/outbox transaction. No migration or
additional projection is introduced. Completed retries and removals do not need
target services. See the canonical favorites section in `MATERIALIZATION.md`.

Accepted evidence:

- **3,101 executable/config files**, SHA-256
  `5d7642e06ad1550179a8f54be6db51f9098c7b6c74f44dabff61fa2ea9d1b9a0`,
  match the installed snapshot byte-for-byte. Node **22.17.1**, branch
  `codex/full-operation`, base **c965790e**. Evidence is under
  `/tmp/wapps-readiness/discussion-favorites-portal-3/`.
- **735 tests / 76 suites / six projects** pass: Discussion core 58,
  Discussion management 160, Account Management 95, favorites feature 42,
  Discussion feature 51 and aggregator 329. Checks include strict selection
  contracts, current authority during I/O, bounded/unsigned target lookup,
  exact retry, dependent parent lookup cancellation and 200 saved references.
- **31 real-service/recovery groups** pass through compiled Editorial,
  Discussion and Account APIs, real OPA, MySQL 8.4, Mongo 7, RabbitMQ 4 and pinned
  MinIO. Existing application topics, My Discussions, article comments and
  application favorites regressions pass, including restarts, projection
  loss/rebuild, authorization failures, atomic rollback, receipt replay,
  tombstones, migration checks and current parent visibility.
- **66 browser layouts / 11 states** pass at 390/768/1440 in both themes.
  Independent sessions prove lost-response exact command/key retry with unchanged
  persisted timestamp/revision, stale-account conflicts, canonical links, shared
  modal membership, keyboard save, restart persistence, updated titles,
  projection lag, metadata outage, withdrawal/deletion, account switching and
  signout. Unavailable references have no invented links and remain removable.
  Modal bounds, overflow and favorite-button scroll access pass. Mobile saved/
  outage, tablet conflict and desktop-dark modal screenshots are inspected.
- Architecture passes for **135 projects / 1,326 production sources / zero
  violations**. Affected builds and source/test typechecks, **57 Angular
  packages**, test inventory, changed readiness-tool lint, local Nginx routing
  and base/development Account Kustomize rendering pass. Existing lint warnings
  remain: aggregator 273, Discussion feature 12, core 1 and management 1.

Initial CSR is **1,494,961 / 1,500,000 bytes**, leaving **5,039 bytes**; budgets
are unchanged. Backend build errors from a control-character regex and a missing
composite project reference are fixed without suppression. Two earlier browser
attempts corrected harness expectations: the canonical saved timestamp must be
included when proving replay identity, and signout requires waiting for the
public thread reread. Their failed logs remain; the third full run passes.

Account Management now requires `DISCUSSION_URL`. Local Compose, base Kubernetes
and the development namespace override are wired; the local gateway routes the
public selection API to Discussion. Deploy that API/gateway and configure the
origin before enabling the updated account service/portal. Manifest rendering
does not qualify deployed connectivity. No production deployment occurred.

Trusted ingress identities, shell profile/preferences and catalog projection
advancement are controlled fixtures. Account broker/Firebase are unavailable in
this focused journey; Discussion uses the actual worker. Existing cross-service
visibility-observation races remain; a saved relation grants no target access.
Client uncertain intent remains in memory and is cleared on account change/full
reload. Deployment, integrated identity, export/erasure, restore/rollback,
load/soak and the complete workspace release gate remain open. Disposable
qualification services are removed after the run.

Next: real discussion voting through canonical actor membership, authorization,
durable writes, materialized counts and portal controls. Pinning, reviews,
related/top-author summaries, feeds/digests, notifications and the other service
workflows remain open. This checkpoint closes none of OP01-OP10; the goal stays
active.

## Quick discussion checkpoint (October 12, 2026)

API-mode topic lists and My Discussions now open a lazy real-service dialog.
It resolves the current app slug to its canonical UUID, reuses the thread form
and application service, and supports public reading, member replies, author
editing/removal and moderator removal. The dialog owns its view state; API ports
come from root providers. Explicit demo mode retains its separate local dialog.
Buttons display supplied service counters, or an unknown-count label.

The original uncertain command/key survives closing and reopening in session
memory. Conflicts retain typed text; account changes clear private forms/retries
and re-read permissions. Navigation disposes the modal, including while its chunk
loads. Distinct form IDs prevent collisions with the underlying page. Closing
refreshes the originating list, including removal from My Discussions after the
last live contribution is removed. No new migration, policy action, durable
store, outbox or projection is introduced; the existing materialization contract
continues to govern every read/write.

Accepted evidence:

- **3,091 executable/config files**, SHA-256
  `9971f14f17454554546718eece48c1892fc6a9c17afa182df51cf78e2ddab81f`,
  match the installed snapshot byte-for-byte. Node **22.17.1**, branch
  `codex/full-operation`, base **c965790e**. Evidence is under
  `/tmp/wapps-readiness/quick-discussion-portal-3/`.
- **380 tests / 54 suites / two projects** pass: Discussion feature 51 and
  aggregator 329. The eleven added tests cover API/demo selection, modal lifetime,
  canonical lookup, real counters, uncertain retry, conflict text, account
  changes, unavailable metadata and destroyed-view reads. Unchanged backend
  unit evidence from the prior checkpoint is reused.
- **27 real-service/recovery groups** pass through compiled Editorial/Discussion
  APIs, actual OPA, MySQL 8.4, Mongo 7, RabbitMQ 4 and pinned MinIO. The run includes
  existing application-topic, article-comment and My Discussions regressions,
  including restarts, full projection loss/rebuild, authorization failures,
  immutable receipts, tombstones, migrations and current parent visibility.
- **84 browser layouts / 14 states** pass at 390/768/1440 in light/dark themes.
  Independent sessions qualify exact request/key retry after close/reopen,
  conflict preservation, projection lag, API restart, account switch/signout,
  moderation, My Discussions refresh, full-thread navigation, outages,
  withdrawal and root removal. Modal bounds, horizontal overflow, scroll access,
  field IDs and themed borders pass; member-dialog keyboard containment passes.
  Mobile-light long-thread/retry and desktop-dark read/pending images are inspected.
- Architecture: **135 projects / 1,322 production sources / zero violations**.
  Affected Angular/CSR builds, source/test typechecks, **57 Angular packages**,
  inventory and changed readiness-tool lint pass. Existing lint debt remains
  273 aggregator warnings and 12 Discussion-feature warnings, with zero errors.

The initial CSR bundle is **1,494,731 / 1,500,000 bytes**, leaving **5,269 bytes**;
budgets are unchanged. New dialog components remain lazy. The three qualification
attempts preserve their logs: the first corrected a harness focus assertion for
deliberately disabled pending fields; the second exposed a rebuild-test race.
That test now waits for every expected topic's exact generation before comparing
the account page. The third run passes. Initial template alias and ES-library
compatibility errors are fixed; the conflict test now settles Angular's initial
form population before simulating user input and asserts the actual command body.
No failing check is counted as accepted evidence.

Trusted ingress identities, shell account data and catalog projection advancement
remain controlled fixtures. Pending command memory is lost on full reload or
account change. Existing cross-service visibility-observation races remain.
Production identity/ingress, deployment, database restore/rollback, load/soak,
export/erasure and the complete workspace release gate remain open. Disposable
qualification services are removed after the run.

Next: real discussion favorites through canonical eligibility, account storage
and portal controls. Votes/pinning, related/top-author summaries, reviews,
feeds/digests, notifications and the other mandatory service workflows remain
open. This checkpoint closes none of OP01-OP10; the goal stays active.

## My Discussions checkpoint (October 12, 2026)

API-mode `/me/discussions` now lists real application topics with a live post
owned by the signed-in member. SQL ownership and tenant scope determine
participation; multiple replies collapse to one thread. Deleted contributions
stop qualifying, root deletion hides the thread, and current application
visibility remains mandatory. The no-store endpoint has a self-read OPA action
and rejects identity/tenant query injection. Titles reuse the existing exact
Discussion generation; canonical membership/revisions are rechecked after I/O.

Ten-candidate keyset pages are ordered by immutable topic creation time. Hidden
parents can leave a short or empty page with a continuation; no unbounded scan
fills the page. The portal resolves current application names/slugs through the
catalog, replaces each page, clears obsolete cards on loading/failure and fences
account changes. Explicit demo mode keeps the old browser-local page. This view
does not claim to show deleted contributions or article-comment history.

No new materialization pipeline is added. The additive participant-index
migration is explicit, validates binary transactional ownership and actual index
order, and refuses incompatible or missing previously completed indexes.
Existing Discussion writes/outbox/payloads/generations remain authoritative and
recoverable. See the My Discussions subsection in `MATERIALIZATION.md`.

Accepted evidence:

- **3,086 executable source/config files**, SHA-256
  `11283062ec13ad03a7a0446fac79bd1de014c3d11c59da236930f708f0f94ef2`,
  match the installed snapshot byte-for-byte. Node **22.17.1**, branch
  `codex/full-operation`, base **c965790e**. Manifest and reports are under
  `/tmp/wapps-readiness/my-discussions-portal-1/`.
- **573 tests / 67 suites / four projects** pass: Discussion core 49,
  management 155, Discussion feature 40 and aggregator 329. These include
  authorization failure, strict response parsing, account switching, obsolete
  results, filtered pagination and migration corruption checks. Backend HTTP
  tests use authorized localhost listener access.
- **27 real-service/recovery groups** pass using compiled Editorial/Discussion
  APIs, actual OPA, MySQL 8.4, Mongo 7, pinned MinIO and RabbitMQ 4. Five new
  participation groups cover self/tenant/case isolation, deduplication, deletion,
  restart, full projection loss/rebuild, withdrawal and populated index upgrade.
  The run retains application-topic and article-comment regressions. No failing
  qualification attempt was needed for this workflow.
- **60 browser layouts**, ten states at 390/768/1440 in both themes, pass.
  Independent same-account and other-account sessions exercise real lists,
  canonical thread links, pagination, projection lag, API restart/outage,
  account switching/signout, last-contribution removal and withdrawn-page
  continuation. Mobile-light author and desktop-dark participant screenshots
  are inspected. Writes are seeded through real compiled APIs; the previously
  accepted application-discussion browser journey covers the posting/edit UI.
- Architecture: **135 projects / 1,321 production sources / zero violations**.
  Affected lint, source/test typechecks, backend/Angular/CSR builds, **57 Angular
  packages**, test inventory, readiness-tool lint and **27 OPA checks** pass.
  Existing warning debt remains 273 aggregator and 12 Discussion-feature
  warnings, zero errors. Local nginx dispatch and trusted-header replacement
  for `/api/me/discussions` pass with existing routing/body-limit regressions.

The initial CSR bundle is **1,481,242 / 1,500,000 bytes**, with **18,758 bytes**
headroom; budgets are unchanged. `DiscussionParticipation1791676824000` and the
updated Discussion OPA bundle are rollout prerequisites. Source/test checks and
accepted unchanged Editorial/materializer/generic-recovery evidence are reused
where valid; invocation mistakes (formatter path and obsolete CSR project name)
were corrected without suppressing failures. Disposable test services are removed.

Trusted ingress identities, shell account data and catalog projection advancement
remain fixtures. Target-kind isolation also uses controlled SQL changes in the
disposable database. There is no shared snapshot across Editorial visibility
checks; existing final-observation race limits apply. Production identity/ingress,
deployment, database restart/restore/rollback, load/soak, export/erasure and the
full-workspace release gate remain open.

Next: connect the quick-discussion dialog to real API-mode threads. Discussion
favorites, votes/pinning, related/top-author summaries, reviews, feeds/digests,
notifications and other mandatory workflows remain on the full-service goal.
This checkpoint closes none of OP01-OP10; the goal stays active.

## Application discussions checkpoint (October 12, 2026)

The API portal now resolves application slugs to canonical UUIDs and provides
public discussion lists/details, member topic creation and replies, author
editing/removal and tenant-admin removal. Topics have real titles and tags;
public chosen names never expose private identity IDs. Replies have their own
payload schema. Root removal hides the thread; removed replies remain redacted
structural entries. Ten-root keyset pages load reply bodies only on detail.
Demo routes remain explicitly selected and no view/vote/pinning statistics are
invented for the real API.

Immutable application bindings reuse the qualified Discussion SQL receipt/outbox,
immutable payload and complete-generation protocol. Current canonical Editorial
visibility is checked without relying on its projection. Generic and article
routes cannot bypass this binding. Withdrawal, suspension and deletion deny
subsequent reads/writes even with retained public generations. The documented
cross-service final-observation race remains; there is no distributed transaction.

Accepted evidence:

- **3,068 executable source/config files**, SHA-256
  `2606d4d2a62ac609dec0f60466cdbd5db1eced05d3f4a719b80d43000613e73a`,
  match `/tmp/wapps-clean-install-ekk5hezn` byte-for-byte. Node **22.17.1**,
  branch `codex/full-operation`, base **c965790e**. The accepted manifest is
  `/tmp/wapps-readiness/application-discussions-portal-3/source.json`.
- **1,179 tests / 110 suites / seven projects** pass: Discussion core 33,
  management 140, materializer 45, Editorial 536, Discussion feature 28,
  article feature 68 and aggregator 329. Successful unaffected targets are
  reused; failed source/invocation checks are corrected and rerun. Backend
  HTTP tests require the qualified localhost listener permission.
- **23 service/recovery groups** pass with compiled Editorial/Discussion APIs,
  actual OPA, MySQL 8.4, Mongo 7, pinned MinIO and RabbitMQ 4. These cover exact
  concurrent replay, API restart, outbox rollback, root/reply validation,
  owner/tenant/admin/raw-route restrictions, pagination, broker delivery,
  projection loss/rebuild, parent visibility, populated migration reentry,
  deliberately corrupted index order, explicit upgrade and policy outage.
  The final run includes all article-comment backend checks and the generic
  Discussion real-store legacy/rebuild/reconciliation regression.
- **84 browser layouts**, 14 states at 390/768/1440 in both themes, pass.
  Independent members and anonymous readers exercise creation, replies,
  title/text edits, preserved conflict text, identical uncertain retries across
  real list/detail navigation, account switching, moderation, redacted replies,
  root removal, pagination, API restart/outage and withdrawal/republishing.
  Final mobile-light conflict and desktop-dark moderation screenshots are inspected.
- Architecture: **135 projects / 1,311 production sources / zero violations**.
  Source/test typechecks, affected builds, **57 Angular packages**, inventory,
  changed readiness-tool lint and **21 Discussion OPA checks** pass. Existing
  lint debt remains **273 aggregator warnings** and **12 Discussion-feature
  warnings**, with zero errors. Local nginx routing, trusted-header replacement,
  application visibility and the 32 KiB discussion body limit pass.

The initial CSR bundle is **1,481,115 / 1,500,000 bytes**, leaving **18,885 bytes**.
The existing quick-discussion dialog now loads on demand and displays a retryable
load error. Its behavior remains covered. Budget limits are unchanged. Browser
qualification corrected the new page's input-theme scope. Migration validation
now queries MySQL's ordered index sequence instead of trusting unordered ORM
introspection, while still rejecting incompatible indexes and destructive down
migrations. Startup requires explicit `DiscussionApplicationTargets1791676823000`;
upgrade workers before enabling application bindings. Older workers are not
rollback-compatible with the new binding kind.

Accepted reports, screenshots and worker/recovery logs are under
`/tmp/wapps-readiness/application-discussions-portal-3/`. Earlier failed attempts
are preserved. Canonical suspension and ingress identities are controlled
fixtures; application publication/withdrawal and Discussion delivery are real
service paths. Catalog projection advancement is controlled. Production identity,
Kubernetes provisioning, database restart/restore/rollback, load/soak, export/
erasure and the full-workspace release gate remain open. Pending portal retry is
memory-only across navigation and is lost on full reload or session change.

Next: account-scoped My Discussions, replacing the current local-reader scan
with real owned/participated topics and current target visibility. Votes,
pinning, related-topic/top-author summaries, discussion favorites, reviews,
feeds/digests, notifications and other mandatory service workflows remain on the
full-service goal. This checkpoint closes none of OP01-OP10; the goal stays active.

## Article comments checkpoint (October 12, 2026)

Anonymous readers can browse published article comments and open replies.
Ordinary signed-in members can post, reply, edit their own text and remove their
comments. Tenant-scoped admins may remove another member's comment but cannot
edit it. Public responses use explicitly chosen display names and expose no
private account IDs. Root removal hides its whole thread; reply removal keeps a
redacted structural entry that remains discoverable. Keyset pagination loads ten
roots per page; reply payloads load only when a thread is opened.

Comments reuse Discussion's immutable payload, SQL command receipt/outbox and
revisioned complete-generation pipeline. Article association is authoritative and
immutable. Generic Discussion routes refuse these threads, and generic listings
exclude them before the bounded head limit. Eligibility comes from current
Editorial SQL authority rather than either projection. Withdrawal denies
subsequent reads/writes and republishing the same canonical article restores its
retained threads. See the article-comments subsection of `MATERIALIZATION.md`
for cross-service race limits, migration/worker ordering and recovery semantics.

The portal preserves exact unconfirmed commands across route navigation, blocks
replacement commands until resolution, clears private intent/forms on account
switching and fences late responses. Saving, accepted-but-projecting, empty,
conflict and unavailable states are distinct. Conflicts preserve text for
comparison and explicit revision refresh. Pending retry is memory-only: full
reload loses that local intent, without undoing a committed write.

Accepted evidence:

- **3,044 source/config files**, SHA-256
  `7caf5489f1821559e22a2afd4b5cf52ee2de1bd294165747e30cd85f38883ee0`,
  verified byte-for-byte against `/tmp/wapps-clean-install-ekk5hezn`, Node
  **22.17.1**, branch `codex/full-operation`, base **c965790e**. Matching manifest:
  `/tmp/wapps-readiness/article-comments-portal-6/source.json`.
- **1,123 tests / 106 suites / six projects** pass: Discussion core 19,
  management 129, materializer 44, Editorial 535, article feature 68 and aggregator
  328. Relevant builds, source/test typechecks and lint pass. Earlier unaffected
  results are reused; the changed placeholder behavior and final templates are
  requalified. Existing aggregator lint debt remains **273 warnings / zero errors**.
- **11 real-service/acceptance groups** pass with compiled Editorial/Discussion,
  real OPA, MySQL 8.4, Mongo 7, pinned MinIO and RabbitMQ 4. These include concurrent
  exact replay, API restarts, SQL receipt failure/rollback, current parent checks,
  owner/tenant/raw-route isolation, revisions/moderation, keyset pagination,
  complete projection loss/rebuild, republishing, migration corruption/reentry
  and policy outage. The final group reruns the existing generic-discussion
  real-store recovery test, including legacy backfill and reconciliation.
- **78 browser layout checks**, 13 states at 390/768/1440 in both themes, pass.
  Independent members, anonymous reading, conflict preservation, exact-key retry
  across actual client navigation, unresolved-write account switching, moderator
  removal, redacted replies, pagination, outage/restart and parent withdrawal/
  republishing are exercised. Comment generations use the actual broker worker.
  Final mobile-light conflict and desktop-dark moderator screenshots were inspected.
- Architecture: **135 projects / 1,298 production sources / zero violations**.
  **57 Angular packages** in the aggregator dependency closure, test inventory,
  changed readiness-tool lint and **14 Discussion OPA checks** pass. Local nginx
  comment/visibility routing, trusted-header replacement and 32 KiB comment body
  limit pass with fixture authentication/upstreams. Disposable stores are removed.

The initial CSR bundle is **1,498,713 / 1,500,000 bytes**, leaving **1,287 bytes**
under the unchanged limit. Existing warning budgets and template/lint debt remain.
Accepted reports are in `/tmp/wapps-readiness/article-comments-portal-6/`;
earlier failed attempts and previous cover/text/favorites evidence are preserved.
Qualification fixed package-alias resolution, a section-spacing override,
redacted-reply discoverability and premature unconfirmed-write wording. Harness
URL/navigation/in-flight timing mistakes were corrected before acceptance.

Shell profile/preferences and trusted ingress identities remain controlled
fixtures. Article projection advancement is controlled; comment delivery/rebuild
uses the real worker. There is no atomic transaction between the two services:
a write may race withdrawal after its final authority observation, while later
reads still deny access. Kubernetes migration/runtime provisioning, production
identity/ingress, database restore/rollback, load/soak, account export/erasure and
the final full-workspace release gate remain open. This does not close OP01-OP10.

Next: application-bound discussion creation, replies, author edits/removal and
moderation through the real portal, preserving canonical parent visibility and
existing generic-discussion behavior. The full-service goal remains active.

## Article cover checkpoint (October 12, 2026)

Authors can upload, preview, resume and cancel private article covers, select an
image, supply required alternative text and save it with the article revision.
The API portal recovers exact upload commands after reload without storing file
bytes or tokens. Staff review a frozen cover and description; private replacement
does not change submitted or public content. Anonymous public readers see only
the current approved image, and withdrawal denies its bytes immediately despite
stale projections. Session changes clear private retry state and previews.

Cover uploads reuse bounded media decoding/storage through an article-specific
contract and namespace. Reference changes share draft/submission/publication
transactions; approval retains atomic canonical state/receipt/outbox semantics.
Cleanup and reference insertion lock the same upload. Latest-submission and
canonical references retain bytes; old nonlatest submission metadata does not.
Withdrawn canonical covers remain retained alongside reviewed payloads, with
access denied. Unreferenced retirement uses durable jobs, bounded leases/retries,
operator recovery and permanent empty object markers. See `MATERIALIZATION.md`.

Accepted evidence:

- **3,022 source/config files**, SHA-256
  `63dd13273e71458f0432b525b5cbb38bd4bf51632ae39fa23caced64f27af98e`,
  verified byte-for-byte against `/tmp/wapps-clean-install-ekk5hezn`; Node
  **22.17.1**. The accepted manifest is preserved at
  `/tmp/wapps-readiness/article-cover-portal/source.json`.
- **1,001 tests / 95 suites / five projects** pass: media domain 54, article
  domain 44, Editorial 534, article feature 41, aggregator 328. Relevant builds,
  source/test typechecks and lint pass. Final frontend build includes the
  heading-spacing/required-description correction. Existing aggregator lint debt
  remains **273 warnings / zero errors**.
- **18 real-service groups** pass on MySQL 8.4, Mongo 7, pinned MinIO, RabbitMQ 4,
  real OPA and compiled Editorial. Coverage includes exact retry/restart, owner/
  tenant/admin isolation, upload lease takeover, SQL receipt rollback and object
  recovery, immutable review, atomic publication/outbox, current visibility during
  object I/O, concurrent references/cleanup, retained tombstones, bounded cleanup
  failures/requeue, corrupt schema/reference rejection and broker rebuild/replay.
- **78 browser layout checks**, 13 states at 390/768/1440 in both themes, pass.
  Independent sessions, conflicting edits, lost upload response and full reload,
  wrong-file refusal, frozen green cover despite a private blue replacement,
  keyboard approval, anonymous images, service restart/outage and unresolved-write
  account switching are exercised. Representative final mobile-light and
  desktop-dark images were visually inspected; overflow/alignment/spacing pass.
- **9 text-article regression groups** pass with actual broker recovery against
  the extended service. Old text-only payloads remain compatible; absent covers
  are omitted rather than serialized as null/undefined fields.
- Architecture: **135 projects / 1,285 production sources / zero violations**.
  **57 Angular packages** in the current aggregator dependency closure, test
  inventory, affected readiness-tool lint and **48 Editorial OPA checks** pass.
  The package count is closure-scoped, unlike the earlier `--all` inventory.
  Real Nginx cover routing/header/body-limit qualification passes with fixture
  authentication/upstreams. Disposable suite teardown succeeds.

The initial CSR bundle is **1,498,704 / 1,500,000 bytes**, leaving **1,296 bytes**
under the unchanged limit. Cover services/components are lazy. Existing 1 MB
warning, style-budget and template warnings remain visible debt.

The final browser report's inherited limitation sentence still names covers as
unqualified; its 78 accepted captures and cover-specific `qualification.json`
supersede that stale generic sentence. Raw reports are retained unchanged.
Shell profile/preferences and ingress identities are controlled fixtures. Browser
projection advancement is controlled for lag, with real broker delivery/recovery
separately qualified. Full-workspace regression, production identity/ingress,
deployment, database restart/restore/rollback, load/soak, cross-service erasure
and article comments remain open. Historical article/favorites/release evidence
is preserved; this checkpoint does not close F06 or OP01-OP10.

Next: real article comments and moderation, with current article visibility
checked at the application boundary. The full-service goal remains active.

## Article text publication checkpoint (October 12, 2026)

Authors can create, reopen and edit account-owned plain-text articles at
`/my/articles`, supply a public byline, add bounded sections/paragraphs/tags and
submit a saved immutable revision. Independent staff use `/editorial/articles`
to review the exact submitted text, reject it with a reason or approve it.
Private edits remain separate from submitted and published content. Authors must
withdraw public/pending content before deleting a private draft; published URLs
remain permanently reserved. No application ownership grant is required to write
an article, and private account identity is never used as its public byline.

Public `/articles` and detail routes use current reviewed content, canonical SQL
selection and exact-revision projections, with title search, category/tag filters
and pagination. Article favorite buttons save canonical UUIDs to Account
Management; `/my/favourites/articles` resolves current titles/URLs. Withdrawn
articles become unavailable references that remain removable. Explicit demo mode
retains fixtures. API and demo favorites adapters load lazily, preserving the
existing initial-bundle limit and account fencing during deferred loading.

Materialization follows the article protocol in `MATERIALIZATION.md`: private
edits stay in SQL; publication/withdrawal commit canonical state, receipt and
outbox atomically. Worker retries, acknowledgements, rebuild and tombstones use
the common Editorial pipeline. Current SQL visibility prevents disclosure through
a stale public projection. Startup requires the additive article migration.

Accepted evidence:

- Backend checkpoint: **2,971 files**, SHA-256
  `54eb4cebdea6a8d83268d3e55a07745c0e0d99c98167908638b96a666b1e9a10`,
  retained at `/tmp/wapps-readiness/article-backend` with **9 real-service groups**.
- Portal checkpoint: **2,988 files**, SHA-256
  `f00b013de9d5e04e2b802ba18650d8d6d0b9f29dc63971f64b3cf31b1c9b1243`,
  copied byte-for-byte into `/tmp/wapps-clean-install-ekk5hezn`; Node **22.17.1**.
  Evidence is in `/tmp/wapps-readiness/article-portal` and the dated JSON record.
- **1,022 tests / 91 suites / six projects**: article domain 38, Editorial 508,
  Account Management 87, article feature 23, favorites feature 38 and aggregator
  328. Unchanged backend results are reused; affected frontend tests were rerun
  after integration fixes. Relevant builds, source/test typechecks and lint pass.
- **10 article real-service groups** using MySQL 8.4, Mongo 7, RabbitMQ 4, real
  OPA and compiled Editorial/Account Management. They cover independent author,
  reviewer, account and anonymous sessions; persistence/restart; revision
  conflicts; atomic rollback; receipt replay; frozen review; projection
  loss/rebuild; withdrawal; favorites; policy outage and server pagination.
- **162 layout states**: 27 workflow states at 390/768/1440 widths in light/dark.
  Overflow, alignment, shared spacing, single-row navigation and input borders
  pass. Representative author, review, reading and favorites screenshots were
  visually inspected. Keyboard navigation and same-browser account switching
  with an unresolved write also pass.
- **10 release backend/broker regression groups** pass against the same compiled
  Editorial service. Account favorite regression covers application rename,
  deletion, lag, shared account revisions, retry, restart and offline removal.
- Architecture: **135 projects / 1,261 production sources / zero violations**.
  **64 emitted Angular packages**, test inventory, readiness harness lint and
  **46 Editorial / 30 identity OPA checks** pass. Aggregator lint retains its
  existing **273 warnings / zero errors**.
- Real Nginx article/private/review/catalog routing and header checks pass using
  fixture authentication/upstreams. Harness teardown succeeded; no disposable
  suite/gateway containers remain.

The initial CSR bundle is **1,498,656 / 1,500,000 bytes**, leaving **1,344 bytes**
under the unchanged limit. Its 1 MB warning and existing component-style warnings
remain. New feature code must continue to respect this constraint.

Limits: **article covers and comments are still required and unimplemented**;
F06 and OP06/OP07 remain open. Shell profile/preferences and trusted ingress
claims are browser fixtures; account favorites themselves use real services.
Public projection publication is controlled for lag checks, with actual broker
delivery/recovery separately exercised. Retry intent survives route navigation in
memory but not full reload/browser termination. Production identity/ingress,
deployment, database restart/restore/rollback, load/soak, feeds and cross-service
export/erasure remain unqualified or unfinished. The full-service goal stays active.

Next: article cover upload, frozen review/public binding, recovery and retention,
then real article comments using canonical content visibility and moderation.

## Release publication portal checkpoint (October 12, 2026)

Verified application owners can create and reopen private release drafts at
`/my/releases`, edit bounded change lists, submit saved notes, compare canonical
notes without losing unsaved fields, and explicitly merge/rebase. Opening a
published version creates a separate private draft. Deletion removes private
work while preserving approved notes; an explicit confirmed withdrawal hides
public notes immediately. Future release dates remain draftable but cannot be
submitted early. Published version identifiers remain reserved.

Assigned independent reviewers use `/editorial/releases`. Queue/detail views show
the frozen submitted notes, current visible application context, rejection reasons
and confirmed outcomes. Current parent labels are read from canonical SQL rather
than included in versioned release content; hidden parents expose no context.
Private edits after submission cannot alter review or public content. Review and
owner commands remain bound to their exact private/public revisions and current
authority. Application behavior stays behind feature ports; pages orchestrate
state and routes, and lazy API adapters validate response identities and receipts.

API-mode devlogs now show actual approved notes, stable/prerelease channels,
version details and earlier-release history. Channel/date filtering and totals
are canonical and server-paginated, including truthful empty, missing, updating
and unavailable states. Explicit demo mode retains its fixtures. Local Nginx routes
owner, review and public release APIs to Editorial with trusted-header replacement.

The feature retains exact pending commands and keys across client navigation,
blocks conflicting intent until an uncertain result is resolved, and clears/fences
private continuations when sessions change. Late completions refresh visible lists
without overwriting another editor; completion links respect owner/reviewer routes.
This retry memory does not survive a full document reload or browser termination.
Canonical drafts, submissions, public notes and command receipts remain in SQL.

Qualification on the isolated Node **22.17.1** lockfile installation passes:

- **1,016 tests / 93 suites / 4 projects**: application workspace 165, aggregator
  328, catalog-versioning 38 and Editorial 485. Later navigation fixes reran the
  affected frontend tests; unchanged backend evidence was retained.
- Declared feature/domain/service/aggregator builds, source/test typechecks and
  lint; **57 emitted Angular packages** pass inspection. The broad integration
  build covers **88 prerequisite tasks**. Existing aggregator lint debt remains
  **273 warnings / zero errors**.
- Architecture: **135 projects / 1,242 production sources / zero violations**;
  test inventory and readiness harness lint pass.
- **11 real-service groups** using MySQL 8.4, Mongo 7, RabbitMQ 4, real OPA and
  the compiled Editorial API. This includes three API restarts, atomic rollback,
  replay/reordering, projection loss/rebuild, hidden-parent context, grant changes,
  immutable review, independent browsers and actual filtered pagination.
- **180 layout states**: 30 workflow states at 390/768/1440 widths, in light/dark
  themes. Measurements cover overflow, shell alignment, navigation rows, themed
  inputs and shared spacing; representative screenshots were inspected visually.
- Real Nginx syntax/routing/header qualification passes with fixture authentication
  and upstreams, preserving media/account/catalog routing. Disposable services and
  containers were removed after qualification.

The initial CSR bundle is **1,499,926 / 1,500,000 bytes**; the budget is unchanged
and only **74 bytes** remain. Subsequent workflow composition must preserve that
limit through lazy loading or reduced eager code.

Accepted source and browser/service evidence:
`/tmp/wapps-readiness/release-portal-complete`, **2,958 files**, SHA-256
`87a4fda48892850ab2c113201b5a7a37a8a1c1d48da3b9d2a25e6a4e897757e6`.
Commands, logs, tests and substitutions are recorded in the readiness JSON.
Earlier backend, application, media and suite manifests remain separate.

This locally qualifies the release author/reviewer/devlog workflow. It does not
close OP06/OP07 or the full-service goal. Ingress identities, shell account data
and successful DNS proof are harness fixtures; parent suspension/withdrawal is
seeded explicitly. Production identity/ingress, public DNS, deployment, database
restart/restore/rollback, load/soak and cross-service export/erasure remain open.
Article publication is next; the service-wide goal stays active.

## Release publication backend checkpoint (October 12, 2026)

This historical backend checkpoint predates the portal checkpoint above.

Verified application owners can create private release drafts, submit immutable
notes and receive independent staff approval/rejection through the Editorial API.
Approved notes have a separate canonical UUID and permanent application/version
URL. Draft edits stay private; private deletion preserves approved notes. Explicit
withdrawal revokes visibility immediately. Another maintainer opens a new private
draft bound to their current grant; former drafts never inherit new ownership.

Both draft and public revisions are required. Competing approvals conflict;
explicit rebase cancels pending review before resubmission. Approval rechecks the
pinned grant and current parent application under canonical SQL locks. Revoked
grants cannot approve/resubmit/rebase. Private cleanup and historical receipt
replay remain available without restoring publication. Domain contracts bound
content, versions and dates; future drafts cannot be submitted early.

Publication, lifecycle, receipt and durable outbox commit atomically. The existing
Editorial materializer now supports `release`, with complete snapshots, monotonic
revisions, tombstones and SQL reconciliation. Public reads check current parent
visibility and release revision before/after Mongo I/O. Parent labels are read
from SQL rather than copied into release projections. The additive migration
validates binary transactional schema and populated relationships in bounded
batches; completed migration history cannot conceal a lost table.

Qualification in the isolated Node **22.17.1** lockfile installation passes:

- **515 tests / 36 suites / 2 projects**: Editorial 484 and catalog-versioning 31.
- Both projects' builds, source/test typechecks and lint; Editorial's **20**
  prerequisite tasks; readiness harness lint and test inventory.
- **46** real Editorial OPA cases, including release self-workspace/reviewer
  policies. The policy definition now retains media cancellation on regeneration.
- Architecture: **135 projects / 1,235 production sources / zero violations**.
- **10** release real-service groups with MySQL 8.4, Mongo 7, OPA, compiled HTTP,
  two API restarts and RabbitMQ 4. This includes receipt/outbox rollback,
  capacity/edit/review races, revoked grants, inherited canonical content, schema
  corruption, projection loss, lost acknowledgements and old events after withdrawal.
- **11** existing application-publication regression groups, including real
  broker delivery/recovery. Disposable processes/containers were removed.

Evidence: `/tmp/wapps-readiness/release-publication-backend-delivery-final` and
`/tmp/wapps-readiness/release-application-publication-regression`. The accepted
source manifest has **2,945 files**, SHA-256
`4f9879560964aba6f7f9a3ddbbbbffbc0795e0a1578345311716222ef29708bb`.
Build/test/policy/boundary logs and exact commands are recorded in the readiness
JSON. The HTTP unit suite required localhost permission after sandbox `EPERM`.

This is a backend checkpoint within the release workflow, not completed F11.
The portal still shows fixed release fixtures and has no release author/reviewer
screens. Browser qualification, gateway routing, deployed credentials, public
DNS, database restart/restore/rollback and load/soak remain unverified. Ingress
identities and successful DNS proof are harness substitutions; parent lifecycle
restrictions are explicitly seeded. No production deployment occurred. Continue
with the release portal, then article publication, while the full goal stays active.

## Application media portal checkpoint (October 12, 2026)

Application owners can upload and preview private logos/banners, explicitly attach
or remove each slot, recover retained uploads and cancel unused images. Saved
text and image changes share the authoritative draft revision. Attachment
acknowledgement preserves unsaved text; competing revisions require reload.

Each command is retained before sending, with its exact revision and retry key.
Reload recovery verifies the original file's format, size and SHA-256, without
retaining file contents, filenames or bearer tokens in session storage. Lost
reservation, upload and attachment responses reuse the original command. No-file
cancellation and recovery remain accessible outside the original editor, including
after draft deletion. A replayed ready receipt is checked against current upload
state. Account changes fence pending work and clear private state. Unavailable
storage prevents new media writes; unavailable lists/previews remain explicit.

Owner and reviewer previews use their authority-specific routes and validate
immutable byte descriptors. Blob URLs are revoked as views/accounts change.
Reviewers see the frozen submission despite later private edits. Explicit
per-slot canonical comparison/merge preserves selected private content; unknown
legacy submission images block approval until the owner resubmits.

The isolated lockfile installation passes **584 tests / 61 suites / 4 projects**:
application workspace 123, aggregator 328, catalog-media 40 and catalog-record 93.
Affected builds, source/test typechecks and lint pass. The aggregator dependency
build completes **85 tasks**, and **57 emitted Angular packages** pass inspection.
Existing aggregator lint debt remains **273 warnings / zero errors**. The source
audit covers **135 projects / 1,226 production sources / zero violations**.

The production CSR initial bundle is **1,492,108 / 1,500,000 bytes**. Pure catalog
record/media packages now explicitly declare that importing unused modules has no
side effects, preserving lazy transport/parser loading. No budget was increased;
the existing 1 MB warning and existing component-style warnings remain.

Real-service browser qualification uses disposable MySQL, Mongo, MinIO, real OPA
and the compiled API. Media checks cover **54 layout states** at 390/768/1440 in
both themes. Shared publication and ownership regressions add **114** and **180**
layout states respectively. They verify API restart, independent sessions,
immutable review/publication, current visibility during projection lag, wrong
accounts/reviewers, reload retry recovery, image merging and legacy resubmission.
The ownership regression retains real controlled-DNS proof and independent review.

Exact commands, source fingerprint, corrected failures and fixture boundaries are
recorded in `applicationMediaPortalCheckpoint` in the dated readiness JSON. Shell
accounts and trusted ingress are fixtures; media rebase grants and the unknown
legacy snapshot are supplied through SQL. This does not qualify production
identity, public DNS, bucket provisioning, cleanup activation, restore/rollback,
load/soak or cross-service account erasure. Prior API retention/publication evidence
is preserved. The next publication work is required article/release behavior;
the complete OP01-OP10 goal remains active.

## Application media retention API checkpoint (prior retention checkpoint)

Owners can recover retained uploads for a draft and cancel an unreferenced image
using its expected revision and an exact retry key. Cancellation refuses draft,
frozen-submission and public references. Its tombstone, cleanup intent and receipt
are atomic; historical upload receipts cannot restore readiness or bytes.

Automatic retention retires expired pending uploads, ready images unused seven
days after creation, and unreferenced images from deleted drafts. Reference
insertion, upload completion and retirement serialize on the upload row. Cleanup
uses durable SQL jobs, fenced leases and eight bounded attempts before explicit
operator requeue. Conditional empty markers at the private object key prevent
delayed uploads from recreating retired bytes. Referenced images and markers are
retained; the dedicated bucket must stay unversioned. Enabled or suspended bucket
versioning is refused. This is not account erasure or a general bucket sweeper.

`--media-cleanup`, `--media-cleanup-status` and
`--media-cleanup-requeue <image-id>` provide bounded maintenance and recovery.
`EDITORIAL_MEDIA_CLEANUP_ENABLED=true` enables the serial API worker after
migration and bucket provisioning. Activation defaults to disabled. Local Compose
and environment examples expose the settings; deployment activation is unverified.
Migration reentry rejects missing completed schema, invalid lifecycle timestamps,
wrong retirement reasons and lost ready receipts. Destructive rollback is refused.

Qualification uses Node 22.17.1 and the existing isolated lockfile installation
with Sharp 0.35.5. It records **498 passing tests / 37 suites / 2 projects**
(Editorial 458, catalog-media 40), builds, source/test typechecks and affected
lint. OPA passes **44 policy tests**. The source audit passes **135 projects /
1,218 production sources / zero violations**. Readiness harness lint and Compose
configuration parsing also pass.

**29 real-service groups** pass against disposable MySQL, MinIO, real OPA and
the compiled API. They include existing upload/publication behavior plus
list/cancel isolation, atomic rollback, concurrent attach/cancel and automatic
retirement, current references, late object writes, versioning refusal, lease
takeover, lost cleanup receipts, bounded retries/requeue, corrupted migration
state, HTTP restart and compiled background/maintenance execution. CLI retained
failure reporting is checked with injected failed-job state; adapter tests execute
all eight failed attempts. Disposable services are removed after qualification.

Exact commands, source fingerprint, corrected failures and exclusions are in
`applicationMediaRetentionCheckpoint` in the dated readiness JSON. No portal
screen changed; previous browser evidence is retained without claiming new media
UI coverage. Full-stack provisioning/activation, cross-service erasure,
database restore/rollback and load/soak remain unqualified.

The user's ownership policy is now explicitly confirmed in the materialization
contract: canonical website domain proof plus independent staff approval, with
later content changes still reviewed. The full-service goal remains active.
Next in this same workflow: portal upload/preview/attach/remove/cancel, reload and
exact retry recovery, per-slot rebase comparison, frozen reviewer previews and
legacy-null resubmission. Preserve lazy composition and the existing bundle budget.

## Application media publication API checkpoint (prior association checkpoint)

Owners can attach or remove a ready logo/banner through a revision-bound draft
command. The image must belong to the same draft, owner and tenant; arbitrary
URLs, descriptors and authority overrides are rejected. Images share the draft
revision, workspace lock and exact-retry receipt protocol. Text-only saves retain
images. Opening a verified-owner editing draft copies canonical images; explicit
rebasing can independently select private or canonical content for each slot.

Submission freezes both image slots, including explicit removal and existing
external URLs. Approval commits those references, canonical media URLs, public
revision, decision, command receipt and materialization outbox in one SQL
transaction. Later private edits never alter submitted/public images. Public
URLs use `/api/media/applications/:applicationId/:purpose/:imageId` under the
explicit `EDITORIAL_MEDIA_PUBLIC_ORIGIN`; the object bucket stays private.
Owner, reviewer and public readers use their respective canonical authorities
before and after object I/O. Withdrawal, deletion, suspension or a replaced URL
stops public access without waiting for a projection update.

`ApplicationImageBindings1791676815000` adds indexed draft/submission/public
references. It validates physical varchar lengths from MySQL metadata because
TypeORM omits its default length of 255 when reading schema. Interrupted initial
backfill is resumable; completed-migration reentry rejects missing or incomplete
draft snapshots rather than silently reconstructing them. Historical submissions
with unknown media cannot be approved. The owner can resubmit for a fresh review,
atomically retiring an old pending submission without withdrawing public content.
Inherited/public references survive deletion of the original private draft and
revocation never restores stale authoring rights. Reference writes revalidate
immutable asset metadata under sorted upload-row locks.

The local nginx routes now send private image commands and public image reads to
Editorial. Uploads have an 8 MiB gateway limit and body timeout; authenticated
routes replace caller identity headers and public image routes strip them. The
media package now has its canonical private package name so independent Angular
libraries resolve its built declarations instead of compiling domain sources
inside a feature root. The affected library chain was rebuilt with repaired
outputs cleared and cache disabled.

Evidence is under `applicationMediaPublicationCheckpoint` in the dated JSON:
594 tests / 39 suites across four affected projects, real SQL/MinIO/OPA/compiled
API media checks, ownership/authoring regression, existing publication/projection
regression and 114 existing portal layout states in both themes at three widths.
The gateway uses fixture upstreams/authentication. The media ownership-transfer,
suspension and direct-URL cases deliberately seed canonical SQL state; separate
ownership regression exercises actual claims/DNS/review. Browser evidence covers
compatibility of existing draft/publication flows, not new media controls.

The media workflow is still incomplete. Next: cancellation and bounded durable
orphan/retention cleanup, then portal upload/attach/remove/preview, image comparison
and review with exact retry recovery. Deployment bucket/origin provisioning,
cross-service erasure, database restore/rollback and load/soak are unqualified.
The full-service goal remains active and no OP01-OP10 gate is closed here.

## Application media API checkpoint (prior upload-only checkpoint)

Authenticated draft owners can reserve a logo/banner upload, send the exact
reserved PNG/JPEG/WebP bytes, recover a failed or unconfirmed completion and
retrieve normalized private WebP previews. SQL enforces case-sensitive owner and
tenant scope, including for administrators. Caller-supplied ownership, URLs and
storage keys are rejected. These uploads do not yet attach to a draft's reviewed
content or publish a catalog image.

Domain contracts bound source/output bytes, pixels, dimensions, purposes and
lifecycle. Sharp 0.35.5 is pinned explicitly and qualified in the clean installed
source snapshot. Still-image normalization strips metadata, preserves aspect ratio
and bounds dimensions. The HTTP adapter accepts uncompressed binary bodies under
a two-upload concurrency cap and a 15-second body deadline. Private preview reads
recheck canonical authority after object I/O and use no-store/nosniff headers.

The owner workspace lock serializes reservations, capacity checks and receipt
writes with draft deletion. Source digest/size bind each intent; persisted
30-second leases fence completion, with three executions per key and ten per
upload. Conditional MinIO writes never overwrite existing bytes; size/digest
verification permits recovery after a lost PUT response or a failed SQL receipt
transaction. Objects become ready only when metadata and receipt commit together.
There is no new projection or outbox for these private authoritative reads.

`ApplicationImages1791676814000` adds validated upload/command tables. Normal
Editorial startup now refuses pending migrations, correcting the previous
`migrationsRun: true` mismatch with the documented explicit-maintenance protocol.
The compiled API qualification verifies refusal without changing migration history.
The private object bucket must be provisioned explicitly; missing storage settings
produce an unavailable error and never select another provider or demo data.

Evidence is recorded under `applicationMediaApiCheckpoint` in the dated JSON.
Affected domain/Editorial regression, builds, source/test typechecks, policy tests,
lint, inventory and architecture checks pass. Real SQL/MinIO/OPA and compiled HTTP
checks cover concurrency, lease replacement, source mismatch, rollback, immutable
object conflicts, negative authorization, bounded bodies, process restart and
immediate preview denial after draft deletion. Trusted actors/ingress are supplied
by the harness. This is not portal or deployed-provider qualification.

Next within the same workflow: revision-bound image association, deliberate
legacy-image preservation and remove/replace/rebase behavior, frozen submission
media, atomic approved public references, visibility enforcement during projection
lag, durable orphan cleanup/retention, and portal upload/review/retry integration.
Expired reservations currently stop consuming pending capacity but do not delete
objects. Full-service readiness, production bucket provisioning, account erasure,
database restore/rollback, load and soak remain open. No production action occurred.

## Ownership portal checkpoint

API users can start a claim from a public application, submit immutable evidence,
publish the displayed DNS TXT challenge, check proof, cancel a claim and see an
independent review decision and reason. Assigned ownership reviewers have a
pending queue and an active-grants view for revocation. Owners can release a
grant. Ownership review remains separate from content-review permission, and
claimants cannot approve themselves. Explicit demo mode retains local notes.

Approved owners open a separate private editing draft of the existing canonical
application. Field comparisons and explicit canonical-value actions preserve
private edits. Refreshing the source never replaces unsaved fields. An explicit
merge uses the selected fields and current revision, cancels pending review and
leaves public content unchanged. Content review publishes the frozen submission
to the same public UUID. Revocation preserves private work; a subsequent grant
requires a fresh draft. Deleting an old editing draft cannot erase publication.

The feature layer owns state and strict response contracts behind ports; pages
compose those services and shared UI. Route paths are centralized. Account
changes cancel obsolete work and clear private state. Unconfirmed requests retain
their original command/key across navigation, and completion returns to the
original application or staff review route. HTTP adapters load lazily; the
initial bundle is 1,496,684 bytes against the unchanged 1,500,000-byte error budget.

Qualification: 752 tests in 78 suites across Editorial, the application workspace
and the aggregator; 21 real-service groups; 21 browser capability checks; and
180 layout states (30 states, three widths, both themes). Browser checks cover
negative/positive DNS proof, rejection, approval, revocation, release, old-grant
denial, exact retries, independent sessions, API restarts, private cleanup,
revision conflicts and projection lag/recovery. Theme, spacing, width, input
borders, section navigation and keyboard controls are checked. Affected builds,
source/test typechecks, lint, inventory and 57 Angular package audits pass.
Architecture checks scan 135 projects and 1,197 production sources with no
violations; 273 pre-existing aggregator lint warnings remain visible.

See `applicationOwnershipPortalCheckpoint` in the dated evidence JSON for the
source fingerprint, commands, logs, corrected failures and exclusions. The
unchanged policy and broker writer reuse their previous qualified evidence;
this browser run controls projection publication and keeps the broker unavailable.
Shell account responses and trusted ingress identities are fixtures. Public DNS,
deployed identity/ingress, database restart/restore/rollback, load/soak and deployment
remain unverified. All disposable qualification containers were removed.

The API-only checkpoint below is historical. Its pending portal work is superseded
by this checkpoint; its original qualification evidence remains unchanged.

## Ownership API integration (workflow incomplete)

The former author's private workspace now survives ownership transfer. They can
read, edit and delete their own private material without accessing the new owner's
drafts or withdrawing/scrubbing the transferred public record. Recorded publication
retries return their original receipt without writing or regaining authority.
Publication migration reentry accepts legitimate historical ownership transfers
and refuses unrecorded owner changes.

Verified-owner editing allocates a separate private UUID and pins it to the
canonical application UUID, original claim ID and source public revision. Opening
or explicitly merging a working copy requires the current active grant and
revision. Submission, approval and withdrawal recheck authority against SQL under
the canonical application lock. Immutable reviewed content publishes into the
existing public application; later private edits remain private. Concurrent
draft approvals commit at most one change to the same source revision.

Canonical changes produce conflicts. Explicit rebase requires a selected merged
payload and the latest public revision, cancels pending review atomically with
the private change/receipt, and leaves existing public content intact. Release
or revocation never restores old unbound drafts, including the same identity's
original draft. A later grant cannot revive a draft bound to an earlier claim.
Removing an editing draft only cleans up private material. Direct Editorial
publisher/moderator routes retain their separate trusted-role policy; this is
not a claim that grant revocation universally revokes staff permissions.

The compiled API now exposes owner claims at `/api/me/ownership-claims`, staff
review at `/api/editorial/ownership-reviews`, and canonical editing through
`GET /api/me/application-drafts/canonical/:id`,
`POST /api/me/application-drafts/from-application` and
`POST /api/me/application-drafts/:id/rebase`. Ownership and editing migrations
are registered in normal startup and maintenance. Private responses use
`Cache-Control: no-store`; invalid, denied, missing, conflicting, rate-limited and
unavailable outcomes have explicit HTTP responses. DNS defaults to the system
resolver; operators may explicitly configure 1-4 server IP addresses with
`EDITORIAL_OWNERSHIP_DNS_SERVERS` (comma-separated, optional ports).

Local real-service qualification includes the compiled API, controlled native
DNS, independent actors, two API restarts, conflicts, retries, denial, rollback,
revocation and policy outage. Existing publication/broker recovery regressions
also pass. See `applicationOwnershipIntegrationProgress` in the dated evidence
JSON for counts, source fingerprint, logs and exclusions. The existing portal
still shows local ownership preparation; no new ownership browser journey or
layout qualification has been delivered. The next step is API-mode claimant and
reviewer screens plus grant-bound editing/conflict recovery, followed by the
independent-browser journey. OP01-OP10 and the full-service goal remain open.

## Initial ownership backend evidence (historical)

The following describes the earlier backend-only checkpoint. The API integration
above supersedes its pending wiring and authoring work; its evidence is retained.

The ownership domain now has bounded immutable claim input, an exact-host DNS
challenge, revision-bound verification/review/cancellation, approval, release and
revocation. The current implementation default requires domain control plus an
independent staff decision, with content changes still reviewed. The optional
policy question has not received a response. Existing catalog authorship is not
automatically treated as proof of ownership. Dedicated
`editorial:ownership-reviewer` permission is separate from content-review roles;
even administrators cannot approve their own claim.

Editorial owns private claim/workspace rows, verification reservations, immutable
command receipts, decision history and current grants. Claim reads use canonical
SQL and need no projection. Approval atomically changes canonical application
ownership/revision with the claim, grant, decision, receipt and outbox. Revocation
or release atomically marks the grant inactive and advances public revision/intent.
Old approval receipts do not reactivate a released grant. Application authoring
must still be integrated with these active grants before the feature is exposed.

DNS uses the existing canonical website hostname and an unpredictable per-claim
TXT token. Proof is valid for review for 24 hours; the challenge expires after
seven days. Network I/O stays outside SQL locks. Persisted verification leases
fence late completions, limit one intent to three executions, limit a challenge
to ten checks, and separate fresh checks by 30 seconds. Missing TXT proof is a
negative observation; provider failures remain recoverable failures. Staff
approval also checks the application's original canonical revision.

The new `ApplicationOwnership1791676812000` migration creates and validates the
claim tables. It is exercised by the dedicated qualification branch; it is **not
yet registered in API startup/maintenance**, and no ownership controller or
portal provider has been exposed. No production migration or DNS record was
changed. Existing application publication remains the most recent complete user
workflow.

The focused check passes 356 tests in 26 suites (ownership 14; Editorial 342),
37 OPA policy cases, affected lint/typechecks, inventory and architecture checks
(135 projects, 1,186 sources, zero violations). Real MySQL/Mongo/OPA plus a local
UDP DNS server exercise immutable retries, tenant/case isolation, negative and
positive proof, grant/outbox rollback, independent SQL connections, concurrent
claims, stale lease fencing, persistent retry bounds, corruption refusal and
policy outage. This proves the application/write path; it does not prove HTTP,
browser or process-restart behavior for ownership. See
`applicationOwnershipBackendProgress` in the dated JSON for exact evidence.

Next within this workflow: integrate ownership transfer/revocation with existing
private drafts and publication, add verified-owner drafts targeting existing
canonical application IDs, then wire owner/reviewer APIs and portal screens and
qualify the complete independent-browser journey. Never transfer a former
author's private draft contents to a new owner. Losing ownership must not prevent
private cleanup or let cleanup withdraw someone else's public record. Imported
editing drafts need a pinned grant and source public revision, with explicit
conflict recovery; approval must recheck both before replacing canonical content.

## Application publication workflow checkpoint

API-mode authors open **Manage publication** from My Apps or a saved draft at
`/my/apps/:applicationId/publication`. Submission freezes saved name, slug,
website and description. Independent assigned reviewers use `/editorial/apps`
and `/editorial/apps/:applicationId` to approve or reject with a reason. An
administrator cannot review their own application. Later private edits remain
private, and rejection preserves the previously approved public content.

Editorial stores `application_submissions`, `application_publications` and
`application_publication_commands`. The owner workspace lock serializes draft
changes, deletion and review. Explicit policy precedes storage; canonical tenant
and owner checks repeat under locks. Each change binds to an aggregate revision
and retains an immutable receipt for exact replay. Approval also checks the public
revision captured at submission, preventing an intervening direct Editorial edit
from being overwritten. Status does not label independently edited public content
as the previously approved submission.

Approval commits the decision, private revision, canonical application content,
public revision/lifecycle, publication pointer, receipt and outbox atomically.
The existing `app` materialization protocol handles snapshots, confirmed delivery,
duplicates, reordering and rebuild. Withdrawal immediately removes SQL visibility
during projection lag. Deleting a draft also withdraws it and scrubs public/private
text and media URL fields while retaining slug reservation, tombstones and receipts.
Stale projected documents or old successful receipts cannot restore visibility.

`ApplicationPublication1791676811000` adds binary-collated transactional tables
and widens public website storage from 500 to 2,048. Domain, command, snapshot,
public response and BFF limits now agree. Reentry validates decision/reviewer,
receipt and publication relationships; malformed history fails explicitly.
Migration/startup ordering remains explicit, and rollback requires a reviewed
data-preserving migration. No production schema was changed.

The feature keeps orchestration in pages, use cases behind ports and lazy HTTP
loading in the infrastructure adapter. Root-scoped session/retry state survives
route changes. Lost submission/approval responses retain the original key and
command; account switches cancel old work. The portal builds within the existing
1.50 MB error budget without increasing it. Existing warning budgets remain debt.

Qualification evidence is recorded in `applicationPublicationWorkflowCheckpoint`
in the dated JSON. Affected regression passes **800 tests in 78 suites across
five projects**, plus **32 OPA cases**. Source/spec typechecks, lint, inventory and
the architecture audit pass (135 projects, 1,181 sources, zero boundary violations).
Existing lint debt is 273 aggregator and six BFF warnings. Six isolated build
targets pass after the recorded Editorial type correction, and all **57 Angular
packages** pass emitted-artifact checks. The qualified 2,847-file source digest is
`729f726dc74bd8d230cd8f0fcc0bad581d9ae2cbdc2d08dad7fb7967cb4e3979`;
the isolated source copy matches exactly within the recorded fingerprint scope.

The focused checks cover real SQL/Mongo/OPA/compiled API and
independent browsers, concurrent decisions, rollback on outbox failure, corrupt
migration input, API restart, public slug collisions and the full website limit.
RabbitMQ qualification covers confirmed publication, acknowledgement-loss
redelivery, duplicates, SQL reconciliation after projection loss and stale events
after withdrawal. Browser checks cover **114 layout states** at 390/768/1440 in
both themes, including spacing, alignment, overflow and truthful failure states.

Trusted ingress identities and unrelated shell account responses are fixtures.
Browser projection timing is controlled; broker recovery runs separately inside
the same disposable qualification. Public browser reads use Editorial's canonical
catalog contract; the BFF has separate HTTP contract/build/typecheck coverage.
The catalog author association does not verify real-world ownership. Claims,
existing-record authoring, media, account-wide erasure, production ingress,
database restart/restore/rollback and load/soak remain open. This completes the
local publication workflow only; the full-service goal and OP01-OP10 stay active.

## Application draft workflow checkpoint

API-mode `/my/apps` and `/apps/register?draftId=...` now create, list, reopen,
edit and delete private application drafts across independent sessions. The
feature composes application/session ports and a strict HTTP adapter; pages own
form and navigation orchestration. Demo mode retains the original local draft
pages. Browser-local data is never imported into an account automatically.

Editorial owns `application_workspaces`, `application_drafts` and immutable
`application_draft_commands`. Explicit self-access policy precedes persistence;
SQL scopes every read/change by trusted owner and tenant. A workspace lock
serializes the 100-draft limit, per-owner slug uniqueness and competing commands.
Edits/deletion require the expected revision. The row and receipt commit together;
injected receipt failures roll back creates, edits and deletion. Deletion clears
all payload fields but preserves owner, revision and tombstone. Old receipt
replay cannot restore deleted content.

Saving creates no public catalog record, ownership grant or projection intent.
Canonical SQL reads need no materializer; the explicit protocol and recovery
reasoning are in `MATERIALIZATION.md`. Run `ApplicationDrafts1791676810000` through
Editorial maintenance before startup. Its reentry checks reject incompatible
schema, corrupt values/receipts, orphan ownership and excess capacity. Existing
public records had a 500-character website limit versus 2,048 in private drafts
at this checkpoint; the later publication checkpoint resolves that mismatch.

The portal preserves the exact key and command after an unconfirmed response,
blocks competing intent, cancels obsolete work on account changes, and refuses
a previously prepared command subscribed under another account. A confirmed save
rereads the canonical revision even when the route is unchanged. Missing drafts
cannot accidentally become new drafts. Loading, unavailable, conflict and retry
states reflect API outcomes.

Affected regression passes **750 tests in 74 suites across four projects**:
catalog-record 81, Editorial 316, application-workspace 25 and Aggregator 328.
All 27 Editorial OPA policy tests pass. Source/spec typechecks, affected lint,
test inventory and architecture checks pass: 135 projects, 1,170 production
sources, zero boundary violations. There are 273 existing Aggregator lint
warnings. The first HTTP regression attempt was sandbox-blocked on localhost;
the permitted run passes all 316 tests. No skipped check counts as evidence.

The final isolated build passes four targets and 87 prerequisite tasks with the
changed runtime/package outputs cleared and Nx cache disabled. Catalog domain
build is included as a prerequisite. All 57 Angular packages in the Aggregator
dependency graph pass emitted-artifact inspection. Existing bundle/style-budget
and unused-import warnings remain. The complete workspace release gate was not
rerun at this focused integration point.

Real MySQL/Mongo/OPA with compiled Editorial and independent Chromium sessions
pass ownership/tenant/case isolation, concurrent duplicate commands, revision and
slug races, final-capacity races, rollback, scrubbed tombstone/replay, migration
reentry/corruption refusal, API restart and policy outage. Public lookup/selection
and canonical counts prove private drafts create no catalog records, public
state or outbox events. The browser checks actual forms, a lost committed save
response with identical retry, same-route edits, wrong-account/missing drafts,
stale edits, deletion, account switching and outage recovery.

Sixty screen/state/theme/width combinations pass at 390/768/1440 in both themes.
They measure no horizontal overflow, aligned columns, 24px header/content gaps,
16px card heading/content gaps and 8px optional heading/description gaps.
Screenshot review exposed a 24px form-card gap; the correction and new spacing
assertions pass on the final build. Representative screenshots were inspected.
All disposable qualification containers were removed.

Evidence is in `docs/readiness/implementation-2026-10-11.json` under
`applicationDraftWorkflowCheckpoint`; local logs use the
`/tmp/wapps-readiness/application-drafts-*` prefix. The isolated source fingerprint
covers 2,827 files and matches the workspace. Shell account responses and trusted
ingress identities are fixtures. Submission, review/publication, ownership
verification, media and cross-service export/erasure are still required.
Production ingress/session validation, database restart, restore/rollback,
load/soak and deployment remain unqualified. Draft persistence does not close
OP06 or any other full-service readiness gate.

## Suite favorites workflow checkpoint

Signed-in readers save/remove approved suites from public detail and listing
screens. `/my/favourites/suites` filters saved suites; `/me/favorite` groups them
with applications. Independent sessions read the same SQL relations. Private
draft edits never replace the approved title shown in favorites. Withdrawal and
deletion remove public metadata/links while keeping the saved reference removable.

`GET /api/catalog/suite-selection?ids=...` accepts 1-50 canonical UUIDs, deduplicates
them and rejects extra query fields. It selects canonical public relations, reads
exact-revision suite projections and rechecks current authority after Mongo I/O.
Account Management checks this endpoint before new suite additions. Missing/private
targets fail explicitly; projection lag is retryable. Existing receipt replay and
removal do not depend on target availability. No new write model or projection is
introduced: the account lock, revision, immutable receipts and atomic outbox own
membership. The configured portal catalog origin must route suite selection to
Editorial; the local gateway now does so.

Affected regression passes 774 tests in 76 suites across five projects. Affected
lint and architecture checks pass (134 projects, 1159 production sources, zero
violations); 273 existing portal warnings remain. Isolated production builds cover
six targets and 88 dependencies. Strict consumer typechecking exposed index-signature
field access in suite parsers; explicit accesses fix it without weakening compiler
settings. The dated JSON records the initial failure and final checks.

Compiled Account Management/Editorial, real SQL/Mongo/OPA and independent Chromium
sessions pass canonical selection beyond one catalog page, account isolation,
lost-response retry, revision conflicts, API restart, approved-content replacement,
projection lag, atomic rollback, withdrawal/deletion and removal during metadata
outages. Browser evidence has 144 measured layout states: 72 application/suite
favorites states and 72 existing private/publication states, at 390/768/1440 in both
themes. Representative screenshots were inspected. Previous real broker evidence
remains valid: this slice does not change suite delivery or materialization.

Trusted ingress identities are supplied by the local harness. Projection timing
is controlled; account Firebase/broker are unavailable in this focused journey,
and unrelated shell account responses are fixtures in the separate suite browser.
Production credentials/ingress, database restart, restore, rollback/load/soak and
deployment remain unverified. The complete workspace release gate was not rerun.
Application ownership/drafts are next; article/discussion favorites, cross-kind
discovery, suite facets/legacy listing URLs and account export/erasure remain open.

## Suite publication workflow checkpoint

Owners submit saved suites, see status/reasons and withdraw them through
`/my/suites/:suiteId/publication`, linked from the saved draft. Authorized reviewers
use `/editorial/suites` and `/editorial/suites/:suiteId` to approve/reject immutable
submitted content. Self-review and cross-tenant review are denied. Public `/suites`
search/listing and UUID detail routes use actual approved content. Rejection
preserves the prior publication; later edits stay private. Withdrawal/deletion
immediately revoke canonical visibility.

Pure lifecycle contracts live in the suite domain. Application services authorize
through OPA; SQL adapters serialize owner writes and atomically commit lifecycle,
receipts and required outbox intent. The existing Editorial transport, projector,
reconciliation and rebuild support suite snapshots/tombstones. Public reads recheck
canonical eligibility after exact-revision projection reads. The additive migration
preserves private suites. `MATERIALIZATION.md` records the protocol.

The compiled browser journey passes submission, lost-response identical-key retry,
approval/rejection, stale-review conflict, immutable content, independent public
reading, Editorial restart, projection lag and withdrawal. Seventy-two measured
layout states cover old private and new publication screens in both themes at
390/768/1440 pixels; representative screenshots were inspected. Real SQL/Mongo/OPA
checks cover atomic outbox-failure rollback, isolation, replay after deletion,
competing reviewers and migration reentry. Actual RabbitMQ checks cover confirms,
redelivery after acknowledgement loss, duplicates, projection-loss reconciliation
and old publication events after withdrawal.

Affected regression: 667 tests in 74 suites across four projects. Editorial OPA:
22 policy cases. Source/spec typechecks pass after two test-only type corrections.
Boundary checks pass for 134 projects and 1159 production sources. The clean build
exposed shared-contract incremental metadata outside its output directory;
`apps/shared/tsconfig.lib.json` now keeps it inside its unique output. Corrected
isolated builds and Angular artifact checks are recorded in the dated JSON evidence.
Existing 273 portal lint warnings and roughly 1.48 MB initial bundle remain debt.
The complete workspace gate was not rerun for this focused workflow.

This is local qualification: trusted ingress identities and unrelated shell account
responses are fixtures; browser projection timing is controlled and actual broker
delivery is exercised separately. Production sessions/ingress, database restart,
restore, rollback/load/soak and deployment remain unverified. Suite favorites,
cross-kind discovery/facets/legacy suite URLs and account-wide erasure/export remain
separate work. This checkpoint does not close a full-product operational gate.

## Private suite workflow checkpoint

`GET/POST /api/me/suites` and `GET/PUT/DELETE /api/me/suites/:id` now implement
owner-only collections. Pure contracts live in `@domains/publication/suite`;
Editorial composes the application use case, self-access OPA policy, SQL adapter
and HTTP controller. New titles are limited to 100 characters, descriptions to
1000, membership to 1-50 application UUIDs and active suites to 100 per owner.
Ownership/tenant checks never depend on projections. The local authenticated
API gateway sends suite routes to Editorial before the account-route matcher.

A suite aggregate and its immutable command receipt commit together. Owner locks
serialize capacity checks and concurrent commands; expected revisions reject stale
edits. Identical-key retries return the original receipt, including after later
deletion. Deletion removes live fields/membership and retains a tombstone, owner
and revision. New application references require canonical public eligibility;
existing unavailable references remain editable/removable. No names or slugs are
copied into membership. The additive `SuiteWorkspace1791676808000` migration checks
schema, physical collation/key order, transactional storage and basic data/receipt
relationships. Rollback requires an explicit data-preserving migration.

These private reads use canonical SQL directly. There is no suite projection or
broker dependency, and saving a private suite cannot publish it. The deliberate
materialization variation and future publication requirements are in
`docs/MATERIALIZATION.md`. Account-wide deletion/export is not implemented by
removing an individual suite.

The portal exposes `/my/suites`, `/suites/create` and `/my/suites/:suiteId` in API
mode. It searches the real catalog, resolves current member metadata separately,
shows unavailable targets truthfully and permits removal during metadata outages.
Session changes clear private forms, cached membership and retry intent. Uncertain
saves retain their key and block different intent until confirmed. Cancellation
also preserves retry intent. Demo routes retain their explicitly local behavior;
`wapps.suite-drafts.v1` is never imported into a real account.

Focused qualification passes 637 Jest tests in 71 suites across the four affected
projects, actual OPA bundle checks, affected source/spec typechecks and lint.
The refreshed isolated dependency/source snapshot clean-builds five affected
projects plus 85 prerequisites with Nx cache disabled; emitted Angular package
inspection passes. Dependency boundaries pass for 134 projects/1145 production
sources. The inventory now records 99 projects without their own behavior specs.
Existing 273 aggregator lint warnings and approximately 1.47 MB initial bundle
remain debt. The complete workspace test/build gate was not rerun for this slice;
the preceding full-gate results are historical, not new evidence.

The focused disposable MySQL/Mongo/OPA runner exercises compiled Editorial and
the compiled portal. It passes create/replay, cross-account/case/tenant denial,
forged/anonymous requests, competing writers, receipt-failure atomic rollback,
target deletion, stale retry after suite deletion, capacity concurrency, migration
reentry, policy outage and application-process restart. Independent browsers pass
create/list/reopen/edit/delete, conflicts, lost-response retry, metadata/account
outages, account-switch draft clearing and keyboard focus. Thirty-six layout
states cover six screens/states at 390/768/1440 pixels in both themes, with column
alignment, header/content gap and overflow measurements plus inspected screenshots.

Failures retained in the numbered logs include a TypeORM default-collation
introspection mismatch (fixed by checking information_schema), HTTP tests initially
lacking loopback permission, strict test-mock typing, and a SQL COUNT string/number
assertion in the browser harness. Corrected checks pass. Shell profile/preferences
and trusted ingress identity mapping are fixtures; catalog projection publication
is controlled and the broker is unavailable. Production credentials/ingress,
database restart, restore, rollback and deployment remain unqualified. See
`privateSuiteWorkflowCheckpoint` in the dated JSON evidence.

## Application favorites portal checkpoint

The aggregator now chooses favorites API/demo providers explicitly. API mode
uses canonical account relations and resolves application metadata through the
Catalog BFF's authority-checked selection contract in batches of at most 50 IDs.
The old browser adapter is `MyFavoritesDemoService`; its data never seeds an
account. Buttons use canonical UUIDs, not slugs. A renamed target retains its
membership and receives its current link/name on reload. Missing targets have
no fabricated metadata or links; metadata failures remain errors while raw saved
items remain removable. Sidebar avatars use returned images or initials.

Mutations bind to the loaded account revision. Unchanged uncertain requests keep
their idempotency key; receipt identity/revision are validated and confirmed
commands trigger a canonical reread. A pending write prevents competing writes,
including during reload. Session changes cancel obsolete reads, metadata and
commands and clear private state/retry keys/feedback. Client cancellation cannot
retract a server commit, so a later session rereads canonical state. Unsupported
content add controls are hidden; existing saved references remain removable.

`/me/favorite` shows all supported saved content; `/my/favourite/apps` selects
applications and `/my/favourites/suites` selects suites. API suite favorites
explicitly remain unavailable. Angular route binding can supply `undefined` for
absent route data; the filter now normalizes that value to the general view.
The browser qualification discovered this issue and a unit regression covers it.
Reusable metadata resolution lives behind feature ports, outside pages. Theme
appearance stays in `theme.scss`; page width/spacing use the shared layout.

The full inventoried gate passes 1,574 Jest tests in 144 suites/32 projects plus
24 portable checks. There are 100 projects without their own behavior specs.
The four affected frontend outputs were preserved outside the build directory
and rebuilt with cache disabled, with 79 prerequisite tasks. Affected source/spec
typechecks, lint, helper lint and package inspection pass. The architecture audit
checks 133 projects/1,134 production sources with zero violations. Existing
lint, Angular template and bundle/style budget warnings remain visible debt.

The combined real-store runner passes its four recovery/catalog suites and both
catalog/favorites browser journeys. Favorites qualification uses compiled portal,
account, Editorial and BFF processes with real MySQL/Mongo/OPA. It proves independent
sessions, account-process restart, lost-response retry without a second revision,
profile revision conflict, target rename/delete/lag, account/metadata outages and
removal without target metadata. Thirty favorites layout states cover saved,
empty, account-error, metadata-error and deleted-target screens at 390/768/1440
pixels in both themes. Measurements verify column alignment, 24px content gaps,
no horizontal overflow and no clipped target text; screenshots wait for finite
theme/entrance animations before capture. Catalog browser regression also passes,
as does the private-profile/preferences journey with 114 combined layout states,
independent accounts, lost-receipt retry and account-process restart. All 56
Angular packages in the aggregator dependency graph pass emitted-artifact checks.

Intermediate failures are preserved: a demo adapter result-type mismatch, an
outdated feed-test provider, the missing route-filter default, and a test run
without required loopback permissions. Corrected checks pass; no checks were
removed. Ingress claims and catalog fixture command policy remain substituted,
catalog projection publication is controlled, and account broker/Firebase are
unavailable. This does not qualify production sessions, database restart, backups,
rollback or deployment. Suites/collections and article/discussion favorites,
full export/deletion and other OP01-OP10 work remain open. See
`applicationFavoritesPortalCheckpoint` in the dated evidence.

## Account favorites backend checkpoint

`GET/PUT /api/me/favorites` now reads and changes canonical account relations under
explicit self-access OPA policy. Relations store target kind, stable UUID and
added time, without copied names or slugs. The account revision and receipt
namespace are shared with profile/preferences commands. The SQL transaction
commits the relation, revision, receipt and outbox together; account deletion
removes relations atomically with the tombstone. Accepted desired-state commands
advance the revision, including no-ops; identical retries return the old receipt.

Application adds use Editorial's qualified canonical selection contract. Adds
for suites/articles/discussions explicitly remain unsupported. Eligibility is a
current observation across services, not a permission grant or a cross-service
transaction. Reads return raw account-owned references; portal display must resolve
current target metadata. Completed receipts are checked before remote lookup,
and removals need no target service. Old add replays cannot undo later removal.
Each account is bounded to 200 relations, enforced under its canonical lock.

Run the additive `AccountFavorites1791676807000` migration before either identity
service. It validates existing schema/data, physical primary-key order, canonical
IDs, lifecycle, timestamps and per-account capacity. Rollback requires a reviewed
data-preserving migration. Account Management now requires `EDITORIAL_URL` as an
HTTP origin; Compose and Kubernetes supply it explicitly. No new projection is
introduced; `identity.updated` invalidations omit private favorite IDs.

The full gate passes 1,544 Jest tests in 143 suites/31 projects plus 24 portable
checks. Affected builds/typechecks and project/tool lint pass. Boundary checks
cover 133 projects and 1,128 production sources with zero violations. Real MySQL
checks cover atomic rollback, concurrent/replayed commands, case isolation,
shared revisions, reconnect, migration validation, lifecycle cleanup and competing
writers for the final capacity slot. The combined real-store runner passes all
four recovery/catalog suites with compiled Account Management/Editorial/BFF and
real OPA. It covers target rename/delete/lag, cross-account denial, policy and
target-service outages, two account process restarts and persistence.

Intermediate test/build failures and the incorrect migration assumption about
TypeORM primary-column enumeration are retained in the evidence. The migration
now validates actual SQL key order; its regression, clean rebuilt chain, full
test gate and both corrected real-store runs pass. A mistyped lint project name
was also corrected and rerun successfully.

The portal remains browser-local in this checkpoint. Ingress claims and catalog
fixture command policy are substituted, and projection publication is controlled;
separate recovery suites exercise broker delivery. Broker/Firebase are deliberately
unavailable to Account Management. This does not qualify production sessions,
database restart, backup restore, rollback or deployment. There are 101 projects
without their own behavior specs; the external credential suite is not rerun here.
OP01-OP10 stay open. See `accountFavoritesBackendCheckpoint` in the dated evidence.

## Canonical catalog selection checkpoint

Editorial and Catalog BFF now expose `GET /api/catalog/app-selection?ids=...`
through the pure catalog port. Requests accept one to 50 lowercase canonical
UUIDs, deduplicate after applying the bound and preserve first-requested order.
The route does not shadow an application slug. Both HTTP boundaries validate the
input; the BFF validates returned identities, order, duplicates and all app fields.

The SQL authority selects current public targets. Private, suspended, deleted
and nonexistent IDs produce indistinguishable omissions. Eligible targets require
an exact-revision projection; lag/corruption/outage fails the whole selection.
A fresh SQL snapshot after projection I/O rejects concurrent changes. Durable
relations can therefore retain target IDs across slug changes without treating
copied projection metadata as authority. This read prerequisite does not persist
favorites or collections, grant mutation permission or establish cross-service
transactional referential integrity.

The full inventoried gate passes 1,466 Jest tests in 138 suites/30 projects and
24 portable checks. The affected domain, Editorial and BFF suites total 359 tests.
All three affected builds and Editorial typecheck pass, initially with 15
prerequisite tasks; affected-only builds were repeated after final ID validation
hardening. BFF/domain spec typechecks also pass. Affected project/tool lint is
clean. The architecture audit remains 133 projects / 1,119 production sources /
zero violations. No frontend behavior or styles changed in this checkpoint.

The real-store runner exercises all four recovery suites using temporary MySQL,
MongoDB, RabbitMQ and MinIO. Catalog checks run compiled Editorial/BFF processes
and prove bounded input, visibility omissions, slug rename/reuse, projection lag,
process restart, projection loss/rebuild and upstream outage. A production
use-case instance with real SQL/Mongo commits a target deletion during projection
I/O and verifies that the response fails instead of exposing the stale item.

One intermediate combined run passed the catalog journey but failed the existing
Editorial outbox assertion that both simultaneous claims always return a row.
The failure log is retained. Qualification now explicitly locks pending rows,
proves concurrent idle polls preserve them, releases locks, verifies progress,
and permits a single post-contention retry before requiring distinct fenced
leases. This retains the delivery/failure/requeue assertions; no production
outbox algorithm changed. The complete corrected real-store runner passes.
Contention throughput/load and deployed workers still require qualification.

The 102 projects without their own behavior specs and seven external suites
outside the portable gate remain explicit. This checkpoint reruns four of those
external suites; it does not rerun credential/identity/OPA qualification or browser
layouts. Fixture command-policy approval and controlled projection publication
remain substituted in the catalog journey; the separate recovery suites exercise
the broker. No database restart/backup restore, production gateway or deployment
claim is made. See `canonicalCatalogSelectionCheckpoint` in the dated evidence.

## Account preferences portal checkpoint

The aggregator explicitly selects API or demo preferences. API mode reads and
writes `GET/PUT /api/me/preferences`; the browser-local implementation is now
`PreferencesDemoService`. Anonymous display choices use a separate
`wapps.guest-display.v1` key. Neither guest nor demo data seeds an account.
Session changes cancel pending reads, saves and exports and clear form state.
A session generation also prevents stale feedback after immediate sign-out/sign-in
with the same token.

The shared application service validates account snapshots and mutation receipts,
binds commands to their loaded revision, retains the idempotency key for an
uncertain identical retry, and reloads canonical data after confirmation. Pages
use a shared editor through the feature API. Conflicts preserve edits and require
explicit discard/reload; a same-account reload cannot silently rebase a dirty
form. Edits made while a save is pending remain in the form. Theme changes follow
the current authoritative stream, so a completed old-account toggle cannot
override a new account's selection.

Display/content, notification and privacy forms now expose account loading,
failure, sign-in, save and conflict states. API export downloads saved account
preferences only, excluding profile data, credentials and unsaved edits. A mixed
demo-profile/API-preferences configuration cannot include demo profile data.
The UI states that full export, notification delivery, public profiles/followers,
data-collection controls and mature-content filtering remain unavailable.

The full gate passes 1,426 Jest tests in 138 suites/30 projects and 24 portable
checks. There are 102 projects without their own behavior specs and seven external
suites outside the portable gate. Three affected library projects pass build and
typecheck targets with 79 prerequisite tasks, followed by affected-only checks
after the asynchronous-save fixes. All 56 aggregator Angular packages pass
artifact inspection. API and explicit demo production builds pass separately.
The 133-project/1,119-source architecture audit has zero violations. Changed-file
lint has zero findings; broader aggregator/theming lint retains 274 existing
warnings. API initial bundle size is 1.44 MB against the existing 1 MB warning
budget; existing component/style/template warnings remain visible.

The disposable MySQL/real OPA/compiled API/Chromium qualification passes 114 layout
states: 42 profile regressions plus 72 settings account/conflict/unavailable/guest
states, at 390/768/1440 pixels in both themes. All three settings screens were
visually inspected at all widths/themes. Tests prove independent sessions,
shared profile revision conflicts, draft retention, keyboard retry after a real
commit with a deliberately lost response, account/guest separation and canonical
export. The portal restores saved settings after an account-process restart;
backend checks also exercise two process restarts and fail-closed policy outage.

The first rendered test run had four incorrect control labels; these were fixed
without changing the UI. The first browser run captured all layouts, then failed
in its interaction checks; review found the harness incorrectly expected the
disabled push control to enable delivery. The corrected complete run passes.
Both failures remain in the raw evidence. Local ingress credentials and unrelated
APIs remain substituted, external browser requests are blocked, and the broker
and Firebase are deliberately unavailable. This is not deployed authentication,
email/push delivery, database restart/restore, rollback or release qualification.
See `accountPreferencesPortalCheckpoint` in the dated implementation evidence.

## Account preferences backend checkpoint

`GET/PUT /api/me/preferences` now reads and replaces validated canonical account
preferences through explicit self-access policy. The domain contract rejects
unknown fields, invalid enums, unbounded/duplicate filter identifiers and
contradictory category filters. Normalized field/filter order makes retry
fingerprints deterministic. Unconfigured accounts return isolated defaults with
`updatedAt: null`, without creating storage records. Account defaults are private,
with email delivery, analytics and personalization opt-ins disabled; browser demo
defaults are separate and are never imported.

Profile, preferences and lifecycle use one account revision. The write locks the
canonical identity, rechecks lifecycle, and atomically commits preferences,
revision, command receipt and a private-data-free `identity.updated` outbox event.
Profile changes invalidate stale preference commands and vice versa. Preferences
have their own fingerprint discriminator, so profile/enrollment receipts cannot
be mistaken for preferences commands. Deletion removes preferences in the same
transaction as the account tombstone and profile removal. Retained tombstones and
receipts cannot be used to resurrect deleted data.

The additive `AccountPreferences1791676806000` migration creates
`identity_preferences`, verifies transactional/case-sensitive storage and physical
schema, and validates existing values and canonical ownership in bounded batches.
It resumes after DDL and refuses destructive down migration. Both identity services
and the explicit maintenance command include the migration; normal startup still
refuses pending migrations.

The complete gate passes 1,389 Jest tests in 136 suites/29 projects and 24 portable
checks. There are 103 projects without their own behavior specs and seven external
suites outside that gate. Five affected builds/typechecks and 12 prerequisites
pass after moving their previous outputs aside and disabling Nx cache. Five
affected lint targets and helper lint pass without errors or warnings. The
133-project/1,116-source architecture audit has zero violations; 46 real OPA cases
pass. An initial QueryRunner typing error was repaired before the successful
build/typecheck run.

Disposable MySQL qualification covers failed outbox rollback, simultaneous
duplicate and competing commands, profile/preferences conflicts, independent
connections, reconnect, stored-data validation, suspension and deletion rollback.
The compiled API plus real OPA verifies malformed/anonymous/cross-account requests,
durable retries, two account-process restarts and fail-closed policy outage. The
existing 42-case profile browser journey also passes as a regression. Ingress
credentials remain locally substituted, the broker is deliberately unavailable,
and no deployed Firebase, restore or rollback claim is made.

At this backend checkpoint the portal still used browser-wide preferences storage.
The subsequent portal checkpoint above qualifies its API adapter, separate guest/demo
state, account-switch cancellation, conflict-preserving forms, truthful export
scope, and browser-to-preferences acceptance checks. Stored notification
choices do not implement delivery, and stored privacy choices do not implement
public profiles or followers. OP05 and OP08 remain open.

## Private profile checkpoint

Account Management now exposes `GET/PUT /api/me/profile` over canonical SQL.
The application boundary evaluates explicit self-profile policy before domain
validation or storage; current lifecycle is checked again under the mutation lock.
Updates require an expected identity revision and idempotency key. Profile text,
social links, identity revision, receipt and the `identity.updated` outbox event
commit together. The operation fingerprint is distinct from enrollment and
registration. Retries return the original receipt without replacing later edits.
Registration completion is now initial-only; existing registration receipt hashes
remain compatible. Text commands preserve the existing avatar and registration date.

The additive `PrivateProfile1791676805000` migration adds nullable social-link
JSON, validates existing values and supports restarting after DDL. An existing
canonical-migration preflight incorrectly depended on metadata column order;
the check now requires the exact composite key members irrespective of their
metadata order. No historical migration DDL changed. A regression covers reordered
metadata and a missing primary-key member. Run explicit identity migrations before
starting either identity service; startup still refuses pending migrations.

The portal explicitly selects API or demo profile providers. API mode never reads
the demo profile key, invents statistics or selects fixtures after a failed read.
Loading, unavailable, signed-out and unregistered profiles are distinct states.
Conflicts preserve form edits and offer explicit discard/reload. Retry of unchanged
intent retains its command key. Session changes clear profile and retry caches,
cancel old reads/saves and reject forms belonging to another account. Refresh and
sign-out responses cannot replace or clear a subsequently signed-in session.
Sign-out clears local private state immediately. Missing profile avatars render
the existing user icon instead of an empty image request.
The local-settings export excludes the remote account profile in API mode and
states that account export is unavailable; it exports browser preferences only.

Qualification uses the built portal/account API, real OPA and disposable MySQL.
It exercises SQL rollback on outbox failure, concurrent writers, duplicate commands,
independent SQL/browser sessions, initial profiles, lifecycle restrictions, real
HTTP denial/conflict/failure, account switching and account-process restart.
The broker is deliberately unavailable; committed invalidations remain in SQL.
The browser uses a local ingress credential mapping and blocks external requests.
It does not qualify real Firebase sign-in, deployed ingress, avatar ingestion,
public profile visibility/privacy, database restart, backups or rollback. Detailed
commands, source fingerprint and final check results are recorded under
`privateProfileCheckpoint` in the dated implementation evidence.

The refreshed clean-install snapshot passes 1,327 Jest tests in 132 suites across
28 projects, plus 24 portable checks. There are 104 projects without their own
behavior specs and seven external suites outside the portable gate. Four affected
builds and 87 prerequisites pass with caching disabled; the demo CSR build passes
separately. Seven typecheck targets and 35 prerequisites pass. All 56 inspected
Angular packages are valid. Nine affected lint targets pass with zero errors and
274 warnings (273 in the aggregator, one in the UI profile test configuration).
Readiness-helper lint passes. The 133-project/1,110-source boundary audit reports
zero violations; 40 actual OPA cases pass. These checks do not replace the remaining
feature, deployed authorization, restore and release qualifications.

The real-service browser check covers seven screens/states in both themes at
390, 768 and 1440 pixels: 42 combinations. It checks no horizontal overflow,
header/content alignment, absent synthetic profile metrics and avatar fallbacks.
Independent sessions observe a saved profile; conflicts retain edits, session
switches clear private state, and outage recovery reloads canonical state.
Keyboard navigation reaches Save and Enter commits the change.
The downloadable local export is checked for its advertised scope and absence
of account profile data and credentials.

OP05 remains open. Avatar upload needs durable media ownership/lifecycle and an
authorized reference command; API mode explicitly says photo editing is unavailable.
Public profile projections, privacy/export/deletion scope, preferences, favorites
and suites still require implementation. The explicit demo avatar remains local.

## Home search preview checkpoint

Home search now uses a shared preview service through `CatalogBrowserService`.
It requests at most three entries per supported kind and preserves service totals,
UUIDs, revisions and unknown ratings. API mode advertises/searches applications;
explicit demo mode searches its configured application/article/suite entries.
Canonical plural and legacy singular group links both work in demo Discover.
The home provider composes navigation only. Generic result presentation no longer
depends on the legacy discovery DTO, whose required metrics encouraged invented
values; the preview keeps unknown fields absent.

Preview state distinguishes idle, loading, ready and failure. Query changes cancel
older requests, multiple consumers share one request, and retry repeats the current
query. Thrown/provider failures never become "No results". Home presentation uses
external HTML/SCSS, existing appearance tokens and shared spacing primitives.
Bundled home activity is now selected only in demo mode. API mode exposes its
unavailable feed explicitly; this is not implementation of the activity service.
Recent-search history remains browser-local, without a cross-device guarantee.

Screenshot review found the feed rendered its generic empty message alongside
loading/failure states. The container now renders item content only when items
exist; a behavior test covers loading, failure, retry and successful empty. Added
declared spec typechecks for search, multi-search and feed. Feed's stricter indexed
property rule exposed dynamic field access in the catalog parsers; those accesses
now use brackets, with no relaxed compiler options or changed validation rules.

The browser qualification is extended to home previews, navigation and failure
states in both themes at 390/768/1440 pixels, followed by real materialization lag,
projection loss/rebuild, authoritative deletion and upstream outage. Its limits
remain those of the catalog portal checkpoint: local gateway and controlled
projection publication, substituted fixture authorization, no account journey or
deployed ingress. Final validation and source evidence are recorded separately
from the earlier catalog checkpoints in the dated implementation JSON.

Final evidence: 1,235 Jest tests in 126 suites/26 projects and all 24 portable
checks pass. Five affected build targets and 85 prerequisites pass without Nx
cache; all 56 inspected Angular packages are valid. Five affected typecheck targets,
six lint targets (zero errors, 281 existing warnings), tools lint and the 133-project/
1,102-source boundary audit pass. All four isolated real-store suites pass, including
42 browser screen/state/theme/width combinations. Explicit demo build passes.
The 2,684-file fingerprint matches the qualified source copy. Historical whole-
workspace build/lint evidence is unchanged; no OP01-OP10 blocker is closed here.

OP04 and all other release blockers remain open. The separate Catalog portal,
legacy taxonomy adapters, directory counts/previews, API articles/suites, actual
activity, durable personal data, community/publication and operations still need
implementation and qualification.

## Catalog portal checkpoint

Aggregator catalog mode defaults to API regardless of environment name. Explicit
`production,demo`/`development,demo` build configurations replace only the catalog
mode; the alpha Dockerfile selects demo. Listing and overview services depend on
feature ports. Their HTTP adapters parse the canonical contract before mapping
UUIDs, revisions, taxonomy, timestamps, URLs and nullable metrics for presentation.
Unused numeric-ID listing/overview adapters and the fake preview API were removed.

The real `/app` route redirects to Discover. Its API composition now uses the
catalog listing feature, including bounded search, filters, sorting and pagination.
The existing grouped search view is isolated in an explicitly selected demo
component. Singular legacy content types map to catalog types; unsupported social
and estimated-user filters fail before HTTP and can be cleared. Categories and
tags load service taxonomy with loading/error/retry states. Overview uses resolved
service labels, real website links and distinct 404/503 states. Tag chips now
render their supplied routes. Unknown ratings, review totals, community previews,
directory counts and featured apps are never synthesized as zero or empty success.
The overview favorite action is disabled in API mode pending durable favorites.

The real-store qualification runner now optionally serves the compiled portal
through a loopback catalog gateway to the compiled BFF and Editorial. It follows
the production redirects and links, verifies pagination and direct reloads, then
checks the browser during stale projections, service restarts, projection loss/
rebuild, authoritative deletion and upstream outage. Catalog responses are not
mocked. Fixture command authorization is still substituted, projection publication
is controlled, and account endpoints are outside this journey. The separate
existing suites retain broker/recovery coverage. This is not deployed ingress,
public editorial publication, backup restoration or full identity qualification.

Visual inspection exposed wrapped breadcrumbs overlapping the mobile title and
negative hero spacing clipping records without a cover. The page now preserves
breadcrumb height and applies cover overlap only when a cover is present. It uses
the shared 24px header/content gap and generic missing-logo icons. Browser checks
measure title/breadcrumb separation and unclipped overview information as well as
the content column and overflow. Theme definitions remain in the portal theme.

The aggregator test config now uses Jest types, with modern browser library types;
its declared typecheck checks production and specs. Corrected seven fixture typing
issues revealed by that check. Listing and overview also have declared spec
typecheck targets. The first listing behavior suite removes that project from the
explicit coverage-gap inventory. Validation results and exact source evidence are
recorded in `docs/readiness/implementation-2026-10-11.json`.

OP04 remains open. Home search previews/feed, the separate Catalog portal, legacy
taxonomy providers, real directory counts/previews, other searchable content types
and the deployed routing contract remain unfinished. Reviews, discussions, suite
membership, durable favorites and other OP01-OP10 requirements remain open; their
truthful unavailable states here do not reduce the full release scope. No production
migration, deployment or production data mutation occurred.

## Catalog read backend checkpoint

The BFF now consumes a bounded canonical `CatalogReadPort`, with UUIDs, real
reference labels, validated transport values and unknown review aggregates as
null. It no longer downloads all Editorial apps, hashes IDs or invents reviews.
SQL performs public-tenant/lifecycle/suspension filtering, search, facet matching,
stable pagination and taxonomy selection. Application content comes from Mongo
at exactly the authorized revision. A fresh SQL snapshot after projection I/O
rejects concurrent changes. Missing/corrupt/stale projections are retryable 503s;
current authoritative absence is a 404. See the deliberate synchronous taxonomy
variation in [materialization](MATERIALIZATION.md).

New Editorial writes serialize DATETIME values as explicit UTC text. Public
timestamps are UTC ISO strings, with millisecond display precision. Existing
legacy dates still require source-timezone verification before cutover; ownership
backfill does not prove their timezone. Mongo connections are lazy, shared,
bounded, recoverable after failure and closed at shutdown. Compose and the API
deployment manifest carry Mongo settings; the Editorial workflow validates and
provisions Mongo, ingress and queue settings as well as SQL credentials.

The refreshed source snapshot reuses dependencies installed by the earlier clean
`npm ci`. All 1,187 Jest tests in 119 suites/25 projects and all 24 portable tests
pass. The three affected projects and their prerequisites build; Editorial's
source/test typecheck and the catalog/BFF spec typechecks pass. Affected lint has
zero errors and six pre-existing BFF warnings. Boundary checks pass for 133
projects and 1,103 audited production files. There are now 107 projects without
their own behavior specs and seven explicitly separate external suites.

The real-store catalog suite runs compiled Editorial/BFF HTTP processes. It
checks canonical IDs, category descendants, conjunctive tag filters, platform/
device/monetization filtering, literal and case-insensitive search, pagination,
public visibility, unknown reviews, projection lag, live taxonomy edits, stale
revisions and immediate deletion hiding. It restarts both services with retained
stores, deletes/rebuilds Mongo projections and checks backend-outage responses.
The isolated runner also reruns the three prior materialization/recovery suites.
UTC behavior passes with the test processes set to `Pacific/Honolulu` and a
daylight-saving transition timestamp. Fixture command policy is substituted;
suspension is seeded directly, and the catalog test controls projection
publication using production snapshot/projector/store functions. Broker delivery
is exercised separately by the existing recovery suites.

Qualification exposed and repaired test-environment failures: Mongo's journal
could exhaust its 256 MiB temporary disk, a readiness ping could wait without a
socket deadline, and preselecting unused HTTP ports raced with actual service
binding. The runner now uses a 512 MiB Mongo tmpfs and bounded probes; services
bind OS-assigned loopback ports and report their actual listening addresses.
Failed attempts are retained in logs and are not counted as passing evidence.

OP04 remains open. The portal still needs its results, taxonomy, search and detail
adapters moved to this new contract, explicit API/demo selection, truthful unknown
and unavailable states, and real browser checks in both themes at all three
required widths. The backend response replaces the old numeric-ID/data-meta
shape; old portal adapters must not be deployed with this BFF. Home/feed, reviews,
publication, favorites, suites and other OP01-OP10 requirements remain open.
No deployment, production migration or production data mutation occurred.

## Clean installation and engineering gates

A disposable copy of the working source, with no existing `node_modules`, build
outputs or Nx cache, installed with `npm ci` including dependency install scripts.
The environment was macOS, Node 22.17.1 and npm 10.9.2. This is reproducibility
evidence for an uncommitted source snapshot, not a committed checkout, Linux
container qualification, deployed service or GitHub Actions run.

| Check | Result |
| --- | --- |
| Declared builds | All 129 pass with Nx cache disabled |
| Angular output inspection | All 63 packages; 101 ESM files, 423 declarations, 302 partial Angular declarations |
| Project tests | 1,120 tests in all 114 inventoried suites, across 23 projects |
| Portable tools | 24 tests, including workflow failure gates |
| Lint | 131 product projects plus readiness tools pass; 445 warnings remain |
| Declared typechecks | All 13 projects pass; aggregator rechecked after correcting production input scope |
| Architecture | 133 project responsibility tags/graphs pass; 1,101 production sources, zero source-audit violations |

Removed 95 empty test targets without removing real spec files. The inventory
keeps 109 projects without their own behavior specs explicit. It fails on
unowned/undiscovered tests, missing targets, empty results and skipped/todo tests.
Six external qualification suites remain separate and are not counted as passes.
The product lint gate excludes the separately managed recordings tool. Added
transaction rollback, connection lifecycle and acknowledgement tests to three
previously constructor-only adapter suites.

The actual ESLint rule now enforces `arch:*` responsibility tags and rejects
framework/storage/broker imports in kernel/domain code. Removed the ineffective
matrix from `nx.json`. This caught an AMQP helper in the event kernel; it now
belongs to the RabbitMQ adapter. Corrected service/adapter dependency manifests,
a mixed eager/lazy identity import in Discussion and a lexical-`this` lint error.

Clean installation exposed Editorial resolving a nested UUID v8 locally instead
of the lockfile's UUID v13. Its Jest transform now handles the locked ESM package;
all 252 Editorial tests pass in the clean snapshot. Aggregator production compiler
inputs no longer include Node-only test setup; those files remain available to Jest.
The original workspace's nested dependencies were not modified.

All 15 image-build workflows now depend on the reusable quality job. The global
PR gate is unfiltered, aggregator publishing is excluded from PRs, and ArgoCD
sync/health failures propagate. Node setup uses `.nvmrc`. Local tests cover these
gates; remote branch protection and actual CI execution remain unverified.

`npm audit` reports 284 dependency findings: 14 low, 102 moderate, 146 high and
22 critical. This includes development/transitive packages and requires exposure
triage and compatible upgrades; no automatic force-upgrade was applied. Engine/peer
warnings, bundle/style warnings, incomplete feature tests, mutable deployment tags,
runtime image/CLI pinning, browser-to-service journeys, process recovery, backup
restore and rollback still prevent OP03/OP10 or full operational completion.
Exact commands, report hashes and source fingerprint are in the JSON evidence.

## Implemented slices

Implemented on this branch:

- Moved record creation orchestration out of its domain library. Replaced the old
  discussion creation sequence with application use cases using ports. Explicit
  policy denials and policy outages stop writes. Editorial now uses the protected
  command path below; the unused non-atomic record creation path was removed.
- Replaced all nine Editorial app/category/tag mutation handlers with application
  commands. Trusted ingress authentication, tenant/ownership checks, OPA policy,
  strict input parsing, idempotency and optimistic revisions precede writes.
  Current ownership is rechecked under SQL locks, including receipt replay.
  Direct publication requires publisher/moderator or taxonomy roles; this does
  not implement ordinary submissions or the review workflow.
- Editorial values/relations, ownership/revision/tombstone state, command receipts
  and outbox intent now commit together. Reads filter current tenant/lifecycle,
  including nested relations. Unbackfilled legacy rows are readable only in the
  public tenant and cannot be claimed by an administrator through ordinary CRUD.
- Disabled Editorial schema synchronization and implicit production seeding.
  A numbered migration creates the schema and refuses incompatible pre-existing
  columns, keys, relations, defaults, identity collations or non-InnoDB tables
  before DDL. Existing ownership is never inferred. Real MySQL qualification now
  passes, including maintenance connections without ORM entities and binary-default
  database collations; physical column metadata drives schema validation.
- Added Editorial confirmed outbox dispatch, 30-second fenced leases, retry
  backoff and retained SQL quarantine after 12 failed attempts. Corrupt requests
  are quarantined immediately. The production coordinator reconnects and avoids
  overlapping drains. Broker connection attempts now have a bounded timeout.
  `--outbox-status` and single-ID `--outbox-requeue` expose recovery; `--migrate`
  runs the numbered migration without starting the API, seeds or dispatcher.
  Delivery to the queue does not mean a completed projection.
- Added the Editorial materializer with consistent SQL snapshots and complete,
  fingerprinted Mongo documents. Conditional publication prevents revision
  regression and tombstone resurrection; related labels have independent
  revisions. Both consumer queues retain work durably; bounded retries and
  confirmed failed-queue transfer precede acknowledgement. Compose includes a
  separate worker process with shutdown and connection-loss handling.
- Added SQL-only Editorial rebuild and SQL/Mongo reconciliation in bounded pages.
  Recovery includes tombstones and works without old projections or broker
  history. It checks current source state before requeue, detects content
  corruption, and reports conflicts without implicit destructive repair. Public
  reads still use authoritative SQL; projected catalog integration remains open.
- Added verified Editorial legacy ownership planning/apply and a separate numbered
  receipt migration. A reviewed fingerprint binds source data and the supplied
  owner. The SQL transaction rechecks under a base-row lock and commits ownership,
  revision, receipt and outbox together. Replay preserves subsequent edits/deletes.
  Backfill preserves the configured public tenant and requires stopped legacy
  writers; it never infers owners or silently relocates tenant data. Exact SQL
  timestamp values and existing suspension flags are preserved.
- Added the Editorial OPA bundle and local bundle merge. Generated policies now
  reject malformed identity/role/resource types and empty or mismatched required
  tenants. Removed example identity privileges from runtime data. Actual OPA
  tests cover each bundle and the merged deployment policies.
- Discussion mutations require trusted authenticated identity, current owner/tenant
  access and policy approval. Added reply creation. Caller-controlled ownership
  fields are rejected. Edits/deletes require a current `expectedRevision`; every
  mutation requires an `Idempotency-Key`. HTTP returns 401/403/409/503 appropriately.
- Added migration-backed discussion ownership, immutable payload references,
  aggregate revisions, command receipts and outbox tables. Disabled discussion
  schema synchronization. A mutation, its receipt and its materialization intent
  commit in one SQL transaction. Uploaded-but-uncommitted objects remain invisible.
- Preserved UUIDv7 content identifiers through the existing generator port.
  Idempotency keys and actor identities use case-sensitive database comparisons.
- Added broker-confirmed, mandatory publication with timeout/return/disconnect
  handling. Outbox leases and retry backoff retain work across failures. The
  dispatcher reconnects after channel loss; it marks delivery after confirmation.
- Replaced incremental materialization with consistent SQL snapshots, checked
  immutable payloads, bounded graph traversal and immutable Mongo generations.
  A conditional head update publishes complete generations monotonically. Counts
  derive from current facts. Edits, likes and tombstones share aggregate revisions.
- Reads pin a generation and recheck current authoritative access after projection
  I/O. Private/deleted bodies are withheld; a stale or incomplete generation is
  reported as pending. Lists omit items whose current state no longer permits them.
- The version-2 consumer uses bounded retries, confirmed failed-queue transfer,
  explicit shutdown and failure exit status. A failed transfer stays unacknowledged.
  The new quorum queue is separate from the legacy queue during migration.
- Added `--rebuild` to the materializer entry point. It enumerates authoritative
  aggregates, including tombstones, and requeues their current revisions through
  the retained outbox. Old projections and broker history are not rebuild inputs.
- Added a legacy backfill use case behind ports, SQL/object adapters, a separate
  numbered receipt migration and maintenance CLI. Planning is read-only; apply
  requires a reviewed fingerprint and an acknowledged maintenance window. Verified
  ownership must cover every node. Immutable copies, structural revalidation,
  atomic revision/outbox/receipt commit and concurrent replay preserve write truth.
  The tool detects drift but cannot prove that legacy writers are stopped.
- Added read-only reconciliation and explicit outbox requeue modes. They compare
  authoritative revisions with complete generation envelopes/ancestry in bounded
  pages, include tombstones, and report concurrent changes, conflicts and failures.
  This checks structural completeness, not every projected payload's checksum.
- Optional authentication now forwards verified tenant/role claims consistently.
  Removed unused allow-all and unsafe mutable-payload/incremental-projection code.
- Added explicit Nx typecheck targets so transpiled test runs cannot hide TypeScript errors in test code.
- Repaired the Editorial composite project references and added real tests to its
  previously empty target, the materializer target, queue adapter and MinIO adapter.
- Removed all 11 domain-layer findings from the architecture audit: Angular tokens
  now belong to the profile/preferences features, domain ports remain pure, and
  unused domain adapter/storage wiring was removed. Repaired the profile and
  preferences domain project references; all three changed domain builds pass.
- Fixed the guest-profile provider returning an Observable instead of the promised
  profile object, and corrected the avatar base URL binding. Moved the existing
  theme/preferences integration suite into the composing portal, removing a
  reverse test dependency that caused the preferences/theming lint cycle.
- Resolved the remaining 15 source boundary findings. Breadcrumbs now own a
  generic UI contract; the listing mapper belongs to its feature; unused search
  and category fixture paths were removed. Privacy settings use feature ports.
  Authentication consumers use a session port selected at composition time.
- Added an application port/facade for local discussion drafts. Browser storage
  and sample threads require explicit demo providers. Real API composition
  installs the disabled implementation even if demo providers were registered
  earlier. This does not implement the pending durable portal discussion API.
- Repaired profile/preferences/theming standalone Angular packages and their
  dependency identities. Shared data now builds inside its own compiler root.
  Added a discussion DTO entrypoint for consumers that need only read contracts.
  Changed domain/profile/preferences imports use the canonical SDK standard
  entrypoint; legacy aliases remain available to unchanged consumers.
- Repaired 24 domain output declarations, nine stale standard references and the
  feed-to-attribution project reference. Isolated incremental metadata inside
  each of those 24 domain outputs and the content kernel output. Added explicit
  prerequisite builds to the Nx TypeScript executor defaults. Documented these
  conventions in the separate library-build rule.
- Removed the affected frontend lint errors, including cross-project test imports
  that bypassed public exports. Existing warnings remain visible.

### Canonical identity checkpoint

Both identity services now use a shared SQL adapter with the Firebase UID as the
canonical actor ID and a separate subject UUID. Management no longer creates an
independent identity graph. `/me` reads a consistent SQL profile snapshot without
provisioning side effects. Profile registration validates expected revision and
idempotency, locks current identity state, and commits values, revision, receipt
and outbox intent together. Credential enrollment is now implemented as described
in the next checkpoint; Firebase and SQL remain separate transactional boundaries.

Creation, authentication, registration, suspension and deletion now retain events
in SQL. Confirmed delivery uses 30-second fenced leases, bounded retries and
retained quarantine. Malformed work cannot block later journal entries. Deletion
commits a tombstone, SQL profile removal, cleanup job and event together; HTTP 202
reports the actual retained cleanup state. Provider cleanup treats already absent
credentials as success and survives a crash before marking. Admin suspension
changes SQL application lifecycle; it does not pretend to update Firebase's
credential-disabled flag. Current SQL identity also gates every account request.

Admin policy denial/outage stops commands. Reset/verification links are bound to
the authorized target's provider email. Malformed and spoofed ingress claims are
rejected, and verified Firebase roles/tenant claims come from supported top-level
fields. Password recovery now requests provider email delivery without exposing
reset links or reporting success during an outage. Local and Kubernetes recovery
routing is separate and rate-limited. Reset consumption and portal identity
adapters are implemented; production delivery and full account/profile integration
remain unqualified.

Migrations run explicitly under an advisory lock, never implicitly at API startup.
The canonical preflight refuses incompatible schema/data and nonempty legacy
subject mappings. Existing identity/Mongo account data has not been imported or
remapped. Migration, event/cleanup status and single-item requeue commands are
available from either built service. Compose orders the migration before API
startup; Kubernetes migration orchestration and runtime provisioning remain open.
The dependency-aware builds passed after clearing the three repaired/generated
identity library outputs, with Nx cache disabled. No production migration or
provider message was executed.

The credential checkpoint passes 300 backend tests in 24 suites across six
projects. These include the production Nest account/authenticator modules with
substituted ports, strict DTO/ingress checks, command denial, optimistic revisions,
replay, tombstones, retained retry/lease protocols, migration preflight and bounded
provider adapters. Isolated MySQL and Firebase Auth emulator qualification now
pass separately; neither is an integrated service or production release test.
OP02 and the full OP01-OP10 goal remain open.

### Credential and portal checkpoint

- Added validated credential signup, canonical initial profile enrollment and
  durable authentication intent before session return. Interrupted provider/SQL
  enrollment can recover with verified credentials and an idempotency key. Existing
  lifecycle restrictions and later profile edits survive replay.
- Added bounded reset-code verification/consumption and real registration,
  recovery, reset and `/api/me` portal adapters. API/demo mode is explicit; missing
  configuration cannot select a demo. Signup asks the user to sign in afterward.
- Moved OAuth callback completion behind an application port with stored-state,
  provider, exact redirect, age, same-origin return path and Google PKCE checks.
  The callback and reset action route remove query secrets from browser history.
- Added reset forms in the established shell/header/content layout. Registration,
  login, recovery and reset display persistent truthful errors and busy states.
  An actual browser caught missed asynchronous updates beneath the OnPush shell;
  a nested-OnPush asynchronous regression test now protects the fix.
- Repaired standalone Angular packaging for identity and three account UI packages,
  plus canonical manifests for authentication, identity core/ontology and events.
  Eight generated outputs were moved aside before the uncached dependency build.
- Fixed production stylesheet loading when external fonts fail: the font sheet is
  independent of application CSS, and production font inlining is disabled to
  avoid a network dependency during compilation. Theme tokens remain in `theme.scss`.
- The production bundle passes reset, enrollment retry/key reuse, recovery retry,
  expired links, keyboard submission and form layout checks at 390, 768, 820 and
  1440 pixels in both themes. HTTP endpoints are local fixtures, external requests
  are blocked, and no passwords enter browser storage. This is browser/contract
  evidence, not proof of a live account-service journey.
- Firebase Auth emulator `demo-wapps` passes actual signup, interrupted-signup
  recovery, wrong-password rejection, action-code verification/consumption, used
  code rejection and old/new credential behavior. No external email is sent.
- Isolated MySQL 8.4 passes migration re-entry, canonical concurrency, initial
  enrollment, rollback after outbox failure, replay preserving later edits,
  restrictions/tombstones and fenced retries. Its publisher/removal ports remain
  substitutes; database process restart and provider cleanup are not covered.

### Materialization real-store checkpoint

`node tools/readiness/qualify-materialization.cjs` now passes all three recovery
suites against temporary MySQL 8.4, MongoDB 7, RabbitMQ 4 and pinned MinIO containers.
The runner uses random loopback ports, generated credentials, tmpfs storage, existing
local images with no pulls, and cleanup restricted to its own containers. It records
image IDs. No existing Wapps database, volume or deployment is modified.

The tests demonstrate SQL migration/re-entry, concurrent command replay, optimistic
conflicts, trigger-injected transactional rollback, immutable objects, duplicate and
reordered projection writes, tombstone preservation, verified ownership backfill,
source drift, confirmed outbox dispatch, failed-transfer redelivery and quarantine,
projection-loss rebuild and reconciliation. Editorial's production consumer function
reads real broker deliveries; the standalone worker entrypoint and ingress are not
running. Policy evaluation is substituted in these store tests; real OPA behavior
has separate evidence. SQL connection reopen is not a database process restart.

Live testing exposed and fixed two defects that mock-only tests missed. RabbitMQ
shutdown closed the connection while its channel-close handshake was pending,
leaving cleanup unresolved; shutdown now sequences the handshakes. Editorial's
schema preflight interpreted ORM-suppressed default lengths/collations as mismatches
when running without entity metadata; it now checks physical column metadata. Added
regressions pass, and the live suites pass after those repairs. One intermediate
container setup failed; the runner now bounds MongoDB cache, detects exited
containers and reports startup failure explicitly.

### Aggregator dependency packaging checkpoint

The aggregator application and all 82 prerequisites now pass an uncached build.
Repaired 49 Angular package definitions, two TypeScript boundary identities and
the favorites domain identity. Angular packages have explicit entrypoints, Sass
paths, canonical private manifests and partial compilation; domains keep their
TypeScript boundaries. The application now emits a real Angular package and has
a separate source typecheck. No compiler root or strictness was relaxed.

Missing boundary package identities caused the application compiler to consume
external sources and crash while reporting diagnostics. The navigation boundary
also contained a pipe built with plain TypeScript. Correct package identities and
Angular compilation resolve both problems. Removed one unused metrics component
that imported an absent model; the active feed health component remains.

All 52 repaired output directories were moved aside before the clean build.
Artifact inspection then found `ui-chat` emitting CommonJS inside an `.mjs` file
despite a successful build. Its Angular config now explicitly emits ES2022 modules;
that output was cleared again before a further uncached dependency build. The new
artifact checker follows ESM chunks and declaration exports across all 56 Angular
packages in the dependency graph, rejecting CommonJS, missing files, escaped
relative paths and missing partial compilation. All packages and six checker
regressions pass.

The 52 affected lint targets pass with zero errors and 370 warnings (248 in the
aggregator). Fixed actual findings without disabling rules, including component
selectors/output bindings and listener callback types. Chat input bindings now
have submission/content/focus tests. Existing test targets with tests reject an
empty run. Shared feature tests stay within their package; the aggregator retains
the portal composition suites previously also selected by the overview feature.
Repaired Angular Jest transforms and setup, and updated the feed attribution test
to exercise its actual popup with explicit theme/root providers.

Nine test targets pass 389 tests in 56 suites, including all 298 aggregator and
38 identity tests. Production CSR compilation, source typecheck and the eight
theme/viewport fixture browser cases pass separately. Existing template/bundle
warnings remain. This checkpoint supersedes the earlier 27-package aggregator
build failure; it does not establish a clean install, a passing whole workspace,
complete CI enforcement or an integrated live product journey.

### Workspace build checkpoint

An uncached run of all 129 declared build targets initially found four remaining
failures. Items listing lacked its package definition; discovery results imported
the legacy SDK alias across its compiler root; notifications exported an absent
presentation module; governance exported a comment-only events file.

All 129 targets now pass. Seven additional Angular libraries have canonical
package identities and real partial compilation, including environment services
and the previously incomplete UI packages. Their seven outputs and the two
scaffold outputs were moved aside before the full run. Governance now refuses
emission on errors. Notification/governance placeholder exports were removed;
no notification delivery or governance event behavior is implemented by this repair.

The workspace artifact checker passes all 63 Angular packages: 101 reachable ESM
files, 423 declaration files and 302 partial Angular declarations. The nine
additional lint targets pass with 11 warnings. These libraries have no existing
behavior tests, so empty runs are not counted. The nine previously verified portal
test targets remain separate evidence. Two final inferred-type lint corrections
were followed by affected builds/lint and another complete artifact check.

This is a full build run with the installed dependencies and repaired outputs
cleared, not a clean-checkout installation or a passing workspace test/lint matrix.
OP03 remains open for those checks, layer enforcement and CI/release reliability.

### Verification and limits

Current focused evidence (October 11, 2026; uncommitted implementation on
`c965790e`):

| Check                          | Evidence                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discussion management          | 95 tests pass, including 6 HTTP checks through the real Nest pipeline with in-memory dependencies and 38 new backfill/maintenance checks.                                                                                                                                                                                                   |
| Discussion materializer        | 43 tests pass for duplicate/reordered work, partial writes, deletion, rebuild equivalence, payload integrity, acknowledgement failures and reconciliation.                                                                                                                                                                                  |
| RabbitMQ adapter | 15 tests pass, including channel-before-connection shutdown ordering on success/failure; actual broker delivery/shutdown also passes in the isolated suites. |
| MinIO adapter                  | 7 immutable-write and bounded-read/error tests pass with a mocked S3 transport.                                                                                                                                                                                                                                                             |
| Editorial | 252 tests / 17 suites pass, including production Nest HTTP with substituted ports and physical-schema validation; four earlier standalone authorization regressions remain recorded. |
| OPA policies                   | 31 Rego cases pass separately and in the deployment's merged policy set using checksum-verified OPA 1.4.2; strict OPA compilation passes. These are actual policy evaluations, not a mocked policy client.                                                                                                                                  |
| Authenticator | 42 tests / 6 suites pass, including real Nest enrollment HTTP with substituted ports, strict DTOs, required configuration and truthful error responses. |
| Canonical identity/account | 112 SQL/protocol tests, 51 account tests, 53 Firebase adapter tests, 14 management application tests and 28 authentication application tests pass. Including Authenticator: 300 backend tests / 24 suites. |
| Compilation | Discussion management/materializer, Editorial and both identity service builds/typechecks pass. Identity and three UI packages build independently; eight enrollment library outputs were cleared before an uncached build. |
| Lint                           | Affected Discussion/materializer/queue/Editorial targets pass; the current Editorial target has no warnings. All six affected identity lint targets pass without lint warnings.                                                                                                                                                                                                                                |
| Architecture | Scoped source audit scans 1,101 production sources with zero boundary violations. All 26 original findings are resolved; three checker self-tests pass. This does not prove all runtime or architectural properties. |
| Portal composition | 43 aggregator suites / 298 tests and 5 identity suites / 38 tests pass. Source typecheck, identity/UI library checks and CSR production build pass. Eight production-bundle fixture browser layouts pass. Existing template/bundle warnings and 248 aggregator lint warnings remain. |
| Changed domain/features        | All 24 changed domain build targets pass. Profile/preferences and their 25 prerequisites pass after moving all 27 declared output directories aside and disabling Nx cache. Three Angular packages emit partial-compiled bundles. 25 affected lint targets pass with warnings.                                                              |
| Aggregator dependency chain | All 83 build tasks pass; 52 repaired outputs cleared, then chat cleared again for its ESM repair. All 56 Angular artifacts pass structural inspection. Nine test targets pass 389 tests/56 suites; 52 lint targets pass with 370 warnings. |
| Complete workspace build | All 129 declared build targets pass with Nx caching disabled. All 63 Angular packages pass artifact checks. Nine additional repaired targets pass lint with 11 warnings; no empty test target counts as coverage. |
| Dependent service verification | Discussion management/materializer and Editorial production builds plus application/test typechecks pass after the shared-library changes.                                                                                                                                                                                                  |
| Live recovery | Canonical identity SQL, Firebase credential emulator and all three Discussion/Editorial isolated-store suites pass. Process restart, standalone deployed workers, real email/cleanup, integrated independent sessions and backup restore remain unverified. |

The HTTP suite initially hit sandbox `listen EPERM` and passed after rerunning
with localhost-listening permission. That environment failure is not a functional
regression. Historical baseline measurements are unchanged. Current check results are recorded in [implementation evidence](readiness/implementation-2026-10-11.json). Logs are under
`/tmp/wapps-readiness/`; they are diagnostic files, not a permanent release record.

### Next work

- Implement canonical suite/collection ownership, storage, revisioned commands,
  current application membership resolution and portal composition. Article and
  discussion favorite targets require their owning canonical read/use cases.
- Extend real-store evidence to standalone service/worker processes, controlled
  crashes and restarts, independent sessions, backup restoration and rollback.
- Finish the separate Catalog portal and remaining nonapplication discovery/feed
  contracts. Aggregator application listing/search/detail/taxonomy and favorite
  journeys now pass. Align deployed workers and service callers with authenticated
  commands and verify legacy timestamp provenance before cutover.
- Qualify operator-reviewed legacy imports against representative deployment
  data. Legacy graph records and old mutable payloads remain preserved; unversioned
  records stay hidden from the new API. Do not cut over an existing deployment yet.
- Finish safe orphan/generation retention, dependency readiness, outbox/projection
  metrics, failed-queue operations and deployment rollback qualification.
- Finish Firebase email action-template configuration and actual delivery, full
  portal account/profile integration, verified legacy identity/profile import,
  cross-domain deletion and lifecycle audit consumers. Qualify actual provider
  cleanup and integrated signup/reset sessions.
- Complete pagination, portal integration and permission lifecycle. The discussion portal still uses its earlier adapters.
- Continue the remaining OP01-OP10 work: full authorization qualification, workspace/CI repair,
  real catalog and personal workflows, publication/media, reviews, notifications
  and full deployment/restore qualification. None of these blockers is closed by
  the tests in this slice.
- Resolve remaining dependency/security findings, lint/bundle warning debt and
  image immutability. Clean installation, workspace build/test/lint and layer tags
  have qualified checkpoints; runtime workers and release recovery remain open.
  Zero source-audit findings do not close authorization, durable data, runtime
  composition or release gates.

## Environment limits

Docker is reachable (29.1.3). The original local MySQL container remains stopped;
qualification uses isolated temporary resources. Firebase Auth emulator is reachable
at `127.0.0.1:9099` for `demo-wapps` during its earlier qualification.
Production provider credentials/configuration, complete multi-feature journeys,
database restart/restore, rollback and load qualification remain unverified.
Targeted catalog/profile browser journeys and application-process restarts pass
as recorded in their checkpoints. No deployment, production migration, real email
or push occurred.
