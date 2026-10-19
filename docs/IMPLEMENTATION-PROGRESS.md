# Full operation implementation

**Current completion index (October 19, 2026):** use
[the backend and BFF checklist](BACKEND-COMPLETION-CHECKLIST.md) for the reconciled
backlog and separate implementation, BFF/ingress, real-dependency and deployment
status. Dated checkpoints below preserve their own source/evidence scope; older
"next" and "current slice" paragraphs do not override that checklist.

Branch: `codex/full-operation`, created October 11, 2026 from `c965790e`.
The assessment and existing recording-related working changes were carried
forward without reverting them. Historical evidence remains in
[the readiness assessment](OPERATIONAL-READINESS.md) and its dated JSON snapshot.

## Article publication, covers and current comment authority (October 18-19, 2026)

This slice starts from clean promoted I28 commit
`2c4a78797bb7bf4df2d3365c3490cd0a91a4fa7a`, with all 4,316 baseline file hashes
verified. It adds a seventh mutually exclusive local-auth extension, separate
article HTTP/service/workflow/cover/comment harness modules, and migrates only
alpha article JSON and cover/media families to `portal_bff`. Existing BFF and
owning-service contracts satisfy the new runtime checks without production
TypeScript or persistence changes. Application-image alpha parity remains separate.

The local journey passes before alpha is changed, then the two-gateway journey
passes 29 groups. Both use real independently enrolled credentials, canonical
Identity mapping, real OPA, fresh MySQL/Mongo/RabbitMQ/MinIO, compiled Editorial
and Community APIs, and both real materializers. Reviewer/tenant claims are
controlled operator setup followed by sign-in. SQL triggers inject atomicity
failures; observers read retained state. The primary journey never writes a
projection directly. Both runs retain O01's complete-gateway/include transport
stress, 1,600 authenticated requests and independent Account/BFF restart.

Coverage includes frozen text/classification/covers despite private edits,
self-review and owner/tenant/forged-context denial, concurrent revisions and key
conflicts, historical receipts, SQL/outbox rollback, cover type/hash/byte/size
bounds, partial-stream cancellation, protected previews, real objects, dependency
outages and restarts. Current canonical replacement/withdrawal overrides old
article and comment projections; generic Discussion rechecks parent authority,
retains redacted replies and restores the same association on republication.
The real worker converges to the retained revision-5 article tombstone. All 90
BFF-stopped case/slash/unknown/private/public-media requests fail without fallback.

Fresh Node 22.17.1 lockfile installation and required gates pass: 6,879 Jest tests
in 428 suites across 58 projects, 34 portable tests, 143 lint targets including
readiness tools, 140 uncached builds, 49 typechecks, 64 Angular package inspections,
144-project architecture tags and zero violations across 1,846 source files.
Builds finish before their `dist` is consumed by service qualification.

All six original extensions pass separately on the final runtime source: 25
profile, 25 member, 27 export, 31 erasure, 29 suite and 31 application groups.
Counts include overlapping baseline groups; every run retains O01's 1,600 reads.
The first member run stops before member-specific checks because the deliberately
stopped BFF returns a bounded two-second 504 instead of the Account matrix's exact
502 expectation. The unchanged rerun passes; both attempts remain recorded, and
the shared assertion and transport configuration are unchanged.

Evidence is retained under `/tmp/wapps-article-parity-20261018-ow5ug443/`, including
the baseline/final source hashes, task-only patch, commands, failed attempts and
cleanup. `verification.json` indexes the 4,322-file final source and exact 15-file
patch, including reproduction against a fresh baseline archive. Branch, HEAD,
index and lockfile are preserved; the isolated source matches the checkout.
The initial installation was immediately interrupted after a wrong working
directory was recognized (exit 130, empty log); tracked checkout/index remained
clean and required dependency resolution was checked before the isolated install.
The first three local runs retain harness failures: private lookup 404 versus an
expected 403, explicit unsupported-media 415 versus 400, and a Mongo head observer
using `discussionId` instead of `_id`. These correct the test's contract/observer;
they do not weaken authorization or change owner behavior. The successful rerun
retains strict statuses. A subsequent coverage review adds an actual MinIO-paused
upload and same-key recovery to the final two-gateway run.

Supplemental publication/covers/comments pass 9/17/9 real-store groups. The
publication suite's old `/review authority/` expectation failed against the current
independent-review attribution guard; its assertion now requires that exact error.
The combined article-comment/recovery invocation correctly refused to scan an
already populated object store. The separate comment run passes, and the dedicated
fresh-store materialization runner passes all four non-skipped Discussion,
Editorial SQL, Editorial projection and Catalog tests, including unknown opaque
consumer keys. Both failed attempts remain retained; neither production migrations
nor the isolation guard changes.

[The qualification contract](ARTICLE-PARITY-QUALIFICATION.md) maps original
frontend requirements and records supplemental setup and limits. No frontend,
lockfile, fixed provider plan, reusable SDK binding contract, live store, migration,
erasure fence or worker activation changes. Live installation remains A21. This
lane stays uncommitted and does not start another assignment; cross-lane integration,
production retention, original presentation acceptance and deployment remain open.

## Integrated erasure, applications and operational baseline (October 18, 2026)

I28 reconciles the completed A28, APP18 and O01 lanes against previous baseline
`908e60952cc4100dfcc6807978ff419a432c9dfc`. The combined source has 4,316 files and
49 task-delta files. Each lane's original source and evidence remain preserved;
`/tmp/wapps-integration-a28-20261018-l4s2868l/verification.json`, the final source
manifest and `snapshots.json` identify the combined source and local snapshot
`codex/integrated-a28-baseline`. Main retains its original HEAD/index and dirty
backlog. The two existing companion workspaces receive the verified baseline;
the unrelated navigation walkthrough in `wappsB` is preserved.

The shared harness retains six mutually exclusive extensions: profile, member,
export, erasure, suite and application. Conflict resolution keeps the A28 cleanup,
crash and 900-second timeout hooks, APP18 workflow/media fixtures and the complete
O01 Docker stress/restart check. Alpha application/ownership routes use the same
bounded `portal_bff` upstream as the other BFF routes. No provider roster, persisted
representation, dependency lockfile or frontend presentation changes are added by
the integration.

A fresh Node 22.17.1 lockfile installation passes 6,879 Jest tests / 428 suites
across 58 projects, 34 portable tests, full lint, 140 uncached builds, 49 typechecks,
separate BFF/Editorial spec checks, 64 Angular package inspections and zero boundary
violations across 144 projects / 1,846 production sources. Existing warnings,
85 projects without their own behavior specs and nine separately inventoried
external suites remain visible. All builds finish before runtime consumers start.

Separate disposable Docker runs pass 31 erasure, 31 application/ownership,
27 export, 29 suite, 25 profile and 25 member groups. Each invocation exercises
both complete gateway configurations and their API/auth include fixtures, with
1,600 bounded authenticated reads, invalid-token denial and independent Account/BFF
restart recovery: 9,600 repeated reads across the six selected runs. Shared baseline
groups overlap; the group counts are not unique-workflow totals. Operational
foundations separately passes both nested SQL/projection recovery tests and all
11 readiness fault/recovery groups. `WAPPS_NGINX_BINARY` is unset throughout.

One member attempt fails at fresh Editorial `--migrate` initialization after its
Docker transport group passes. The CLI reports only `Error`, so the cause is not
established. A fresh rerun with safe database error-code observation and a subsequent
uninstrumented full member confirmation both pass without source changes. The failed
attempt remains in `runtime-failed-attempts.json` as a qualification reliability risk.
The first erasure run also passes; it is repeated with `WAPPS_ERASURE_OUTPUT` to
retain detailed fence/artifact and inventory evidence beside the final log. The
initial Angular artifact command stalls after omitting the required Nx environment;
its log/exit remain, and the corrected command passes with all three Nx flags.
An intermediate merge-script anchor assertion fails before writing and is corrected
to the application workflow anchor. These attempts are retained in the evidence
index. Final source differs from the qualified source only in these documentation
records; the task patch reproduces the complete final manifest.

This closes the bounded integration and Docker regression gaps. Controlled DNS,
trusted source setup/direct Editorial projection, seeded notification history and
retry-clock fault injections retain their lane-specific limits. Application
participant cleanup and full Account erasure are separate invocations. Readiness
covers only `editorial-catalog`; production writer fencing/inventories, archived
backup/object-version/log policy, broader readiness, restore/rollback/load/soak and
original frontend acceptance remain open. Live installation remains A21. No push,
deployment, live migration or live-worker enablement is included. The checklist
proposes the next bounded batch; no new feature session starts automatically.

## A28 full account erasure (October 18, 2026)

The [amended erasure qualification](ACCOUNT-ERASURE-QUALIFICATION.md) starts from
integrated snapshot `908e60952cc4100dfcc6807978ff419a432c9dfc` in a fresh
unchanged-lockfile installation. It adapts the legacy Account/Discussion/completion
checks to independent local Authentication, canonical provider mappings, current
BFF Review routes and fresh owning-service stores. The fixed three-participant
erasure plan and separate credential journal are unchanged. Changes are confined
to readiness tools and A28 documentation; no production schema, service behavior,
frontend presentation or live activation changes are introduced.

Both native gateway configurations exercise self-deletion, staff combined status,
denial/no-fallback behavior, credential outage, participant/inventory gates,
private state and archive removal, anonymous retained contributions and media,
SQL receipt failure, quarantine/requeue and actual Account process-crash recovery.
Owned writers/materializers are stopped and awaited before fence activation;
artifact hashes and inventory plans/fingerprints are retained. Independent
Account, Discussion and Editorial erasure regressions cover large histories,
concurrency, migration reentry, all 36 Editorial attribution checks and stale
projections. The full erasure invocation passes 29 groups, the A27 export
regression passes 25, and supplemental Account cleanup/coordinator, Discussion
and Editorial runs pass 2/5/14/11 groups respectively. Baseline groups overlap
between invocations; these are not distinct-workflow totals.

The isolated gate passes 6,869 Jest tests / 426 suites, 34 portable tests, full
lint, 140 uncached builds, 49 typechecks, 64 Angular package inspections and
zero boundary violations across 144 projects / 1,842 production sources. The
readiness-tool lint is repeated after harness corrections. Existing warnings,
85 behavior gaps and eight separately qualified external suites remain explicit.
`/tmp/wapps-a28-account-erasure-20261018/verification.json` indexes exact commands,
results, source manifests, task-only patch, process/container cleanup and limits.
Failed sandbox/fixture attempts and the corrected successful runs are retained.

Native Nginx 1.28.3 does not qualify Docker-to-host transport. Editorial fixture
publication/direct projection, seeded notification receipts, retry-clock changes
and malformed-source transports are explicit substitutions. Production worker
fencing, approved inventory, external providers, archived backups/object versions/
logs, restore/rollback/load/soak and original frontend acceptance remain release
work. Live installation stays A21. Main's branch, HEAD, index and dirty backlog
are preserved; no commit, push, deployment or live migration is performed.

## Application publication and ownership parity (October 18, 2026)

APP18 completes the bounded BC10/BC11/BC27 lane in `wappsB`, measured against
combined baseline `908e60952cc4100dfcc6807978ff419a432c9dfc` and the integrated
4,298-file manifest. The accepted presentation stays `c965790e...`; no frontend,
dependency lockfile, stored representation or provider roster changes. The preserved
untracked navigation walkthrough is excluded from the task patch. A28 in `wapps`
and operational foundations in `wappsA` retain their separate assignments/status.

The existing explicit application BFF, domain authorization and durable owner
implementations pass the new real-session qualifier. After its local-only preflight,
alpha's direct Editorial alternatives are removed for the complete
`/me/application-drafts`, `/editorial/application-reviews`, `/me/ownership-claims`
and `/editorial/ownership-reviews` families. Matching case-insensitive rules retain
64 KiB bodies, bounded timeouts and disabled upstream retry. Local/alpha case/slash/
unknown-suffix and mutation matrices fail with BFF stopped and no direct fallback.

`WAPPS_APPLICATION_PARITY_INTEGRATION=1` runs as a separate extension of the
fresh-store local-auth harness. It uses independent local credential sessions,
canonical Identity/Account, real Editorial OPA, isolated SQL/Mongo/MinIO/RabbitMQ,
the compiled Editorial API and its broker materializer. Twenty-nine groups pass
(19 shared authentication/settings and ten application/ownership groups). They prove:

- Frozen draft submission/classification, independent content review, canonical
  update and withdrawal; foreign-owner/tenant/spoofed-context/self-review denial,
  revision/key conflicts, concurrent exact receipts and independent sessions.
- Publication/grant outbox rollback, real broker projection lag and recovery,
  object/projection/owner/policy outages, exact receipts across process restart and
  old-event redelivery after withdrawal without resurrection.
- Production DNS resolver against the shared controlled UDP fixture, negative/rate-
  limited proof, cancel, unavailable proof and original-key lease recovery after
  Editorial SIGKILL/restart. Only the disposable failed lease is advanced.
- Proof grants no editing authority. Dedicated independent ownership review is
  separate from content review; verified owners still submit frozen public updates.
  Canonical revoke/release immediately deny source/open/rebase/submit/withdraw while
  Mongo lags. Old receipts and reapproval never revive old claim-bound drafts.
- Former-author and grant-bound private removal preserve the transferred public
  record. A minimal real PNG/WebP/MinIO round trip preserves frozen review media,
  owner-only previews, immutable receipts and retained referenced content.
- Existing Editorial erasure hooks drain private ownership/draft/audit provenance
  after canonical self-deletion, retaining anonymous approved content/media and the
  permanent ownership-history fence. An independently approved successor receives
  canonical content without old grants or erased private history, then withdraws it.

The erasure test stops its own materializer before enabling its disposable
participant fence. It is compatibility evidence for A28, not full Account erasure
completion, credential-cleanup convergence, deployment fencing or archived-data
disposition. Export's fixed four-provider roster and erasure's three participants
plus independent credentials are untouched. Application-specific owner APIs and
existing unbound-draft deletion behavior remain unchanged.

Qualification uses a fresh `npm ci` copy, Node 22.17.1 and
`NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true`. All builds finish before
runtime consumers start. The full gate passes 6,869 Jest tests / 426 suites across
58 projects, 34 portable tests, full lint, 140 uncached builds, 49 typechecks,
separate BFF/Editorial spec checks, 64 Angular artifact inspections and the boundary
audit (144 projects, 1,842 production sources, zero violations). Existing warnings,
85 behavior-gap projects and eight separately gated external suites remain explicit.
Separate fresh-store regressions pass 20 ownership/verified-authoring/HTTP groups
and 11 publication/broker groups. They add competing claims/reviewers/drafts,
stale DNS completion, explicit rebase, SQL reconnect, migration reentry/corrupt
history rejection, lost acknowledgement, projection rebuild and event reordering.
Those regressions use trusted setup actors/direct projection where documented;
the 29-group gateway run supplies the real-session evidence.

Evidence is in `/tmp/wappsB-application-ownership-20261018-5_ffh246/`:
`verification.json`, baseline/final source hashes, qualification hashes, all logs,
failed attempts, exact task-only file list/patch and patch reproduction. The first
runtime attempt used conflict notes below the domain minimum; valid changed notes
correctly exercise 409. Restricted-network installation and an Angular inspection
missing Nx settings were interrupted and rerun with the required access/environment.
The publication regression's old `/reviewer/` assertion was also corrected to the
specific current missing-erasure-timestamp and independent-attribution errors;
the migration guard correctly rejected both corrupt rows before and after the fix.
Their logs remain preserved. Only task-owned resources are cleaned up.

Native Nginx 1.28.3 compares both checked-in API/auth configurations; it does not
resolve Docker-to-host transport. The complete gateway startup probe still uses
Docker. Controlled DNS substitutes external authoritative propagation. Local media
is included for the necessary publication round trip; alpha's independent media
families, articles/releases and broad media remain outside this slice. No public
DNS/TLS, external credential provider, browser/presentation acceptance, backup/
restore/load/soak or deployment claim. Live installation remains A21; no live store,
worker, migration, installation, commit, push or cross-workspace merge is performed.

Shared-file integration points are `deploy/alpha/nginx/api.conf`, the additive
local-auth extension/media fixture selection, the existing ownership qualifier's
shared DNS extraction, the publication qualifier's stale error assertion,
readiness README and the three checklist/parity/progress
documents. Integrate only this lane's patch against the combined baseline; retain
all integrated checkpoints and other lanes' status. This lane stops here.

## O01 operational transport, migration recovery and scoped readiness (October 18, 2026)

This bounded BC24/BC25/BC27 slice stays in `wappsA` on
`codex/discovery-feed-parity`, based on integrated snapshot
`908e60952cc4100dfcc6807978ff419a432c9dfc`. Its task-only patch, final source
manifest, command/result index and retained failures are in
`/tmp/wappsA-ops-foundations-20261018-ds3gld4i/verification.json` and sibling files.
No commits, cross-workspace integration, live deployment/migration/worker changes,
dependency lockfile changes or frontend changes are part of this slice. The
accepted presentation remains `c965790e063139bcd5e6bacc759f289703e4ea9a`.

A minimal Docker Nginx/host HTTP reproduction fails while connecting the auth
subrequest after 1,583 requests and 3,166 short-lived upstream connections. The
same 10,000-request probe passes with HTTP/1.1 upstream reuse and 20 connections.
This isolates per-request connection churn as the reproducible trigger in this
Docker Desktop environment; it does not establish a universal kernel/network
root cause. Local and alpha now share equivalent checked-in auth/BFF pools with
32 idle connections per worker, a three-second idle lifetime and 1,000 requests
per connection. Auth subrequests have explicit connection/read/send deadlines
and no upstream retry. Existing identity-header replacement and route ownership
are preserved.

The local-auth qualifier now starts both complete Docker gateway configurations
as well as both API/auth include configurations. Each run adds 1,600 bounded
authenticated reads, invalid-token denial and independent Account/BFF restart
recovery without request retries or pacing. Baseline, profile, member, export and
suite runs are separate (21 / 25 / 25 / 27 / 29 passing groups respectively);
their shared baseline groups overlap. Both local and
alpha use Docker Nginx for these runs, including the previously native-only
profile/member/export/suite workflows. All extension callbacks and their mutual
exclusion remain in place. The complete alpha fixture substitutes absent unrelated
domains with an unavailable test endpoint; the local complete gateway retains
runtime DNS failure for missing domains. API fixtures retain accelerated rate
limits and the existing controlled alternate-authentication scenario.

Editorial API, maintenance and the two historical recovery qualifiers now share
one ordered 27-migration roster and the `editorial_migrations` receipt table.
Both qualifiers pass on fresh disposable real stores. Evidence covers an empty
installation, pre-classification upgrade, interrupted additive DDL, re-entry,
incompatible/missing/invalid classification refusal, non-destructive migration
rollback, transactional write/backfill rollback, concurrent replay, retained
tombstones, duplicate/reordered events, confirmed dead-letter transfer and rebuild
after projection loss. The historical SQL adapter qualifier retains its explicit
allowing policy fixture; the new HTTP readiness journey uses real OPA.

Editorial and BFF expose dependency-aware `/api/health/ready` for the explicit
`editorial-catalog` scope. Liveness stays independent. Read-only bounded probes
distinguish owner, SQL, schema (including malformed classification and authoritative
revision types despite retained migration receipts), Mongo, policy and broker failures; absent and frozen
materializers; retained poison; and SQL backlog/expired leases. BFF consumes only
the safe owner contract. Transition alerts carry fixed codes, aggregate counts
and the [operator runbook](EDITORIAL-CATALOG-READINESS.md), with recovery events.
The disposable runtime proves concurrent bounded failure responses, real catalog
materialization, independent process restart and restoration after each fault.

Qualification uses a fresh own `npm ci`, Node 22.17.1,
`NX_DAEMON=false NX_ISOLATE_PLUGINS=false`, and completed uncached builds before
runtime consumes `dist`. Gates pass: 6,879 Jest tests / 428 suites across 58
projects, 34 portable checks, full production/tool lint, 140 builds, 49 declared
typechecks, separate BFF spec typechecking, 64 Angular package inspections and
zero architecture violations across 144 projects / 1,846 production sources.
Final readiness refinements have separate affected build/test/typecheck and
runtime evidence. Existing lint/build warnings remain visible in the logs.

Retained non-qualifying attempts include the deliberate minimal transport failure,
the initial sandboxed unit run (`listen EPERM`, resolved by enabling localhost
listeners for the full rerun), and an initial runtime wrapper that inherited
Node's test context and emitted no nested qualifier results. The wrapper now
clears that context and rejects empty/skipped/non-passing TAP results; both
historical qualifiers have explicit passing reruns. Earlier native comparisons
and nine Docker failures remain historical evidence, not current passing results.

Registry/other-journey readiness, deployed probe and alert delivery, whole-history
projection integrity, identity-event consumer/retention disposition, general
crash/backup/restore, load/soak, external identity providers and original frontend
acceptance remain open. Bounded SQL counts are lower bounds; Mongo availability
is not a full reconciliation. No current live installation or alpha rollout is
claimed. Other lanes' A28 erasure and application publication/ownership work is
outside this task delta.

## Integrated export, suites and discovery baseline (October 18, 2026)

The three A26 parallel lanes are integrated into the preserved `wapps` source:
A27 account export, suite lifecycle/publication and discovery article all-tags
filtering. The combined baseline is recorded by local snapshot branch
`codex/integrated-a27-baseline` and the 4,298-file final manifest in
`/tmp/wapps-integration-20261018-a7_k2sw8/`. `verification.json` indexes commands,
results, source hashes and limitations; `snapshots.json` identifies the exact local
commits and `workspace-refresh.json` records the subsequent workspace refresh.
The original main HEAD/index and dirty backlog are preserved. Individual lane
source copies/manifests remain available, including the unrelated `wappsB`
navigation walkthrough. The accepted frontend reference remains `c965790e...`.

Task-only three-way integration uses the preserved A26 source manifest, rather
than treating main's untracked backlog as deletions. Shared documentation retains
all three checkpoints. Alpha includes both export and suite BFF families. The
local-auth harness retains both extensions and all A27 crash/authentication
callbacks, and rejects simultaneous profile/member/export/suite extensions.
No dependency lockfile, provider roster or presentation changes are introduced
by integration. The suite lane's temporary service error interrupted only its
final report; the coordinator recovered its logs/manifests and verified matching
qualification source before merging.

Combined qualification uses a new source copy and fresh `npm ci`, Node 22.17.1,
`NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true`. All gates pass:

- 6,869 Jest tests / 426 suites across 58 projects and 34 portable readiness tests,
  with no skips/todos; 85 behavior-gap projects and eight external suites remain
  separately identified, not counted as tested behavior.
- Full production/tool lint, 140 uncached builds, 49 typechecks, separate BFF and
  Editorial spec typechecks, all 64 Angular package inspections and the boundary
  audit: 144 projects, 1,842 production sources, zero violations. Existing lint
  warnings remain recorded debt.
- Separate runtime invocations against the same completed builds: 25 export,
  27 suite, six discovery-tag and 23 member/favorites/inbox groups. Each run owns
  fresh isolated dependencies and completes its required resource cleanup. The
  shared baseline groups overlap; these counts are not distinct workflow totals.

Native Nginx qualifies both checked-in API/auth configurations for export, suites
and member regressions; the unrelated complete-gateway startup check still uses
Docker. Discovery uses compiled BFF/Editorial with real MySQL/Mongo/OPA and trusted
setup claims/direct projection. These substitutions do not resolve Docker-to-host
transport, full account erasure, external providers, original frontend/browser
acceptance, archived-data retention, backup/restore, load/soak or deployment. Live
installation remains A21. No live stores or workers are changed.

After this gate, the user-authorized next parallel assignments are A28 full account
erasure in `wapps`, application publication/ownership in `wappsB`, and Docker
transport, migration qualifiers and dependency-aware readiness in `wappsA`.
All start from this combined source manifest; their implementation and completion
need new evidence. Subsequent integration must preserve each lane's task delta.

## Account export gateway parity (October 18, 2026)

A27 completes the bounded BC21/BC27 export slice in the preserved `wapps` working
copy on `codex/full-operation`, without switching, staging or committing its
backlog. Task deltas are measured against A26 snapshot
`3d54604d8b4f85f1fed826601f76948885b78f0c` and its 4,290-file source manifest,
not against the branch's older HEAD `95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`.
The accepted presentation reference remains `c965790e...`; no frontend files,
dependency lockfile, stored representation or provider roster changes.

Alpha's `/api/me/exports/*` direct Account bypass is removed. Both checked-in
API/auth configurations require explicit BFF request/latest/status/cancel/download
handlers for canonical, case/slash and unknown-suffix paths. The family has bounded
64 KiB requests/timeouts and no upstream retry. Download routes disable buffering,
caching, temporary-file spooling and recompression. BFF preserves private/no-store
attachment headers and validates declared length/digest while retaining the final
chunk until validation. Account retains current authorization, canonical jobs,
immutable chunks, exact command receipts, leases, cancellation and retention.
The durable plan remains exactly `account`, `credentials`, `editorial`, `discussion`.

The new `WAPPS_EXPORT_PARITY_INTEGRATION=1` extension runs with independent
Authentication, Account, BFF, Editorial and Community processes plus fresh
MySQL/RabbitMQ/Mongo/MinIO and real OPA. Both local and alpha configurations use
explicit native Nginx 1.28.3. `export-runtime-attempt4.log` passes all 25 groups
(19 shared authentication/settings groups and six export groups) in about 87 seconds.
They prove nonempty exact-provider capture, current and historical private payloads,
issuer/subject isolation, safe credential allowlists, independent sessions,
concurrent/replayed commands, conflicts, request/stream bounds, private attachment
integrity, foreign-account and suspended-account denial, corruption rejection,
all route families during BFF shutdown, owner/source/credential/policy failures,
retry after recovery, cancellation and expiry purge. An actual Account SIGKILL
while Editorial capture is blocked leaves a durable lease; restart produces a
complete second-attempt archive. In-flight cancellation cannot resurrect chunks.
Malformed missing/foreign/duplicate/oversized source streams fail without a ready
artifact, and durable SQL completion separately rejects invalid provider receipts.

