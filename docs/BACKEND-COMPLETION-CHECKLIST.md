# Backend and BFF completion checklist

Current assessment: **October 19, 2026**, after Discussion route consolidation,
the generic Review owner API/BFF slice, independent local Authentication,
complete administration BFF, staff health-monitor BFF, account/profile gateway
parity, A26 favorites/inbox classification, A27 account-export gateway parity,
suite lifecycle/publication parity, discovery article tag intersection, A28
full account-erasure qualification, application publication/ownership parity and
O01 operational foundations, verified together as integrated baseline I28,
followed by article publication, cover and current comment-authority qualification.
Branch: `codex/full-operation`; base HEAD:
`2c4a78797bb7bf4df2d3365c3490cd0a91a4fa7a`, the promoted clean I28 baseline.
The article slice remains uncommitted; its final source manifest and task-only
patch identify the assessed changes. Earlier checkpoints retain their own bases.

This is the current assignment/checklist index for the full backend scope. Keep
[functionality history](FUNCTIONALITY-MAP.md), [readiness criteria](OPERATIONAL-READINESS.md),
[implementation evidence](IMPLEMENTATION-PROGRESS.md) and the
[materialization contract](MATERIALIZATION.md) as supporting records. Their older
"missing", "next" and "current slice" statements describe their checkpoints,
not today's backlog. No completion percentage or whole-product readiness is claimed.

The presentation requirement remains the original frontend at
`c965790e063139bcd5e6bacc759f289703e4ea9a`. Its routes, filters, overview contracts,
notification and privacy settings were inspected for backend requirements. Current
frontend builds/screenshots do not establish acceptance of that presentation.
Frontend merge and visual acceptance are tracked separately as **FE01**.

## Reading and updating this checklist

- **Implemented** describes source, not production behavior: `present`, `partial`,
  `scaffold`, or `unverified`. Remaining gaps are in the corresponding record.
- **BFF / local / alpha** separates BFF handlers from checked-in ingress routing.
  `yes` means present in source/configuration; `bypass` means a direct owner route;
  `mixed` means only part of the workflow crosses BFF. Neither configuration proves
  what a running host serves. Operator-only commands use `n/a` deliberately.
- **Real dependencies**: `H12`, `H13`, `H14`, `H15`, `H16` mean dated historical
  qualification on October 12-16, 2026, within the cited scope and substitutions.
  `R18` is the October 18 Discussion qualifier inspected below; `V18` adds the
  generic Review qualification. `U` means unverified.
  Historical success does not qualify subsequently changed source or a new route.
- **Deployment**: `U` means no current, workflow-specific verification of this
  worktree's deployed version. Alpha's October 13 rollout is documented history;
  a runbook, manifest or health response is not current workflow acceptance.
- **Priority/dependencies** are in each record: P0 blocks safe activation; P1 is
  required for full scope; P2 is a disposition/documentation task. Close a record
  only when its remaining work and acceptance criteria are evidenced. Preserve IDs.
- Add evidence with date, source commit **and dirty-source manifest**, commands,
  environment/providers, result, substitutions and deployment/image identity.
  Keep failed attempts with their resolution; mark affected results stale after edits.

## Evidence and reconciliation

