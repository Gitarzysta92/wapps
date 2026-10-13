# Workspace verification

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