Fresh-store regressions additionally pass:

- Account source/storage: 140-item canonical history, snapshot edits, exact owner/case,
  reconnect, avatar integrity, missing/corrupt chunks, concurrent claims, immutable
  writes, rollback, expiry/cancellation/erasure during downloads and completion bounds.
- Discussion source: 134 contributions, 135 registered payload versions and 131 review
  versions, consistent snapshots, relationships/tombstones, foreign-data exclusion,
  reconnect/cancel and invalid structure/object history. Registered uncommitted,
  lost-confirmation, absent, corrupt, retiring and retired payload cases also pass.
- Editorial source: 140 retained submissions across content families, exact ownership,
  historical media, snapshot/cancel/reconnect, corruption/retirement and compiled
  internal HTTP with real OPA, including mixed-credential and policy-outage denial.

Qualification uses a new task-owned `npm ci` installation, Node 22.17.1, the
unchanged lockfile, `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`, and uncached builds
completed before runtime tests. `npm test` passes 6,842 Jest tests / 424 suites
across 58 projects and 34 portable tests; 85 behavior gaps and eight external suites
remain separately reported. Full lint, all 140 builds and 49 typechecks, the separate
BFF spec typecheck, all 64 Angular artifact inspections and boundaries (144 projects,
1,842 production sources, zero violations) pass. Final readiness lint covers the
changed harnesses. All exact logs, manifests and the task-only patch are in
`/tmp/wapps-a27-account-export-20261018/`; `verification.json` is the evidence index.

Failures are retained. The first runtime lacked the required Discussion writer
role; fixture claims now use the real local credential provider. Attempt 2 expected
503 for authentication outage, but Nginx correctly denies an unavailable auth
subrequest as 500. Attempt 3 used an asynchronous assertion on synchronous receipt
validation; the corrected callback preserves the rejected-input assertion. The
storage fixture omitted credential-binding/legacy-import migrations; adding them
restored the current source/storage regression. The older Compose probe now compares
credential subjects to exported verified bindings rather than application IDs, and
its cleanup message distinguishes deletion acceptance from erasure completion.

Substitutions remain explicit: native gateway runs do not resolve A25/A26 Docker-to-
host stalls; the full local gateway startup check still uses Docker. Editorial
content setup uses canonical fixture claims/direct production projection, while
Discussion commands use real authenticated BFF. Negative source streams are loopback
fault probes; credential-outage work is submitted directly to the durable store
because ingress is unavailable. Only disposable lease/expiry timestamps are advanced.
Source regressions use fixture authority and the storage regression uses fixture
records. One-GiB load, external Firebase/SSO, original frontend/browser acceptance,
backup/restore and coordinated deployment are not qualified. Live remains A21.

A28 is the next privacy slice. Editorial/Discussion cleanup must remain pending
until reviewed inventories and old-writer/materializer fencing are established;
this export fixture deliberately leaves both erasure fence settings false. Qualify
private SQL/audit/payload cleanup, retained-public authorship anonymization and
referenced-media survival, projection confirmation, exact `account`, `editorial`,
`discussion` receipts, independent credential cleanup, interruption/retry and
non-resurrection. The legacy combined Firebase/browser/erasure harness still assumes
pre-A20 Account credential composition and provider subject equals account ID; it
needs independent Authentication wiring and subject-aware assertions before its
full A28 rerun. It is not evidence for current erasure. Archived backups, old object
versions and logs retain a separate retention/disposition gate. No erasure policy,
live worker, store, migration or deployment is changed by A27.

Shared integration points are `deploy/alpha/nginx/api.conf`, the local-auth and
qualification-process helpers, readiness README and the three checklist/parity/
progress documents. Reconcile only A27 hunks with the parallel suites/publication
and discovery/feed lanes; do not import the pre-existing backlog as this task's work.

## Discovery article tag parity (October 18, 2026)

The bounded discovery lane on `codex/discovery-feed-parity` starts from preserved
A26 snapshot `3d54604d8b4f85f1fed826601f76948885b78f0c`. The accepted presentation
reference remains `c965790e063139bcd5e6bacc759f289703e4ea9a`; no component, template,
stylesheet or product action changes. The [contract inventory](DISCOVERY-FEED-CONTRACT-INVENTORY.md)
maps original filters, legacy URLs, cards and overview fields to current owners,
separating implemented behavior, missing composition and undecided metrics/taxonomy.

Article multi-tag filtering now follows the original all-tags semantics. The
Article owner accepts optional bounded `tags`, preserving legacy `tag`; canonical
SQL applies every selected tag to count and page queries before pagination.
Approved publication tags choose eligibility, with unchanged tenant/lifecycle,
exact-revision projection and post-I/O current-authority checks. Discovery maps
the complete tag set through its explicit BFF contract. Both BFF article clients
and the article feature adapter serialize and validate every selected tag. No
schema, stored payload, receipt, outbox, generic capability key, provider roster,
bootstrap or gateway configuration changes.

Verification in `/tmp/wappsA-discovery-parity-20261018-vqcziq5l/` uses its own fresh
lockfile installation, Node 22.17.1, `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`:

- Full `npm test`: 6,860 Jest tests / 425 suites across 58 projects and 34 portable
  readiness tests pass. The 85 behavior gaps and eight separately gated external
  suites remain explicit. Final additional anonymous/member tag-route tests and
  owner authority regression pass in the focused 808-test Editorial and
  2,007-test BFF rerun; these overlap the full gate and are not additive totals.
- Full lint, all 140 uncached builds and 49 typechecks, and the boundary audit
  (144 projects, 1,842 production files, zero violations) pass. Final separate
  owner/BFF spec typechecks and all 64 emitted Angular packages pass;
  `verification.json` records the commands. Existing lint warnings remain debt.
- `qualify-suites.cjs --discovery-tags --no-browser` passes six groups with fresh
  randomly named MySQL/Mongo/OPA containers and compiled Editorial/BFF processes.
  It verifies all-tags totals/pages, duplicate/legacy selectors, bounds/errors,
  empty results, private edits/drafts and other-tenant exclusion, classification,
  missing projections, current withdrawal before materialization, old-snapshot
  replay, process restarts and unavailable dependencies. Builds finish before
  runtime starts; no other checkout or retained qualification install is used.

Trusted author/reviewer identity claims and direct production materializer calls
are explicit substitutions. Current-choice classification checks use the production
selector with real source results and fixture preferences; Angular service tests
cover preference reload/session fencing. Real Account preference persistence,
browser/accepted-presentation fidelity, broker delivery, authenticated gateway
transport, abrupt crash/restore and deployment are not qualified by this slice.
A25/A26 Docker-to-host Nginx stalls remain unresolved; this run uses neither
native nor container Nginx. Existing A26 behavior is retained without claiming
its BFF preference filtering also applies to Discover.

Initial failures are retained: the sandbox install stalled before dependency
resolution and was stopped; a network-authorized clean install passed. The first
targeted run exposed the new `tags` key missing from the explicit article BFF
allowlist, fixed with positive/negative route coverage. A final spec typecheck
found an optional test URL, corrected without changing behavior. The first
artifact-inspection invocation omitted the required Nx flags and stalled
in daemon setup; it was stopped and rerun with both flags disabled. The final source
manifest/diff and exact commands/results are in the evidence directory. There is
no commit, push, merge, deployment, live migration or worker enablement.

Remaining BC01/BC02 work includes mixed-kind taxonomy, multi-category articles,
suite taxonomy/legacy slugs, social-reference publication, estimate provenance,
broader search fields, author/badge/comment composition, general feed votes,
top-author/views and full timeline history. This lane shares only the article
query/client contract and the `qualify-suites.cjs` entry hook with potential future
publication work; checklist/progress documentation needs reconciliation with the
parallel account and suite lanes. See the inventory and final manifest for exact files.

## Suite lifecycle and publication parity (October 18, 2026)

The bounded suite lane runs in `wappsB` on `codex/suites-publication-parity`, based
on preserved A26 snapshot `3d54604d8b4f85f1fed826601f76948885b78f0c`. Evidence is
`/tmp/wappsB-suites-publication-20261018-9gw_04jl/`; `verification.json`, the
baseline/final source hashes and `task-only.patch` identify the uncommitted delta.
No other lane's checkout/install/stores are used. The user-owned navigation
walkthrough is preserved. The accepted presentation reference remains
`c965790e063139bcd5e6bacc759f289703e4ea9a`; runtime frontend files are unchanged.

Private suite deletion previously withdrew and deleted the independently approved
publication. It now scrubs the private workspace/submission history while retaining
the approved snapshot and its public revision. The owner can read publication
status and explicitly withdraw the retained snapshot using the current tombstone
revision. Removed drafts cannot be edited, submitted or newly reviewed. Withdrawal
preserves tombstone timestamp consistency and commits public revision/outbox changes
atomically. Historical command receipts retain their representation and cannot
reapply mutations. Historical deleted suites without a retained snapshot keep
their former 404 behavior; the new path cannot restore old deleted publications.
No schema, provider roster or opaque-key representation changes
are introduced. Alpha's suite alternatives are removed from direct Editorial routes;
all suite families use the existing explicit BFF contract in both configurations.

The new `WAPPS_SUITE_PARITY_INTEGRATION=1` local-auth extension runs real
Authentication, Account, Editorial and BFF processes with canonical enrolled
identities, independent credential sessions, real reviewer claims, OPA and disposable
MySQL/Mongo/RabbitMQ. Application prerequisites and all suite authoring/review
commands cross the local BFF. Public suite projections use the compiled Editorial
broker materializer, with no manual snapshot/projector substitution. Twenty-seven
combined groups pass, including eight suite groups and nineteen shared baseline
groups. Coverage includes foreign owner/tenant and self-review denial, ordered
membership, unavailable members, exact/concurrent replay and revision/key conflicts,
frozen classification, rejection/resubmission, approval/deletion rollback, projection
lag, process restart, broker duplicate delivery, independent private removal,
withdrawal and full route-family BFF-outage denial in both gateways.

The existing Editorial export endpoint produces a complete bounded source stream
containing owner-private suites and independent approved content after private
removal. Canonical Account self-deletion reports accepted/pending and denies the
old session. The disposable Editorial participant is then explicitly fenced and
driven to completion: private owner/reviewer provenance drains, exact receipts
survive restart, and anonymous approved content remains available at the next
publication revision. This is suite-only participant evidence. The full Account
archive/export delivery and fixed cross-service erasure roster still depend on
the parallel A27/A28 work; no successful full privacy completion is inferred.

Verification uses a newly copied 4,290-file A26 source tree and a fresh unchanged-
lockfile `npm ci` in `/tmp/wappsB-suite-qualification-lzgxhvlo`, Node 22.17.1,
`NX_DAEMON=false NX_ISOLATE_PLUGINS=false`. All builds finish before runtime tests:

- `npm test`: 6,849 Jest tests / 425 suites across 58 projects, plus 34 portable
  tests, with no skips/todos. The 85 behavior-gap projects and eight separately
  gated external suites remain explicit.
- Full production/tool lint and `npm run check:boundaries` pass, with 144 projects,
  1,842 production sources and zero boundary violations. Existing warnings remain.
- Uncached full build/typecheck passes 140 builds and 49 typechecks; all 64 Angular
  packages pass artifact inspection. The added Editorial spec and BFF specs also
  pass explicit typechecks.
- Both deployed policy mergers pass strict OPA checks and 288/288 policy cases each
  using the lane's checksum-verified OPA 1.4.2 binary.
- `suite-runtime-compatible.log` records the final 27 combined groups, including
  the historical deletion compatibility guard.
  `suite-store-regression-configured.log` adds 19 owning-store/migration/delivery/
  favorites groups plus the existing favorites HTTP journey, including 131-row
  snapshot migration interruption/reentry, rebuild and old-event suppression.

The historical store/favorites regression uses trusted ingress fixtures and explicit
test-only Account authentication settings with an unavailable authentication origin;
it does not qualify Authentication. Real credentials are covered by the new suite
extension. The native gateway run uses both checked-in API/auth configurations with
temporary paths/addresses and excludes unrelated media includes. The complete
gateway startup check still uses Docker. Re-exposing an acknowledged outbox row is
a declared replay fault injection, not a crash. Another explicit SQL fixture
removes an already-withdrawn suite snapshot to reproduce historical private
deletion, qualifying its 404 behavior and receipt non-resurrection. A25/A26 container-to-host transport
stalls remain unresolved and no native run is counted as container qualification.

Failed attempts are retained: an interrupted restricted install, an unavailable
historical OPA executable, missing historical Account authentication configuration,
and harness expectations for application-selection cache headers, generic unknown-
route 404 headers, Mongo reconnection delay and the erasure revision advance.
Corrections preserve the production contracts rather than weakening them.

This lane changes suite-specific Editorial code/tests, suite qualification tools,
the alpha suite locations and documentation. Shared integration points are
`deploy/alpha/nginx/api.conf`, `tools/readiness/local-auth.test.cjs`,
`tools/readiness/README.md`, `apps/services/catalog-bff/README.md`, and the three
checklist/parity/progress documents. Reconcile those explicitly with the other
lanes; no automatic merge, commit, push, live migration, worker enablement or
deployment was performed. BC09/BC12 source and bounded native-gateway behavior
are qualified; full privacy, archived-data privacy, deployed routing, crash/restore,
container transport and original frontend acceptance remain open.

## Favorites and inbox gateway parity (October 18, 2026)