The three completed lanes now share the [I28 integrated source checkpoint](IMPLEMENTATION-PROGRESS.md#integrated-erasure-applications-and-operational-baseline-october-18-2026).
Combined verification in `/tmp/wapps-integration-a28-20261018-l4s2868l/` passes 6,879
Jest tests / 428 suites, 34 portable tests, full lint, 140 builds, 49 typechecks,
64 Angular package inspections and zero boundary violations. Separate Docker runs
pass erasure/application/export/suite/profile/member regressions and both Editorial
recovery qualifiers plus readiness faults. The 4,316-file manifest and local
`codex/integrated-a28-baseline` snapshot identify the dirty source; `snapshots.json`
records its exact commit. Deployment status is unchanged. Lane rows below retain
their own historical substitutions; I28 supersedes their Docker transport gap.

| Evidence | What it establishes | Limits / current interpretation |
| --- | --- | --- |
| Article slice (October 18-19): [qualification contract](ARTICLE-PARITY-QUALIFICATION.md), `/tmp/wapps-article-parity-20261018-ow5ug443/verification.json` | Local-first and both-Docker-gateway article journeys, 29 groups each; 90 BFF-stopped route variants; supplemental publication/covers/comments 9/17/9 groups and four materialization tests; all full workspace gates and six existing extension regressions; exact 15-file patch reproduces 4,322 final source hashes | Overlapping baseline groups; controlled operator claims and supplemental projection fixtures are explicit. First member run receives stopped-BFF 504 instead of exact 502; unchanged rerun passes and both attempts remain. Application-image alpha parity, original frontend acceptance and live activation remain separate. |
| I28: [combined checkpoint](IMPLEMENTATION-PROGRESS.md#integrated-erasure-applications-and-operational-baseline-october-18-2026), `/tmp/wapps-integration-a28-20261018-l4s2868l/verification.json` | All full workspace gates; 31 erasure, 31 application, 27 export, 29 suite, 25 profile and 25 member Docker groups; 9,600 bounded authenticated reads across those six runs; two SQL/projection recovery tests and 11 operational groups | Overlapping baseline groups; controlled DNS/source setup and privacy fixtures retain their stated limits. Readiness covers editorial-catalog only. No production fences/inventories, archived-data, broad recovery/load, frontend or deployment acceptance. |
| APP18: [application/ownership checkpoint](IMPLEMENTATION-PROGRESS.md#application-publication-and-ownership-parity-october-18-2026), `/tmp/wappsB-application-ownership-20261018-5_ffh246/` | New lockfile installation; 6,869 Jest tests / 426 suites and 34 portable tests; full lint, 140 builds, 49 typechecks, separate BFF/Editorial spec checks, 64 Angular artifacts and zero boundary violations; 29 combined real-session runtime groups through both native gateway configurations | Controlled UDP DNS substitutes public authoritative propagation; actual Editorial materializer uses fresh SQL/Mongo/RabbitMQ and application media uses MinIO. Editorial ownership-erasure hooks and successor acquisition are participant compatibility, not A28 completion. No Docker transport, frontend, archived-data or deployment claim. |
| O01: [operational foundations](IMPLEMENTATION-PROGRESS.md#o01-operational-transport-migration-recovery-and-scoped-readiness-october-18-2026) and `/tmp/wappsA-ops-foundations-20261018-ds3gld4i/verification.json` | Docker local/alpha transport and separate profile/member/export/suite regressions; current Editorial SQL/projection migration/recovery qualifiers; real dependency/schema/worker/backlog/poison readiness faults and recovery; full workspace gates | Only `editorial-catalog` readiness scope. Bounded SQL samples and Mongo availability do not establish whole-history integrity. No live deployment/probe/alert delivery, external-provider, restore/soak or frontend acceptance. |
| E01: source/configuration inspection, October 18 | [BFF registration][bff-module], controller/client sources, [local ingress][local-api], [alpha ingress][alpha-api], media includes, owning modules and workers | Read-only assessment; no live routing probe, service restart, store mutation or new integration run. |
| E02: [October 18 Discussion checkpoint][discussion-evidence] and `/tmp/wapps-unified-discussion-api-20261018/` | Inspected test/build logs: 2,390 tests / 67 affected suites; uncached three-service build plus prerequisites; four typechecks; ten real-store groups in `runtime-final.log`; one owner controller | Real MySQL/Mongo/RabbitMQ/MinIO and both nginx configs; controlled authentication/policy/parent providers. Nest-instance recreation is not an OS-process crash. Full legacy browser/export/erasure/notification journeys were not rerun. |
| V18: [October 18 Review checkpoint](IMPLEMENTATION-PROGRESS.md#generic-review-owner-api-and-bff-mapping-october-18-2026) and `/tmp/wapps-generic-reviews-api-20261018/` | 2,559 distinct tests / 82 affected suites; uncached affected service/library builds plus 44 prerequisites; five typechecks; architecture/inventory/lint; 14 real-store groups, four added for Reviews; both review ingress paths cross BFF | Historical SQL receipt replay, rollback/retry, lifecycle/permissions and Mongo independence pass. Real authentication/policy/parent providers, full export/erasure/browser journeys, process crashes and deployed activation remain unverified. |
| A18: [local auth checkpoint](IMPLEMENTATION-PROGRESS.md#local-authentication-and-bff-session-boundary-october-18-2026) and `/tmp/wapps-local-auth-20261018/` | 2,641 affected tests / 87 suites; uncached three-service build and prerequisites; seven typecheck sets; architecture/inventory/lint; five local-provider real-store groups | Built Authenticator/Account/BFF through local ingress with disposable SQL/RabbitMQ and no Firebase; process restarts, rotation/replay, canonical lifecycle and cleanup pass. External email/SSO, alpha activation, abrupt crash/restore, full erasure/export saga and frontend acceptance remain open. |
| A19: [staff lifecycle checkpoint](IMPLEMENTATION-PROGRESS.md#account-lifecycle-administration-through-bff-october-18-2026) and `/tmp/wapps-account-admin-20261018/` | 2,181 affected tests / 49 suites; 107 OPA tests; affected builds/typechecks/lint and real-store ingress qualification | Disable/enable/revoke through BFF, real OPA and local credentials; both ingress configurations, tenant/nonstaff denial, rollback, lifecycle outbox and session invalidation. Existing installation activation is blocked by one unverified legacy subject mapping. Remaining credential admin workflows and deployment stay open. |
| A20: [independent authentication checkpoint](IMPLEMENTATION-PROGRESS.md#independent-authentication-process-october-18-2026) and `/tmp/wapps-auth-process-20261018/` | 2,634 tests / 82 affected suites; uncached service builds/prerequisites; affected typechecks/lint; zero architecture violations and six checker tests; seven real-stack groups using the checked-in fresh-database initializer | Separate processes/SQL grants, stable issuer-subject bindings, BFF sessions, staff controls, rollback/retry, export/cleanup and an alternate verifier probe pass. Supersedes A18/A19 process composition. Legacy activation, alpha/Kubernetes configuration, full alternate provider/export/erasure journeys and frontend acceptance remain open. |
| A21: [legacy import and local activation](IMPLEMENTATION-PROGRESS.md#legacy-identity-import-and-local-authentication-activation-october-18-2026), `/tmp/wapps-legacy-identity-20261018/` and `/tmp/wapps-legacy-activation-20261018/` | 256 adapter tests / 16 suites and 426 Account tests / 29 suites; affected build/typecheck/lint; nine real-stack groups, live BFF session/restart checks, source-backup restore and zero architecture violations | Approved stub import preserves the original UUID and stores, remains restricted/unbound, and allows fresh local accounts. Authentication/Account/BFF/ingress activated locally. Domain services, legacy login restoration, external providers, full privacy workflows, alpha/Kubernetes and frontend/release acceptance remain open. |
| A22: [complete administration BFF contract](IMPLEMENTATION-PROGRESS.md#complete-account-administration-through-bff-october-18-2026) and `/tmp/wapps-account-admin-resume-20261018/` | Full portable gate: 6,697 Jest tests / 421 suites, 34 portable tests; production/tool lint; 140 builds, 49 typechecks and 64 Angular artifacts; 107 OPA tests; eleven real-stack groups; zero architecture violations | All admin-users routes cross BFF in both gateway configurations. Credential edits/revocation, exact IDs, tenant/forged denial, rollback/retry, deletion replay and read-only combined cleanup pass. Local unlink/action links fail explicitly. Coordinated live rollout, external providers, durable audit retention and full privacy convergence remain open. |
| A23: [staff health monitor BFF](IMPLEMENTATION-PROGRESS.md#staff-health-monitor-configuration-through-bff-october-18-2026) and `/tmp/wapps-health-bff-20261018/` | 6,778 Jest tests / 422 suites and 34 portable tests; production/tool lint, 140 builds, 49 typechecks, 64 Angular artifacts, BFF spec typecheck and zero architecture violations; ten real health groups with SQL/Mongo/OPA/both Nginx routes and eleven local-auth groups | Explicit staff reads/configuration, exact receipts, tenant/forged denial, revision replay, atomic rollback, lost-response retry, erasure fences, withdrawal and process/outage recovery. Health authentication and public probe DNS/transport remain fixtures; no live deployment, worker enablement or frontend acceptance. |
| A24: [private account/settings gateway parity](IMPLEMENTATION-PROGRESS.md#private-account-and-settings-gateway-parity-october-18-2026) and `/tmp/wapps-account-routes-20261018/` | 6,786 Jest tests / 422 suites and 34 portable tests; production/tool lint, 140 builds, 49 typechecks, 64 Angular artifacts, BFF spec typecheck and zero boundary violations; nineteen local-auth real-stack groups, eight added for settings | Private account/profile/preferences/avatar and deletion acceptance cross BFF in both configurations. Real credentials/OPA/SQL prove isolation, rollback/replay, persistence, photo bounds/removal and BFF outage without owner fallback. Remaining callers/routes are inventoried; public-profile/source qualification, full erasure, activation and frontend acceptance remain open. Initial timeout attempts and corrected private-avatar denial expectation are recorded. |
| A25: [public-profile/follow/badge parity](IMPLEMENTATION-PROGRESS.md#public-profile-follow-and-badge-gateway-parity-october-18-2026) and `/tmp/wapps-public-profile-parity-20261018/` | 6,825 Jest tests / 422 suites and 34 portable tests; 288 OPA cases per merged bundle; full lint, 140 builds, 49 typechecks, 64 Angular artifacts and zero boundary violations; twenty-three combined runtime groups | Both API/auth gateway configurations use native Nginx 1.28.3 with real credentials/OPA/SQL/Editorial/Community/Mongo/MinIO and test-owned Discussion materialization. Audiences, contacts/photos, sharing, follow/badge rollback/replay/revocation, persistence, withdrawal and outages pass. Docker-to-host stalls remain unresolved; deployment, mature filtering, full erasure and frontend acceptance remain open. Source setup/projector substitutions are recorded. |
| A26: [favorites/inbox parity](IMPLEMENTATION-PROGRESS.md#favorites-and-inbox-gateway-parity-october-18-2026) and `/tmp/wapps-favorites-inbox-parity-20261018/` | 6,842 Jest tests / 424 suites and 34 portable tests; full lint, 140 builds, 49 typechecks, BFF spec typecheck, 64 Angular artifacts and zero boundary violations; twenty-three combined runtime groups | Both native gateway configurations exercise real credentials/OPA/source stores and actual reply/mention/watch workers. Four-kind favorites, current classification, private read-state, replay/suppression, persistence, removal/re-add and outages pass. Source setup, scheduler/acknowledgement fault substitutions and Docker transport limits remain explicit. Full privacy/quarantine/deployment/frontend acceptance remain open; runtime presentation is unchanged. |
| A27: [account export parity](IMPLEMENTATION-PROGRESS.md#account-export-gateway-parity-october-18-2026) and `/tmp/wapps-a27-account-export-20261018/` | Clean Node 22.17.1 install; full portable/test/lint/build/typecheck/artifact/boundary gates; independent real-provider export through both native gateways plus Account/Editorial/Discussion source/storage regressions | Exact unchanged four-provider roster, historical capture, integrity, replay, current authority, outages, cancellation, expiry and Account SIGKILL/restart. Explicit fixture/clock/source-fault substitutions; Docker transport, full erasure, external providers, browser/frontend acceptance and deployment remain open. |
| Suite lane after A26: [suite lifecycle/publication parity](IMPLEMENTATION-PROGRESS.md#suite-lifecycle-and-publication-parity-october-18-2026) and `/tmp/wappsB-suites-publication-20261018-9gw_04jl/` | New isolated lockfile installation; 6,849 Jest tests / 425 suites and 34 portable tests; full lint, 140 builds, 49 typechecks, BFF spec typecheck, 64 Angular packages and zero boundary violations; 27 combined real-session runtime groups | Real Authentication/Account/Editorial/OPA/SQL/Mongo/RabbitMQ and both native gateways qualify private suites, independent frozen publication, withdrawal, replay/restart, failures, owner export and suite-only Editorial erasure. Private removal preserves approved publication. Historical store/delivery/favorites regression uses declared ingress fixtures. Full Account export/archive/erasure remains dependent on A27/A28; no deployment, container-transport or frontend acceptance. |
| E03: [October 16 consumer-boundary checkpoint][consumer-evidence] | 6,256 Jest tests / 406 suites, 33 portable checks, 136 builds, 45 typecheck projects, 64 Angular artifacts; six isolated store qualifiers reported | Historical full-workspace result; subsequent Discussion changes prevent treating it as a current full gate. Optional scraper lockfile-pruning fallback remains unqualified. |
| E04: October 12-15 workflow checkpoints in [progress][progress] and [readiness JSON][readiness-json] | Detailed commands, providers, source snapshots, failures and local/browser results for individual workflows | JSON filename is October 11 but entries have their own dates. Many older paths/statuses are historical; use current source references below. Browser fixtures and emulator evidence are not deployed-provider acceptance. |
| E05: [alpha runbook][alpha-readme], `compose.alpha.yaml`, release workflow | Reports October 13 backend rollout, real Firebase email/password configuration, in-app workers and immutable alpha image tags; describes activation/rollback | Current deployed SHA/digests, runtime ingress and per-workflow results were not inspected. Alpha disables HTTP monitoring and optional integrations; Google/GitHub/anonymous providers are disabled there. |

E02's initial `runtime.log` failed with `Favorite target lookup unavailable`.
The completed checkpoint attributes this to fixtures sending an internal scoped
selection request to the portal origin. Corrected fixtures use the owner service
origin; the fresh final run passes. This is a **resolved historical failure**, not
a current product defect. Initial and final logs remain available. Current source
was refreshed after that work completed; its new evidence supersedes the earlier
October 16 route description. Local `/tmp` logs are useful supporting evidence,
not durable release artifacts; archive source manifests and reports for release.

| Stale claim | Current interpretation / checklist |
| --- | --- |
| Discussion needs a generic owner API, or uses `/api/discussion-bindings` | One reusable owner `/api/discussions` controller exists; old binding routes return 404. BFF and Account clients use it. BC16 needs broader provider/journey qualification and coordinated deployment, not another consolidation. |
| Review/Identity generic core extraction completes their HTTP separation | Consumer packages and opaque engines exist. Review still exposes application-specific owning HTTP routes; BC17 remains implementation work. |
| Profiles, suites, publication, media, reviews, export or erasure are wholly absent | Later checkpoints and current source implement these workflows. BC05-BC22 distinguish residual behavior, BFF/alpha gaps and qualification from historical absence. |
| Discover/Digest/Explore are fixture-only; catalog IDs/review totals are synthetic | Real catalog/discovery/feed composition exists. Rich discovery and activity ratings use owner data; catalog unknowns remain explicit. Original filter/metadata parity is still incomplete or unverified (BC01-BC02). |
| All preferences, mature filtering or notifications are missing | Canonical preferences and in-app replies/mentions/watches exist. A26 adds current classification enforcement to favorites, shared-profile content and delivery/inbox reads. Remaining advertised settings and email/push/system alerts stay open (BC07, BC18-BC19). |
| Authorization still necessarily permits `ok(false)` writes; all builds fail | Later denial/HTTP/store regressions and build checkpoints supersede the baseline defects. End-to-end authority and the current full release gate remain open (BC23, BC26). |
| Discussion/Editorial still use best-effort writes and runtime schema sync | Durable intents, revisions, migrations, tombstones and recovery tools exist. Registry still has `synchronize: true`; process crash/restore remain separate gaps (BC24, BC28, BC30). |
| Alpha is portal-only, or every locally integrated route is deployed through BFF | Backend alpha is documented, but checked-in alpha routes still bypass BFF for many families. Current deployed state is unknown (BC27). |
| All ten Discussion store groups prove real-provider or crash recovery | E02 substitutes authority providers and recreates Nest instances. Neither production-provider integration nor process-crash recovery is established. |

## Current status matrix

The real-dependency column describes only each cited bounded qualification;
uncited journeys and whole-product readiness remain unverified. Unit
regressions, including E02's full BFF suite, are additional evidence, not substitutes.
Every deployment cell remains U for the currently assessed implementation.

| ID / workflow | Implemented | BFF / local / alpha | Real dependencies | Deployment |
| --- | --- | --- | --- | --- |
| [BC01 Discovery and taxonomy](#bc01-discovery-and-taxonomy) | partial parity; article multi-tag query complete | yes / yes / mixed | H13-14; October 18 article-tag slice real MySQL/Mongo/OPA/BFF; remaining U | U |
| [BC02 Home, activity and metadata](#bc02-home-activity-and-metadata) | partial parity | yes / yes / yes | H13-14; current U | U |
| [BC03 Authentication and sessions](#bc03-authentication-and-sessions) | independent local auth + Identity/BFF implemented | yes / yes / yes | A20/A21 local SQL/processes/ingress; external provider deferred | local auth active; alpha/K8s U |
| [BC04 Account administration](#bc04-account-administration) | all admin BFF contracts present | yes / yes / yes | A22 local SQL/processes/OPA/ingress; unavailable local actions fail explicitly | local A21 lifecycle active; A22 rollout pending |
| [BC05 Profiles and photos](#bc05-profiles-and-photos) | present | yes / yes / yes | A24 private; A25 public; A26 classification/current-source regression | U |
| [BC06 Follows and badges](#bc06-follows-and-badges) | present | yes / yes / yes | A25 real Account/OPA/native-Nginx rollback/replay/revocation | U |
| [BC07 Preferences and classification](#bc07-preferences-and-classification) | partial consumers | yes / yes / yes | A24 persistence; A26 favorites/profile/inbox and delivery classification; remaining settings U | U |
| [BC08 Favorites](#bc08-favorites) | present | yes / yes / yes | A26 four-kind real-source/native-Nginx replay, removal, persistence and outages | U |
| [BC09 Private suites](#bc09-private-suites) | present; lifecycle qualified | yes / yes / yes | suite lane: real sessions/OPA/stores, native gateways; full privacy pending | U |
| [BC10 Application drafting/publication](#bc10-application-drafting-and-publication) | present; frozen publication qualified | yes / yes / yes | APP18 real sessions/OPA/stores/native gateways | U |
| [BC11 Ownership](#bc11-ownership) | present; grant/revoke/successor qualified | yes / yes / yes | APP18 controlled DNS, independent grants, participant erasure hooks | U |
| [BC12 Suite publication](#bc12-suite-publication) | present; independent removal/withdrawal | yes / yes / yes | suite lane: frozen review, broker replay, retained anonymous publication | U |
| [BC13 Articles](#bc13-articles) | present; publication/covers/comments qualified | yes / yes / yes | October 18 article slice: independent sessions, real stores/workers, both Docker gateways | U |
| [BC14 Releases](#bc14-releases) | present | yes / yes / bypass | H15; current U | U |
| [BC15 Media](#bc15-media) | article covers qualified; application-image alpha pending | yes / yes / mixed | October 18 covers: real objects, bounds/denial/replay/outages, both Docker gateways | U |
| [BC16 Discussions and comments](#bc16-discussions-and-comments) | present; current article parent authority qualified | yes / yes / yes | article slice: real Authentication/OPA/Editorial/Discussion workers; broader R18 journeys remain | U |
| [BC17 Reviews and moderation](#bc17-reviews-and-moderation) | present, generic owner API | yes / yes / yes | V18; authority substituted | U |
| [BC18 In-app notifications](#bc18-in-app-notifications) | present; classification enforced | yes / yes / yes | A26 real reply/mention/watch workers, SQL receipts, private read-state/replay and current authority | U |
| [BC19 Advertised channels/alerts](#bc19-advertised-channels-and-alerts) | preferences only / incomplete | preferences only / mixed / bypass | delivery U | U |
| [BC20 HTTP application health](#bc20-http-application-health) | public and staff BFF present | yes / yes / yes | A23 real SQL/Mongo/OPA and both gateways; authentication and probe DNS/transport fixtures | U; probing remains disabled |
| [BC21 Account export](#bc21-account-export) | present | yes / yes / yes | A27 independent providers; I28 Docker export regression; historical source/storage regressions | U |
| [BC22 Account erasure](#bc22-account-erasure) | present | yes / yes / yes | A28 independent processes and cleanup; I28 Docker erasure regression | U |
| [BC23 Authorization and privacy](#bc23-authorization-and-privacy) | partial qualification | mixed / mixed / mixed | historical + R18 subset | U |
| [BC24 Migrations/materialization](#bc24-migrations-and-materialization) | present; residual gaps | via workflows / mixed / mixed | O01 current Editorial SQL/projection recovery passes; R18 subset | U |
| [BC25 Readiness/observability](#bc25-readiness-and-observability) | Editorial catalog scope implemented; broader scope partial | owner + BFF readiness / activation pending / activation pending | O01 dependency, schema, backlog/poison and worker fault/recovery | U |
| [BC26 CI/build artifacts](#bc26-ci-and-build-artifacts) | partial release qualification | n/a | I28 full workspace gate; external suites separate | U |
| [BC27 Deployment/ingress](#bc27-deployment-and-ingress) | partial alignment; caller inventory recorded | mixed / mixed / mixed | R18/V18/A22-A28, suite and APP18 families; O01 Docker gateway regressions | U |
| [BC28 Crash/restore/rollback](#bc28-crash-restore-and-rollback) | tools/runbooks; proof incomplete | n/a | historical limited recovery; restore U | U |
| [BC29 Load/soak](#bc29-load-and-soak) | unverified | all released contracts | U | U |
| [BC30 Content Node Registry](#bc30-content-node-registry) | scaffold; disposition open | none / local dependency / absent | no behavior qualification | U |

## Workflow records

Paths below use the `/api` prefix unless explicitly `/auth`. Controller directories
are linked so method, DTO and downstream-client details stay next to their owner.
For every implemented write, the owner retains authorization and durable effects;
BFF has no database transaction or materializer of its own.

### BC01 Discovery and taxonomy

- **Owner/contracts:** Catalog/Editorial domain; [BFF catalog][catalog-src] provides
  `/catalog/{apps,app-selection,facets,categories,categories/tree,tags,discover}`;
  [Editorial catalog][editorial-catalog] and article/suite catalog APIs provide source reads.
  Editorial categories/tags/reference controllers own taxonomy maintenance.
- **Authority/work:** Editorial SQL records, taxonomy and publication revisions;
  immutable payloads and matching Mongo projections via Editorial outbox/materializer.
  No BFF search index. H13 [grouped discovery][discovery-evidence] and H14 rich-tile
  evidence cover bounded pages, filters, lag and real metadata, with stated fixtures.
- **Remaining/next (P1; BC07, BC17):** Close original filter parity one family at a
  time. The [discovery-lane contract inventory](DISCOVERY-FEED-CONTRACT-INVENTORY.md)
  maps the original controls/cards to owners and records the completed article
  multi-tag intersection slice: domain/query, owner SQL, BFF/adapter validation,
  portable checks and six real MySQL/Mongo/OPA/compiled-service groups. Legacy
  single-tag behavior is retained; no storage or gateway changes. [The discovery query contract][discovery-query] still rejects mixed-kind facets, suite taxonomy and unsupported
  social/estimated-user filters; the original `filters.ts` advertises the latter two.
  Acceptance: map every original reachable filter/directory/legacy query to an owner
  contract, then qualify the first missing facet through BFF with accurate totals,
  pagination, labels, empty/error and withdrawal behavior. Do not silently drop filters.

### BC02 Home, activity and metadata

- **Owner/contracts:** BFF [Explore/Digest/timeline][feed-src], `/catalog/discover`
  and `/catalog/apps/:slug`; internal Editorial/Community `/internal/explore`,
  canonical catalog selections and Review summaries. Home search uses the discovery contract.
- **Authority/work:** Existing publications, discussions, SQL reviews and account
  preferences; bounded current reads, no new feed projection. H13 Explore/Digest/
  timeline and [H14 rich metadata][tiles-evidence] qualify their own revisions.
- **Remaining/next (P1; BC01, BC07, BC16-17):** Inventory original overview/cards:
  real authors/badges, vote/review counts, suite membership, estimated users and any
  displayed views/status/history. Ratings now have owner-backed enrichment; general
  feed votes, top-author/view summaries and complete timeline history lack equivalent
  completion evidence. Acceptance: a field/action-to-authority matrix and one missing
  BFF composition with canonical counts, revoked-access handling and truthful unknowns.
  No fabricated metrics or new recommendation algorithm; presentation work is FE01.
  The [discovery-lane inventory](DISCOVERY-FEED-CONTRACT-INVENTORY.md) now provides
  the field/action-to-authority matrix. It completes the article multi-tag query
  gap under BC01, not the remaining card metadata compositions or BC02 acceptance.

### BC03 Authentication and sessions

- **Owner/contracts:** Authentication exposes service-only `/credentials/*`. Identity
  owns the `/api/auth/*` facade and private gateway validation; BFF preserves browser
  routes. Both local and alpha authentication route sets now cross BFF.
- **Authority/work:** Independent credential storage/process, exact issuer/subject
  bindings, stable Wapps IDs, guarded registration receipts and remote credential
  administration/export/deletion are implemented. Canonical lifecycle, ownership,
  revisions, provider plans and outboxes remain in Identity/Account. No frontend change.
- **Evidence (A20/A21):** [Process-boundary checkpoint](IMPLEMENTATION-PROGRESS.md#independent-authentication-process-october-18-2026),
  [contract and migration guide](LOCAL-AUTHENTICATION.md), and
  `/tmp/wapps-auth-process-20261018/`. Production local bundles are qualified with
  separate SQL grants, real OPA and both gateway route sets. A second standalone
  token verifier retains the Wapps identity/profile and respects suspension.
  It is a verifier probe, not a fully implemented alternative credential provider.
  A21 imports the approved restricted stub into a separate canonical schema and
  activates local authentication with verified BFF sessions/restarts and backup
  restoration. The old UUID/stores are retained; no credential binding is created.
  A24 also qualifies both gateways' private account/settings/photo contracts with
  real local tokens, independent sessions and canonical self-deletion acceptance.
- **Remaining/next (P0; BC23):** Legacy login restoration requires verified linking
  and a retention/erasure plan for the archived private stores. Do not infer links
  from email. Coordinate the still-stopped domain services before full local activation.
  Alpha configuration generation, Kubernetes wiring, external provider qualification
  and the full export/erasure saga remain open. A22 completes the remaining BC04
  BFF contracts; coordinated rollout remains pending. Local OAuth/anonymous credentials/email delivery remain unavailable;
  Firebase integration is deferred at the user's request. Concurrent multi-issuer
  configuration is not included; foreign issuer bindings fail closed. Frontend merge,
  visual acceptance and full release qualification remain outstanding.

### BC04 Account administration

- **Owner/contracts:** [Account controllers][account-http] `/admin/users/:uid/*`
  disable/enable, token revocation, credential edits/unlink, generated action links,
  deletion and identity lookup. All eleven explicit BFF handlers, including a
  read-only `/deletion-status`, are implemented. Both gateway configurations send
  the entire admin-users family through BFF; unknown actions cannot fall through
  to Account. See [the contract](LOCAL-AUTHENTICATION.md#staff-administration-through-bff).
- **Authority/work:** Canonical SQL lifecycle, configured credential-provider operations, OPA,
  identity outbox/cleanup. Actor tenant context reaches policy: all global
  administration operations deny tenant-scoped administrators. SQL suspension blocks
  access/sign-in/refresh but does not disable provider credentials or delete sessions.
  Explicit revocation removes local sessions; re-enablement permits fresh sign-in.
  Audit logs distinguish confirmed/denied/unconfirmed outcomes; lifecycle events
  remain durable in the existing outbox. No new revocation command journal is claimed.
- **Evidence (A19/A22):** Exact case-sensitive IDs, filtered trusted headers,
  staff/tenant/forged denial, failed transactions and retry, session invalidation,
  deletion replay and combined cleanup status pass with real OPA/SQL/local
  credentials through both gateways. Stopping BFF proves every new route fails
  without owner fallback. Local unlink returns 400; unavailable action links return
  503. Completion requires both credential and account-erasure journals; the full
  saga is not qualified by credential cleanup alone. No frontend/Firebase change.
- **Remaining/next (P0; BC03, BC23):** A21 activated local lifecycle routes. Roll
  out the A22 Account/BFF/policy/gateway versions together and verify the candidate
  installation. External providers, durable administrative audit retention,
  complete privacy convergence and alpha/Kubernetes deployment remain open.
  No new administration frontend is required by this backend slice.

### BC05 Profiles and photos

- **Owner/contracts:** Account/Wapps [profile controllers][account-http]; [BFF account][account-bff]
  `/me`, `/me/profile`, `/me/profile/avatar/*` and [public profiles][profiles-bff]
  `/profiles/:id/{avatar,totals,favorites,suites,articles,discussions,activity}`.
  Internal owner APIs include `/internal/profile-*` on Editorial/Community.
- **Authority/work:** Account SQL profile, normalized avatar bytes, audience/contact
  choices and current source authority; identity intents and existing source projections.
  H12 profile checkpoints and [H14 BFF profile evidence][profiles-evidence] exist.
  A24 qualifies private profile/photo parity in both gateways with real local
  credentials/OPA/SQL, concurrent/historical receipts, atomic rollback, independent
  sessions, WebP byte isolation, process restart and removal. A25 aligns public
  profile/photo routes in alpha and qualifies current real source composition,
  public/followers/private audiences, independent sharing switches, contact privacy,
  source withdrawal and source/BFF outages through both Nginx configurations.
  A26 filters all five shared-content sections by current viewer classification
  choices, including anonymous defaults, nested metadata and concurrent changes.
  The final gateway runs use native Nginx; Docker transport remains a stated limit.
- **Remaining/next (P1; BC07, BC16, BC22, BC27):** Qualify erased authors against
  current cross-service cleanup, then activate
  the coordinated candidate. Acceptance: erased authors cannot expose stale private
  fields; classification preferences govern shared content. Contact email remains
  member-provided, not verified identity. Frontend acceptance is separate.

### BC06 Follows and badges

- **Owner/contracts:** Account SQL use cases; [BFF profiles][profiles-bff]
  `/me/profile-follows`, `/outgoing`, `/me/badges`, `/profiles/:id/badges`,
  `/admin/profile-badges`; same owner contracts in [Account][account-http].
- **Authority/work:** Canonical follow requests/approval and badge grants/revocations,
  reasons, revisions and receipts. H12 audience/badge and H14 public-profile BFF
  checkpoints qualify these policies. A25 requalifies the combined workflow with
  real Account/OPA and both native Nginx configurations: independent approval,
  cancellation/removal, immediate metadata/photo/shared-content denial, SQL/outbox
  rollback, concurrent/historical receipts, staff reasons/audit and persistence.
  Global badge policy now rejects tenant-scoped staff; `identity:admin` alone is
  insufficient. Historical receipts cannot restore revoked decisions.
- **Remaining/next (P1; BC22, BC23, BC27):** Qualify erasure of private audit provenance
  and coordinated deployed behavior. Docker-to-host transport stability, original
  frontend acceptance and current deployment remain unverified; the bounded A25
  run does not close those release requirements.

### BC07 Preferences and classification

- **Owner/contracts:** Account `/me/preferences` through [BFF preferences][preferences-bff];
  Editorial authors propose classification and staff approve frozen publications.
  BFF/public consumers use those owner facts, never infer General from missing data.
- **Authority/work:** SQL preference revision/receipt and publication classification;
  existing outboxes/projections, no classification worker. H13 classification and
  content-consumer checkpoints plus H14 preferences BFF evidence; see
  [classification contract][classification-contract].
  A24 aligns saved preference routes in both gateways and qualifies shared canonical
  profile/preferences revisions, historical/concurrent replay, outbox rollback,
  persistence and unavailable policy/owner/BFF behavior. A26 adds current approved
  classification to favorite metadata, all five shared-profile content sections and
  reply/mention/watch delivery and inbox reads. General-only defaults hide Mature
  and unclassified nested metadata; independent sessions use current choices and
  a change during composition fails closed. Historical suppression remains durable.
- **Remaining/next (P1; BC01-02, BC19):** Audit the remaining advertised privacy,
  content and personalization settings. Acceptance: mature disabled hides Mature
  **and unclassified** content in every remaining consumer; changed sessions/choices
  invalidate stale responses.
  Distinguish persisted fields from implemented consumers (including analytics);
  modeled-only language/timezone/accessibility fields are not delivered features.

### BC08 Favorites

- **Owner/contracts:** Account generic saved-association engine with Wapps consumer
  mapping; [BFF member][member-bff] `/me/favorites` and `/me/favorites/content`;
  owner `/me/favorites`, Editorial selection and Community `/discussions/selection`.
- **Authority/work:** Canonical Account SQL associations, exact keys, revisions,
  receipts and watch baselines; owner authority rechecks. H14 BFF and H16 consumer
  qualification; A26 aligns both gateway families and qualifies four-kind saves,
  exact IDs, independent sessions, concurrent/historical receipts, rollback/retry,
  current classification, hidden targets, persistence, removal during source outage
  and re-add watch baselines. Shared-profile favorites now use generic Discussion
  selection through a Wapps consumer mapper; the obsolete owner route is removed
  from that client. Alpha no longer bypasses BFF for favorites.
- **Remaining/next (P1; BC21-22, BC27):** A27/A28 qualify saved-relation export and
  private erasure; I28 reruns both plus member delivery through Docker. Production
  fencing, coordinated deployment and original frontend acceptance remain open.
  Source-setup and seeded erasure-notification history remain explicit limits.

### BC09 Private suites

- **Owner/contracts:** Editorial [suite workspace][suite-src]; [BFF suites][suites-bff]
  `/me/suites` list/create/read/edit/delete; owner uses the same domain routes.
- **Authority/work:** Canonical owner-scoped SQL drafts/membership UUIDs, revisions,
  command receipts and tombstones; current catalog resolves member metadata.
  H14 [private-suite BFF evidence][suites-evidence]; export/erasure are BC21-22.
  The suite lane after A26 qualifies both gateways, real canonical sessions/OPA,
  two-session persistence, ownership/tenant denial, membership changes, exact
  retry/conflict, unavailable members and atomic private removal. Removed drafts
  leave approved snapshots intact and retain owner status/withdrawal access.
  Existing Editorial export and suite-only erasure hooks pass against real stores.
- **Remaining/next (P1; BC21-22, BC27):** A27/A28 qualify complete Account archives,
  fixed privacy provider plans and disposable cleanup convergence; I28 reruns them
  and suite behavior through Docker. Production privacy fencing, archived-data
  policy, deployment and original frontend acceptance remain open. Collaborative
  curation is not added scope.

### BC10 Application drafting and publication

- **Owner/contracts:** Editorial application domain; [BFF applications][applications-bff]
  `/me/application-drafts`, canonical/open/rebase, submit/withdraw/publication and
  `/editorial/application-reviews`; corresponding Editorial domain controllers.
- **Authority/work:** SQL drafts, immutable submissions, independent decisions,
  canonical revisions/receipts; immutable objects and atomic outbox -> Mongo projection.
  H14 drafting/publication BFF checkpoints supersede the original missing-workflow claims.
- **Qualified:** APP18 completes draft -> independent review -> canonical update ->
  withdrawal through both native gateway configurations. Frozen fields/classification/
  media, independent sessions, owner/tenant/self-review denial, revision/key conflicts,
  rollback, broker lag and restart/replay pass. Former-author and grant-bound private
  removal preserve the transferred canonical record. Application-specific Editorial
  APIs and their existing unbound-draft deletion semantics remain unchanged.
- **Remaining/next (P1; BC07, BC15, BC22, BC27):** I28 integrates APP18 with A28 and
  O01, rerunning application/ownership and full erasure separately through Docker.
  Qualify coordinated activation, production privacy fencing, original frontend
  acceptance and broad media families; alpha media is still a separate route gap.

### BC11 Ownership

- **Owner/contracts:** Editorial [ownership][ownership-src]; BFF
  `/me/ownership-claims` create/verify/cancel/release and
  `/editorial/ownership-reviews/:id/decision`.
- **Authority/work:** SQL domain proofs, independently reviewed grants, revisions,
  receipts and revocation/audit records. H13 classification/ownership checks include
  real DNS proof; [H14 ownership BFF evidence][ownership-evidence] covers integration.
- **Qualified:** APP18 uses real sessions and the production resolver against
  controlled UDP TXT records. Proof alone grants nothing; dedicated staff cannot
  self-approve. Canonical revoke/release deny source/open/rebase/submit/withdraw during
  projection lag. New grants cannot revive old claim-bound drafts. DNS failure/lease
  recovery after Editorial SIGKILL, rollback/replay, existing participant erasure and
  successor acquisition without erased private history pass.
- **Remaining/next (P0 for ownership activation; BC03, BC22, BC27):** A28 qualifies
  the complete privacy coordinator and cross-service journey; I28 verifies the
  combined source through Docker. Public authoritative DNS/TLS, production erasure
  fencing, coordinated deployment and original frontend acceptance remain open.
  The controlled-DNS proof is an explicit substitution.

### BC12 Suite publication

- **Owner/contracts:** Editorial suites; [BFF suite publication][suite-publication-bff]
  `/me/suites/:id/{publication,submit,withdraw}`, `/editorial/suite-reviews`,
  `/catalog/{suites,suite-selection}` -> matching Editorial APIs.
- **Authority/work:** SQL private workspace and independent immutable publication
  snapshots, reviews/receipts/outbox and public Mongo projections. H12 independent
  snapshots and H14 BFF checkpoints supersede the earlier private-only status.
  The suite lane qualifies independent review/self-review denial, frozen content
  and classification, rejection/resubmission, private deletion preserving approval,
  hidden-member denial, truthful lag, broker replay/rebuild, atomic outbox failure,
  restart and explicit withdrawal despite retained projections. Both native
  gateways deny every tested suite family when BFF is stopped. The Editorial
  participant removes private provenance while retaining anonymous approved
  content at a new canonical publication revision.
- **Remaining/next (P1; BC21-22, BC24, BC27):** A28 additionally qualifies retained
  approved suites in the complete Account privacy journey; I28 reruns suite and
  erasure workflows separately through Docker. Archive/backup privacy, production
  fencing, deployment/migration activation and original frontend acceptance remain open.

### BC13 Articles

- **Owner/contracts:** Editorial articles; [BFF articles][articles-bff]
  `/me/articles`, `/editorial/article-reviews`, `/catalog/{articles,article-selection,article-visibility}`;
  covers BC15, comments BC16. Corresponding owner APIs remain domain-specific.
- **Authority/work:** SQL draft/publication state and frozen text/classification,
  immutable payload/cover references, receipts/outbox and Mongo publication projections.
  [H15 article BFF evidence][articles-evidence] covers 24 handlers and local runtime groups.
- **Current qualification:** The [October 18-19 article slice](ARTICLE-PARITY-QUALIFICATION.md)
  passes local first, then both Docker gateways with real independent sessions,
  frozen review/classification/covers, denial/concurrency/replay, SQL/outbox rollback,
  broker materialization and truthful outages. Current withdrawal hides retained
  article/comment projections; republication restores the same comment association.
  Alpha's complete JSON, private preview and public article-media families use BFF.
- **Remaining/next (P1; BC07, BC22, BC27):** Preserve these contracts in the eventual
  original-frontend merge and coordinated deployment. Production retention/archived-data
  policy, live migration/worker activation and whole-product load/soak remain open.

### BC14 Releases

- **Owner/contracts:** Editorial releases; [BFF releases][releases-bff]
  `/me/releases` source/open/rebase and publication, `/editorial/release-reviews`,
  `/catalog/releases/:slug/:version?` -> corresponding owner APIs.
- **Authority/work:** Canonical SQL owner grants, version uniqueness, drafts/frozen
  submissions/reviews/receipts/outbox and projected public versions. [H15 evidence][releases-evidence].
- **Remaining/next (P1; BC07, BC11, BC27):** Qualify candidate release publication and
  withdrawal under changing ownership. Acceptance: approved stable/prerelease version
  and pagination contracts hold, self-review is denied, revoked owners cannot publish,
  retries do not duplicate versions, and saved-application notifications use current access.

### BC15 Media

- **Owner/contracts:** Editorial application images/article covers; BFF
  `/me/application-images`, `/me/article-covers`, frozen submission previews and
  `/media/{applications,articles}/*`; profile photos are Account-owned under BC05.
  [Local media routes][local-media] use BFF; [alpha media routes][alpha-media] use
  BFF for article covers, while application images still bypass it.
- **Authority/work:** SQL reservations, normalized immutable objects, association
  references, processing/retention receipts and cleanup work; publication outboxes
  carry references. H14 image and H15 cover BFF evidence includes binary failures/retries.
- **Current qualification:** Article covers pass byte/type/hash/size bounds,
  partial-stream and explicit cancellation, protected/frozen previews, stale revisions,
  unavailable storage and durable object replay through both Docker gateways. Existing
  privacy/retention behavior and fixed provider plans remain unchanged.
- **Remaining/next (P1; BC10, BC22, BC27):** Align and qualify application-image alpha
  routing separately. Preserve retained public media and durable private cleanup;
  production retention, archived-data policy and coordinated activation remain open.

### BC16 Discussions and comments

- **Owner/contracts:** Community composes generic [Discussion HTTP][discussion-http].
  BFF `/application-discussions`, `/article-comments`, `/me/discussions`,
  `/discussion-selection` maps Wapps keys to owner `/discussions`, `/participation`,
  `/selection`, comments, votes and pins. Generic portal `/discussions` stays keyless.
- **Authority/work:** SQL nodes/relations, exact opaque keys, revisions, receipts,
  votes/pins and tombstones; immutable MinIO payloads; atomic outbox -> confirmed
  RabbitMQ delivery -> guarded Mongo generations. E02/R18 passes; both configured
  ingress families cross BFF. `/discussion-bindings` is retired, with no compatibility alias.
- **Current article qualification:** The article slice uses independent real
  Authentication, OPA and Editorial authority through both Docker gateways. It
  checks generic Discussion routing, owner/tenant/keyless/forged-scope denial,
  replies/redaction, SQL rollback, broker generations and current withdrawal/
  republication against retained projections. No consumer parsing moves into SDK.
- **Remaining/next (P0 before activation; BC03, BC23-24):** Run the consolidated
  route with real Authenticator/OPA/Editorial providers and the amended legacy
  journeys. Acceptance: unfamiliar case-sensitive keys, key omission/forgery,
  parent-access revocation, tenant/owner denial, historical receipts, votes/pins,
  redacted replies and lag pass without consumer parsing in SDK/materializer.
  Process crashes belong to BC28; coordinated version/migration rollout to BC27.

### BC17 Reviews and moderation

- **Owner/contracts:** Reusable Review core, management and [HTTP][reviews-owner]
  composed by Wapps Community. [BFF review routes][reviews-bff] retain
  `/application-reviews/:applicationId` and map opaque keys and responses to generic
  `/reviews` for slots, ratings, helpful votes, reports and staff hide/restore.
  Discovery/feed clients also use the generic contract. Dedicated owner routes are
  removed; both ingress configurations cross BFF.
- **Authority/work:** Canonical SQL review slots/versions, helpful membership,
  reports/decisions and receipts; deliberate synchronous variation, no Mongo
  materializer needed for review reads. V18 preserves SQL representations and
  historical fingerprints. Unit/HTTP checks exercise unfamiliar keys; real SQL/BFF
  checks cover the configured Wapps consumer, current authority, historical replay,
  immutable report evidence and rollback/retry. No new migration is needed.
- **Remaining/next (P0 before activation; BC23, BC27):** Qualify with real
  Authenticator/OPA/Editorial and full amended export/erasure journeys, then
  activate matching Community/BFF/ingress versions. Acceptance: the same denial,
  parent revocation, replay and immutable-evidence behavior holds with actual
  providers and deployed artifacts. New consumers supply authority/repository
  adapters; accepting arbitrary keys is not Wapps access authority.

### BC18 In-app notifications

- **Owner/contracts:** Account generic delivery/inbox engines with Wapps providers;
  [BFF member][member-bff] `/me/notifications`, `/mentions`, `/favorites` and read
  commands -> Account inbox APIs; owner `/internal/{reply-notifications,mention-notifications,favorite-updates}`.
- **Authority/work:** Canonical source intents/cursors, subscriptions, Account SQL
  inbox and delivered/suppressed receipts; bounded reply/mention/watch workers
  commit decisions before acknowledging source work. H13, H14 BFF and H16 store evidence.
  A26 qualifies actual workers against consolidated Discussion and current source
  authority through both gateway families: delivered/suppressed SQL receipts,
  acknowledgement replay, private read timestamps, pagination, process persistence,
  General/Mature/unclassified choices, disabled preferences and withdrawal. Removing
  and re-adding a favorite does not expose old-generation notifications or updates.
  Inactive recipients settle as suppressed; failures remain retryable.
- **Remaining/next (P1; BC19, BC21-22, BC27-28):** Qualify current quarantine/requeue
  operations, full export/erasure convergence and coordinated activation. The test
  re-exposes source rows after committed receipts and advances the disposable watch
  scheduler; it does not prove an abrupt process crash or production polling latency.

### BC19 Advertised channels and alerts

- **Owner/contracts:** Account notification preferences and delivery capability;
  original settings advertise email frequencies, push/critical-only and in-app
  system alerts. BFF persists preferences; no complete channel-subscription or
  delivery API/provider pipeline is evidenced. This is distinct from auth email in BC03.
- **Authority/work:** Preferences are canonical SQL; email schedule/subscription,
  push subscription, alert-source and delivery-receipt ownership is unfinished.
  [OP08][notifications-gate] and the original notification settings establish this
  gap; no real delivery qualification or deployment evidence exists.
- **Remaining/next (P1; BC07, BC18):** Define the existing advertised event/channel
  matrix and implement one email event, with provider choice recorded. Acceptance:
  an actual message arrives, unsubscribe/current permission changes suppress it,
  retries and provider failures are durable/observable, and duplicate delivery is
  controlled. Follow with daily/weekly frequency, push and system alerts. Deferral
  requires an explicit reduced-release decision; it is not full backend completion.

### BC20 HTTP application health

- **Owner/contracts:** Editorial health; BFF `/catalog/application-health/:slug` is
  implemented. Staff `GET /editorial/health-monitors/:applicationId` and
  `PUT /editorial/health-monitors/:applicationId/:id` now cross explicit BFF routes
  in both gateway configurations. [Editorial][health-owner] retains authorization,
  canonical target/origin checks, transactional configuration and revision receipts.
- **Authority/work:** SQL monitor configuration/history, leased schedule slots and
  observations; bounded HTTP worker, no broker/projection. [H13 evidence][health-evidence]
  substitutes public DNS/pinned transport with local endpoints. A23 reruns those
  safeguards and adds real OPA/SQL/BFF/gateway denial, immutable historical/concurrent
  replay, rollback/retry, uncertain-write recovery, erasure fences, withdrawal and
  process restart/outage. Authentication subrequests remain controlled fixtures;
  public reports show unknown until measured and omit disabled definitions.
- **Remaining/next (P1; BC23, BC27):** Qualify real public DNS/TLS/egress and staff
  credentials on the coordinated candidate before activating approved-origin HTTP
  checks. Probing remains disabled; no live deployment or frontend changes are included.
  HTTP checks only; no owner-written notices or inferred internal-service uptime.

### BC21 Account export

- **Owner/contracts:** Account coordinator; [BFF exports][exports-bff]
  `/me/exports` create/list/status/cancel/download -> Account, plus authenticated
  Editorial/Community `/internal/account-export` and credential provider capture.
- **Authority/work:** SQL jobs/leases, immutable private artifacts and exact provider
  receipts. Wapps fixed roster: `account`, `credentials`, `editorial`, `discussion`.
  H12/H14/H16 are historical; A27 qualifies the current independent-provider path.
- **A27 evidence:** Both native gateway configurations pass the independent real-provider
  journey: exact roster/receipts, historical payloads, input/stream bounds, concurrent
  and historical commands, private digest-checked downloads, isolation/current lifecycle,
  source and credential outages, cancellation, expiry and actual Account SIGKILL/restart.
  Fresh Account/Editorial/Discussion source and storage regressions pass larger histories,
  corruption, SQL snapshots/reconnect and receipt rejection. See the A27 checkpoint and
  `/tmp/wapps-a27-account-export-20261018/verification.json`.
- **Remaining/next (BC22, BC27-28):** A28 completes disposable full erasure and I28
  verifies export/erasure through Docker. External Firebase/SSO acceptance,
  maximum-size/load, browser/frontend acceptance, backup/restore and coordinated
  deployment remain separate. Plan changes still require durable-job migration,
  never a roster inferred from availability.

### BC22 Account erasure

- **Owner/contracts:** Account `DELETE /me` through BFF, durable coordinator to
  Editorial/Community `/internal/account-erasure` and credential cleanup through
  independent Authentication.
  Wapps participant roster is exactly `account`, `editorial`, `discussion`.
- **Authority/work:** Canonical lifecycle/write barriers, tombstones, participant
  leases/receipts, attribution cleanup, object inventory/retirement and projection
  confirmation. [H13 complete local journey][erasure-evidence] supersedes disabled-control
  and incomplete-participant history; H15-16 prerequisites have later bounded evidence.
- **A28 evidence:** The [amended journey](ACCOUNT-ERASURE-QUALIFICATION.md) uses
  independent local Authentication/Account processes and real owning services.
  Both gateway configurations cover combined pending/failed/completed status,
  private cleanup, anonymous retained publication/media, exact receipt rejection,
  SQL failure/retry, quarantine/requeue and actual coordinator crash recovery.
  Owned writer exits, frozen artifacts and inventory fingerprints precede cleanup.
  Supplemental Account, Discussion and Editorial regressions retain bounded-history,
  migration, concurrency and stale-projection/non-resurrection coverage.
- **Remaining/next (P0 activation; BC03, BC16, BC24, BC27-28):** Qualify external
  credential providers, production writer fencing and reviewed inventory, archived
  backup/object-version/log retention, restore/rollback and coordinated deployment.
  I28 closes the bounded combined Docker regression gap; original frontend
  acceptance remains open. Live installation stays A21; test fences do not authorize
  live flags.

### BC23 Authorization and privacy

- **Owner/contracts:** Every owning use-case boundary; BFF trusted-context adapters,
  Authenticator, canonical Account lifecycle and OPA/consumer authority ports.
  Internal service credentials never become browser authority; `/internal/*` is service-only.
- **Authority/work:** Owner SQL tenant/ownership/lifecycle and current parent access;
  transactions, immutable refs, receipts, outboxes and tombstones remain in owners.
  Historical denial/OPA/BFF tests and R18's controlled providers cover parts of this,
  not all real-provider/runtime trust boundaries. See [architecture rules][architecture-rules].
- **Remaining/next (P0; feeds BC03-04, BC16-17):** Build a route/actor denial matrix
  for one auth-to-owner journey. Acceptance: anonymous, wrong-user/tenant/key,
  explicit false policy, policy outage, forged ingress headers, revoked parent and
  projection lag cause zero unauthorized writes/reads. Preserve binary key semantics;
  no content-kind/version registry in Discussion. Catalog/Editorial legitimately own
  application-specific APIs; do not abstract every domain into a generic service.

### BC24 Migrations and materialization

- **Owner/contracts:** Editorial, Community/Discussion and Identity maintenance
  entrypoints, outbox pumps and workers; BFF exposes workflow outcomes, not maintenance
  authority. [Materialization contract][materialization] defines per-feature protocols.
- **Authority/work:** SQL and committed immutable references are authoritative;
  Mongo is disposable. Revisions, fenced leases, confirmed handoff, retained retries,
  rebuild and tombstones exist. E02 validates Discussion. O01 repairs H15's two
  obsolete Editorial qualifiers by sharing the complete production migration roster
  and migration table. Both now pass on disposable real stores: empty/upgrade/re-entry,
  interrupted DDL, incompatible/missing/invalid classification rejection, rollback,
  duplicate/reordered events, tombstones and projection-loss rebuild. Identity's
  delivered-events queue still lacks an alpha consumer.
- **Remaining/next (P0 before data cutover; BC23):** Qualify legacy
  identity mappings/import and define identity-event consumer/retention disposition.
  Pending binding/index/classification migrations need coordinated writer fencing.

### BC25 Readiness and observability

- **Owner/contracts:** Each runtime service/worker plus operators; `/health` and
  `/health/ready` are service contracts. Editorial and BFF now report dependency-aware
  `editorial-catalog` readiness; Registry remains static. Alpha probes largely check
  liveness; deployed probe/alert wiring remains unqualified.
- **Authority/work:** Dependency connectivity, migration compatibility, durable
  queue/job/backlog/lease state and observed convergence must drive readiness and alerts.
  Existing journal/requeue CLIs and logs are partial infrastructure, not alert qualification.
  O01 proves owner/SQL/Mongo/OPA/broker outages, physical schema incompatibility,
  missing/frozen materializer, SQL backlog/expired leases and retained poison, followed
  by recovery. Bounded read-only probes leave liveness independent; safe transition
  alerts include codes, aggregate counts and an [operator runbook](EDITORIAL-CATALOG-READINESS.md).
- **Remaining/next (P1; BC24):** Extend readiness to the other journeys/Registry and
  qualify deployed probes, scraper/alert delivery and longer observation windows.
  The bounded SQL sample and Mongo availability check do not prove complete historical
  projection integrity. O01 is not whole-product readiness or live alert activation.

### BC26 CI and build artifacts

- **Owner/contracts:** Workspace quality and image publishing workflows; operator
  commands in [readiness tooling][tooling], no BFF API or business-data worker.
  Authority is source/lockfile, declared outputs, test inventory and immutable image digest.
- **Evidence:** E03 full historical pass; E02 affected pass. [Alpha workflow][alpha-workflow]
  gates images and uses full SHA tags. Other deployment workflows still publish/use
  `latest`. Actual branch protection/current CI execution is U; warnings and historical
  dependency-audit findings need current triage, not reuse as a current vulnerability count.
- **Remaining/next (P1; implementation slices stabilized):** Run clean Node 22.17.1
  lockfile installation and complete declared test/lint/typecheck/build/artifact gates
  for a frozen candidate. Acceptance: no skips/empty/unowned tests, external suites
  separately reported, emitted packages/runtime dependencies valid, Linux images smoke
  tested, failed quality blocks publishing and chosen deployment uses immutable digests.
  Resolve optional scraper packaging only if that integration is included.

### BC27 Deployment and ingress

- **Owner/contracts:** Release/operator composition; [local][local-api] and
  [alpha][alpha-api] ingress plus media includes, service identities and BFF routes.
  Deployment manifests are intended routing, not evidence of active routing.
- **Authority/work:** Versioned config/images and ordered migrations over retained
  stores. E05 documents a backend alpha; E02 and V18 test both nginx configurations
  for Discussion and Reviews. The October 18-19 article slice aligns and qualifies
  article JSON, review, cover and public/private media families through both Docker
  gateways. Alpha still bypasses BFF for release and application-image workflows
  already integrated locally. A22 administration
  and A23 staff health routes cross BFF in both configurations, including case variants
  and unknown suffixes. A24 aligns private account/profile/photo/preferences and
  self-deletion acceptance, removes the broad direct `/me` fallback and records the
  [remaining routes and callers](BFF-ROUTE-PARITY.md). A25 aligns public profiles,
  follows, totals and badges, with real dependency qualification through both native
  Nginx configurations; O01 subsequently repairs and qualifies Docker transport. A26 aligns the
  complete favorites/inbox families with current classification and real delivery
  workers. A27 aligns the complete export family and verifies all four required
  providers, private downloads, cancellation and crash/retry through both native gateways.
  A28 qualifies complete erasure and combined status through both configurations,
  including independent credentials, fixed participant receipts and retained content.
  The suite lane aligns `/me/suites`, `/editorial/suite-reviews` and
  `/catalog/{suites,suite-selection}` through both native configurations.
  APP18 aligns the complete application-draft/review and ownership-claim/review
  families after local BFF qualification; both native configuration outage matrices pass.
  I28 reruns erasure/application/export/suite/profile/member workflows and complete
  local/alpha gateway transport against the combined source using Docker.
  Authentication aliases also
  cross BFF in both route sets; external-provider integration remains deferred.
  Both gateways still expose direct application-visibility and registration routes
  without a discovered current portal caller; disposition remains open.
- **Remaining/next (P0 activation; BC03-04, BC17, BC20, BC24, BC26):** Complete
  production transport, version/migration and activation qualification; export
  parity is A27 and disposable full-erasure convergence is A28.
  Acceptance: full path/case/slash/unknown-suffix behavior requires explicit BFF
  handlers, BFF outage cannot fall through to owners, internal routes are inaccessible,
  migration/version compatibility is recorded and observed image/config identities match.
  Activation is a separate action; this assessment does not deploy anything.

### BC28 Crash, restore and rollback

- **Owner/contracts:** Operators and every durable owner/worker; maintenance/status/
  inventory/rebuild commands and [Community activation runbook][community-readme],
  not a portal API. Coordinated SQL, immutable objects and retained job state form backups.
- **Evidence:** Several historical slices test process restart/reconnect; R18 only
  recreates Nest instances. No complete current process-crash matrix, backup restoration
  or compatible rollback rehearsal is evidenced. Earlier object-inventory isolation
  incident/recovery is historical, not a general restore qualification.
- **Remaining/next (P0 before real-data release; BC24, BC26-27):** Define recovery-time
  and acceptable-data-loss targets, then crash one Discussion command between SQL,
  object/outbox, broker confirm and projection acknowledgement. Acceptance: no lost
  committed write, duplicate visible effect or resurrection; reconcile without old
  projections/broker history. Follow with coordinated SQL/object restore and compatible
  all-service rollback; verify ownership, privacy, receipts and migrations before traffic.

### BC29 Load and soak

- **Owner/contracts:** Operators across catalog/BFF and writing services; test the
  actual public contracts and workers, not synthetic static health responses.
  Authority is measured reports tied to hardware, source, images, dataset and concurrency.
- **Evidence/status:** [Readiness targets][release-definition] are proposed, unmeasured:
  10,000 records; 20 reads/second; catalog p95 <500 ms; ordinary writes <1 s excluding
  external delivery; normal projection visibility <5 s; 24-hour mixed soak.
- **Remaining/next (P1 final gate; BC25-28):** Run a bounded catalog load baseline
  first. Acceptance: report latency distribution, throughput, errors and dependency
  utilization against those targets; follow with mixed writes, backlog convergence,
  broker/database restart and the soak. No performance or capacity pass is inferred
  from unit tests or previous local browsing.

### BC30 Content Node Registry

- **Role/contracts:** [Current module][registry-module] registers only health/platform
  controllers, empty ORM entities and `synchronize: true`; its README's registration/
  discovery prose is aspirational. There is no content CRUD/BFF workflow to qualify.
  Canonical product data already belongs to Editorial, Account and Community.
- **Authority/work/status:** No implemented content authority, outbox or materializer.
  Local Compose starts it and gates the gateway on its health; alpha Compose omits it.
  It is in the explicit [behavior coverage gaps][coverage-gaps]. Deployment/behavior U.
- **Disposition/next (P2; required before BC27 topology sign-off):** Treat it as a
  scaffold, **not a prerequisite for a generic Discussion registry or new product scope**.
  Resolve retain/exclude with a named architectural responsibility and consumer.
  Acceptance: either document exclusion from the released topology and remove its
  unnecessary startup dependency in a later slice, or specify a bounded required use
  case with owner/API/migration/readiness tests before relying on it. No speculative
  registry implementation is authorized by this checklist.

## Separate downstream and optional work

**FE01 - original frontend merge and visual acceptance:** blocked on the relevant
backend contracts, separate from backend completion delivered here. Preserve the
original composition/interactions at `c965790e...`, integrate through feature ports/
providers/mappers and BFF, and verify desktop/tablet/mobile, both themes, keyboard
and truthful loading/empty/failure behavior. Original metrics/actions still need
real backend support or an explicit product decision; current simplified screens
cannot silently redefine scope. No frontend files are changed by this assessment.

AI enrichment, external scraping and Discord are optional integrations. Their
credentials and workers must not be prerequisites for the core product. If enabled,
qualify their own retry/dead-letter/artifact/provider behavior separately. Discord
operator reports do not deliver customer notifications. Billing, new recommendation
algorithms, new providers and visual redesign are not added requirements.

## Recommended next bounded slices

The assigned A28, APP18 and O01 batch is complete within its documented bounds and
integrated as I28. Main's existing dirty backlog remains preserved, and `wappsA`
and `wappsB` are refreshed to the verified baseline. No further feature session or
deployment is started by the integration.

The next proposed batch can use the same three workspaces with separate fresh
installations and disposable resources:

1. **`wapps`: BC13/BC15/BC27 article publication, covers and comments.** Completed
   within the [article qualification bounds](ARTICLE-PARITY-QUALIFICATION.md):
   local first, then complete alpha article/cover families, independent sessions,
   frozen review/classification, current Discussion parent authority and real workers.
   Original frontend acceptance and live deployment remain separate.
2. **`wappsB`: BC14/BC11/BC27 release publication under current ownership.** Build
   on verified application/ownership behavior to qualify stable/prerelease history,
   independent review, revoked/released owners, replay, withdrawal and current saved-
   application delivery. Align alpha release routes only after the local journey passes.
3. **`wappsA`: BC28/BC24 operational reliability and bounded Discussion recovery.**
   First improve safe migration diagnostics and investigate the retained I28 startup
   failure under bounded repetition; its cause remains unestablished. Exercise one real
   Discussion command across SQL/object/outbox, broker-confirm and projection-acknowledgement
   crash windows, then rebuild disposable projections and verify no lost committed
   write, duplicate visible effect or resurrection. Full backup/restore and compatible
   rollback remain subsequent gates; do not activate live workers or change live stores.

These are proposals, not active assignments. Shared gateway/readiness/checklist edits
must be reconciled and the combined candidate verified after that batch. Remaining
original discovery filters/metadata, preference/channel consumers, real-provider
Discussion/Review journeys, broad readiness, archived-data policy, frontend acceptance,
coordinated deployment and load/soak retain their own acceptance criteria. Older
checkpoint "next" paragraphs do not override this index. No new provider roster,
generic content registry or presentation redesign is implied.

## Assessment verification

Performed on October 18, 2026 after the concurrent Discussion work completed:

- Refreshed the source baseline; compared 704 relevant `.ts`, `.cjs` and `.mjs`
  files in BFF, Community, Discussion, Account/consumer adapters and readiness tools
  with the retained qualification copy. No differences were found. This supports
  the bounded E02 attribution; it does not extend that run to unexecuted journeys.
- Checked all 30 stable IDs, status-record coverage and local Markdown links/anchors.
  `git diff --check` passes for the documentation changes.
- `npm run check:boundaries` with Node 22.17.1 passes: 141 projects, 1,804 production
  source files, zero boundary violations. This is a source audit, not authorization
  or runtime qualification.
- Only this checklist and top-of-file links in the two progress/readiness documents
  are changed by this assessment. No integration suite, frontend edit, commit,
  deployment, service restart or live-store mutation was performed.

[progress]: IMPLEMENTATION-PROGRESS.md
[readiness-json]: readiness/implementation-2026-10-11.json
[materialization]: MATERIALIZATION.md
[release-definition]: OPERATIONAL-READINESS.md#definition-of-fully-operational
[notifications-gate]: OPERATIONAL-READINESS.md#op08-deliver-notifications-and-enforce-saved-preferences
[discussion-evidence]: IMPLEMENTATION-PROGRESS.md#consolidated-discussion-resource-api-october-18-2026
[consumer-evidence]: IMPLEMENTATION-PROGRESS.md#consumer-boundaries-for-reviews-and-identity-october-16-2026
[discovery-evidence]: IMPLEMENTATION-PROGRESS.md#grouped-discover-workflow-october-13-2026
[tiles-evidence]: IMPLEMENTATION-PROGRESS.md#home-and-search-tile-correction-october-14-2026-frontend-not-accepted
[verification-evidence]: IMPLEMENTATION-PROGRESS.md#email-verification-checkpoint-october-12-2026
[profiles-evidence]: IMPLEMENTATION-PROGRESS.md#public-profiles-follows-and-badges-through-bff-october-14-2026
[classification-contract]: MATERIALIZATION.md#reviewed-content-classification
[suites-evidence]: IMPLEMENTATION-PROGRESS.md#private-suite-workspaces-through-bff-october-14-2026
[ownership-evidence]: IMPLEMENTATION-PROGRESS.md#application-ownership-through-bff-october-14-2026
[articles-evidence]: IMPLEMENTATION-PROGRESS.md#articles-and-covers-through-bff-october-15-2026
[releases-evidence]: IMPLEMENTATION-PROGRESS.md#release-authoring-and-publication-through-bff-october-15-2026
[health-evidence]: IMPLEMENTATION-PROGRESS.md#http-application-health-workflow-october-13-2026
[erasure-evidence]: IMPLEMENTATION-PROGRESS.md#account-erasure-workflow-october-13-2026
[bff-module]: ../apps/services/catalog-bff/src/app/app.module.ts
[catalog-src]: ../apps/services/catalog-bff/src/app/catalog/
[discovery-query]: ../libs/domains/discovery/src/application/public-discovery.ts
[editorial-catalog]: ../apps/services/editorial/src/app/http/editorial-catalog.controller.ts
[feed-src]: ../apps/services/catalog-bff/src/app/explore/
[auth-src]: ../sdk/features/identity/applications/authenticator/service/src/controllers/
[account-http]: ../sdk/features/identity/applications/management/service/src/app/controllers/
[account-bff]: ../apps/services/catalog-bff/src/app/account/
[profiles-bff]: ../apps/services/catalog-bff/src/app/profiles/
[preferences-bff]: ../apps/services/catalog-bff/src/app/preferences/
[member-bff]: ../apps/services/catalog-bff/src/app/member/
[suite-src]: ../apps/services/editorial/src/app/suites/
[suites-bff]: ../apps/services/catalog-bff/src/app/suites/
[suite-publication-bff]: ../apps/services/catalog-bff/src/app/suites/portal-suite-publication.controller.ts
[applications-bff]: ../apps/services/catalog-bff/src/app/applications/
[ownership-src]: ../apps/services/editorial/src/app/application-ownership/
[articles-bff]: ../apps/services/catalog-bff/src/app/articles/
[releases-bff]: ../apps/services/catalog-bff/src/app/releases/
[discussion-http]: ../sdk/features/discussion/packages/infrastructure/http/src/discussions.controller.ts
[community-readme]: ../apps/services/community/README.md
[reviews-bff]: ../apps/services/catalog-bff/src/app/reviews/
[reviews-owner]: ../sdk/features/review/packages/infrastructure/http/README.md
[health-owner]: ../apps/services/editorial/src/app/application-health/application-health.controller.ts
[exports-bff]: ../apps/services/catalog-bff/src/app/exports/
[architecture-rules]: ../rules/architecture-boundaries.md
[registry-module]: ../apps/services/content-node-registry/src/app/app.module.ts
[coverage-gaps]: ../tools/readiness/test-coverage-gaps.json
[tooling]: ../tools/readiness/README.md
[local-api]: ../deploy/local/nginx/api.conf
[alpha-api]: ../deploy/alpha/nginx/api.conf
[local-media]: ../deploy/local/nginx/application-media.conf
[alpha-media]: ../deploy/alpha/nginx/application-media.conf
[alpha-readme]: ../deploy/alpha/README.md
[alpha-workflow]: ../.github/workflows/alpha-release.workflow.yml