A26 completes the approved bounded favorites/inbox slice on `codex/full-operation`,
base HEAD `95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, preserving the existing dirty
tree. Both gateway configurations send the entire `/api/me/favorites/*` and
`/api/me/notifications/*` families through explicit BFF handlers. Alpha's Account
bypass is removed. Canonical, case/slash and unknown suffixes retain the boundary,
64 KiB ingress limits, bounded timeouts and no upstream retry. BFF rejects read
bodies before owner I/O. Saved references, exact command receipts, revisions,
outboxes, watch generations and notification read-state remain Account-owned.

Current approved classification now travels through the Wapps source contracts
for reply/mention targets, favorite updates and shared-profile summaries/activity.
Missing classification stays unclassified. BFF filters all four favorite kinds
and all five shared-profile content sections using current viewer preferences;
anonymous viewers see General only. Hidden saved targets retain a removable
reference and generic unavailable metadata. Filters remove nested metadata with
the item, preserve scan continuations, and reject preference changes during
composition. Short or empty filtered profile pages with continuation are valid;
ordering and forward-progress checks remain strict.

Account wraps reply/mention sources with a consumer-owned classification check
for delivery and inbox reads. Inactive/erased recipients settle as suppressed;
dependency errors and concurrent preference changes remain failures. Watch delivery
checks canonical classification choices in its transaction and inbox reads recheck
the current snapshot/source. Suppressed receipts remain suppressed after opt-in.
Generic SDK engines retain opaque consumer contracts. No schema, persisted event
or receipt representation changes are introduced. The shared-profile favorites
client also stops calling retired `/discussion-selection`: its Wapps mapper validates
generic `/discussions/selection` results and exact application bindings.

`WAPPS_MEMBER_PARITY_INTEGRATION=1` extends the disposable local-auth qualifier
with four groups, using real enrolled sessions, Authentication/Account/BFF,
Editorial/Community, OPA, MySQL, RabbitMQ, Mongo and MinIO. Actual reply/mention/watch
workers run only in disposable Account. All twenty-three combined groups pass in
about 83 seconds (`member-runtime-attempt4.log`). Coverage includes four-kind
concurrent command replay, stale/key conflicts, independent sessions, all route
variants, body/query/forged-context denial, General/Mature/unclassified choices,
anonymous profile defaults, delivered/suppressed SQL receipts, acknowledgement
replay, recipient-private read timestamps, pagination, process persistence,
SQL/outbox rollback, policy/source failures, removal during source outage,
historical non-resurrection, re-add watch baselines, BFF shutdown and withdrawal
privacy against retained projections.

Both API/auth configurations run on explicit native Nginx 1.28.3, retaining A25's
unresolved Docker-to-host transport limitation. The complete local gateway startup
check still uses Docker. Editorial setup uses trusted claims for real canonical
test identities and its production snapshot/projector directly; Discussion commands
cross authenticated BFF and use the real broker materializer. The replay check
re-exposes acknowledged source rows after receipt commit, and test watch schedules
advance via `availableAt=0`. These substitutions do not qualify Editorial browser
authoring/broker delivery, production polling latency or abrupt process crashes.

Verification uses Node 22.17.1 and the retained isolated clean-lockfile installation
with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`. Evidence is in
`/tmp/wapps-favorites-inbox-parity-20261018/`:

- `npm test`: 6,842 tests / 424 suites across 58 Jest projects plus 34 portable
  tests, with no skips/todos. The 85 declared behavior gaps and eight separately
  gated external suites remain explicit.
- `npm run lint` and `npm run check:boundaries` pass: 144 projects, 1,842 production
  sources and zero boundary violations. Existing lint warnings remain debt.
- Uncached `npx nx run-many -t build,typecheck --all --parallel=3 --skip-nx-cache`
  passes all 140 builds and 49 typechecks. All 64 Angular packages pass emitted
  artifact inspection. The separate BFF spec typecheck and final BFF rerun
  (2,000 tests / 30 suites) pass.
- The public-profile regression passes all twenty-three groups in about 72 seconds,
  covering audience/contact/photo privacy, sharing, follows and badges after the
  classification changes (`profile-regression.log`). The two runtime invocations
  share nineteen baseline groups; they are not 46 distinct groups.

Failed attempts are retained. The initial sandbox test run lacked localhost
listener permission; the authorized rerun passed. Earlier full checks exposed a
test classification literal widened to `string` and an old frontend parser test
that rejected filtered continuation; both were corrected. The separate BFF spec
check found an overly broad Jest mock return type, also corrected. Runtime attempt 1
compared unread items after another session marked them read; attempt 2 overlapped
a build replacing `dist`; attempt 3 injected a source schedule before event creation,
which the journal correctly rejected. Attempt 4 fixes these harness errors and
passes without weakening the production assertions.

`verification.json` and the final source manifest identify the exact qualified
snapshot. Among 2,078 frontend/UI files, one adapter spec changes for filtered
pagination; the other 2,077 and the dependency lockfile retain their pre-slice
hashes. No live stores, services, workers or deployment changed; live activation
remains A21. Full export/erasure, quarantine operations, archived-data privacy,
remaining advertised preferences/channels, Docker transport stability, crash/restore,
load/soak and original frontend acceptance remain open. The next bounded parity
slice is export/privacy (BC21/22/27), as recorded in the completion checklist.

## Public profile, follow and badge gateway parity (October 18, 2026)

A25 completes the approved public-profile route slice on `codex/full-operation`,
base HEAD `95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, preserving the dirty tree.
Both gateway configurations now route `/api/profiles/*`,
`/api/me/{profile-follows,totals,badges}` and `/api/admin/profile-badges/*` through
the existing explicit BFF handlers. The alpha prefix bypass is removed. Case/slash
variants, malformed and unknown suffixes retain the BFF boundary, with 64 KiB
request limits, bounded timeouts and no upstream retry. Profile GET/HEAD handlers
reject nonempty or chunked bodies before Account I/O.

Account's badge controller now preserves and validates the actor's tenant claim.
The generated Identity OPA policy denies tenant-scoped badge administration;
unscoped `admin` and `identity:badge-manager` retain access, while `identity:admin`
alone does not grant it. This closes the previous loss of tenant context before
global badge authorization. No schema, projection representation or frontend changes
are introduced. Account, policy, BFF and gateway activation must be coordinated later.

`WAPPS_PUBLIC_PROFILES_INTEGRATION=1` extends the disposable local-auth qualifier
with real Editorial, Community, Mongo and claimed empty MinIO storage, alongside
Authentication, Account, BFF, MySQL, RabbitMQ and actual OPA bundles. All twenty-three
groups pass, including four new profile groups. They cover nonempty published
suites/articles/favorites/discussions/activity, projection lag, public/followers/
private audiences, contact and WebP privacy, every sharing switch, independent
approval/removal/cancellation, global badge policy, SQL/outbox rollback, concurrent
and historical receipts, stale/key conflicts, independent process restarts,
dependency failures, BFF shutdown and source withdrawal against retained projections.
Old approval/award receipts cannot restore revoked access or badges.

The final runtime uses native Nginx 1.28.3 for both checked-in API/auth configurations,
with filesystem paths and dependency/listener addresses substituted. The full
local gateway startup-with-missing-domains check still uses the Docker image.
The explicit `WAPPS_NGINX_BINARY` option never silently replaces Docker. Repeated
Docker gateway attempts stalled at varying requests while direct service health
remained 200; lower listener ports and pacing did not resolve them. Pacing was
removed. The native comparison passed without retries or weakened assertions.
Docker-to-host transport stability remains unqualified; this is not deployment,
Linux-container workflow, load or soak acceptance. All failed attempt logs remain.

Editorial setup uses trusted test claims for actual enrolled canonical identities
and an independent reviewer, through real owning HTTP APIs. Its production SQL
snapshot/projector is invoked directly; Discussion uses the actual broker worker
in the disposable environment. Shared-profile requests and Discussion commands
cross the real authenticated gateway. These setup substitutions do not qualify
Editorial browser authoring or its broker delivery. Mature-content consumers,
full author erasure, archived-data policy, external providers, frontend acceptance
and crash/restore remain open.

Verification uses Node 22.17.1, the retained isolated clean-lockfile installation
and `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`. Evidence is in
`/tmp/wapps-public-profile-parity-20261018/`:

- `npm test`: 6,825 tests / 422 suites across 58 Jest projects plus 34 portable tests;
  no skips/todos. The declared behavior gaps and separately gated external suites remain.
- Focused profile BFF HTTP: 124 cases; Account HTTP: 139 cases. BFF spec typecheck passes.
- Actual OPA strict/tests and both policy mergers pass, with 288 cases per merged bundle.
- Workspace lint and architecture pass: 144 projects, 1,839 production sources,
  zero boundary violations; existing warnings remain debt. Final readiness-tool lint passes.
- Uncached full builds/typechecks pass: 140 builds and 49 typechecks. All 64 Angular
  packages pass artifact inspection. An initial inspection without the Nx environment
  flags stalled and was terminated; the correctly configured invocation passes.
- The final combined runtime passes in about 70 seconds (`profile-runtime.log`),
  including independently toggled sharing controls and every shared-content read
  immediately after follow revocation. The initial native run also passed.
  The first attempt exposed a test-only object-store adapter mistake, fixed before
  the subsequent transport investigation. Native source archive/build logs and its
  SHA256 are retained; no machine-wide Nginx installation was performed.

`verification.json` and the final source manifest record exact changed hashes and
the qualified snapshot. All 2,078 frontend/UI files and the dependency lockfile
retain their pre-slice hashes. No live store, service, worker or deployment changes;
the live local installation remains A21. The next bounded slice is favorites/inbox
parity with current content authority, classification and notification privacy,
as recorded in the [route inventory](BFF-ROUTE-PARITY.md) and completion checklist.

## Private account and settings gateway parity (October 18, 2026)

A24 implements the approved route/caller inventory and one bounded parity slice
on `codex/full-operation`, base HEAD `95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`,
preserving the existing dirty tree. Both local and alpha gateways now route
`/api/me`, private profile/photo and preferences through explicit BFF handlers.
The broad direct-Account `/me` fallback is removed. Known remaining alpha bypasses
are explicit; all other `/me` suffixes reach BFF and unknown actions fail there.
Case/slash behavior, 64 KiB JSON / 2 MiB avatar limits and no upstream retries are
preserved. Account/profile/avatar/preferences GET requests reject bodies before
owner I/O, as well as the existing query-selector rejection.

[The route inventory](BFF-ROUTE-PARITY.md) maps current browser adapters to BFF
controllers and lists every remaining direct API/media family in these gateway
includes. Public profiles/follows/badges, favorites/inboxes/exports and Editorial
workspace/publication/media still need alpha parity. Both configurations also
retain direct application-visibility and registration routes without a discovered
current portal caller; their compatibility/disposition needs a separate decision.
The accepted frontend baseline is still `c965790e...`; its original presentation
and eventual integration/visual acceptance are not changed by this slice.

`bff-account-settings-runtime-checks.cjs` extends the disposable local-auth suite
with eight groups. Real independent Authentication/Account/BFF processes, separate
credential/canonical SQL access, OPA, MySQL/RabbitMQ and both Nginx API/auth route
sets qualify reads, forged-context denial, strict paths/methods/body bounds,
independent sessions, canonical account isolation, shared profile/preferences
revisions, concurrent/historical receipts, conflict handling and outbox rollback.
Real PNG bytes become WebP in Account SQL, remain isolated and survive independent
process restarts; removal deletes the bytes and replays the original receipt.
Policy outage and an unavailable test BFF Account binding fail closed; the latter
keeps real Identity available for ingress validation. Stopping BFF denies every
tested account/settings/photo/deletion route and variant without owner fallback.
Self-deletion accepts a durable canonical tombstone, reports cleanup pending and
denies further application access. Full cross-service erasure is not claimed.

Verification uses Node 22.17.1 and the retained isolated clean-lockfile installation
with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`. Evidence is in
`/tmp/wapps-account-routes-20261018/`:

- `npm test`: 6,786 tests / 422 suites across 58 inventoried Jest projects and
  34 portable tests, with no skips/todos. The gate explicitly leaves 85 projects
  without their own behavior specs and eight external suites outside its scope.
- Focused account/preferences BFF HTTP suites: 114 cases, including eight added
  fixed-length/chunked GET-body rejection cases. BFF spec typechecking passes.
- `npm run lint` and `npm run check:boundaries` pass: 144 projects, 1,839 production
  sources, zero architecture violations. Existing lint/build warnings remain debt.
- Uncached `nx run-many -t build,typecheck --all --parallel=2 --skip-nx-cache`:
  140 builds and 49 typecheck targets pass. The Angular artifact checker verifies
  64 packages; a frontend build does not establish presentation acceptance.
- `WAPPS_LOCAL_AUTH_INTEGRATION=1 node --test tools/readiness/local-auth.test.cjs`:
  all nineteen real-stack groups pass in `local-auth-contract.log`, including the
  eleven earlier groups. Only random test containers/images/stores are used and
  removed. This is process-restart evidence, not abrupt-crash/backup/restore proof.

Initial integration attempts recorded a gateway 504 and a transport timeout at
different checkpoints; neither recurred in the final complete run. No request
retry was added to mask them. A subsequent run exposed a qualifier expectation
error: Account deliberately returns 403 for unavailable private avatar bytes,
not 404. The assertion now preserves that owner contract; failure logs are retained.
The qualifier also emits test gateway diagnostics on unexpected HTTP status.

The final source manifest records fourteen changed/added files and no deletions.
All 2,078 frontend/UI files and the dependency lockfile retain their pre-slice
hashes. No live service/store, frontend or worker is changed; local activation
remains A21. Next is public-profile/follow/badge parity with real current source
authority, followed by the remaining bounded families and coordinated candidate
qualification. External providers, archived-data policy, public probe egress,
full privacy convergence and release/restore/soak remain open.

## Staff health monitor configuration through BFF (October 18, 2026)

A23 implements BC20 staff management on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, preserving all prior dirty-tree work.
Explicit BFF `GET /api/editorial/health-monitors/:applicationId` and
`PUT /api/editorial/health-monitors/:applicationId/:id` retain the existing staff
contract. Local and alpha gateway configurations send the complete route family,
including case variants and unknown suffixes, through BFF with bounded bodies,
timeouts and no upstream retries.

The BFF validates trusted ingress provenance, forwards only identity/roles/tenant,
rejects query selectors and malformed commands, and validates bounded owner
responses. PUT receipts must confirm the exact application/monitor, normalized
fields and expected next revision. Configuration reads allow historical monitor
origins after an approved website change so staff can repair them. Request parsing,
successes and BFF errors are private/no-store; bodies are bounded at 8 KiB and
responses at 32 KiB, with a ten-second downstream deadline. No redirects or automatic
mutation retry occur. Sanitized owner denial/conflict statuses remain distinct from
503 unavailable or uncertain outcomes.

Editorial retains real OPA authorization, current canonical tenant/application and
approved-origin enforcement, the identity-erasure write barrier, SQL transactions,
immutable monitor versions and replay. The change adds no schema or worker behavior.
Identical historical replay returns the originally accepted configuration without
overwriting later state. Disabled definitions remain editable, while public health
omits them; enabled but unmeasured checks remain unknown.

Verification uses Node 22.17.1 and the retained isolated clean-lockfile installation.
Evidence is in `/tmp/wapps-health-bff-20261018/`, with the final source hashes recorded
separately because the base SHA does not identify this uncommitted candidate.

- `npm test` passes 6,778 Jest tests / 422 suites across 58 projects plus 34 portable
  tests, without skips/todos. This includes 81 new health BFF HTTP cases and the
  existing Editorial/reliability regression. The inventory still reports 85 projects
  without their own behavior specs and eight external suites outside that gate.
- `npm run lint`, separate BFF spec typechecking and `npm run check:boundaries`
  pass. The architecture audit scans 144 projects / 1,839 production sources with
  zero violations. Existing lint/build warnings remain visible debt.
- All 140 declared builds and 49 typecheck targets pass with
  `nx run-many -t build,typecheck --all --parallel=2 --skip-nx-cache`.
  `check-angular-packages.mjs --all` validates 64 packages. The final normalized-URL
  bound is additionally rebuilt with BFF and its 24 prerequisites, typechecked,
  linted and covered by the repeated full test gate and final runtime qualification.
- The health qualifier uses real disposable MySQL/Mongo/OPA and compiled
  Editorial/BFF with both checked-in Nginx API/auth includes. Ten groups cover
  authorization, revisions/replay, rollback/retry, lost-reply recovery, erasure and
  parent fences, owner/BFF restarts and dependency failures. It retains the worker's
  private-address/redirect protections, real slow/deadline requests, stale/unknown
  evidence, lease fencing, migration checks and capacity limit.
- `WAPPS_SUITES_OPA_DOCKER=1 WAPPS_SUITES_OUTPUT=/tmp/wapps-health-bff-20261018/runtime-final
  node tools/readiness/qualify-suites.cjs --health --no-browser` records those ten
  groups in `runtime-final/qualification.json`.
- `WAPPS_LOCAL_AUTH_INTEGRATION=1 node --test tools/readiness/local-auth.test.cjs`
  passes eleven real Authentication/Identity/BFF/OPA/gateway groups, including the
  full local gateway's 503 response for a valid monitor route when Editorial is
  absent. Health-specific staff tokens remain fixtures in the health qualifier.

An initial Angular artifact-check invocation omitted the isolated Nx settings and
held graph construction. Only that task-owned checker was stopped; the rerun with
`NX_DAEMON=false NX_ISOLATE_PLUGINS=false` passes, as does the waiting test gate.
The failed/initial logs are retained. All 2,078 frontend/UI source files and the
dependency lockfile match the before-slice hashes. No file is removed.

The qualifier now accepts `WAPPS_SUITES_OPA_DOCKER=1` for cached OPA 1.4.2 instead of
requiring a host OPA executable. Its staff authentication subrequest is an explicit
fixture; policy and SQL authority are real. Probe DNS/pinned transport still route
logical public targets to local HTTP fixtures without weakening production address
validation. `--no-browser` deliberately omits frontend/browser acceptance.

No live service, database or provider is changed, and automatic probing stays off.
The existing local installation retains A21. Real public DNS/TLS/egress, the
coordinated credential/domain-service candidate, deployment/restore/soak and original
frontend acceptance remain open. Next is the remaining BFF route/caller inventory
and one bounded local/alpha parity slice before coordinated activation.

## Complete account administration through BFF (October 18, 2026)

A22 resumes the interrupted BC04 slice on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, preserving the extensive existing dirty
tree. The completed source includes explicit BFF credential email/password edits,
provider unlinking, reset/verification links, deletion acceptance and identity
lookup, alongside the existing disable/enable/revoke routes. A read-only
`GET /api/admin/users/:uid/deletion-status` reports accepted cleanup without issuing
another command. The local and alpha gateway configurations route the entire
admin-users family through BFF, including unknown/malformed paths.

Account remains the policy/lifecycle owner; credential edits cross the independent
Authentication service. Source-generated OPA policy now denies tenant-scoped
`admin` and `identity:admin` callers for every global administration operation,
including identity/status reads. Requests reject scope selectors and unexpected
fields; downstream requests/responses are bounded, exact-ID/status/schema checked,
and never automatically retried or redirected. BFF responses are private/no-store.
Credential mutations/link requests extend the existing actor/target/outcome log
without recording passwords, emails, tokens or generated links.

Deletion still commits the canonical tombstone, existing cleanup jobs and outbox
atomically. Status reads inspect both credential-deletion and account-erasure
journals at the accepted revision. Only both completed receipts produce
`completed`; either terminal failure produces `failed`; otherwise cleanup stays
`pending`. Missing or inconsistent journals fail unavailable without repair or
synthetic receipts. Repeated DELETE preserves the accepted revision and existing
retry semantics. No schema migration or provider-plan change is introduced.

Verification uses Node 22.17.1, the retained isolated clean-lockfile installation,
production bundles and fresh disposable MySQL/RabbitMQ/OPA/Nginx. Evidence is in
`/tmp/wapps-account-admin-resume-20261018/`:

- `npm test` passes 6,697 tests / 421 suites across all 58 inventoried Jest
  projects, plus 34 portable tests, with no skips/todos. It explicitly records
  85 projects without their own behavior specs and eight external suites outside
  that gate. This is regression evidence, not completion of those missing tests.
- `npm run lint` passes production targets and readiness tools. Existing warnings
  remain, including seven BFF warnings; no warning suppression is added.
- Affected `nx run-many -t test,typecheck,lint --skip-nx-cache` passes, as do
  uncached Authentication/Account/BFF builds and 34 prerequisite tasks. Separate
  BFF spec typechecking passes; test transpilation is not used as its substitute.
- The final `nx run-many -t build,typecheck --all --parallel=2 --skip-nx-cache`
  passes all 140 build and 49 typecheck targets. Angular artifact inspection
  (`node tools/readiness/check-angular-packages.mjs --all`) validates 64 packages
  with no errors. Existing build warnings remain; compiled presentation is not
  evidence of original-frontend fidelity or user acceptance.
- The pinned OPA 1.4.2 container passes 107 policy tests. The architecture audit
  passes 144 projects / 1,834 production sources with zero violations.
- `WAPPS_LOCAL_AUTH_INTEGRATION=1 node --test tools/readiness/local-auth.test.cjs`
  passes one external test containing eleven explicit groups, with no skips/todos.
  The new helper exercises both actual gateway configurations, member/tenant/forged
  denials, exact identity lookup, SQL/credential rollback and retry, credential-edit
  session revocation, deletion replay and status reads. BFF shutdown/restart proves
  every added route fails without direct-owner fallback and then recovers.
- The local provider truthfully rejects unlinking with 400 and unavailable action
  links with 503. Real credential cleanup leaves overall erasure pending while
  consumer providers are absent. A terminal erasure-job failure is injected only
  in the disposable fixture to prove failed status; unit tests qualify the
  two-completed-journals case. No complete provider erasure is simulated as success.

The first focused HTTP run lacked sandbox listener access and timed out during
setup; the same tests pass with local listeners enabled. That failed attempt is
retained. All original frontend/UI source files and the dependency lockfile remain
unchanged by this slice. The source changes are uncommitted, so the base SHA alone
does not identify the candidate; the evidence manifest records exact changed hashes.

No live service, database or provider is changed. The running local installation
retains A21 until Account/BFF/OPA/gateway are rolled out together. External-provider
unlink/link success, durable administrative audit retention, complete privacy
convergence, alpha/Kubernetes activation and original-frontend acceptance remain
open. The next BFF implementation slice is BC20 staff monitoring and the remaining
direct-route audit; coordinated domain activation and release qualification follow.

## Legacy identity import and local authentication activation (October 18, 2026)

A21 completes the interrupted migration/activation slice on `codex/full-operation`,
base HEAD `95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`. The user approved retaining
the one Firebase-linked legacy stub in a restricted state and enabling fresh local
accounts. Live evidence matched the reviewed disposable-copy plan immediately
before import. No local credentials or matching content ownership references were
found in the legacy inspection; no provider link was guessed from the stored email.

The Account maintenance CLI now supports bounded offline `--legacy-plan` and
reviewed-hash `--legacy-import` commands. Only fully matched, unregistered, nondeleted
stub records are supported; populated/unknown historical formats require their own
migration. The importer uses a separate empty canonical schema and the migration
advisory lock. Stable ID, original creation time, restricted lifecycle state,
creation outbox and import receipt are committed together. Identical replay retains
later canonical state; conflicting plans, foreign/populated tables and changed
evidence fail. The original nonempty `identity_subjects` guard remains effective.

The live cutover imports the UUID into `identity_canonical` as inactive/suspended,
without a credential binding. Original SQL and Mongo records remain preserved.
Authentication has a separate `authentication` schema/user; access to Identity is
denied, and the Account user cannot read credentials. Versioned local images run
Authentication, Account, BFF and OPA. The ignored `.env` selects the new schema and
`compose.auth.local`; no tracked secrets or frontend source changes are introduced.

The local gateway previously failed startup when stopped domain services were absent
from Docker DNS. Its existing Editorial, Community and registry routes now resolve
their upstreams per request with bounded DNS lookup. Routing and authorization are
preserved. A full-gateway regression starts with those services absent, verifies
BFF authentication and unauthorized denial, and requires an unavailable domain
route to fail. Full-stack Compose health dependencies remain unchanged; the bounded
activation uses `--no-deps` after separately checking stores/migrations.

Build/source checks and disposable process qualification use Node 22.17.1 and the
retained isolated lockfile installation. Live Docker containers use Node 22.23.2
from the retained `wapps-review-runtime:20261014` image. Versioned activation images
copy the qualified bundles without fetching dependencies; deployed bundle SHA-256
hashes match the tested outputs. Exact image IDs and runtime versions are recorded
in `runtime-manifest.json`. This is not a fresh production image-build qualification.

- The resumed source matched the qualification snapshot exactly. Pre-interruption
  final adapter checks pass 256 tests / 16 suites, source/spec typecheck and lint;
  Account regression passes 426 tests / 29 suites. The final uncached Account build
  and 27 prerequisite tasks pass. These unchanged-code checks are retained under
  `/tmp/wapps-legacy-identity-20261018/`, not represented as newly repeated runs.
- `WAPPS_LOCAL_AUTH_INTEGRATION=1 node --test tools/readiness/local-auth.test.cjs`
  passes nine explicit groups in one external test, with no skips/todos. Real
  MySQL/RabbitMQ/OPA/Nginx and production bundles cover the staged import, atomic
  rollback, concurrent replay, complete local gateway startup, both ingress route
  sets, sessions/restarts, administration, database isolation, alternate verifier,
  credential export/cleanup and dependency failure.
- Live port-4200 BFF checks pass signup/retry, sign-in, bad-password and forged-header
  denial, profile/session persistence across actual container restarts, stale-bearer
  refresh, replay denial and all-session sign-out. A dedicated `example.test` smoke
  account remains, with its sessions revoked. SQL confirms its credential subject
  differs from the Wapps ID and the original identity remains restricted/unbound.
- The source SQL dump and Mongo archive restore into new databases on disposable
  inspection copies and exactly match the mapping/node/account/profile evidence.
  Source stores are not overwritten. A single-transaction backup of the activated
  canonical/credential schemas also restores successfully, preserving both identities,
  the exact credential binding and zero active sessions. Both version-matched Compose
  migration jobs replay with no pending migrations. These backups are retained for
  rollback/reconciliation.
- `npm run check:boundaries` passes 144 projects / 1,833 production sources with
  zero violations. Changed readiness-tool lint, syntax/format checks, nginx config
  validation, Compose validation and `git diff --check` pass.

The first live check reached its final SQL assertion but treated a binary issuer
column as a JavaScript string. The verification script was corrected and the same
account was used for the passing rerun; runtime source did not change. The original
failure is retained alongside the passing evidence. Activation logs/scripts, import
receipt hashes, backup verification and image/source manifests are under
`/tmp/wapps-legacy-activation-20261018/`, also preserved privately in the ignored
`deploy/local/identity-cutover.local/` directory. Do not publish private records,
configuration or credentials from that directory.

This activates local authentication only. Editorial, Community, registry,
materializers and media workers remain stopped; their migrations and coordinated
activation are still required. Existing static frontend images are unchanged and
do not establish original-frontend fidelity or browser acceptance. No privileged
account, legacy credential link, Firebase integration, alpha/Kubernetes deployment,
full export/erasure saga or complete release qualification is claimed. Retained
legacy private records need an explicit retention/erasure plan before that account
can enter the complete privacy workflow. New writes now exist: rollback must retain
and reconcile the new canonical/credential stores, not restore the old snapshot over
them. Next backend work is the remaining BC04 administration and BC20 monitoring BFF
contracts; see the completion checklist and migration runbook.

## Independent authentication process (October 18, 2026)

Implemented on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, preserving the existing dirty tree.
This A20 checkpoint supersedes A18/A19's in-process credential composition.
Authentication now runs independently with its own credential database, SQL user,
migrations and bounded, authenticated `/credentials/*` HTTP contract. It no longer
imports Account SQL or owns canonical identities, profiles, outboxes or broker
workers. Identity/Account consumes that contract for sessions, verification,
credential administration, export and durable cleanup. The BFF preserves the
browser API; both gateway authentication route sets cross BFF, and private gateway
validation resolves credentials through Identity's canonical lifecycle checks.

Identity owns exact `(issuer, subject)` bindings and independently generated stable
Wapps IDs. New bindings, canonical identities and creation outboxes commit together.
Provider subjects never become browser identity IDs. Authentication stores hashed
registration receipts; unbound existing credentials require the original receipt
and password proof before enrollment. Sign-in and matching email cannot silently
create or link an identity. Existing ownership, revisions, deletion tombstones,
provider plans and cleanup receipts/retries retain their meaning. Administration
resolves Wapps IDs before issuing subject-specific commands and requires an exact
issuer/subject completion receipt. Missing or foreign bindings fail closed.

The local MySQL image packages initializers with explicit non-executable modes;
fresh volumes receive separate Identity/Authentication grants. Authenticator startup,
migration and operator provisioning refuse a schema containing noncredential tables.
Existing volumes require a reviewed migration. ARCH011 prevents Authenticator from
importing Account persistence/use cases and prevents Account from instantiating
local/Firebase credential implementations. These import checks supplement runtime
access-control and process-boundary qualification.

Verification uses Node 22.17.1, the existing isolated clean-lockfile qualification
workspace, production service bundles and disposable MySQL/RabbitMQ/OPA/Nginx.
Evidence is under `/tmp/wapps-auth-process-20261018/`, including the initial source
hashes, final dirty-source manifest and command logs:

- Seven affected projects pass tests, source/spec typechecks and lint using
  `nx run-many -t test,typecheck,lint --skip-nx-cache`. The final distinct total is
  2,634 tests / 82 suites, including the final Account rerun of 426 tests / 29 suites.
  No skips or todos; seven pre-existing BFF lint warnings remain.
- Uncached Authenticator/Account/BFF builds and 34 prerequisite tasks pass. The
  subsequent Authenticator schema guard passes its affected build, tests,
  typechecks and lint. No frontend build or full-workspace release gate is claimed.
- Architecture checks pass: 144 projects, 1,830 sources, zero violations; six
  checker tests pass. Inventory, affected readiness-tool lint, Compose validation
  and `git diff --check` pass.
- `WAPPS_LOCAL_AUTH_INTEGRATION=1 node --test tools/readiness/local-auth.test.cjs`
  passes seven groups through the built processes and checked-in local MySQL image.
  Coverage includes registration/replay/concurrency, credential and canonical-outbox
  rollback/retry, refresh rotation, sign-out, restart persistence, lifecycle and
  expiry denial, both gateway configurations, real OPA staff/tenant checks,
  revisions/outboxes, credential export, durable cleanup and dependency outages.
- Separate SQL users are denied reads of each other's stores. A misplaced credential
  migration refuses Identity without creating credential tables. An alternate
  standalone token verifier preserves the same Wapps ID/profile and canonical
  suspension; this is a verification probe, not a complete second provider.
- All 2,078 frontend/UI files and `package-lock.json` remain unchanged against this
  slice's starting hashes. Test containers and test image tags are removed. No
  commit, live migration, deployment or provider switch is made.

Earlier manual database provisioning passed but missed a real initializer failure:
the Docker Desktop bind mount reported the non-executable script as executable and
then refused execution. The initializer is now copied into the image with mode 0644
and sourced by MySQL's entrypoint. The final qualification builds this same image
and uses its actual initializers; earlier manual-fixture results are not the final
startup evidence.
An additional guard assertion initially expected the internal error text in the
intentionally sanitized CLI output. The corrected check verifies the guard directly
against real Identity SQL, the process's nonzero exit and the absence of credential
tables after refusal. The failed and corrected runs remain in the evidence directory.

Activation of the existing local installation remains blocked by the unverified
legacy `identity_subjects` mapping recorded in A19. Its guard and backup remain
intact; no guessed binding or email-based migration is introduced. Existing local
credentials also need reviewed relocation before adopting separate databases.
Alpha configuration generation, Kubernetes wiring, a full export/erasure saga,
abrupt crash/restore and deployment proof remain open. Current runtime configuration
supports one issuer; concurrent multi-issuer routing/account linking is not included.
Local email/OAuth/anonymous credentials remain unavailable and Firebase integration
is deferred. Original frontend merge/visual acceptance remains FE01. See
[the process contract and migration guide](LOCAL-AUTHENTICATION.md) and
[the current completion checklist](BACKEND-COMPLETION-CHECKLIST.md).

## Account lifecycle administration through BFF (October 18, 2026)

Implemented on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, preserving the existing dirty tree.
Three explicit BFF commands now cover `/api/admin/users/:uid/disable`, `/enable`
and `/revoke-tokens`. Both checked-in gateways route these operations through BFF,
including malformed encoded target paths that must not fall back to a direct owner.
BFF validates body/query absence, bounded target/response contracts and trusted
identity provenance; it forwards only allowed context and never retries mutations.

Account retains policy and canonical/provider writes. Its application adapter now
preserves tenant context; generated OPA constraints deny tenant-scoped authority
for these global identity operations. Disable/enable retain canonical transactions,
revision/no-op behavior and the durable lifecycle outbox. Revocation remains a
separate provider operation and removes local access/refresh sessions. Suspension
alone does not delete credentials; revoke during suspension to keep old sessions
invalid after re-enablement. New sign-in works after enablement. No additional
schema change, projection, provider plan or asynchronous cleanup contract is added.
Credential-free logs record actor, valid target, action and confirmed/denied/
unconfirmed outcome; they are operational evidence, not a durable audit journal.

Verification uses Node 22.17.1 and the existing isolated clean-lockfile qualification
workspace. Commands and evidence are retained under
`/tmp/wapps-account-admin-20261018/`:

- Affected BFF/Account tests: 2,181 tests in 49 suites, no skips or todos. BFF covers
  explicit routing, target/context validation, owner status mapping, bounded/false
  receipts, redirects, lost-response non-retry and credential/header filtering.
  Owner tests cover preserved tenant/subject, denial/outage and audit outcomes.
- `docker run ... openpolicyagent/opa:1.4.2-static test /policies`: 107 policy tests
  pass against the generated Identity bundle, including global-vs-tenant scope.
- Uncached Authenticator/Account/BFF builds and 34 prerequisite tasks pass. Four
  affected source/spec typechecks, affected project/tool/policy-source lint,
  architecture (144 projects, 1,827 sources, zero violations), inventory and Compose
  validation pass. Seven pre-existing BFF lint warnings remain visible debt.
- `WAPPS_LOCAL_AUTH_INTEGRATION=1 node --test tools/readiness/local-auth.test.cjs`
  passes six groups with real disposable MySQL/RabbitMQ/OPA/Nginx and production
  bundles. New staff checks cover both local/alpha admin routing, nonstaff/scoped
  denial, forged headers, exact case, policy outage, SQL rollback, idempotent state
  changes, durable lifecycle events, suspension, re-enablement and all-session
  invalidation. Existing registration/refresh/restart/export/cleanup groups pass.
  All test-owned containers are removed; no persistent Wapps data is used by tests.
- Frontend/UI files and `package-lock.json` are unchanged. No commit or deployment
  is made. Full external-provider, browser and cross-service release proof remains open.

The initial BFF fixture omitted an unrelated required Editorial origin; the policy
restart test assumed Docker would preserve a random published port; and the outbox
assertion initially counted the earlier enrollment event. Fixtures now configure
the origin, pause/unpause OPA for outage and count lifecycle events after the initial
revision. All affected checks were rerun; earlier failures are not passing evidence.

Local activation was attempted. The registry-dependent Compose build stalled, so
verified bundles were packaged using the existing cached Wapps runtime image; old
Account/BFF images were tagged for recovery. The existing local MySQL and RabbitMQ
dependencies were started, Identity was backed up, and guarded migration was run.
It refused the one row in the legacy `identity_subjects` table. A subsequent read
confirmed that table remained the only Identity table and its row count remained
one. No mapping was erased/rebound and no provider was switched. Started dependencies
were returned to their prior stopped state. The gateway and other local application
services were already stopped before this task; they were not recreated.

Activation requires a verified legacy-subject migration before canonical cutover.
Remaining BC04 credential editing/unlink/action links/deletion/lookup integration,
BC20 staff health, external identity/email integration and original frontend
merge/visual acceptance remain outstanding. Firebase integration remains deferred.

## Local authentication and BFF session boundary (October 18, 2026)

Implemented on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, preserving the existing dirty tree.
The user deferred Firebase integration and requested a simple local provider with
replaceable authentication boundaries. Local Compose now explicitly selects
`AUTH_PROVIDER=local` for the migration job, Authenticator and Account Management.
The default stack has no Firebase dependency. The old emulator is an optional
profile; no existing running service or data was changed during this work.

The authentication library now exposes provider-neutral password, verification,
revocation and strategy-factory ports. Authenticator controllers and validation
use these contracts; concrete provider selection stays in composition. Local SQL
credentials use salted scrypt passwords, opaque access/refresh tokens stored as
hashes, atomic single-use rotation, bounded session retention and all-session
revocation. Canonical lifecycle/enrollment/outbox behavior remains authoritative.
Account credential edits/export/deletion use the same selected adapter. Foreign
subjects fail closed; required provider plans and accepted jobs are unchanged.

BFF has explicit bounded handlers for the existing authentication session,
registration, credential-action and configured OAuth contracts. Local ingress
routes `/auth/*` and `/api/password-recovery` to BFF; trusted-header validation
continues at the owner/gateway boundary. Stale access tokens do not prevent a
refresh exchange. Local OAuth/anonymous credential accounts and email actions
remain unavailable rather than returning fabricated success. The operator-only
`--local-user` command provisions explicit local roles/tenant through canonical
enrollment; the browser cannot choose these privileges.

`LocalCredentials1792281600000` adds two authoritative local credential tables
through the explicit migration entrypoint. Existing canonical IDs, profiles,
content and receipts are not rewritten. Services refuse pending migrations. See
[local authentication](LOCAL-AUTHENTICATION.md) and the updated local runbook for
setup, migration and provider replacement; existing accounts require verified
subject mapping before a future provider switch.

Validation uses Node 22.17.1 and the retained isolated clean-lockfile install at
`/var/folders/35/y91w68hd3t51n5phjfqzcwzm0000gp/T/wapps-boundary-qualification-65t8wf73`.
Evidence logs and the task-baseline diff are under
`/tmp/wapps-local-auth-20261018/`:

- 2,641 distinct affected Jest tests in 87 suites pass across local/Firebase
  adapters, Authenticator, Account, BFF, Identity core/authentication and Account SQL.
  No skips, todos or empty targets. The unchanged Firebase adapter's compatibility
  tests use controlled clients, not a live Firebase integration.
- Uncached builds pass for Authenticator, Account Management and BFF plus their
  34 prerequisite tasks. Seven relevant source/spec typecheck sets and seven
  affected project lint targets pass; BFF retains seven existing warnings.
  Changed readiness tools also pass lint.
- Architecture/inventory pass: 144 projects, 1,825 production sources, zero
  dependency-boundary violations and no inventory errors. Compose validates.
- `WAPPS_LOCAL_AUTH_INTEGRATION=1 node --test tools/readiness/local-auth.test.cjs`
  passes five groups against fresh disposable MySQL/RabbitMQ/Nginx and the built
  production services with Firebase settings absent. It covers ingress/BFF,
  registration/replay/concurrency, independent sessions, stale-bearer refresh,
  rotation replay, expiry, sign-out, process restarts, canonical suspension,
  transaction rollback/retry, explicit operator claims, password revocation,
  duplicate-email errors, secret-free export, foreign-provider refusal, durable
  credential cleanup, and SQL/provider outages. It cleans only its own resources.
- All 2,078 frontend/UI source files and the dependency lockfile match the start
  of this task. Task diff whitespace checks pass. No commit, deployment or running
  stack restart was performed.

Early checks exposed an Nx project-name copy error, test fixtures still coupled
to the old provider injection, a test-only AsyncIterable type error, and missing
fault-trigger privilege in the disposable SQL fixture. These were corrected and
the affected checks rerun. Loopback HTTP suites required the normal sandbox
escalation. None of those earlier failures is counted as passing evidence.

This completes the local authentication/BFF slice, not production identity or full
Wapps readiness. External email/SSO/multifactor integration is deferred; alpha
routing, legacy registration completion, original frontend merge/visual acceptance,
full account erasure/export journeys, abrupt crash/restore and release qualification
remain open. BC04 account administration is the next bounded BFF implementation.

## Generic Review owner API and BFF mapping (October 18, 2026)

The Review architecture slice is implemented on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, preserving the existing dirty tree.
`@sdk/features/review/libs/management` owns commands/queries through generic
repository and authority ports. `@sdk/features/review/http` provides one
`ReviewsController` under `/api/reviews`; every operation requires an exact opaque
`bindingKey`. The generic implementation has no Wapps kinds, key formats, IDs or
role-name interpretation. Missing, repeated and malformed keys fail closed.

BFF retains `/api/application-reviews/:applicationId`, constructs
`wapps:application:<uuid>` and maps responses back to the existing frontend shape.
Review pages/commands, Discovery previews and Explore/timeline summaries now use
the generic owner API. Community's old application-specific controller/filter are
removed, with no compatibility alias. The internal `ApplicationReviews` facade
continues to support Wapps profile/feed readers. The alpha gateway joins local in
routing the complete application-review family through BFF; source/configuration
is changed, not a running deployment.

`ApplicationReviewAuthority` preserves existing OPA actions, public-tenant and
current parent-access rules. `ApplicationReviewRepository` maps the consumer key
to the historical application UUID scope. SQL tables, locks, review versions,
helpful membership, reports, journal, receipts and command fingerprints are
unchanged. No migration, new projection, queue or object payload representation is
introduced. Canonical SQL snapshots remain the deliberate Review materialization
variation. New consumers must supply their own authority/repository composition;
unknown keys do not gain Wapps access merely because the HTTP API is generic.

Evidence is in `/tmp/wapps-generic-reviews-api-20261018`, including a pre-turn
source archive/hash manifest, changed-source patch, logs and artifact inspection.
Qualification uses the existing unchanged-lockfile `npm ci` snapshot at
`/var/folders/35/y91w68hd3t51n5phjfqzcwzm0000gp/T/wapps-boundary-qualification-65t8wf73`,
Node 22.17.1 and `NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true`.

- 2,559 distinct Jest tests across 82 suites pass: Review management 17/1, HTTP
  40/1, core 34/2, Community 542/41, BFF 1,781/26 and consumer contracts 145/11.
  BFF's full existing suite and the new Discovery client suite were run separately.
  The HTTP fixture initially failed typechecking because all operations shared a
  receipt-shaped mock; typed per-operation results corrected it. The failed log
  remains, and the affected tests/typecheck pass after the fix.
- Changed service/library output directories were cleared before the uncached
  build: Community, BFF and Review HTTP plus 44 prerequisites pass. New libraries
  emit public JS/declarations and unique incremental metadata. Both service bundles
  resolve private workspace imports; Community contains no retired Review route.
  Five affected source/spec typechecks pass. Five project lint targets and changed
  readiness-tool lint pass with seven existing BFF and one Community warning.
- Architecture and inventory checks pass: 143 projects, 1,815 production sources,
  zero violations and no inventory errors. ARCH009/010 now cover Review management
  and HTTP as well as core; architecture audit tests pass.
- `node tools/readiness/qualify-materialization.cjs --discussion-bff` passes all
  14 groups with fresh MySQL/MongoDB/RabbitMQ/MinIO and nginx. Four new Review groups
  exercise a historical SQL receipt/fingerprint, concurrent exact replay/key
  conflicts, key/case/tenant/author isolation, helpful membership, immutable report
  evidence, independent moderation/withdrawal, parent revocation and provider
  failures. An injected journal failure rolls back state/content/receipts; retry
  commits once. Review reads/writes work with Mongo closed. Owner/BFF recreation
  retains state and historical receipts. Both local and alpha nginx read/command
  paths are asserted to traverse BFF. Local behavior passed before alpha routing
  changed, then the qualifier passed again with both ingress configurations.

No portal/UI file or dependency lockfile changes. Existing Wapps stores are
untouched; temporary qualification containers are cleaned up. No commit,
live-stack restart or deployment is performed. Authentication, policy and parent
providers are controlled fixtures; real Firebase/OPA/Editorial integration and
full export/erasure/browser journeys are not newly qualified. Nest recreation is
not an independent process-crash test. Activation requires matching Community,
BFF and ingress versions. Remaining work is tracked in BC17/BC23/BC27 and the
original frontend merge/visual acceptance remains FE01.

## Consolidated Discussion resource API (October 18, 2026)

The owning service now registers one reusable `DiscussionsController` from
`@sdk/features/discussion/http` under `/api/discussions`. The separate
`/api/discussion-bindings` resource family is removed with no alias or redirect.
The key describes consumer context; it is not a separately managed HTTP resource.
BFF and Account clients use the consolidated owner routes. Frontend contracts
and dedicated BFF application-topic/article-comment routes are unchanged.

An empty query retains legacy unbound list/detail/create/reply/edit/delete
behavior and response shapes. A valid `bindingKey` selects the scoped contract;
empty, repeated, malformed or unknown selectors fail with 400 rather than falling
back. Omitted/wrong keys cannot access bound data, and supplying a key cannot
access unbound data. Legacy likes remain unbound; votes/pins require a key and
participation/selection require a prefix. Discovery paths precede `/:id`.
The generic portal routes still reject browser-supplied scope selectors.

The former Community controller and its unused DTOs are removed. Trusted actor
conversion moves unchanged into `discussion-actor.ts` for Community controllers
and HTTP composition. The reusable adapter receives both scoped queries and
`unboundQueries`; all commands use the same durable engine. Existing seed/internal
facades remain. No domain, canonical SQL, migration, command fingerprint, outbox,
immutable payload or materialization representation changes are introduced.

Qualification uses Node 22.17.1 on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, preserving prior uncommitted work.
The unchanged-lockfile clean-install snapshot is updated at
`/var/folders/35/y91w68hd3t51n5phjfqzcwzm0000gp/T/wapps-boundary-qualification-65t8wf73`.
Evidence and a pre-turn source/hash archive are in
`/tmp/wapps-unified-discussion-api-20261018`. Commands use Node 22 on `PATH` and
`NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true`:

```sh
node node_modules/jest/bin/jest.js --config sdk/features/discussion/packages/infrastructure/http/jest.config.ts --runInBand
node node_modules/jest/bin/jest.js --config apps/services/community/jest.config.ts --runInBand
node node_modules/jest/bin/jest.js --config apps/services/catalog-bff/jest.config.ts --runInBand
node node_modules/jest/bin/jest.js --config sdk/features/identity/applications/management/service/jest.config.cjs --runInBand --runTestsByPath sdk/features/identity/applications/management/service/src/app/infrastructure/public-favorite-targets.spec.ts
node node_modules/nx/bin/nx.js run-many -t build -p apps.services.catalog-bff,sdk-features-discussion-applications-management,sdk-features-identity-applications-management --parallel=2 --skip-nx-cache
node node_modules/nx/bin/nx.js run-many -t lint -p apps.services.catalog-bff,sdk-features-discussion-applications-management,sdk-features-discussion-http,sdk-features-identity-applications-management --parallel=2
node node_modules/typescript/bin/tsc -p sdk/features/discussion/packages/infrastructure/http/tsconfig.spec.json --noEmit --incremental false
node node_modules/typescript/bin/tsc -p apps/services/community/tsconfig.spec.json --noEmit --incremental false
node node_modules/typescript/bin/tsc -p apps/services/catalog-bff/tsconfig.spec.json --noEmit --incremental false
node node_modules/typescript/bin/tsc -p sdk/features/identity/applications/management/service/tsconfig.spec.json --noEmit --incremental false
npm run check:boundaries
node tools/readiness/qualify-materialization.cjs --discussion-bff
```

- Affected tests pass: HTTP 67 / 1 suite, Community 540 / 40, BFF 1,776 / 25 and
  Account favorite client 7 / 1: 2,390 tests across 67 suites, without skips.
  Community checks ensure one owning controller and no retired route registration.
- Four affected output directories are cleared in the isolated snapshot before
  the uncached service build: three service targets and 44 prerequisites pass.
  Emitted service bundles resolve private workspace imports, and the HTTP output
  contains the new controller without the removed controller artifact. Four
  spec/source typechecks pass. Affected project and readiness lint pass, retaining
  seven existing BFF warnings and one Community warning. Architecture audit:
  141 projects, 1,804 production sources, zero violations.
- The real-store qualifier passes ten groups through both nginx configurations,
  BFF and the unified controller with fresh MySQL/MongoDB/RabbitMQ/MinIO. It checks
  old unbound behavior and Wapps receipt replay, nested replies, likes/votes/pins,
  discovery, denial, parent revocation, projection lag, service recreation, outage,
  redaction, tombstones and stale-generation suppression. A second consumer uses
  the same controller/materializer with an unfamiliar key and payload, including
  key omission/wrong-key denial and retired-route 404s.
- The first typecheck caught a test fixture using null instead of an absent
  projection binding; the fixture is corrected and HTTP tests/typechecks rerun.
  The first real-store run caught Account eligibility using a fixture's portal
  origin for internal selection. BFF correctly rejected that scope selector.
  Account, nested BFF and notification proxy fixtures now use the explicit service
  origin; portal journey calls retain the portal origin. The fresh qualifier rerun
  passes. Both failure logs remain in the evidence directory.
- Authentication/policy/parent providers are controlled fixtures. Real
  Firebase/OPA/Editorial, complete legacy browser/export/erasure/notification
  journeys and independent process-crash windows are not newly qualified. The
  amended legacy harnesses pass lint; this does not replace running their journeys.
  The qualifier replaces Nest instances over retained disposable stores and uses
  the real dispatcher/broker/materializer, without touching existing Wapps stores.

All 2,078 pre-turn portal/UI files and the lockfile remain unchanged. No new
migration, commit, live-stack restart or deployment occurs. The previously added
binding/index migrations still apply to older databases. Community, BFF and Account
must switch together because old `/api/discussion-bindings` clients no longer work.
Next bounded architecture slice: generic Review owner API with Wapps mapping in
BFF. Remaining BFF coverage, original frontend merge/visual acceptance and full
release/recovery qualification remain outstanding.

## Reusable bound Discussion owner API (October 16, 2026)

The missing owning-service boundary is implemented. The new
`@sdk/features/discussion/http` package exposes `/api/discussion-bindings` for
creation/list/detail, edit/removal, replies, votes/pins, participation and public
selection. It consumes generic command/query/discovery ports and a trusted actor
resolver. Keys remain opaque and case-sensitive; the package and materializer do
not interpret Wapps kinds, IDs or consumer version conventions.

Community supplies current parent authority, content validation, policy mapping,
canonical SQL adapters and historical receipt compatibility at composition.
Catalog BFF constructs Wapps keys and maps generic content/structure to the
unchanged frontend contracts. Application-topic, article-comment, participation
and selection controllers are removed from Community; both ingress configurations
route those frontend families through BFF. Account favorite eligibility now uses
generic public selection. Application reviews remain a separate capability with
dedicated owner routes and are not claimed as migrated.

Commands retain canonical authorization, aggregate revisions, atomic receipts and
outbox intent, immutable payload references and the existing materializer. Reads
recheck authority after external I/O; discovery prefixes only filter candidates.
An explicitly configured other consumer can persist an opaque key without Wapps
target metadata. Wapps still validates its own key/metadata pair. The additive
`DiscussionBindingIndex1792150000000` migration follows
`CommunityDiscussionBindingKeys1792080000000`; it adds the canonical page index
without rewriting rows or changing projection schema 4. Selection transport is
bounded to 2 MiB internally for fifty complete consumer roots; frontend summaries,
ordinary-page limits and full-thread limits retain their contracts.

Qualification uses Node 22.17.1 on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`. Prior uncommitted work is preserved.
The existing unchanged-lockfile `npm ci` snapshot is updated with this slice at
`/var/folders/35/y91w68hd3t51n5phjfqzcwzm0000gp/T/wapps-boundary-qualification-65t8wf73`.
Evidence and pre-turn source/hash archives are in `/tmp/wapps-bound-discussion-api`.
Commands use Node 22 on `PATH` and
`NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true`:

```sh
node node_modules/jest/bin/jest.js --config apps/services/catalog-bff/jest.config.ts --runInBand
node node_modules/nx/bin/nx.js run-many -t test -p apps.services.catalog-bff,sdk-features-discussion-core,sdk-features-discussion-management,sdk-features-discussion-http,sdk-features-discussion-applications-management,sdk-features-discussion-applications-materializer --parallel=2 --skip-nx-cache
node node_modules/jest/bin/jest.js --config sdk/features/identity/applications/management/service/jest.config.cjs --runInBand --runTestsByPath sdk/features/identity/applications/management/service/src/app/infrastructure/public-favorite-targets.spec.ts
node node_modules/nx/bin/nx.js run-many -t build -p apps.services.catalog-bff,sdk-features-discussion-applications-management,sdk-features-identity-applications-management --parallel=2 --skip-nx-cache
node node_modules/nx/bin/nx.js run-many -t typecheck -p sdk-features-discussion-applications-management,sdk-features-discussion-management,sdk-features-discussion-http,sdk-features-identity-applications-management --parallel=2 --skip-nx-cache
node node_modules/nx/bin/nx.js run-many -t lint -p apps.services.catalog-bff,sdk-features-discussion-applications-management,sdk-features-discussion-management,sdk-features-discussion-http,sdk-features-identity-applications-management --parallel=2
node node_modules/typescript/bin/tsc -p apps/services/catalog-bff/tsconfig.spec.json --noEmit --incremental false
npm run check:inventory
npm run check:boundaries
node tools/readiness/qualify-materialization.cjs --discussion-bff
```

- Full BFF regression passes 1,776 tests / 25 suites. Discussion core (15),
  management (24), HTTP (36), Community (538) and materializer (49) pass 662 tests /
  46 suites. A subsequent deployed-module boundary spec adds two passing tests,
  verifying generic registration and absence of the retired controllers. Account
  favorite client tests pass 7 / 1 suite. After test-only fixes, affected BFF specs
  pass 155 tests / 2 suites and Community/BFF spec typechecks pass.
- Uncached Community/BFF/Account builds and 44 prerequisite tasks pass. Four
  affected typecheck targets and 41 prerequisites pass. Five affected lint targets
  pass with existing warnings (seven in BFF and one in Community). The new unused
  test variable warning is corrected; targeted test/readiness lint passes cleanly.
  Inventory reports no errors. Architecture checks cover 141 projects and 1,806
  production sources with zero violations. Community/BFF/Account emitted bundles
  contain no unresolved private workspace package requires; `git diff --check`
  passes.
- Two real-store BFF qualification runs pass. The final run has ten groups through
  fresh MySQL/MongoDB/RabbitMQ/MinIO, real local/alpha nginx configurations, BFF and
  generic owner handlers. It checks historical Wapps receipt replay, trusted-context
  rejection, tenant/owner/policy denial, exact binding, replies/votes/pins, lag,
  redacted ancestors, revocation, service recreation, dependency failure, deletion
  and stale-generation suppression. The existing dispatcher publishes through real
  RabbitMQ and delivery is acknowledged after production materialization succeeds.
- A second consumer supplies an unfamiliar case-sensitive key and payload to the
  same generic handlers and materializer. Twelve-root pagination, discovery,
  isolation, votes/pins, revocation, recreation, receipts and tombstones pass.
  Generic internal endpoints and retired-route 404s are exercised. The legacy
  journey fixture wrapper traverses actual BFF and rejects forged context; Account
  favorite checks use generic selection and current parent authority.
- The runtime qualifier uses controlled authentication, policy and parent services;
  it does not newly qualify Firebase/OPA/Editorial or original frontend acceptance.
  Service recreation replaces Nest instances over retained disposable stores,
  not independent OS-process crash windows. Full legacy browser/export/erasure
  journeys are not rerun; their updated BFF fixture wrapper is qualified separately.
  Existing Wapps stores and buckets are untouched and disposable containers are
  cleaned by the runner.
- Retained failures include sandbox-denied localhost listeners, stale declarations
  before prerequisite builds, an initial Nx graph failure, and a mistaken `.ts`
  rather than `.cjs` Account Jest config. Corrected runs pass. BFF regression found
  an outdated expected generic downstream body and an application-reply mapping
  that used article text limits; both are corrected. The final selection test
  narrows unknown JSON by asserting its full expected value. A module-metadata test
  initially hit Jest's ESM `uuid` loader and now mocks only unused ID generation;
  real runtime qualification continues to use production generation.

Activation requires the index migration and a coordinated Community/BFF/Account/
ingress switch because old dedicated owner routes no longer exist. Follow the
Community README's fencing, backup, migration, convergence and traffic reopening
order. No commit, image publication, live service restart or deployment occurs.
All 2,078 pre-turn portal/UI files and the lockfile remain byte-identical. Original
frontend merge/visual acceptance, other capability API migrations and the broader
operational release gates remain outstanding.

## Generic Discussion routes through BFF (October 16, 2026)

Eight explicit BFF handlers now cover `/api/discussions` listing/reading,
creation, comments, editing/deletion and comment like/unlike. Both local and alpha
portal ingress configurations send this exact route family to Catalog BFF. The
existing endpoints and JSON/receipt contracts are preserved, including arbitrary
consumer content, optional subject references, lifecycle/visibility, structural
redaction, aggregate revisions and historical idempotency keys. Generic endpoints
remain unbound; they cannot access or mutate application/article-bound resources.

The BFF validates trusted ingress context, bounded bodies and complete response
structures, forwards only allowlisted identity headers, and sends each command
once without redirects or automatic retries. The owning Community service retains
canonical access, consumer bindings, payload interpretation, SQL transactions,
immutable objects, receipts and outbox/materialization behavior. No SDK, owning
service, database schema or projection-format change is introduced. The generic
route has a scoped 300 KiB HTTP parser/transport limit for the existing 256 KiB
content envelope; application-topic/comment route limits remain unchanged.

Qualification uses Node 22.17.1 on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, preserving all prior uncommitted work.
The unchanged-lockfile clean-install snapshot from the preceding checkpoint is
updated with this slice's sources. Evidence and the pre-turn source/hash archive
are in `/tmp/wapps-generic-discussion-bff`.

Commands run in
`/var/folders/35/y91w68hd3t51n5phjfqzcwzm0000gp/T/wapps-boundary-qualification-65t8wf73`,
with Node 22.17.1 on `PATH` and `NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true`:

```sh
node node_modules/jest/bin/jest.js --config apps/services/catalog-bff/jest.config.ts --runInBand
node node_modules/nx/bin/nx.js run-many -t test -p sdk-features-discussion-core,sdk-features-discussion-management,sdk-features-discussion-applications-management,sdk-features-discussion-applications-materializer --parallel=2 --skip-nx-cache
node node_modules/nx/bin/nx.js run apps.services.catalog-bff:build --skip-nx-cache
node node_modules/nx/bin/nx.js run apps.services.catalog-bff:lint
node node_modules/typescript/bin/tsc -p apps/services/catalog-bff/tsconfig.spec.json --noEmit --incremental false
node node_modules/eslint/bin/eslint.js tools/readiness/bff-generic-discussions-runtime-checks.cjs tools/readiness/qualify-materialization.cjs tools/readiness/discussion-recovery.test.cjs
npm run check:boundaries
node tools/readiness/qualify-materialization.cjs --discussion-bff
```

- Full BFF Jest regression passes 1,766 tests / 24 suites, including 93 generic
  route HTTP tests. Discussion core, management, Community and materializer
  regressions pass another 626 tests / 45 suites.
- Uncached BFF build and its 24 prerequisite tasks pass. BFF spec/source typecheck,
  affected BFF/readiness lint and `git diff --check` pass. BFF retains seven
  pre-existing lint warnings. Architecture checks pass for 140 projects and
  1,798 production sources with zero violations.
- `node tools/readiness/qualify-materialization.cjs --discussion-bff` passes seven
  runtime groups through production BFF/Community HTTP handlers, both real nginx
  API/auth configurations and fresh MySQL, MongoDB, RabbitMQ and MinIO containers.
  It covers large arbitrary JSON, exact replay/conflicts, ingress-header forgery,
  tenant/owner/policy denial, replies and likes, paused consumption and stale reads,
  immediate privacy revocation, removed-ancestor redaction, service recreation,
  dependency failure/reconnect, application-topic/article-comment/review regressions,
  exact consumer binding, parent denial, deletion and stale-generation suppression.
  The existing outbox dispatcher publishes confirmed messages; the harness consumes
  them and acknowledges only after the production materialization function succeeds.
- This qualifier uses controlled authentication/policy/parent-authority fixtures.
  It does not qualify Firebase/OPA/Editorial integration, browser presentation,
  production deployment or process-crash recovery. Service recreation uses fresh
  Nest instances against the same disposable stores, not container/process restarts.
  Existing live Wapps stores, buckets and services are not modified.
- A real bootstrap regression was found and fixed: registering a route-local
  middleware named `jsonParser` suppressed Nest's default parser for other routes.
  A regression test reproduces the 400 response before the fix and passes after
  wrapping the route-local parser. The full real-store rerun passes. Failed evidence
  is retained, including an initially missing Editorial URL in the HTTP fixture,
  the harness's `local_auth` rewrite error and a disposable Mongo IPv6 bind failure.
  The runner now binds its temporary Mongo listener explicitly to IPv4; host-gateway
  overrides are limited to Linux in the nginx harness.
- All 2,078 pre-turn portal/UI source files and the lockfile remain byte-identical.
  No new migration, commit, image publication or deployment is performed.

This supersedes the pending generic-discussion BFF item in earlier checkpoints.
Next bounded integration is authentication/session handling through BFF, followed
by remaining account administration and staff health-monitor routes. Alpha still
has older direct routes for other families; this checkpoint only changes generic
Discussion there. Original frontend merge/visual acceptance, release packaging,
deployment, backup restoration, rollback and load gates remain outstanding.

## Consumer boundaries for Reviews and Identity (October 16, 2026)

Applied the consumer-owned binding approach to the five audited areas. Review core
validates an opaque, case-sensitive `bindingKey`; Wapps preserves its original
`applicationId` response contract in `libs/domains/community`. The Review lifecycle,
canonical application visibility/tenant checks, SQL scopes and historical command
fingerprints are unchanged.

Reusable Identity management now owns saved-association/watch mechanics, shared
notification delivery/inbox mechanics and export/erasure coordination. Wapps target
schemas, key construction, favorites/update source routing, reply/mention contracts,
profile activity/provider composition, service-access policies and required provider
rosters live in `libs/usecases/account` (`@wapps/account`). Its account schemas and
SQL adapters move together to `libs/adapters/account-mysql`
(`@wapps/account-mysql`). Keeping canonical account transactions together preserves
shared revisions, write barriers, exact receipts and lifecycle cleanup. Other Wapps
profile/preference use cases move with their ports to prevent a reverse dependency.
Existing Identity application entrypoints compose these packages. All callers,
compiler references and runtime qualification imports use the new boundaries.

The generic engines do not parse consumer namespaces, content types or key versions.
Wapps keeps the exact existing export roster (`account`, `credentials`, `editorial`,
`discussion`) and erasure roster (`account`, `editorial`, `discussion`). Both generic
coordinators require the consumer's complete plan; they reject missing/duplicate
providers and mismatched receipts. Artifacts are validated against the fixed Wapps
plan at SQL read/completion boundaries. A future plan change requires an explicit
durable-job migration; it cannot be an environment toggle. This extraction adds no
SQL migration or new projection format. Stored rows, leases, outboxes, internal
revisions, command fingerprints and delivered/suppressed receipts retain their
existing representations. Frontend changes are contract imports/references only;
all pre-turn portal/UI templates and styles are byte-identical.

`rules/consumer-capability-boundaries.md` records the rule. ARCH009/010 prohibit
consumer imports, known content-type coupling and fixed provider registries in
reusable Identity/Review code. Kernel and Discussion import checks also cover the
new consumer library locations. Existing responsibility tags and the usecase/adapter
dependency matrix apply to `libs/usecases` and `libs/adapters`.

Verification: Node 22.17.1; branch `codex/full-operation`; base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, with the existing uncommitted work preserved.
Clean `npm ci` uses the unchanged lockfile in the isolated snapshot
`/var/folders/35/y91w68hd3t51n5phjfqzcwzm0000gp/T/wapps-boundary-qualification-65t8wf73`.
Evidence is retained in `/tmp/wapps-consumer-boundary`.

- Full `npm test`: 6,256 Jest tests / 406 suites and 33 portable checks pass, without
  skips/todos. The initial sandbox run could not bind HTTP listeners; the authorized
  rerun passes all 54 test-owning projects. Seven external qualifications remain
  separately inventoried, not reported as unit-test passes.
- Full workspace lint plus the corrected `wapps-account` and readiness-tool reruns
  passes. The only introduced lint error was a self-package import in the moved
  export test; it now uses a relative import. Existing warnings remain.
- Uncached clean builds pass for all 136 declared build projects. All 45 declared
  typecheck targets and 59 prerequisite tasks pass. Emitted Angular inspection passes
  all 64 packages; Account/Auth/Community/BFF/Editorial bundles have no unresolved
  `@wapps` runtime dependencies. The unrelated `store-app` build still logs a pruned
  lockfile fallback for `@domains/catalog/media@0.0.1`; its successful exit does not
  qualify that deployment artifact.
- `npm run check:boundaries`: 140 projects, 1,794 production sources, zero violations.
  All eight architecture-policy/source-audit tests pass after the final guard change.
- Fresh MySQL qualifiers pass: ordinary account recovery, `--account-export-storage`,
  and `--account-erasure-coordinator`. These cover rollback, concurrent writes,
  canonical privacy/revisions, exact replay, restart/reconnect, complete export
  artifacts, lease fencing and completion only after all participant receipts.
  The export fixture initially omitted the existing Account mentions migration;
  adding it to the fixture fixes that real failure, and all three qualifiers pass.
- Fresh SQL/MinIO qualifiers pass: `qualify-materialization.cjs --reply-notifications`,
  `--mention-notifications`, and `--favorite-updates`, each independently. They cover
  atomic intent, receipt deduplication, lost acknowledgements, suppression, current
  visibility, source outages, quarantine/requeue, account isolation, export and
  erasure. Each run creates disposable stores; existing Wapps buckets are not used.
- `git diff --check` passes. No template/style or lockfile change in this turn.

This is a backend boundary refactor, not full-service or visual acceptance. No
production deployment or new live BFF acceptance run was performed. The original
frontend merge/visual acceptance and existing release blockers remain outstanding.

## Consumer-owned Discussion keys (October 15, 2026)

Discussion now accepts an opaque, case-sensitive `bindingKey`. Its consumer owns
the key's meaning and any namespace or format/version convention. The SDK and
materializer contain no application/article target registry or payload schema.
Structural discussion/comment roles, concurrency revisions, immutable references
and projection schema markers remain internal durability mechanisms.

The reusable command/query engine and binding/access ports live in
`sdk/features/discussion/libs/management`. Wapps public contracts move to
`libs/domains/community`; the Wapps runtime and provisioning move from the SDK to
`apps/services/community`. Existing project, output and deployment identities are
retained for compatibility. Community supplies target/payload interpretation,
current parent access, policy mapping, mentions, anonymity and historical request
fingerprints. Exact keys and canonical authority are checked on reads and writes;
generic routes cannot bypass a bound parent's access rules. Browser contract
imports change; templates, styles, UI components and interactions do not.

`CommunityDiscussionBindingKeys1792080000000` adds and validates binary key storage,
backfills consumer bindings and transactionally requeues the existing revision's
outbox intent. It preserves revisions, command receipts, immutable references and
tombstones. Projection schema 4 supports guarded same-revision upgrades from 3;
obsolete consumer fields are removed. Erasure retains old stable guards until
upgrade. Old writers/materializers must be fenced during activation. See the
Community README and materialization contract for migration/rollback limits.

Verification on Node 22.17.1, branch `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, with uncommitted changes in the
lockfile-qualified `/tmp/wapps-clean-install-ekk5hezn` snapshot:

- Full `npm test`: 6,241 Jest tests / 403 suites and 28 portable checks pass.
  The final portable rerun passes all 32 checks, including four new object-store
  isolation checks. Full workspace
  lint passes with existing warnings. Seven project typechecks and 48 prerequisite
  tasks pass; the BFF spec compiler check passes separately.
- Clean uncached Community, materializer and aggregator builds plus 99 prerequisite
  tasks pass. Angular emitted-artifact inspection passes. Architecture audit:
  139 projects / 1,786 production sources, no violations. ARCH007/008 prohibit
  Discussion imports of consumer domains and known consumer target coupling.
- Isolated real-store Discussion migration/recovery passes: transaction failure
  and resume, historical command replay, same-revision projection upgrade,
  obsolete field removal, stale snapshot refusal and an unknown consumer key
  (`unknown-consumer|document@v987/opaque-id`) through SQL/MinIO/Mongo. Original
  create/reply/update/delete/vote/pin fingerprints are frozen in consumer tests.
- Fresh-container author/interaction/projection/review erasure qualification
  passes. The general materialization runner also passes Catalog, but its two
  Editorial recovery suites fail because their fixture migration lists omit
  current `classification` columns. The overall runner is therefore not green;
  those separate fixture/migration checks remain release blockers.
- The local forward migration is applied with writers fenced. Nine application
  discussion and nine comment/review BFF groups pass. After payload recovery, the
  existing example thread returns 200 with both comments through BFF; the unbound
  route returns 404. Final reconciliation: 75 examined, 75 current, zero rebuilds,
  conflicts or failures. All fifteen local services run; all eleven configured
  health checks pass. The final regression's cleanup reports no errors and accepts
  two disposable account erasures without claiming background completion.
- Of 2,078 baseline portal/UI files, 35 change only contract imports/re-exports or
  compiler references. No templates, styles or shared UI files change in this
  slice. The earlier dirty worktree is preserved; no commit or reset is made.

### Local qualification incident and recovery

At 15:54 UTC on October 15, an incorrectly invoked erasure qualifier used a
disposable SQL database with the shared local MinIO bucket. Its inventory retired
95 existing payload objects. This was a test-isolation mistake, not pre-existing
corruption. Two payloads belonged to the live example thread; 93 were current or
historical payloads of already-deleted disposable test threads.

All 95 objects were restored from projection copies or deterministic fixture
definitions, accepting bytes only when both SHA-256 and length matched canonical
SQL metadata. Recovery held canonical locks, used conditional object writes and
reverified bytes; SQL hashes, references and revisions were unchanged. The audit
then verified all 112 committed registered objects and all 29 current references,
with zero inconsistent objects and zero remaining incident retirement markers.
The original thread was requeued from canonical authority. Its one incident
dead-letter request was archived and reprocessed against the restored canonical
snapshot before acknowledgement; the Discussion failed queue then contained zero
requests. No queue purge was used.

The qualifier now rejects any pre-existing object-store bucket before mutating
fixtures, claims a fresh dedicated store with a unique marker and detects racing
claims. Portable tests and read-only verification against the existing local
store confirm rejection before mutation. Use `qualify-materialization.cjs`, which
provisions dedicated containers; isolated SQL alone is insufficient. Safe erasure
and Discussion recovery runs supersede the unsafe run's functional evidence.

Evidence is under `/tmp/wapps-review/opaque-key-*`, including failed runs and private
recovery metadata. The initial comments/reviews regression encountered a stale
gateway upstream after Community recreation; its fixtures were cleaned and the
gateway configuration validated/reloaded. These local diagnostics are not a
permanent release record. Original frontend merge/visual acceptance, remaining
BFF routes and production deployment/rollback/load/backup qualification stay open.

## Article comments and member reviews through BFF (October 15, 2026)

Six article-comment and ten member-review handlers now cross BFF, with complete
case-insensitive gateway families. Comments cover cursor pages, full threads,
creation/replies, author editing and authorized deletion. Reviews cover public
pages/detail/ratings, the member's publish/edit slot, withdrawal, helpful membership,
versioned reports and staff hide/restore/report/moderation pages. No frontend
source/assets, owning-service behavior, migration or materializer changes.
Original frontend merge and visual acceptance remain outstanding.

Comments reuse the bounded discussion transport and pure comment contracts.
Reviews have an explicit module/client/transport using the pure Review domain.
Both verify ingress provenance and forward only allowed identity/tenant/roles.
The BFF validates selectors, content, response IDs, ancestry/redaction, rating
consistency, pagination and receipts. It preserves each workflow's existing key
grammar and expected revisions. It has no database access, projection-based
authorization, automatic command retry or lifecycle preflight.

The owning service keeps canonical parent/tenant/author/policy decisions. Comments
retain immutable payloads, SQL receipts/outbox and Mongo generation materialization.
Reviews retain canonical SQL snapshots, immutable content/report versions, helpful
facts, independent withdrawal/hide flags, historical receipts and the event journal.
Review broker delivery is not claimed. Requests are 32 KiB; normal responses 512 KiB;
comment threads share the two-slot/64-MiB transport bound and 2,000-node/depth-64
contract. All requests have 15-second deadlines and no redirects.

Verification on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, with uncommitted integration changes:

- Node 22.17.1 and lockfile-qualified `/tmp/wapps-clean-install-ekk5hezn`, Nx cache
  disabled. BFF tests: 1,673 / 23 suites, including 184 new production-AppModule
  HTTP tests. Affected domain/service/unchanged feature tests: Discussion core
  143 / ten, owning service 532 / 38, Review core 27 / one, review feature 24 / two,
  article feature 81 / eight. Total: 2,480 tests / 82 suites.
- Commands: `nx test apps.services.catalog-bff --runInBand --skip-nx-cache` and
  `nx run-many -t test -p sdk-features-discussion-core,sdk-features-discussion-applications-management,sdk-features-review-core,portals-shared-features-review,portals-shared-features-articles --runInBand --skip-nx-cache`.
  BFF build plus 23 prerequisite tasks, lint, separate spec typecheck, qualifier
  lint/syntax and `npm run check:boundaries` pass. Seven existing BFF warnings
  remain. Audit: 137 projects / 1,774 production sources, zero violations.
- Nine live comment/review groups pass through gateway/BFF/Discussion with real
  local MySQL, Mongo, RabbitMQ, MinIO, OPA and the Firebase credential emulator.
  Independent sign-in, author/parent isolation, spoofed-admin denial, exact replay,
  key/revision conflicts, nested replies, moderator redaction, multilingual text
  and eleven-root pagination pass. Reads expose no account/reporter IDs.
- Reviews publish immediately from canonical SQL; two independent members produce
  current totals/distributions. Helpful add/remove is per member. Reports preserve
  the reported content version. Staff hiding survives author edits; staff restore
  does not cancel author withdrawal. Republish restores visibility only when both
  flags allow it. Historical hide replay does not overwrite newer state.
- During paused comment materialization, accepted edits return pending receipts,
  stale full-thread/containing-page reads return 503, and unaffected pages stay
  readable. Review reads/writes remain current. Recovery materializes the exact
  comment revision. Root deletion immediately hides a still-stored live generation;
  old creation replay cannot resurrect it, and the tombstone later converges.
- OPA, Editorial and Discussion outages fail closed; exact commands recover after
  restart. Editorial's ownership-DNS sidecar is restarted. Stopping BFF makes all
  sixteen handlers and case/slash/unknown-family variants unavailable. Restoring
  BFF preserves current content and historical receipts. Parent withdrawal revokes
  comments/reviews; independently republishing restores retained associations.
- Nine existing application-discussion live regression groups pass against the
  shared transport, including votes/pins, participation/selection/favorites,
  dependency outages, materialization lag, restart/replay and cleanup. A real
  15-second stalled-review HTTP test confirms uncertain failure without an
  automatic retry, followed by the caller's exact retry; the final full BFF
  regression, lint and spec typecheck pass after this coverage was added.
- Browser checks use the existing Review Member session: review list/rating
  distribution, detail, owner controls and article comment empty state/form
  survive reload. The comment reload control works. No browser content or settings
  were saved, and the original discussion page is restored. DOM evidence is in
  `browser-rating.txt`, `browser-detail.txt`, and `browser-comments.txt` under the
  evidence prefix. Screenshots are `/tmp/wapps-review/screenshots/bff-comments-reviews-rating.png`
  and `bff-comments-reviews-article.png`. This is integration evidence, not visual
  acceptance or a saved browser comment/review journey.

The initial HTTP harness omitted the production module's required Editorial origin;
that setup was corrected. Its passing focused retry ran in the existing checkout;
the final complete BFF run and build/lint/typecheck used the qualified isolated
snapshot. The first live attempt expected page one to fail during lag although the
stale root was on page two. The qualifier now checks the containing cursor page and
also confirms the unaffected first page stays readable. All failed-run fixtures
were cleaned and two account erasures accepted; the fresh run passes. Failed
evidence is retained. No owning-service fix was needed.

Evidence prefix: `/tmp/wapps-review/bff-comments-reviews-`. Automated logs:
`bff-regression-final.log`, `domain-regression.log`, `build.log`, `lint-final.log`,
`typecheck-final.log`, `boundaries.log` and `qualifier-lint-final.log`. The initial
`http-tests.log`/`runtime.json`/`runtime.log` retain failures; `runtime-second.json`
and `.log` record the nine passing groups. Private mode-0600 `.accounts.json`
siblings contain recovery credentials and must not be published. Rollback BFF/nginx
artifacts are in `/tmp/wapps-review/before-bff-comments-reviews`.

`discussions-regression.json`/`.log` retain the nine passing related live groups.
Six disposable account erasures across the initial, fresh and regression runs are
accepted; background completion is not claimed. All disposable content is cleaned
through normal APIs, with no resets/reseeding or changes to existing staff rights.
All fifteen local services run and configured health checks pass; nginx validates
(`final-health.json`). `source-manifest.json` confirms 2,078 portal/UI files and
4,104 pre-existing files outside this slice are unchanged. Qualified BFF source,
the active runtime build and gateway match. This preserves the current frontend;
it does not certify it against the accepted pre-work reference.

This supersedes pending article-comment/member-review BFF work below. Generic
discussion and remaining account/authentication/health routes still need migration.
Original frontend merge/visual acceptance and full workspace, deployment, load,
crash-window/replay/rebuild and backup-restoration gates remain open. No commit
was made.

## Application discussions and replies through BFF (October 15, 2026)

Ten explicit handlers now cover application topic lists and full threads,
creation/nested replies, edits/deletion, voting, moderator pin/unpin, private
participation pages and public favorite selection. The three complete gateway
families route through BFF, including case/slash variants and unknown suffixes.
No frontend source/assets, owning-service behavior, migration or materializer
protocol changes. Original frontend merge and visual acceptance remain outstanding.

`PortalDiscussionsModule` uses pure Discussion contracts and fixed bounded clients.
Ingress identity is verified and only allowed identity/tenant/role context is
forwarded. Selectors, IDs, revisions, content/mentions, tree ancestry, redacted
ancestors, vote state, page/selection bounds and command receipts are validated.
Historical receipts remain historical; BFF neither retries commands nor performs
projection/lifecycle preflights. Discussion retains canonical authorization,
identity lifecycle, parent eligibility, immutable payload references, SQL revisions,
receipts, transactions, outbox and generation materialization.

Requests are bounded to 32 KiB, ordinary responses to 512 KiB and full-thread
transport to 64 MiB with two concurrent full-thread requests. Full contracts retain
up to 2,000 nodes/depth 64; owning-service generation byte limits remain independent.
Downstream deadlines are 15 seconds, redirects/retries disabled, responses
private/no-store and dependency failures explicit. Topic lists carry roots only;
participation pages retain valid short/empty continuations for hidden parents.

Verification on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, with uncommitted integration changes:

- Node 22.17.1, lockfile-qualified `/tmp/wapps-clean-install-ekk5hezn`, Nx cache
  disabled. `nx run-many -t test -p apps.services.catalog-bff,sdk-features-discussion-core,portals-shared-features-discussion,sdk-features-discussion-applications-management --runInBand --skipNxCache`
  passes 2,230 tests / 77 suites: BFF 1,489 / 22 (145 new production-AppModule
  HTTP tests), Discussion core 66 / seven, unchanged frontend feature 143 / ten,
  and owning service 532 / 38.
- BFF build and 23 prerequisite tasks, BFF lint, separate spec typecheck,
  readiness qualifier lint/syntax and `npm run check:boundaries` pass. Seven
  pre-existing BFF lint warnings remain. Boundary audit: 137 projects / 1,766
  production sources, zero violations. Explicit inspection confirms no service
  adapter/database imports, domain authorization relocation or projection access.
- Nine live discussion groups pass through gateway/BFF/Discussion and real local
  Firebase emulator, OPA, MySQL, Mongo, RabbitMQ and MinIO. Coverage includes all
  ten routes, independent sign-in, owner/parent isolation, spoofed moderation
  denial, revisions/keys, multilingual edits, nested replies and participation.
- Upvote/downvote/clear retains each viewer's own choice; only the assigned admin
  can pin. Replaying older vote/pin receipts never undoes newer state. Twelve-topic
  pagination is pinned-first, unique and bounded; lists return root previews and
  selection excludes replies/missing IDs. Existing favorites resolve real metadata.
- Paused materialization returns 503 for stale reads while canonical edits and
  reply deletion commit. Recovery retains a redacted parent and its live child.
  Mongo outage does not block canonical writing/replay; object-store failure
  cannot commit a partial edit. BFF and Discussion restarts preserve content and
  receipts, and all family variants fail while BFF is stopped.
- Root deletion immediately hides text, selection, participation and favorite
  metadata while a live generation remains stored. Historical create/delete
  replay cannot resurrect it; the tombstone converges after worker recovery.
  Withdrawing the parent application also blocks live topics and new creation.
- Seven existing favorites/inbox runtime regression groups pass, including real
  reply/mention/favorite-update delivery, pagination, recipient isolation, durable
  mark-read retries, saved opt-out, dependency outages and cleanup.
- Browser reload, application topic list, quick-thread dialog and My Discussions
  pass using the existing Review Member session. No browser content/settings were
  saved. The original discussion page is restored. Screenshots under
  `/tmp/wapps-review/screenshots/`: `bff-discussions-quick.png` and
  `bff-discussions-workspace.png`. This verifies integration, not frontend fidelity.

Initial HTTP setup lacked the production module's required Editorial origin;
the fixture was corrected. A separate spec typecheck caught an un-narrowed JSON
result; final tests and typecheck pass. The first runtime attempt used the wrong
catalog URL in setup/cleanup. It deleted its fixture application but the bad cleanup
assertion delayed account erasure. The correct public endpoint was checked and both
account erasures accepted in a separate recovery step. Failed evidence is retained;
the fresh second full run passes without owning-service changes.

Evidence prefix: `/tmp/wapps-review/bff-discussions-`. `tests.log`, `build.log`,
`lint.log`, `typecheck-qualified.log`, `readiness-lint.log` and `boundaries.log`
record automated checks. `live.json`/`.log` retain the failed first run and
`live-cleanup-recovery.json` records completed cleanup. `live-second.json`/`.log`
record nine passing discussion groups; `member-regression.json`/`.log` record
seven passing related groups. Credential-bearing `.accounts.json` siblings are
private recovery records and must not be published. Rollback artifacts are in
`/tmp/wapps-review/before-bff-discussions`.

All disposable topics/applications are deleted through ordinary APIs; six account
erasures across initial cleanup, the successful run and regression were accepted.
Background erasure/payload/audit retention completion is not claimed. No stores
were reset/reseeded and existing fixture content/staff permissions were preserved.
All fifteen services run with configured health checks passing, and active nginx
configuration validates (`final-health.json`). `source-manifest.json` records
unchanged frontend/pre-existing files and matching qualified/runtime artifacts.

This supersedes pending application discussion/reply BFF work below. Generic
`/api/discussions`, article comments, application reviews and remaining account/
authentication/health routes still need migration. Original frontend merge/visual
acceptance and full workspace, deployment, load and recovery gates remain open.
SQL crash windows, broker duplicate/reorder, authoritative rebuild and backup
restoration were not rerun for this transport slice. No commit was made.

## Articles and covers through BFF (October 15, 2026)

Twenty-four explicit handlers now cover article list/detail/create/update/delete,
publication status/submit/withdraw, independent staff queue/detail/decision,
public browse/slug/selection/visibility, cover reservation/list/detail/cancel/upload,
private normalized previews, frozen owner/staff submission previews and public
covers. Complete case-insensitive route families require BFF, including slash
variants and unknown suffixes. Existing article adapters keep their contracts.
No frontend source/assets, owning-service behavior, migration or projection
protocol changes. Original frontend merge and visual acceptance remain outstanding.

`PortalArticlesModule` uses pure article/media contracts, fixed Editorial routes,
verified ingress identity and deliberate context forwarding. It checks selectors,
response identity, pages/page sizes, category/tag matches, frozen fields and
receipts. Commands preserve keys and expected revisions. Bounds accommodate valid
multibyte articles: 96 KiB JSON requests, 2 MiB ordinary/page responses and 8 MiB
for the exact 100-draft workspace. Binary input/output is bounded to 8 MiB, with
two upload buffers and four preview buffers. Authorization precedes upload body
buffering; length/hash and quoted revision are checked before forwarding exact
source bytes. Disconnects cancel work and release permits. JSON/preview and upload
deadlines are 15/30 seconds. There are no automatic retries or redirects.

Editorial retains canonical ownership/staff independence, immutable submissions,
classification review, unique public slugs, SQL revisions/receipts/atomic outbox,
cover references, normalization/storage and materialization. BFF has no store
access or lifecycle preflight that can reject historical receipt replay. Public
text requires the exact selected projection revision; public covers require the
current canonical reference and authority recheck after object I/O.

Verification on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, with uncommitted integration changes:

- Node 22.17.1, lockfile-qualified `/tmp/wapps-clean-install-ekk5hezn`, Nx cache
  disabled. `nx run-many -t test -p apps.services.catalog-bff,domains-publication-article,catalog-media,portals-shared-features-articles --runInBand --skipNxCache`
  plus focused Editorial `--testPathPattern='(articles|article-covers)/'` and the
  final full BFF rerun pass 1,608 tests / 40 suites: BFF 1,344 / 21 (261 new),
  article domain 68 / three, media domain 54 / four, unchanged article feature
  81 / eight and Editorial 61 / four.
- BFF build and 23 prerequisite tasks, BFF lint, separate spec typecheck,
  readiness lint and architecture audit pass. Seven pre-existing BFF lint warnings
  and two readiness warnings remain. Architecture: 137 projects / 1,760 production
  sources, zero violations. Explicit review confirms domain/authorization/storage
  boundaries and bounded fixed-route clients.
- Eight article runtime groups pass through gateway/BFF/Editorial, Firebase
  emulator, OPA, MySQL, Mongo, MinIO and materializer. Coverage includes all 24
  routes, independent sessions, isolation/spoofing, revisions/keys, multibyte saves,
  real cover normalization/replay, reference protection, frozen review versus
  private edits, rejection/resubmission and live staff self-review denial.
- Independent approval preserves reviewed text/classification/cover. Browse,
  search, pagination, selection/visibility and immutable unique slugs pass. Paused
  materialization yields 503 for stale text while public covers remain canonically
  authorized. Object/Mongo failures remain explicit; private text editing and
  canonical media authority do not depend on a projection.
- BFF outages prove every migrated family, case/slash variants and unknown suffixes
  cannot bypass it. BFF/Editorial restart preserves drafts and historical receipts.
  Replacement removes old public cover access immediately; withdrawal hides text,
  selection/visibility and covers while a revision-1 live projection remains.
  Queued replacement/withdrawal converges to the revision-3 tombstone; replay cannot
  resurrect content.
- Ten related application draft/image runtime regression groups pass. The first
  regression attempt found an outdated control asserting that articles stay
  available while BFF is stopped. Nine older readiness scripts now expect article
  unavailability at that integration boundary. Only that one assertion changed in
  each; the other eight complete runtime qualifiers were not rerun. Readiness lint
  and syntax checks cover all nine; the new article runtime directly covers the
  shared assertion. The first regression cleaned its fixtures; the fresh run passes.
- Browser checks with the existing Review Member session read the saved draft,
  selected cover, approved frozen submission and public article, and reload
  successfully. The workspace showed an explicit unavailable state during the
  regression outage and recovered after reload. Staff review denies member access.
  No browser content or session changes; the original discussion page is restored.
  Screenshots: `/tmp/wapps-review/screenshots/bff-articles-workspace.png`,
  `bff-articles-public.png`, `bff-articles-review-denied.png`. These demonstrate
  integration, not original-frontend fidelity or visual acceptance.

The first compiler pass caught a URLSearchParams tuple typing issue; lint caught a
control-character regex and an unused test binding. These were corrected and the
final checks pass. The first runtime attempt assumed 404 for a cancelled empty
cover; Editorial returns 400 because it never had an image. The second assumed
category case folding, but the article schema explicitly requires binary collation.
The qualifier now uses the exact category, and BFF checks that response contract
while preserving owning-service title search. Both failed runs cleaned fixtures;
their reports remain preserved. The third full article run passes. Owning-service
behavior and failure handling were preserved.

Evidence prefix: `/tmp/wapps-review/bff-articles-`. `tests.log`,
`owning-tests.log`, `bff-tests-schema-qualified.log`,
`build-schema-qualified.log`, `lint-schema-qualified.log`,
`typecheck-schema-qualified.log` and `architecture.log` contain automated evidence.
`live.json` and `live-second.json` retain failed attempts and cleanup;
`live-qualified.json`/`.log` contain the passing article run.
`application-media-regression.json`/`.log` retain its initial failed assertion;
`application-media-regression-qualified.json`/`.log` contain the passing regression.
Credential-bearing `.accounts.json` siblings must not be published. Rollback
artifacts remain in `/tmp/wapps-review/before-bff-articles`.

Across three article runs and two media regressions, ten disposable account
erasures were accepted; background completion is not claimed. Disposable articles
and application fixtures are withdrawn/deleted, public covers inaccessible and
regression grants/DNS fixtures cleaned. Audit/media retention and asynchronous
cleanup remain under owning-service lifecycle rules. No reset/reseed occurred.

Final source/runtime preservation is recorded in
`/tmp/wapps-review/bff-articles-source-manifest.json`: 2,060 frontend source/config/
asset files match the prior isolated snapshot; 197 pre-existing dirty files outside
this slice remain unchanged. Each of the nine updated readiness qualifiers differs
from its captured baseline only in the article-outage assertion. The running BFF
artifacts and gateway files match the qualified sources/build; prior DNS records
and mode are restored. All fifteen services run, with health checks passing where
configured; nginx configuration and DNS reachability pass. Final health evidence is
`/tmp/wapps-review/bff-articles-final-health.json`.

This supersedes pending article BFF work below. Discussions/reviews and remaining
account/authentication/health routes still need BFF migration. Original frontend
merge/acceptance, deployed ingress, load and full release/recovery qualification
remain open. SQL crash windows, broker duplicate/reorder, rebuild, backup restore
and the complete workspace release gate were not rerun for this transport slice.

## Release authoring and publication through BFF (October 15, 2026)

Sixteen explicit handlers now cover private release list/source/read/create/open/
update/rebase/delete, publication status/submit/withdraw, independent staff queue/
detail/decision and public release pages/exact versions. The complete private,
review and catalog release families route to BFF, including case/slash variants
and unknown suffixes. The unchanged frontend release adapter retains full release
fields, change entries, filters and version URLs required by the original devlog.
No frontend source/assets, owning-service implementation, migration or projection
protocol changes. Original frontend merge and acceptance remain outstanding.

`PortalReleasesModule` uses pure catalog versioning contracts, verified ingress
identity and fixed Editorial routes. It bounds requests to 64 KiB, ordinary/page
responses to 2 MiB and the exact private list to 6 MiB: 100 valid multibyte drafts
can exceed 2 MiB. All operations use a 15-second deadline with no redirects or
automatic retries. IDs, selectors, both expected revisions, response identity,
page/filter consistency and receipts are checked. Legacy absent/null application
context remains distinguishable. The BFF performs no storage access, transition
preflight or authorization based on projections/historical receipts.

Editorial retains canonical identity/tenant and current ownership checks, frozen
submissions, independent review, immutable/unique public versions, SQL revisions,
receipts, atomic outbox and materialization. Private editing/deletion remains
available after revocation, but a new grant cannot silently rebind old drafts.
Public reads retain canonical selection, exact projection revision and authority
recheck. Lag returns 503; withdrawal returns 404 even with an old live projection.

Verification on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, with uncommitted integration changes:

- Node 22.17.1, lockfile-qualified `/tmp/wapps-clean-install-ekk5hezn`, Nx cache
  disabled. `nx run-many -t test -p apps.services.catalog-bff,catalog-versioning,portals-shared-features-application-workspace --runInBand --skip-nx-cache`
  passes BFF 1,083 tests / 19 suites, versioning 38 / one and unchanged application
  workspace 167 / ten. The separate Editorial `--testPathPattern=releases` run
  passes 27 / one, including staff self-review/tenant denial. Total: 1,315 tests /
  31 suites, including 167 new production-AppModule HTTP tests.
- BFF build and 23 prerequisite tasks, BFF lint, spec typecheck, readiness-tool
  lint and architecture audit pass. Seven existing BFF lint warnings and two
  existing readiness warnings remain. Architecture: 137 projects / 1,753
  production sources, zero violations. Explicit review confirms pure contracts,
  fixed routes, bounded clients and unchanged authorization/materialization owners.
- Eight live release groups pass through gateway/BFF/Editorial, Firebase emulator,
  OPA, MySQL, Mongo, DNS and materializer: private creation/source/CRUD, owner
  isolation/spoofing denial, revision/key conflicts, future-date denial, frozen
  review versus later edits, rejection/resubmission and independent approval.
  Public pages/version preserve punctuation, channel/date filters, empty pages,
  immutable URLs and version uniqueness, including after withdrawal.
- Paused materialization leaves public reads at 503 until approved content arrives.
  Revocation during Mongo outage blocks rebase/submission/approval from canonical
  authority while private edits/rejection and historical replay remain valid.
  A new grant requires new binding. Open/rebase detect stale publication revisions.
  Withdrawal hides notes while revision 1 remains stored; queued replacement and
  withdrawal converge to revision-3 tombstones. BFF/Editorial restarts and replay
  cannot resurrect publication. Independent sign-in reads the same saved draft.
- The related ownership runtime regression passes all ten groups, including DNS
  failure/recovery, independent approval, canonical editing, revocation during lag,
  grant replacement/release, service recovery and historical receipt replay.
- Browser verification uses the existing Review Member session: release list,
  saved draft, approved frozen snapshot, public list/version and reload pass.
  During the regression's intentional BFF outage, the page displays unavailable;
  reload after recovery restores saved content. Staff review explicitly denies
  member access. No saved browser changes or session changes. Screenshots are
  `/tmp/wapps-review/screenshots/bff-releases-workspace.png`,
  `bff-releases-public-version.png` and `bff-releases-review-denied.png`.
  These verify integration, not original-frontend fidelity or acceptance.

The initial sandboxed test launch timed out during local HTTP-server setup and
is not counted as qualification. The first isolated
HTTP run found test-table arity errors and one invalid fixture assumption; the
tests were corrected without changing production behavior, and the full regression
passes. The first live run passed all seven behavior groups but failed cleanup:
the original author's unbound application draft still reserved the slug needed
by a grant-bound import. The qualifier now removes that disposable private draft
before importing and does not erase fixture accounts if cleanup fails. A targeted
recovery run claimed/withdrew the earlier disposable parent through ordinary proof
and independent approval, then cleaned its new grant/account. The fresh full run
passes all eight groups. Failed evidence is retained; no assertion was relaxed.

Evidence prefix: `/tmp/wapps-review/bff-releases-`. `tests.log`, `owning-tests.log`,
`build.log`, `lint.log`, `typecheck-final.log`, `architecture.log` and lint reports
record automated checks. `live.json`/`.log` retain the failed cleanup attempt;
`cleanup-recovery.json`/`.log` prove its recovery; `live-qualified.json`/`.log`
record the passing run; `ownership-regression.json`/`.log` record regression.
Credential-bearing `.accounts.json` siblings must not be published. Rollback
artifacts are in `/tmp/wapps-review/before-bff-releases`.

Across both release runs, cleanup recovery and ownership regression, seven
disposable account erasures were accepted; background completion is not claimed.
All disposable parents, private drafts, grants and DNS records are cleaned.
Existing audit history is retained. Final source/runtime hashes and preservation
checks are in `bff-releases-source-manifest.json`: 2,060 frontend source/config/
asset files match the prior isolated snapshot and 200 pre-existing dirty files
outside this slice remain unchanged. The active runtime matches the qualified
build. All fifteen services run; nginx configuration and DNS reachability pass.
No reset/reseed occurred. SQL crash windows, broker duplicate/reorder, rebuild and
backup restoration were not rerun in this transport slice.

Next bounded BFF workflow is article authoring/publication/review and covers.
Discussions/reviews, remaining authentication/account routes, original frontend
merge/acceptance and full deployment, load and recovery qualification remain open.
This checkpoint is local release-workflow qualification, not full-product readiness.

## Application ownership through BFF (October 14, 2026)

Nine explicit handlers now serve claimant list/detail/create/verify/cancel/release
and independent staff queue/detail/decision, including pending and active-grant
views. Both complete ownership route families require BFF, including case/slash
variants and unknown suffixes. The unchanged ownership feature adapter retains its
contract. The accepted original ownership form's evidence URL and relationship
notes remain supported; its local demo persistence is not a source of business data.
No frontend source/assets, owning-service implementation, migration or projection
protocol changes. Original frontend merge/acceptance remains outstanding.

The BFF uses pure catalog ownership parsers and the existing bounded application
transport: verified identity forwarding, 64 KiB requests, 2 MiB responses,
15-second deadlines, private/no-store and no redirects/automatic retries. It
validates IDs, selectors, queue/claimant consistency and receipt action/revision.
It does not resolve DNS, access storage, preflight current grants or reinterpret
historical receipts. Editorial retains canonical website binding, identity/tenant
authorization, fenced DNS checks, throttling/freshness, independent approval,
active-grant conflicts, decisions/reasons, SQL revisions/receipts and atomic outbox.
Canonical editing and content publication still enforce the current grant and
independent content review while projections lag.

Verification on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, with uncommitted integration changes:

- Node 22.17.1, isolated lockfile-qualified `/tmp/wapps-clean-install-ekk5hezn`,
  Nx cache disabled. `nx run-many -t test -p apps.services.catalog-bff,catalog-ownership,portals-shared-features-application-workspace --runInBand --skip-nx-cache`
  passes BFF 916 tests / 18 suites, catalog ownership 14 / one, and application
  workspace 167 / ten: 1,097 tests / 29 suites. This includes 129 new production
  AppModule HTTP tests against a real local upstream.
- BFF build plus 22 prerequisite tasks, BFF lint, separate spec typecheck,
  readiness-tool lint and `npm run check:boundaries` pass. Seven pre-existing
  BFF lint warnings remain. Architecture: 137 projects / 1,748 production sources,
  zero violations. Explicit review confirms fixed routes, bounded transport,
  pure contracts, owning-service authorization and unchanged materialization.
- `bff-ownership-runtime-checks.cjs` passes all ten groups through real local
  gateway/BFF/Editorial, Firebase emulator, OPA, SQL, DNS, Mongo and materializer.
  Claims bind to the canonical website; proof at another host fails and fresh
  checks are throttled. Owner isolation, spoofed headers, creation/key conflicts,
  cancellation, required rejection reasons and staff self-review denial pass.
  DNS outage leaves the revision unchanged; original-key recovery verifies once
  after the check lease, without granting editing permission before approval.
- Independent approval enables canonical editing while projection revision 1
  remains stored; public reads return 503 until revision 2 arrives. Competing
  approval conflicts atomically. Private owner edits remain unpublished and
  require separate content review. BFF outages prove every ownership route family
  uses BFF; restart preserves grants and historical receipts.
- With Mongo unavailable and materialization paused, revocation commits revision
  3 and immediately blocks canonical source/rebase, resubmission and approval of
  pending owner content. Staff can reject that now-invalid proposal. Old approval
  and draft-import receipts still replay but cannot restore permissions. Mongo
  recovery confirms the old revision-2 document remains; materialization then
  converges to revision 3. Editorial outage/restart preserves revocation. A new
  independently approved grant can be voluntarily released, also denying canonical
  access before its older projection catches up.
- Browser verification uses the existing Review Member session: My ownership
  claims and the Atlas Notes approved claim (revision 3) load, the decision reason
  and observed proof date survive reload, and staff review shows explicit access
  denial. No browser mutation/session changes. The original discussion is restored
  and fully loaded. Screenshots: `/tmp/wapps-review/screenshots/bff-ownership-approved.png`
  and `/tmp/wapps-review/screenshots/bff-ownership-review-denied.png`. Full mutation
  and independent staff behavior are qualified through HTTP, not browser actions.

The first live attempt passed five groups, then expected gateway 502/503 during
BFF shutdown but received nginx 504. Its cleanup completed. The qualifier now
accepts all three gateway-unavailable statuses; application/Editorial/DNS failure
expectations remain 503. The fresh second attempt passes all ten groups. No product
behavior or safety invariant was relaxed. Both reports and the failed log remain.

The related application draft/image runtime regression passes all ten groups on
its first attempt against the new ownership path, including real normalized
image bytes, frozen/public previews, independent ownership approval, canonical
import/rebase, storage/service outages, restarts, historical replay and withdrawal.
Its only source change updates the fixture-boundary comment. Across the failed
ownership attempt, successful ownership attempt and image regression, six new
identities have erasure accepted with subsequent access denied; completion of
background erasure is not claimed. Disposable publications/drafts/grants and DNS
records are cleaned. Cancelled/revoked claim audit records remain canonical history.

Evidence prefix: `/tmp/wapps-review/bff-ownership-`. `tests-focused.log`,
`tests.log`, `build.log`, `lint.log`, `typecheck.log`, `tools-lint-final.log` and
`architecture.log` record automated checks. `live.json`/`live.log` retain the first
attempt; `live-qualified.json`/`.log` record the passing run. Recovery
`.accounts.json` siblings contain credentials and must not be published. Runtime
rollback artifacts and the prior DNS zone are in
`/tmp/wapps-review/before-bff-ownership`. `workspace-regression.json`/`.log` record
the passing related workflow. `source-manifest.json` records source/runtime/report
hashes and preservation checks. Final scoped formatting, `git diff --check`,
`nginx -t`, DNS reachability and local service health checks pass. All fifteen
services run; existing DNS records/mode and frontend source/assets are preserved.
Runtime artifacts match the qualified isolated build. No reset/reseed occurred.

Next bounded workflow is release authoring/publication and staff release review
through BFF. Article authoring/covers, discussions/reviews and remaining account/
authentication routes also remain. Original frontend merge/acceptance, deployment,
load and full release/recovery qualification are open. SQL crash windows, broker
duplicate/reorder and backup restoration were not rerun in this transport slice.

## Application publication and review through BFF (October 14, 2026)

Six explicit handlers now serve owner publication status/submit/withdraw and staff
queue/detail/decision. The gateway sends the complete application-draft and
application-review families to BFF, including case/slash variants and unknown
suffixes. Existing application-publication and media adapters keep their contracts.
No frontend source/assets, owning-service code, migration or projection protocol
changes. Original frontend merge/acceptance remains outstanding.

Publication shares the application transport's verified identity forwarding,
64 KiB JSON request / 2 MiB response bounds, 15-second deadline, private/no-store
responses and no redirects/automatic retries. Input and result parsing uses pure
catalog contracts. Receipt identity/action/expected/submitted revisions must match;
legacy image-snapshot markers and stale editing bindings remain visible. BFF does
not grant publication from projection state or interpret historical receipts as
current publication. Editorial still owns canonical access, independent review,
immutable submissions, slug uniqueness, transactions, receipts, outbox and monotonic
projection/tombstone behavior. There is no new database/object-store access in BFF.

Verification on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, with uncommitted integration changes:

- Node 22.17.1, isolated lockfile-qualified `/tmp/wapps-clean-install-ekk5hezn`,
  Nx cache disabled: BFF 787 tests / 17 suites, catalog record 94 / three,
  application-workspace feature 167 / ten. Total: 1,048 tests / 30 suites,
  including 97 new production-route publication HTTP tests.
- BFF build plus 22 prerequisite tasks, BFF lint, separate spec typecheck,
  readiness lint and architecture audit pass. Seven pre-existing BFF lint warnings
  remain. Architecture: 137 projects / 1,746 production sources, zero violations.
  Explicit review confirms fixed routes, bounded transport, pure domain contracts,
  canonical resource authorization and unchanged owning-service materialization.
- `bff-application-publication-runtime-checks.cjs` passes twelve groups through
  real gateway/BFF/Editorial, Firebase emulator, OPA, SQL, Mongo and materializer.
  It verifies owner/anonymous/staff access, self-review denial even for staff,
  immutable submissions versus later edits, rejection/resubmission, classification,
  original-key replay, conflicts and atomic public-slug collision. Paused projection
  delivery yields 503 after approval; public reads then resolve the exact frozen
  content without private review metadata. Private submission/review remain usable
  during Mongo outage. BFF/Editorial outages fail explicitly and restarts preserve
  canonical state. Withdrawal hides content while its revision-1 live projection
  remains stored; queued replacement and withdrawal converge to a revision-3
  tombstone. Old submit/approve receipts cannot resurrect it.
- The application draft/image qualifier passes all ten groups against the new
  publication routes, including image bytes, frozen/public previews, domain proof,
  independent ownership approval, canonical import/rebase, storage/service outages,
  replay and withdrawal. Its only source change is a comment reflecting that
  publication now goes through BFF while ownership setup still routes directly.
- Browser read verification after activation/reload passes for the existing Orbit
  Tasks publication page: saved revision 8, published submission 5 and pending
  submission 7 remain distinct; submitted logo/banner load at 512 x 512 and
  1,440 x 810 and status survives Reload publication. The public application
  overview still opens correctly. No saved mutations and no session changes;
  browser returns to the original Atlas Notes discussion. Staff decisions and the
  full mutation lifecycle are qualified through HTTP, not repeated in the browser.
  Screenshots: `/tmp/wapps-review/screenshots/bff-application-publication-owner.png`
  and `/tmp/wapps-review/screenshots/bff-application-publication-public.png`.

Both live qualifiers pass on their first run. The initial focused test attempt
failed because omitted tuple elements were interpreted as Jest completion callbacks,
and a malformed trusted-claims fixture expected 401 instead of the existing 400
contract. Its fixture typing also failed the spec compiler. Explicit tuple values
and correct status expectations resolve these test-only issues; focused tests,
full affected regressions and typechecking pass afterward. No runtime behavior was
relaxed to make those cases pass. The earlier draft/image checkpoint's per-project
test labels are corrected below from the original log; its total was accurate.

Disposable drafts/publications, ownership grant and DNS fixtures are removed.
Four new identities have erasure accepted with subsequent access denied; full
background erasure is not claimed. Existing staff permissions/account and existing
content are preserved. The local DNS sidecar rejoins Editorial after restart and
all fifteen services run. No reset/reseed or schema migration was performed.

Evidence prefix: `/tmp/wapps-review/bff-application-publication-`.
`tests-focused.log` retains the initial failure; `tests-focused-final.log` passes
97 cases and `tests.log` contains the three-project 1,048-test regression. Build,
lint, spec typecheck, readiness lint and architecture results are in their named
`.log` files. `live.json` and `workspace-regression.json` contain successful runtime
reports; recovery `.accounts.json` siblings contain credentials and must not be
published. Runtime rollback artifacts are in
`/tmp/wapps-review/before-bff-application-publication`. `source-manifest.json`
records source/runtime/report hashes and preservation checks. Scoped formatting,
`git diff --check` and `nginx -t` pass; runtime artifacts match the qualified build.

Next bounded slice is ownership claims/proof/status/release and staff ownership
review through BFF. Other authoring/media, discussion/review and account/auth routes
remain, as do original frontend merge/acceptance and full deployment/load/recovery
gates. SQL crash-window, broker duplicate/reorder and backup-restore proofs are not
rerun in this transport change. Stop here for the user's check.

## Application drafts and images through BFF (October 14, 2026)

The local gateway sends private application drafts, canonical import/rebase,
image reservations/uploads/cancellation, slot changes and all six preview variants
through `PortalApplicationsModule`. Existing frontend adapters keep their contracts.
No frontend source/assets, owning-service behavior, migrations or materialization
protocols change. Editorial still authorizes canonical ownership and tenant scope,
normalizes images and owns SQL revisions/receipts, immutable objects, fenced leases,
reference checks, outbox and projection lifecycle. The BFF has no database or object
store access. Original frontend merge/acceptance remains a separate outstanding step.

The BFF validates strict pure domain contracts, verified identity, source bytes/hash,
receipt identity/revision and WebP responses. JSON bodies are bounded to 64 KiB,
responses to 2 MiB, source/output images to 8 MiB. Two concurrent uploads include
preauthorization, buffering and downstream I/O; four preview slots last until
response finish/close. Body buffering and JSON/preview I/O have 15-second deadlines;
upload forwarding has 30 seconds. Disconnects abort downstream binary I/O. Gateway
timeouts cover these bounds and media buffering/retries are disabled. Original
keys/revisions are forwarded; no uncertain command is automatically retried. A
historical ready receipt may replay after cancellation without restoring bytes.

Verification on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, with uncommitted integration changes:

- Node 22.17.1, isolated lockfile-qualified `/tmp/wapps-clean-install-ekk5hezn`,
  Nx cache disabled: BFF 690 tests / 16 suites; catalog record 94 / three;
  catalog media 54 / four; application-workspace feature 167 / ten. Total:
  1,005 tests / 33 suites, including 124 new production-route HTTP tests.
- BFF build and 22 prerequisite tasks, BFF lint, separate spec typecheck,
  readiness-tool lint and architecture audit pass. Seven pre-existing BFF lint
  warnings remain. Architecture: 137 projects, 1,744 production sources, zero
  violations. Explicit review confirms pure domain contracts, fixed routes,
  bounded service calls and canonical authorization/materialization in Editorial.
- `bff-application-workspace-runtime-checks.cjs` passes ten groups through the real
  gateway/BFF/Editorial, Firebase emulator, OPA, SQL, MinIO and local DNS. It checks
  draft persistence/independent sessions, denial/spoofing, conflicts/replay, exact
  normalized bytes, attachment/removal, referenced cancellation, historical upload
  replay, object-store failure/retry, frozen owner/staff previews, canonical public
  reference checks, domain proof/staff grant, import/rebase image choices, mandatory
  BFF routes, BFF/Editorial restart persistence and withdrawal without resurrection.
  Existing direct publication/ownership commands prepare disposable fixtures only.
- The related suite-publication qualifier passes ten groups, including frozen
  submissions, independent review, public reads, projection lag, outages and
  tombstone convergence. Seven older BFF qualifiers change only their read-only
  direct-Editorial outage control from application drafts to articles. Of those
  seven, only suite publication is rerun in this slice.
- Browser verification after activation/reload passes for the existing My Apps
  list and Orbit Tasks editor. Fields, classification, logo (512 x 512), banner
  (1,440 x 810), retained-upload preview and reload work. No saved browser mutation;
  the full command lifecycle is qualified through real HTTP. Evidence:
  `/tmp/wapps-review/screenshots/bff-application-workspace-editor.png`. Browser
  returned to the user's original Atlas Notes discussion. This does not establish
  original frontend fidelity.

Failed attempts are retained. The first focused HTTP run found an incomplete-body
keepalive connection left open after early rejection; the filter now closes such
connections and the final 124-case focused run passes. The first live run expected
404 for cancelled-upload preview, while Editorial deliberately returns 400 with no
ready image. The qualifier was corrected without changing owner/BFF behavior. The
second live run found the local DNS sidecar still attached to Editorial's previous
network namespace after earlier restart tests (`ECONNREFUSED`). The qualifier now
restarts that local sidecar, preserves DNS file permissions and merges/removes only
its unique challenge. The final run and suite regression pass. The DNS sidecar was
restarted after the regression and resolves again; all fifteen services run.

All disposable publications are withdrawn, drafts deleted and claims/DNS fixtures
removed. Erasure is accepted for eight disposable identities across all three live
attempts and the suite regression, with subsequent access denied. Completion of
background account/object cleanup is not claimed. Existing staff and content are
preserved. Runtime rollback artifacts are in
`/tmp/wapps-review/before-bff-application-workspace`; never reset/reseed the stores.

Evidence prefix: `/tmp/wapps-review/bff-application-workspace-`. `tests.log` is the
four-project regression run; `tests-final.log` is the final 124-case focused run.
`build.log`, `lint.log`, `typecheck.log`, `tools-lint.log` and `architecture.log`
record static checks. `live.json` and `live-final.json` are failed attempts;
`live-qualified.json` and `suite-regression.json` are successful reports. Credential
recovery `.accounts.json` files must not be published. `source-manifest.json`
records exact source/runtime/report hashes and preservation checks. Final scoped
formatting, `git diff --check` and `nginx -t` pass; activated BFF and both gateway
files match the qualified artifacts. No frontend build was needed.

Next bounded slice: application publication status/submit/withdraw and staff
review/decision through BFF. These remain direct Editorial routes, along with
ownership and other unmigrated authoring/media workflows. Full-workspace release,
production load, alpha/Kubernetes deployment and recovery gates remain open;
broker duplicate/reorder, SQL crash-window and backup restoration proofs are not
rerun in this transport slice. Stop here for the user's check.

## Suite publication, review and public reads through BFF (October 14, 2026)

The local gateway now sends the entire suite workspace/publication, suite-review
and public suite/selection route families through explicit BFF handlers. Existing
suite and catalog-listing adapters retain their contracts, including search,
pagination, page size, sort and selected IDs. No frontend source/assets,
owning-service behavior, migration or materialization protocol changed. Editorial
owns the domain; the BFF has no database access and makes no publication decisions.
The original frontend at `c965790e` still requires its separate merge/acceptance.

The BFF validates verified identity, strict selectors/commands, frozen submission
DTOs, response identity, receipt action/revisions and public/private field separation.
It preserves keys, expected/submitted revisions, 201 command receipts and safe
400/401/403/404/409/413/429 responses. Uncertain/dependency failures are 503 with
Retry-After. Transport is bounded to 64 KiB commands, 1 MiB JSON responses and
fifteen seconds, with no redirects or automatic retries. Unknown suffixes stop at
BFF rather than falling through to an owning service. Editorial retains OPA,
canonical tenant/owner checks, independent staff approval, transactions, immutable
submissions/receipts, publication revisions, outbox and projection/tombstone rules.

Verification on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, with uncommitted integration changes:

- Node 22.17.1, lockfile-qualified `/tmp/wapps-clean-install-ekk5hezn`, Nx cache
  disabled: BFF 566 tests / 15 suites, suite domain 37 / four and suite feature
  19 / two pass: 622 tests / 21 suites total, including 104 new production-route
  HTTP checks. BFF build with 22 prerequisite tasks, lint, separate spec typecheck
  and readiness-tool lint pass. Seven pre-existing BFF lint warnings remain.
- Architecture audit passes 137 projects / 1,737 production sources with zero
  violations. Explicit review confirms domain-only contract imports, fixed HTTP
  endpoints, bounded service calls, verified identity forwarding and owning-service
  authorization/persistence/materialization. No frontend build is needed for this
  transport-only slice.
- `bff-suite-publication-runtime-checks.cjs` passes ten groups against the real
  gateway/BFF/Editorial, Firebase emulator, OPA, SQL, Mongo and materializer. They
  prove owner/other/anonymous denial, staff self-review denial, frozen submission
  versus edited draft, rejection/resubmission, exact classification/application
  order, stale decisions, same-key replay, explicit projection lag, anonymous
  public browse/detail/selection, mandatory BFF routing, BFF/Editorial outages and
  restart persistence. Withdrawal hides the suite while its old revision-1 live
  projection still exists; queued replacement/withdrawal then converge to a
  revision-3 tombstone. Historical submission/approval receipts cannot republish.
- The related private-suite qualifier passes all ten groups, including CRUD,
  search/selection, independent sign-in, isolation, membership edits, conflicts,
  outages/restarts, projection failure and deletion without resurrection.
- Browser read checks pass after activation/reload: public catalog has the existing
  "The focused workspace" suite, its detail resolves all three applications, and
  owner publication status displays the approved submission and survives reload.
  No saved browser changes; full mutation/review lifecycle was checked through HTTP.
  Screenshots: `/tmp/wapps-review/screenshots/bff-suite-publication-public.png` and
  `/tmp/wapps-review/screenshots/bff-suite-publication-owner.png`. Browser returned
  to Home afterward. These checks do not establish original frontend fidelity.

Both runtime qualifiers pass on their first run. Newly created suites are removed;
erasure is accepted for four disposable identities with subsequent access denied.
Full background erasure is not claimed. Existing staff and content are preserved.
The previous BFF/gateway are saved in
`/tmp/wapps-review/before-bff-suite-publication`. Evidence, exact command logs and
reports use `/tmp/wapps-review/bff-suite-publication-*`; credential-bearing
`.accounts.json` files must not be published. The source/runtime manifest is
`/tmp/wapps-review/bff-suite-publication-source-manifest.json`.

Final scoped formatting, `git diff --check` and `nginx -t` pass. Activated BFF
artifacts/gateway match verified build/source files; unrelated dirty work and all
frontend files are preserved. All fifteen review services are running. No commit
was created. Broker duplicate/reorder, SQL crash windows, backup restore, load and
deployment gates are not requalified by this transport slice. Other authoring/
publication/media, discussion/review and authentication/account-administration BFF
work, alpha/Kubernetes activation and the original frontend merge remain open.
This supersedes the pending suite-publication migration in older checkpoints.

## Private suite workspaces through BFF (October 14, 2026)

The local gateway now routes private suite list/detail/create/update/delete through
explicit BFF handlers. The existing feature adapter keeps its contracts and uses
the existing BFF catalog search/selection for application metadata. No frontend
source/assets, owning-service behavior, migration or projection changes in this
slice. Editorial owns private suites; the earlier conversational attribution to
Account was incorrect. The original presentation at `c965790e` remains the source
of truth for its separate merge and visual acceptance.

Editorial retains canonical owner/tenant authorization, application eligibility,
SQL drafts, capacity locks, revisions, immutable command receipts and tombstones.
Deletion retains existing atomic publication revocation/outbox behavior. The BFF
forwards verified identity context, keys and revisions without browser/worker
credentials, redirects or automatic retries. Shared pure parsers validate fields,
ordered membership and classification proposals; response identity/revision/deletion
checks reject mismatched receipts. Transport is bounded to 64 KiB commands, 1 MiB
responses and fifteen seconds. Current reads remain distinct from historical
receipts, so replay cannot imply resurrection of a deleted suite.

Verification on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, with uncommitted integration changes:

- Node 22.17.1 and lockfile-qualified `/tmp/wapps-clean-install-ekk5hezn`, Nx cache
  disabled: BFF 462 tests / 14 suites (79 new checks), suite domain 37 tests / four
  suites and suite feature 19 tests / two suites pass: 518 tests / 20 suites total.
  BFF build with 22 prerequisite tasks, lint and separate spec typechecking pass.
  Scoped readiness-tool lint passes. Seven pre-existing BFF warnings remain outside
  the new code; no frontend build is needed for this transport-only change.
- Architecture audit passes 137 projects / 1,735 production sources, zero violations.
  Explicit review confirms pure domain contracts, bounded explicit HTTP routes,
  trusted identity forwarding and owning-service persistence/materialization.
- `bff-suites-runtime-checks.cjs` passes ten groups through the real gateway, BFF,
  Editorial, identity emulator, OPA, SQL and Mongo. They cover strict identity,
  application search/selection, create/replay and independent sign-in, ownership
  denial, ordered edit/add/remove and classification proposals, conflicts, mandatory
  BFF routes including case/slash variants, BFF/Editorial restarts and outages,
  projection failure without loss of private edit/removal access, deletion replay
  without resurrection and cleanup. Lost replies are tested separately with the
  real-HTTP contract fixture; SQL transaction crash windows are not requalified.
- The related export qualifier passes nine groups, including four-source archive
  integrity, isolation, revocation, BFF/Account restarts and capture-source recovery.
  All five earlier BFF qualifiers now use `/api/me/application-drafts` as their
  read-only direct-service comparison during BFF outages. That comparison passes
  in both new runs; the other four qualifiers are not rerun in this slice.
- Browser verification loads the existing member's three suites, opens "My review
  collection", resolves Atlas Notes/Prism Studio/Orbit Tasks, loads its editor and
  filters application search to Atlas Notes. Cancel editing plus full reload retains
  the original three applications and text. No saved browser data changes. This is
  a read/search/editor-loading check; complete CRUD is qualified through real HTTP
  with disposable accounts. Screenshot:
  `/tmp/wapps-review/screenshots/bff-suites-search.png`.

The first live attempt passed CRUD/ownership checks but timed out on catalog search
during the BFF outage. Gateway logs showed the generic catalog route retaining its
long default connect timeout. Search/selection now have explicit two-second connect
and twenty-second read/send bounds, matching the suite routes. Nginx syntax/reload
and the full suite qualifier passed afterward. Earlier checks also exposed one
invalid-tenant test fixture that actually used a valid identity string and an
unnecessary regex escape in the qualifier. Both were corrected and rerun.

The failed attempt, successful suite run and export regression clean up their
disposable suites/archives and accept erasure for six test identities, with access
denied. Existing accounts/content are preserved without resetting/reseeding stores.
Full background erasure is not claimed. Evidence is `/tmp/wapps-review/bff-suites-*`;
the successful runtime report is `bff-suites-runtime-final.json`. Credential-bearing
`.accounts.json` siblings must not be published. Exact commands are the affected Nx
targets, BFF spec `tsc --noEmit`, `npm run check:boundaries` and the two qualifiers
documented in the readiness README.

Final scoped formatting, `git diff --check` and `nginx -t` pass. Seventeen scoped
source/document files match the isolated workspace; the three activated BFF
artifacts and gateway match their verified build/sources. The hash manifest is
`/tmp/wapps-review/bff-suites-source-manifest.json`. Unrelated dirty files and all
frontend source/assets are preserved; all fifteen review services are running.

Nested suite publication/submission/withdrawal and public suite catalog routes are
the next BFF slice. Other authoring/media, discussion/review and authentication/
account-administration routes, alpha/Kubernetes activation, original-frontend merge
and full release/load/deployment/recovery gates remain open. Historical checkpoints
below retain their scope at the time; their pending private-suite migration is
superseded here.

## Account exports through BFF (October 14, 2026)

The local gateway now routes export request, latest/status, cancellation/revocation
and archive download through explicit BFF handlers. The existing frontend export
adapter consumes the unchanged contract. No frontend source/assets, owning-service
behavior, migration or projection changes in this slice. The original presentation
at `c965790e` still requires its separate merge and visual acceptance.

Account retains canonical authorization, durable jobs/leases, all four capture
sources, immutable chunks, expiry/revocation and cleanup. Request retries preserve
the idempotency key and return the same job in its current lifecycle. BFF forwards
only verified identity context; it has no database or source-worker credentials.
Downloads have four concurrent permits, bounded backpressure, a fifteen-minute
total deadline and disconnect cancellation. Size/hash verification withholds the
last chunk until completion; failures never produce a complete-looking archive.
Nginx disables archive buffering, cache, temporary-file spill, compression and
upstream retries. Account rechecks current canonical access for every stored chunk.

Verification on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, with uncommitted integration changes:

- Node 22.17.1 and lockfile-qualified `/tmp/wapps-clean-install-ekk5hezn`, Nx cache
  disabled: BFF 383 tests / 13 suites and identity feature 158 tests / 18 suites
  pass (541 tests / 31 suites total, including 75 new BFF export checks). BFF
  build/lint and 22 prerequisite tasks pass. Separate spec typechecking and scoped
  new-code/readiness-script lint pass. Seven pre-existing BFF lint warnings remain
  outside the new code.
- Architecture audit passes 137 projects / 1,732 production sources, zero
  violations. Explicit review confirms owning-service authorization and storage,
  pure shared contracts, bounded clients, strict selectors and credential isolation.
- `bff-export-runtime-checks.cjs` passes nine groups through the real gateway, BFF,
  Account, identity emulator, OPA, stores, Editorial and Discussion. A real
  four-source archive has exact bytes/digest and complete receipts; another account
  cannot inspect, revoke or download it. Case/slash routes require BFF. BFF/Account
  outages and restarts preserve jobs/archive/replay. Revocation blocks download;
  an unavailable Discussion source leaves the job retryable without releasing a
  partial archive, and the same job completes after recovery.
- The related private-profile runtime regression passes seven groups, covering
  canonical text/photo writes, replay/conflicts, ownership, BFF/Account outages,
  restart persistence, stale-photo revocation and erasure acceptance. All four
  earlier BFF qualifiers now use read-only `/api/me/suites` as their BFF-outage
  comparison because exports have migrated. The other three qualifiers were not
  rerun; the suites comparison passes in the export and profile qualifiers.
- Browser verification on the existing member account confirms Privacy & Data
  displays the no-export state after Refresh Export Status and a full reload.
  This is a status-only browser check; request/download/revocation are qualified
  through real HTTP with disposable accounts. Existing account settings are
  unchanged. Evidence: `/tmp/wapps-review/screenshots/bff-export-status.png`.
- Test archives are revoked, erasure is accepted for both export identities and
  the profile regression identity, and their account/profile access is denied.
  Complete background erasure is not claimed. Existing accounts/content are
  preserved; no reseeding or database reset occurs.

Commands are the BFF `test`, `build` and `lint` Nx targets, the identity feature
`test` target, `tsc --noEmit -p apps/services/catalog-bff/tsconfig.spec.json`,
`npm run check:boundaries` and the two live qualifiers documented in the readiness
README. Evidence is `/tmp/wapps-review/bff-export-*`; credential-bearing report
siblings must not be published. Initial spec typing and unused-mock-parameter
checks failed and were corrected; the affected checks passed on rerun.

Final scoped formatting, `git diff --check` and `nginx -t` pass. The eighteen scoped
source/document files match the isolated snapshot; all three activated BFF
artifacts and gateway configuration match the verified build/sources. The hash
manifest is `/tmp/wapps-review/bff-export-source-manifest.json`. Unrelated dirty
files are preserved and all fifteen review services are running.

Large-archive/device memory and load qualification remain open: the existing
frontend adapter buffers its download. The four captures are per-source snapshots,
not one distributed snapshot. Remaining BFF work includes authentication/account
administration, private suite workspaces, discussion/reviews and publication/
authoring/media. Alpha/Kubernetes activation, the original frontend merge and full
release, deployment and recovery gates remain open. Historical checkpoints below
retain their scope at the time; their pending export migration is superseded here.

## Public profiles, follows and badges through BFF (October 14, 2026)

The local gateway now routes public profiles/directory, audience-protected photos,
shared favorites/suites/articles/discussions/activity, public/private totals and
badges, incoming/outgoing follows and staff badge administration through explicit
BFF handlers. Existing frontend feature adapters consume the unchanged contracts.
No frontend source/assets, owning-service behavior, migration or projection changes
in this slice. The accepted original frontend is still `c965790e`; its merge and
visual acceptance remain separate work.

Anonymous reads require verified ingress provenance and reject conflicting identity
headers. Signed-in operations retain strict authentication context. Account keeps
all lifecycle, audience, sharing, ownership and staff-policy decisions plus canonical
SQL, revisions, receipts, outbox and materialization. BFF validates bounded inputs,
typed cursors, content/receipt scope and response contracts; it forwards no bearer,
cookie, email or worker credential. Hidden totals remain null. Reads do not cache
permission. Commands preserve keys/revisions without automatic retry. Transport
uses thirty-second deadlines, 64 KiB requests, 1 MiB JSON and 256 KiB WebP limits.

Verification on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, with uncommitted integration changes:

- Node 22.17.1 and lockfile-qualified `/tmp/wapps-clean-install-ekk5hezn`, Nx cache
  disabled: BFF 308 tests / 11 suites pass (92 new checks), covering trusted
  anonymous/member paths, populated/hidden shared
  pages, cursor ordering, credential isolation, commands/replay/lost replies,
  malformed results, bounds and protected media. User-profile feature tests pass
  86 cases / six suites: 394 tests / 17 suites in total. BFF build/lint and 22
  prerequisite tasks pass, as does the
  separate BFF spec typecheck. Seven pre-existing BFF lint warnings remain outside
  this change; new code/readiness tooling have no lint findings.
- `npm run check:boundaries` passes 137 projects / 1,728 production sources, zero
  violations. Explicit review confirms that Account remains the authorization and
  write-model authority; BFF imports pure contracts and accesses no database.
- `bff-public-profiles-runtime-checks.cjs` passes eight check groups through the
  real gateway, BFF, Account, OPA, identity emulator, stores and content services.
  They cover anonymous/spoofed/invalid identity, public/private/follower audiences,
  real normalized photo bytes, populated favorites/discussions, shared/hidden
  content and totals, independent follow approval, staff award/revoke reasons and
  history, conflicts/replay, mandatory BFF paths including case/slash variants,
  dependency failure, restarts and immediate revocation. Historical receipts do
  not restore removed follow access or revoked badges. Suite/article live pages
  are empty/hidden in this disposable fixture; populated responses have HTTP
  contract coverage, not a new authoring/publication qualification.
- Related private-profile and preferences qualifiers pass seven and six groups.
  Their BFF-outage comparison, and the member qualifier's, now uses read-only
  `GET /api/me/exports` because badges have migrated. The temporary topic is
  removed; erasure is accepted for the three new profile accounts and one private
  regression account. Existing member preferences are restored and the staff
  profile stays unchanged. Complete background erasure is not claimed.
- Browser verification loads the existing member's totals (one discussion, one
  suite, one article, zero favorites), empty badges and public profile preview.
  Hidden sections show explicit non-sharing, and incoming/outgoing follows and
  directory refresh successfully. No existing profile/privacy value is changed
  by browser checks. Evidence:
  `/tmp/wapps-review/screenshots/bff-public-profile-preview.png`.

Commands are the BFF `test`, `build` and `lint` Nx targets, the user-profile feature
`test` target, `tsc --noEmit -p apps/services/catalog-bff/tsconfig.spec.json`, the
architecture audit and the three live qualifiers documented in the readiness
README. Evidence is `/tmp/wapps-review/bff-public-profile-*`; credential-bearing
`.accounts.json` / `.account.json` siblings must not be published. Retained failed
attempts include a missing Editorial origin in the new HTTP fixture, unsafe
cleanup throwing inside `finally`, and a sandbox-denied loopback test listener.
The fixture and cleanup were corrected; socket tests require local-listener access.
A draft qualifier photo-field mismatch was corrected before its first live run.

Final scoped formatting/lint, `git diff --check` and `nginx -t` pass. All eighteen
scoped source/document files match the isolated snapshot, and all three activated
BFF artifacts plus gateway configuration match the verified build/sources. The
hash manifest is `/tmp/wapps-review/bff-public-profile-source-manifest.json`.
Unrelated dirty files are preserved; no frontend file changed during this slice.
All fifteen local review services are running. The four disposable identities
are denied profile access after erasure acceptance.

Remaining profile integration gaps are the original frontend merge/acceptance,
its combined text/photo save orchestration, the known token-refresh/pending-photo
issue, and original optional `lastActiveAt`, for which no authoritative response
exists. Do not substitute demo timestamps. Remaining BFF families include account
exports, other authentication/account administration, discussion/review and
publication/authoring/media routes. Alpha/Kubernetes activation and full release,
deployment and recovery gates remain open. Historical checkpoints below retain
their scope at the time; their then-pending profile routes are superseded here.

## Favorites and notifications through BFF (October 14, 2026)

The local gateway routes favorite reads/commands, composed favorite metadata and
all three notification inbox/read families through BFF. The frontend metadata
adapter now consumes one composed endpoint instead of joining Editorial and
Discussion responses in the browser. All four favorite types retain their real
names/links, application logos and reviewed classification; discussions inherit
their current parent application link/classification. Existing preference masking,
session cancellation, removal and retry behavior stay in the feature layer.
No templates, styles, components, interactions or visual layouts change in this
slice. The current frontend is still not the accepted original presentation.

Account retains authorization, canonical SQL, shared revisions, command receipts,
transactional outbox intent and notification delivery/read state. BFF reconstructs
verified identity context, validates strict contracts, preserves keys/revisions,
and bounds transport without redirects or automatic mutation retries. Metadata
reads select only canonical saved references and recheck the Account revision and
references before returning. Missing targets remain removable; dependency failure
is explicit. Mark-read preserves natural recipient/notification idempotency and
the first read timestamp. No migration, projection or worker protocol is added.

The live mention check exposed a deployment packaging defect: both local and
alpha OPA mergers copied only `policy.rego`, omitting the existing
`profile-audience.rego`. OPA returned an undefined decision and Account correctly
returned 503. Both mergers now include all non-test Rego modules. Real merged
bundle tests include every policy test plus explicit public-allow/private-deny
profile decisions. The existing local review stack loads the matching generated
policy; no audience rule or backend authorization was weakened.

Verification on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, with uncommitted integration changes:

- Node 22.17.1, lockfile-qualified `/tmp/wapps-clean-install-ekk5hezn`, Nx cache
  disabled: BFF 216 tests / 10 suites, favorites domain 67 / 4, favorites feature
  58 / 2 and aggregator 349 / 53 pass: 690 tests / 69 suites. The BFF adds 48
  checks and the pure composed contract adds 12 checks. Tests cover malformed
  inputs/results, trusted forwarding, capacity/batching/payload bounds, canonical
  rechecks, conflicts, outage/lost replies and recipient-scoped receipts.
- Affected domain/feature/BFF build, lint and source/test typechecks pass; BFF
  spec sources also pass a separate `tsc --noEmit`. The initial dependency build
  completed 37 prerequisite tasks. Aggregator library/CSR builds and 57 Angular
  package inspections pass. Seven pre-existing BFF lint warnings and existing
  portal budget/template warnings remain.
- Architecture audit passes 137 projects / 1,723 production sources, zero
  violations. Local and alpha merged OPA bundles each pass 285 real policy tests,
  strict compilation and explicit audience decisions (two portable test cases).
- `bff-member-runtime-checks.cjs` passes seven real gateway/Firebase-emulator/
  OPA/Account/MySQL/Editorial/Discussion check groups: all four favorites and
  metadata; replay/conflict/isolation; mandatory BFF paths and restarts; Account
  outage and retry; eleven actual replies with pagination, a mention and a
  favorite update; private mark-read/replay and restart persistence; opt-out;
  removal during metadata outages and no resurrection by historical retries.
  The disposable topic is removed and erasure accepted for both new accounts.
  Existing review accounts/content are preserved; background erasure completion
  is not claimed.
- Related profile and preferences runtime regressions pass seven and six groups
  respectively. Both use unmigrated `/api/me/badges` as the BFF-outage control.
  The profile test erases its disposable account; original member preferences
  are restored through canonical commands. No database reset or reseeding occurs.
- Browser verification saves Atlas Notes, reloads Favorites with its real name
  and link, removes it and reloads the original empty list. Replies, favorites
  and mentions views load; the existing reply remains unread. Screenshots:
  `/tmp/wapps-review/screenshots/bff-member-saved.png`,
  `bff-member-restored.png` and `bff-member-notifications.png` in that directory.
- Final scoped formatting, readiness/OPA-script lint, `git diff --check` and
  `nginx -t` pass. All 25 scoped source/document files match the isolated
  workspace; activated BFF/gateway, four OPA modules and 4,094 portal files match
  their sources/build artifacts. The final controller formatting rebuild produces
  the identical BFF bundle. Unrelated dirty files are preserved and all fifteen
  review services are running. The hash manifest is
  `/tmp/wapps-review/bff-member-source-manifest.json`.

Evidence is `/tmp/wapps-review/bff-member-*`. Runtime report siblings ending in
`.accounts.json` / `.account.json` contain disposable recovery credentials and
must not be published. Retained failed attempts include the old four-request
frontend expectation after composition moved to BFF, a too-narrow inferred
adapter return type, a test using a legal provider UID as invalid input, an
unknown-response test typing error, and the missing deployed audience policy.
Each affected check was corrected and rerun successfully. A browser DOM checkbox
locator did not match Taiga's control; the visible accessibility action succeeded
and removal was verified after reload. This was an automation locator failure.

Public profile audiences/photos, follows, totals, badges, other account/authentication
flows, discussion/review and publication/authoring routes still need BFF integration.
Alpha/Kubernetes activation, the original frontend merge and its visual acceptance,
and full release/deployment/recovery gates remain outstanding. The next bounded
BFF workflow is public profiles and their related social reads/commands.

## Account, private profile and photos through BFF (October 14, 2026)

The local gateway now sends `GET/DELETE /api/me`, `GET/PUT /api/me/profile`,
`PUT/DELETE /api/me/profile/avatar` and `GET /api/me/profile/avatar/:id` through
explicit BFF routes. Existing frontend adapters consume their responses unchanged.
The BFF validates trusted identity and strict input/output contracts, forwards
verified credential email only for the account summary, and preserves command
keys, expected revisions, photo checksums, access/conflict statuses and erasure's
202 acceptance. Acceptance does not claim that background erasure has completed.
Account retains lifecycle/policy/ownership checks, image normalization, canonical
SQL writes, receipts and transactional outbox/materialization responsibilities.
There is no new migration or projection, and no frontend source or asset change.

Transport uses fixed Account routes, fifteen-second downstream deadlines, no
redirects or automatic mutation retries, and 64 KiB JSON / 2 MiB photo-upload /
256 KiB photo-download limits. Uploads also have a body deadline and a two-upload
concurrency bound. Private WebP reads are no-store with nosniff/sandbox headers.
Local Nginx covers canonical, trailing-slash and mixed-case paths, with bounded
timeouts and no upstream retry. The existing persistent review stack at
`http://localhost:4203` runs the matching BFF build and gateway configuration.

Verification on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, with uncommitted integration changes:

- Node 22.17.1 and lockfile-qualified `/tmp/wapps-clean-install-ekk5hezn`:
  `nx run apps.services.catalog-bff:test --runInBand --skip-nx-cache` passes
  168 tests in nine suites. Seventy new HTTP checks exercise the production
  AppModule with an Account fixture: trusted headers and identity, malformed
  inputs/responses, photos, access/conflicts, erasure compatibility, bounds and
  lost replies followed by caller-controlled retries.
- BFF build/lint/test targets pass without Nx cache; the initial build also
  completed eighteen prerequisite tasks. Final lint has zero errors and seven
  existing warnings outside the new code. Separate spec `tsc --noEmit` and both
  BFF runtime qualifiers' ESLint checks pass. Nx daemon/plugin isolation is
  disabled. The isolated BFF source and deployed build match this checkpoint.
- `npm run check:boundaries` passes for 137 projects / 1,718 source files with
  zero violations. `nginx -t` passes for the activated gateway configuration.
- `tools/readiness/bff-profile-runtime-checks.cjs` passes seven check groups
  against the real gateway, Firebase emulator, Account, OPA and MySQL: identity
  and email provenance; text save/replay/conflicts and shell reads; image
  normalization/private reads and cross-account denial; mandatory BFF routing
  and restart persistence; Account outage/recovery and saved SQL photo data;
  replacement/removal with historical retries unable to resurrect old photos;
  and erasure acceptance followed by revoked access. The qualifier erases only
  its newly registered disposable member; the existing staff account is read-only.
- The preferences qualifier passes its six regression groups and restores prior
  values. Its BFF-outage comparison now uses unmigrated `/api/me/favorites`, since
  `/api/me` also requires BFF. No database reset or reseeding occurred.
- Browser checks save and reload profile text, upload and reload a real normalized
  photo in both profile and shell, remove the photo, and restore the original
  Review Member profile. An API comparison confirms all original profile fields
  and the no-photo state, with revision/history advancing normally. Evidence:
  `/tmp/wapps-review/screenshots/bff-profile-photo.png` and
  `/tmp/wapps-review/screenshots/bff-profile-restored.png`.

Evidence is `/tmp/wapps-review/bff-profile-*`, plus the latest preferences report.
The report's sibling `.account.json` contains disposable recovery credentials and
must not be published. The initial lint failure on control-character regexes was
corrected without suppression; final lint, types, build and tests pass. Browser
file selection stalled before returning. The first subsequent photo save received
401 and triggered successful session refresh, which cleared the pending selection.
Explicit reselection succeeded. Preserving pending photo intent through token
refresh remains an open frontend integration issue; automatic recovery is unproven.

The original frontend stages photo/text under one Save Changes action. These
existing Account commands remain separate revision-bound writes, so its eventual
merge must preserve that interaction and handle partial failure explicitly. This
checkpoint does not certify original-frontend fidelity or atomic text/photo saves.
Public profile audiences/photos, follows, totals, badges, favorites, notifications,
other account/authentication flows, discussion/review and publication/authoring
routes still need BFF integration. Alpha/Kubernetes activation, the original
frontend merge and full release/deployment/recovery gates remain outstanding.
The next bounded workflow is favorites and notifications through the BFF.

## Account preferences: frontend to BFF to Account (October 14, 2026)

`GET/PUT /api/me/preferences` now traverses the BFF in both directions on the
local gateway. The existing feature adapter and frontend presentation are
unchanged. The new BFF module validates trusted identity, strict command/response
contracts and self identity, then calls the fixed Account Management endpoint
with bounded transport. Only verified identity/claims/ingress context is forwarded.
Expected revision and the original idempotency key survive unchanged; access and
conflict statuses remain meaningful. An uncertain save is not automatically retried.
Account retains lifecycle/policy enforcement and atomic preference/revision/receipt/
outbox writes. No migration, projection or authoritative-write change is introduced.

Local Compose adds `ACCOUNT_MANAGEMENT_URL`; local Nginx now directs canonical,
trailing-slash and mixed-case preferences URLs to BFF. It limits bodies to 64 KiB,
connection waits to two seconds and read/send waits to twenty seconds, and disables
upstream retry. The BFF uses a fifteen-second/64 KiB downstream limit and no redirects.
The existing persistent review stack at `http://localhost:4203` runs the new BFF
and gateway route. Frontend assets were neither rebuilt nor replaced.

Verification on `codex/full-operation`, base HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, with uncommitted integration changes:

- Node 22.17.1 and lockfile-qualified `/tmp/wapps-clean-install-ekk5hezn`:
  `nx run apps.services.catalog-bff:test --runInBand --skip-nx-cache` passes 98 tests
  in eight suites, including 36 new BFF/Account HTTP contract checks. These cover
  header allowlisting, invalid identity/claims, malformed input and responses,
  denied/conflicting/rate-limited requests, response limits, redirect refusal and
  a lost reply after an upstream commit followed by identical caller retry.
- `nx run-many -t lint,build -p apps.services.catalog-bff --parallel=1 --skip-nx-cache`
  passes with sixteen prerequisite tasks. Lint has zero errors and seven existing
  warnings outside the new module. Separate BFF spec `tsc --noEmit` passes.
  The new runtime qualifier passes ESLint. All Nx runs disable daemon/plugin
  isolation. Source files match the qualified snapshot and deployed BFF build.
- `npm run check:boundaries` passes for 137 projects / 1,714 source files with no
  violations. `nginx -t` passes for the activated local gateway configuration.
- `tools/readiness/bff-preferences-runtime-checks.cjs` passes six check groups
  against actual gateway, Authenticator/Firebase emulator, Account, OPA and MySQL:
  auth/header spoofing, save/replay/isolation, stale/mismatched command rejection,
  mandatory BFF routing, Account outage/retry and restart persistence, then cleanup.
  When BFF stops, all tested preferences path forms fail while unmigrated `/api/me`
  still works. Account outage returns BFF 503 with no-store and retry guidance.
  Both services recover and original preference values are restored. Revisions,
  timestamps and command/outbox history advance normally.
- Browser verification uses the existing Display & Content page: select List,
  save, reload and observe List retained, then restore Grid and confirm saved.
  The screenshot is `/tmp/wapps-review/screenshots/bff-preferences-saved.png`.
  This proves the existing adapter works through BFF, not acceptance of the
  rejected frontend presentation or completion of its original-version merge.

Evidence is `/tmp/wapps-review/bff-preferences-*`. Retained failed attempts include
an initial test fixture configuration error, a spec table typing error, an overly
strict duplicate no-store-header assertion, the gateway's former unbounded
connection wait, and a request interrupted by an in-progress Nginx reload.
Those are not passing checks; corrected final tests, types and runtime checks pass.

Still outstanding: all other direct account/authentication, discussion/review,
publication/authoring and protected-media paths; alpha/Kubernetes route/configuration
activation; and merging the original frontend as presentation source of truth.
The next account slice is the shell/profile read-write contract and protected
avatar handling. Full release, deployment, backup/restore and load gates stay open.

## User requirement: frontend connects through the BFF (October 14, 2026)

The original frontend must consume a BFF-owned API contract. Backend integration
must follow frontend feature adapter -> BFF -> owning service, preserving original
presentation and keeping domain authorization, transactions and materialization
inside the owning services. This is now a repository rule in
`rules/portal-bff-boundary.md`.

The current implementation does not yet satisfy it for all workflows. Inspection
of `deploy/local/nginx/api.conf` and `application-media.conf` confirms direct
gateway routes to Discussion, Editorial, Account and Authenticator for discussions,
reviews, profiles/settings, authoring/review, some public publication reads,
authentication and media. The BFF currently composes catalog/discovery/feed paths;
same-origin routing does not make the remaining paths BFF integrations.

Each missing BFF route must preserve validated identity, idempotency/revision
semantics, domain errors and protected-media behavior before ingress is switched.
Qualification must exercise that BFF path. This checkpoint records the required
boundary and observed gaps; it changes no frontend, service runtime or deployment
routing and does not close the integration work.

## User correction: original frontend is authoritative (October 14, 2026)

The user rejected the frontend work after the tile checkpoint. Prior statements
that restoration was complete are superseded: the test/build evidence remains
valid only for the behavior it exercised and does not establish visual acceptance.
The verified original frontend is `c965790e063139bcd5e6bacc759f289703e4ea9a`;
its direct successor `95e3bfd3` contains the autonomous implementation and is only
a recovery point. The active focus is backend and integration work. The original
frontend will be merged back as the presentation source of truth after its data
and behavior requirements are supported. See `rules/frontend-source-of-truth.md`.

No frontend source was changed for this correction. A recoverable copy of the
current frontend (2,078 inventoried files),
its patch and the original Git snapshot are retained under
`/tmp/wapps-frontend-source-of-truth-20261014`. The original commit is durable Git
history; the temporary recovery directory must be retained until the later merge.
Concurrent alpha deployment and recording changes remain outside this work.

An initial comparison of the original Discover template/view models and current
service contracts found the following integration requirements. This is a focused
inventory, not an exhaustive full-service completion claim:

| Original requirement                                         | Current backend evidence                                                                  | Remaining integration                                                                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Application logo, tags, rating and review preview            | Public catalog and anonymous review composition exist                                     | Preserve original component inputs and routes through adapters; do not substitute review counts for discussion counts.     |
| Application voting and discussion count                      | Discussion-post voting exists; no application-level voting contract was found             | Implement the actual aggregate/commands and canonical discussion counts; post votes are not application votes.             |
| Article author avatar and badges                             | Account has public-profile and staff-awarded badge APIs; discovery carries only a byline  | Resolve permitted author presentation, including revocation, audience and anonymization, without hard-coded badges.        |
| Suite tags, rating, voting, discussion count and top comment | Suite publication/member previews exist; these community fields are absent from discovery | Complete owning domain/API support and adapt it to the original suite card; retain the original UI requirement.            |
| Discover filters and ordering                                | Current API supports bounded typed facets and name/newest sorts                           | Compare every original filter and sort option before calling the integration complete; keep unsupported behavior explicit. |

Backend qualification also has a concrete open regression: the existing
`tools/readiness/discovery-runtime-checks.cjs` starts the BFF with
`DISCUSSION_URL=http://127.0.0.1:1`. Enriched application search now requires the
real review service, so that historical qualifier cannot validate the current
contract. It needs a real Discussion dependency and outage/recovery checks before
its earlier success can be carried forward. The recent local seeded-stack smoke
check is separate evidence and does not repair that qualifier.

## Home and search tile correction (October 14, 2026; frontend not accepted)

The follow-up visual review found missing Home card surfaces/spacing and reduced
Discover tile composition. Home now restores the elevated surface, radius,
shadow, 20px feed spacing and original scroll scaling. Empty top-edge slots no
longer add padding. A compact refresh control uses the existing primary appearance
so it remains readable over the Home decoration in both themes.

Discover restores the original application, article and suite compositions and
full-width result column. The BFF now supplies real application logos, review
totals/averages/quotes, approved article bylines/covers and bounded suite member
previews. Canonical display tags separate labels/destinations from ID/slug filter
aliases, fixing duplicate labels and UUID tag links. Home quick search also shows
real logos and protected article-cover thumbnails. Favorites, filtering, independent
group pagination, saved preferences and failure/retry states remain connected.
Unsupported demonstration ratings, votes and badges are not fabricated.

This is bounded read composition with current publication rechecks; there is no
new migration, projection or authoritative write. See the rich discovery read
contract in `MATERIALIZATION.md`. The branch remains `codex/full-operation`, HEAD
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb`, with uncommitted restoration changes.
Earlier rich-feed source digests certify their own checkpoints, not these edits.

Verification uses Node 22.17.1, the lockfile-qualified isolated installation
`/tmp/wapps-clean-install-ekk5hezn`, and the persistent local review stack at
`http://localhost:4203`. Evidence is in `/tmp/wapps-review/tiles-*`:

- 593 tests in 83 suites pass across discovery domain (29/2), catalog BFF (62/7),
  search (29/4), feed (30/8), multi-search (13/1), aggregator (349/53) and articles
  (81/8). Affected lint/typechecks and the BFF test TypeScript compilation pass.
- Uncached aggregator library/CSR and BFF builds pass with 88 prerequisite tasks.
  The final refresh appearance rebuild passes for feed, aggregator library and CSR
  with `--excludeTaskDependencies --parallel=1 --skip-nx-cache` after those builds.
  Angular artifact inspection passes for 57 packages. Existing lint and bundle/
  component budget warnings remain visible debt.
- Architecture audit passes for 137 projects and 1,710 source files with zero
  violations. Nx commands and package inspection use `NX_DAEMON=false` and
  `NX_ISOLATE_PLUGINS=false`; the explicit BFF spec check uses
  `tsc --noEmit -p apps/services/catalog-bff/tsconfig.spec.json`.
- Live API checks confirm all three groups, real media/review/member metadata,
  unique display tags and combined application/search/tag filtering. Browser
  checks confirm favorite persistence after reload, quick-search cover loading,
  loaded tile images and no tile overflow at 390/768/1440 in light/dark themes.
  Screenshots are in `/tmp/wapps-review/screenshots/tiles-*`.

Failed attempts are retained: sandboxed BFF tests could not listen; the permitted
rerun passes. Template narrowing errors were fixed and rebuilt. A concurrent
prerequisite rebuild caused a temporary typecheck output race; the sequential
check passes. One final build was accidentally run in the main checkout with
stale prerequisites and failed; the corrected isolated build passes. None of
these failed attempts counts as successful qualification.

The original Home hero headline still clips at 390px (REVIEW-2), outside this tile
correction. This focused checkpoint does not rerun the full release gate or close
production/deployment/recovery gates. The broader operational goal stays paused.

## Rich feed and collection header restoration (October 14, 2026)

This completes the two presentation gaps recorded in the October 13 checkpoint.
Private collection create/detail/edit pages use the original back link, personal
collection badge, detail title, introduction, member count and notice composition.
The live account-backed forms, member selection, publication and retry controls
remain connected.

Explore and application timelines now compose the original application, article,
suite, release, review and discussion card designs from real public read data.
Editorial supplies descriptions, images, named application taxonomy, reviewed
article attribution/excerpts/protected covers, approved suite member previews and
release changes. Discussion supplies public or anonymized attribution, review
quotes/ratings and bounded thread excerpts. The BFF adds actual public application
review totals and averages, rechecking current publication identity, revision and
classification after the summary read. No demonstration authors, images, ratings,
badges, views or local vote counts are substituted for unavailable data.

Preview contracts are strictly parsed and bounded. Canonical publication and
parent visibility, frozen suite membership, projection lag and erasure behavior
remain enforced. Each suite preview member respects the current mature-content
choice; account/choice changes continue cancelling stale results. A missing
dependency produces an unavailable/retry state. Article covers use the protected
reader, including actual image loading and recovery after media failure.

The browser checks exposed an existing decorative canvas resize bug: once faded,
the canvas retained its desktop width and caused mobile overflow. Hiding the
fully faded canvas removes that stale geometry; scrolling back recalculates it
and resumes the original animation. A focused browser comparison reproduces the
failure in the recovery commit and passes against the repaired implementation.

No migration, write model, projection, queue, materialization intent or new secret
is introduced. Consumer/producer compatibility and rollback are documented in
`MATERIALIZATION.md`, under the rich card read contract. Changes remain uncommitted
on `codex/full-operation`; the broader operational goal stays paused.

Verification uses Node 22.17.1 and the isolated lockfile-qualified installation
`/tmp/wapps-clean-install-ekk5hezn`. Evidence is under `/tmp/wapps-readiness/`:

- Affected domain, Editorial, Discussion, BFF, feed and aggregator tests pass:
  **1,813 tests / 175 suites**, with lint and typechecks. After the protected-cover
  provider fix, feed/aggregator checks were repeated: **379 tests / 61 suites**.
  Logs: `rich-feed-final-checks.log` and `rich-feed-cover-checks.log`.
- Domain/backend, Angular library and CSR builds pass. The last build includes
  the shared canvas fix: `rich-feed-canvas-build.log`. All **57 Angular packages**
  pass emitted ESM/partial-declaration/entrypoint inspection in
  `rich-feed-final-angular-packages.json`. Existing lint and bundle/style budget
  warnings remain visible debt.
- `npm run check:boundaries`: 137 projects, 1,708 production source files, zero
  violations (`rich-feed-final-boundaries.log`). Test inventory and affected
  readiness-tool lint also pass. The canvas browser comparison is recorded in
  `rich-feed-canvas-regression.json`; shared UI unit-test coverage gaps remain
  explicitly inventoried.
- `node tools/readiness/qualify-suites.cjs` passes live private collection
  create/select/save/edit/delete, publication review, retries/conflicts, frozen
  membership, migration/replay and restart checks, with **72 measured layouts**.
  Evidence: `rich-feed-suites-runtime`.
- `node tools/readiness/qualify-suites.cjs --account-export-runtime --timeline`
  passes **21 integrated check groups** and **114 measured layouts**: 42 Explore
  (including all six rich card kinds), six Digest, six timeline and 60 content
  preference states. It checks actual metadata/detail links, protected cover
  failure/retry, persisted choices, account/route cancellation, fully hidden
  continuations, reviewed reclassification, stale projections, outages and
  Account/BFF/source restart. Evidence: `rich-feed-timeline-runtime-6`.

The two successful integration runs contain **186 measured layouts** at
390/768/1440 in both themes. Collection create/detail, rich card and timeline
screenshots were visually inspected. Earlier failed runs are retained; they
identified the missing article-cover provider, stale generic-card test selectors
and faded-canvas resize overflow. No failed run is counted as successful evidence.
The final executable snapshot contains 3,819 files with SHA-256 digest
`ac8f1344087649cb54c512d1dac2bcaf4e847896302f1630b229d1889b6e3341`;
subsequent changes finalize documentation only.

Local qualification uses real SQL/Mongo/MinIO/OPA and compiled APIs with local
trusted-identity fixtures; browser external traffic is blocked and production
materializers are invoked directly. It does not establish production ingress,
backup restoration, deployment rollback or load/soak readiness. This closes the
two requested UI restoration gaps, not the broader operational gates.

## UI restoration (October 13, 2026)

The user requested a recovery commit followed by restoration of the original UI
while preserving live integrations. Commit `95e3bfd3` is that recovery point;
the presentation reference is `c965790e063139bcd5e6bacc759f289703e4ea9a`.
Restoration changes remain uncommitted on `codex/full-operation`. Concurrent
`deploy/alpha` work and the user-owned recording tools are outside this change.

Original components and layouts now compose the live catalog, article/suite
reading, private collection, application draft/ownership, favorites, review,
discussion, release and health features. Article/suite catalog pages now use
the existing results page with real publication adapters. The restored Discover
filter bar and display menu preserve server sorting, exact source totals and
independent group pagination. Library/domain boundaries and protected cover
access remain intact. Keeping the working independent font link avoids blocking
the main stylesheet when external fonts are unavailable. Digest's cover retry
is outside the card link, with a stretched title link preserving the card's
clickable surface.

Limits at this checkpoint (resolved by the October 14 update): rich card metadata
was missing from the live Explore/timeline contract. Those cards retained original
primitives and reduced actual metadata, but did not reproduce the rich designs.
Private collection editing still kept its newer page header. New authoring/review,
privacy and uncertainty controls were retained. This checkpoint did not establish
pixel-identical restoration or production qualification; the broader development
goal remained paused.

Verification uses Node 22.17.1 and the lockfile-qualified isolated installation
`/tmp/wapps-clean-install-ekk5hezn`. Reports and screenshots are under
`/tmp/wapps-readiness/ui-restoration-*`. The presentation manifest identifies
actual changed files; the source manifest records 3,813 files and snapshot hashes.

- Affected behavior checks: 500 tests in 73 suites across aggregator, listing,
  feed, discussion, review and health; affected lint/typechecks pass. After later
  portal/feed edits, the affected aggregator/feed targets were repeated (379
  tests in 61 suites), and the portal targets were repeated again (349 in 53).
- Angular library and CSR builds pass, including the original prerequisite build
  and subsequent uncached changed-project builds. 57 emitted Angular packages
  pass the ESM/partial declaration/entrypoint inspection. Bundle/style size and
  existing lint warnings remain visible debt.
- `npm run check:boundaries`: 137 projects, 1,705 source files, zero violations.
  Inventory and readiness-tool lint pass; two existing tooling warnings remain.
- `node tools/readiness/qualify-suites.cjs --discovery` passes with real
  SQL/Mongo/OPA and compiled Editorial/BFF/portal: filtering/sorting, paging,
  current links, frozen classification approval, projection lag/replay/rebuild,
  restart/outage, account changes, and 192 measured layouts. Evidence:
  `ui-restoration-discovery-runtime-3`.
- `node tools/readiness/qualify-suites.cjs --account-export-runtime
--favorites-content-preferences` passes: all four favorite kinds, selected-group
  hidden counts, account switching, preference/metadata retries, keyboard removal,
  frozen approval and restart, plus baseline Explore navigation. Evidence:
  `ui-restoration-favorites-runtime`.
- `node tools/readiness/qualify-suites.cjs --application-discussions --delivery
--member-reviews` passes: live ratings, publishing/editing, helpful marks,
  reports, independent moderation, exact retries, conflicts and restart; 108
  measured layouts. Evidence: `ui-restoration-reviews-runtime`.
- `node tools/readiness/qualify-suites.cjs --account-export-runtime --timeline`
  passes: Explore/Digest/timeline detail links, paging/Back, current-account
  preferences, protected cover recovery, parent/suite classification, hidden
  continuations and restart; 78 measured layouts. Evidence:
  `ui-restoration-timeline-runtime-3`.
- `node tools/readiness/qualify-suites.cjs` passes: private collection create,
  selection, editing, deletion, exact retries and conflicts; independent review,
  anonymous public reading, rejection, withdrawal, restart and 72 measured layouts.
  Legacy snapshot upgrade checks now migrate later additive columns before using
  current readers, preserving the original migration failure/recovery assertions.
  The anonymous browser fixture removes its token instead of storing an empty
  credential. Evidence: `ui-restoration-suites-runtime-3`.

The five successful integration runs contain 492 measured layouts in total.
Earlier failed logs remain available. They exposed and verified repairs for
stylesheet loading, reading-layout test selectors, release/Digest spacing,
Digest cover retry, and stale collection qualification fixtures. The final
executable snapshot is recorded by source digest
`5d2c7fdf4373d710ba7f1c1f05cb82fd30611bb9b33a06c34825db1b3a91062e`;
the subsequent edits only finalize these documentation records. Later Digest
changes were qualified by the final timeline run; favorites/reviews were unchanged.

Browser captures use 390/768/1440 widths in both themes. Screenshots of article
reading, suite details/editing, catalog listings, grouped Discover, favorites,
Explore and reviews were visually inspected as well as measured. Local tests use
trusted ingress/shell identity fixtures and blocked external browser traffic;
most projection workflows invoke production materializers directly. The review
run additionally exercises the broker. These checks do not certify deployed
identity/ingress, backup restore, rollback, load/soak or full operational readiness.

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
  management 129, materializer 44, Editorial 535, article feature 68 and aggregator 328. Relevant builds, source/test typechecks and lint pass. Earlier unaffected
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
  Account Management 87, article feature 23, favorites feature 38 and aggregator 328. Unchanged backend results are reused; affected frontend tests were rerun
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

| Check                     | Result                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| Declared builds           | All 129 pass with Nx cache disabled                                                                 |
| Angular output inspection | All 63 packages; 101 ESM files, 423 declarations, 302 partial Angular declarations                  |
| Project tests             | 1,120 tests in all 114 inventoried suites, across 23 projects                                       |
| Portable tools            | 24 tests, including workflow failure gates                                                          |
| Lint                      | 131 product projects plus readiness tools pass; 445 warnings remain                                 |
| Declared typechecks       | All 13 projects pass; aggregator rechecked after correcting production input scope                  |
| Architecture              | 133 project responsibility tags/graphs pass; 1,101 production sources, zero source-audit violations |

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

| Check                          | Evidence                                                                                                                                                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Discussion management          | 95 tests pass, including 6 HTTP checks through the real Nest pipeline with in-memory dependencies and 38 new backfill/maintenance checks.                                                                                                                                            |
| Discussion materializer        | 43 tests pass for duplicate/reordered work, partial writes, deletion, rebuild equivalence, payload integrity, acknowledgement failures and reconciliation.                                                                                                                           |
| RabbitMQ adapter               | 15 tests pass, including channel-before-connection shutdown ordering on success/failure; actual broker delivery/shutdown also passes in the isolated suites.                                                                                                                         |
| MinIO adapter                  | 7 immutable-write and bounded-read/error tests pass with a mocked S3 transport.                                                                                                                                                                                                      |
| Editorial                      | 252 tests / 17 suites pass, including production Nest HTTP with substituted ports and physical-schema validation; four earlier standalone authorization regressions remain recorded.                                                                                                 |
| OPA policies                   | 31 Rego cases pass separately and in the deployment's merged policy set using checksum-verified OPA 1.4.2; strict OPA compilation passes. These are actual policy evaluations, not a mocked policy client.                                                                           |
| Authenticator                  | 42 tests / 6 suites pass, including real Nest enrollment HTTP with substituted ports, strict DTOs, required configuration and truthful error responses.                                                                                                                              |
| Canonical identity/account     | 112 SQL/protocol tests, 51 account tests, 53 Firebase adapter tests, 14 management application tests and 28 authentication application tests pass. Including Authenticator: 300 backend tests / 24 suites.                                                                           |
| Compilation                    | Discussion management/materializer, Editorial and both identity service builds/typechecks pass. Identity and three UI packages build independently; eight enrollment library outputs were cleared before an uncached build.                                                          |
| Lint                           | Affected Discussion/materializer/queue/Editorial targets pass; the current Editorial target has no warnings. All six affected identity lint targets pass without lint warnings.                                                                                                      |
| Architecture                   | Scoped source audit scans 1,101 production sources with zero boundary violations. All 26 original findings are resolved; three checker self-tests pass. This does not prove all runtime or architectural properties.                                                                 |
| Portal composition             | 43 aggregator suites / 298 tests and 5 identity suites / 38 tests pass. Source typecheck, identity/UI library checks and CSR production build pass. Eight production-bundle fixture browser layouts pass. Existing template/bundle warnings and 248 aggregator lint warnings remain. |
| Changed domain/features        | All 24 changed domain build targets pass. Profile/preferences and their 25 prerequisites pass after moving all 27 declared output directories aside and disabling Nx cache. Three Angular packages emit partial-compiled bundles. 25 affected lint targets pass with warnings.       |
| Aggregator dependency chain    | All 83 build tasks pass; 52 repaired outputs cleared, then chat cleared again for its ESM repair. All 56 Angular artifacts pass structural inspection. Nine test targets pass 389 tests/56 suites; 52 lint targets pass with 370 warnings.                                           |
| Complete workspace build       | All 129 declared build targets pass with Nx caching disabled. All 63 Angular packages pass artifact checks. Nine additional repaired targets pass lint with 11 warnings; no empty test target counts as coverage.                                                                    |
| Dependent service verification | Discussion management/materializer and Editorial production builds plus application/test typechecks pass after the shared-library changes.                                                                                                                                           |
| Live recovery                  | Canonical identity SQL, Firebase credential emulator and all three Discussion/Editorial isolated-store suites pass. Process restart, standalone deployed workers, real email/cleanup, integrated independent sessions and backup restore remain unverified.                          |

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
