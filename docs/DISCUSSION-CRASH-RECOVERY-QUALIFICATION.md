# O02 bounded Discussion crash recovery and migration diagnostics

October 19, 2026. This `wappsA` slice starts from I28 commit
`2c4a78797bb7bf4df2d3365c3490cd0a91a4fa7a` on
`codex/discovery-feed-parity`. It qualifies one generic Discussion command family
and improves Editorial maintenance diagnostics. It does not activate live workers,
run live migrations, reconcile sibling lanes or change the A21 live installation.
The source, command/results, failed attempts, cleanup, source manifests and task-only
patch are retained in `/tmp/wappsa-recovery-20261019-651jqvgu/`; `verification.json`
is the evidence index. The branch HEAD alone does not identify this uncommitted slice.

## Initialization investigation and unresolved risk

I28's `runtime-member.log` in
`/tmp/wapps-integration-a28-20261018-l4s2868l/` shows the 1,600-request Docker
transport group passing before the compiled Editorial `--migrate` command fails
with only `Editorial failed: Error`. Its diagnostic and uninstrumented confirmation
runs both pass all 25 groups without source changes. These observations do not
establish which operation or condition failed originally.

The first new fresh-store campaign also fails, in
`ApplicationImageCleanup1791676816000` with an incompatible-schema guard result.
That log is retained as `runtime-attempt1.log` and its child log under
`runtime-attempt1/`. The failing guard's ORM/physical comparison was not captured
in that first attempt; the disposable stores were removed. Subsequent campaigns
pass unchanged migration behavior. This narrows an observed initialization failure
to a concrete migration guard, but it does not establish why that guard failed or
that it caused I28's original failure. Both risks remain unresolved. No migration
schema, guard, accepted receipt, migration order or 27-migration roster is changed.

The production maintenance source now emits structured operation, elapsed-time,
allowlisted driver/network code, numeric errno, SQL state and syscall fields.
Traversal of driver errors, causes and aggregate errors is bounded to eight objects;
cycles and accessor fields are ignored. Unknown string codes/names are omitted or
normalized. Messages, stacks, addresses, credentials, DSNs, SQL and query parameters
are not copied. A maintenance-specific TypeORM logger suppresses raw error/SQL
output (TypeORM migration logging otherwise includes exception messages even with
query logging disabled), and retains only a failed migration identity from the
trusted production roster. The original error is rethrown; failure remains nonzero.
No automatic operation retry, startup delay or gateway substitution is introduced.

The final post-build campaign passes 12 fresh databases: eight sequential and
four concurrent, each in its own schema. Eight re-entries apply zero migrations;
each fresh schema retains all 27 production receipts. Four deliberate failures
(wrong credentials, missing database, refused TCP connection and a trigger rejecting
migration receipts) produce nonzero CLI exits and the expected safe operation/codes.
Removing that test-owned trigger and explicitly rerunning maintenance recovers all
27 receipts. Secret-bearing test exception messages do not appear in the CLI output.
This is bounded evidence, not resolution of the intermittent guard failure.

`WAPPS_RECOVERY_OBSERVE_SCHEMA=1` adds a test-only, read-only driver observer. The
final campaign retains selected column/index metadata in each initialization
process's `.ipc.json`. All observed cleanup index orders match the expected physical
order in that campaign; this does not explain the earlier failure. Unexpected
future initialization failures also retain a bounded schema metadata snapshot and
remain failures while independent Discussion checks continue.

## Real process/store qualification

The runner creates unique Docker MySQL 8.4, MongoDB 7, RabbitMQ 4 management/quorum,
MinIO and OPA 1.4.2 stores, with loopback ports and no preexisting volume reuse.
Their exact image IDs, resource names, ports and cleanup are retained. Separate
compiled production Discussion owner and materializer processes use those stores.
Commands enter through `/api/discussions?bindingKey=...`; the owner uses real OPA,
canonical SQL write/erasure barriers, transactions, immutable object registration,
receipts and the production outbox. Wapps consumer key interpretation stays in
consumer code; generic handlers and materializers remain unchanged.

Ingress identity headers and the consumer's parent visibility endpoint are controlled
fixtures. The runner verifies exact binding preservation in SQL/Mongo, a different
valid key, forged credentials, tenant isolation, foreign-owner mutation denial,
revoked parent access and a canonical erasure fence. Independent Authentication and
canonical Identity/Account resolution are exercised separately by the preserved
Docker gateway regressions. The second-consumer unknown opaque key/payload journey
remains covered by the separate generic Discussion BFF regression.

`discussion-crash-preload.cjs` is loaded only by qualification child processes. It
observes external driver calls and uses IPC to stop completion at a named boundary.
The parent verifies the expected SQL/object/projection/broker state, sends actual
`SIGKILL`, waits for OS process exit and starts a new compiled process. These are
actual process crashes at controlled boundaries, not exceptions labeled as crashes.
No fault switch, barrier or dependency replacement is added to production code.

The final matrix passes in 169.543 seconds, with 14 actual `SIGKILL` observations.
Targets are asserted by the runner; the acceptable loss of committed commands in
this slice is zero. Uncommitted uploads may remain registered and unreferenced;
they never become a partially visible mutation. Every committed node's referenced
object is checked against its registered size/hash and owner/tenant scope.

| Killed/recovery boundary | Observed recovery | Asserted bound |
| --- | ---: | ---: |
| Object upload accepted before structural SQL commit | 1.430 s | 40 s |
| Structural mutation, receipt and outbox inserted before SQL commit | 1.529 s | 40 s |
| SQL committed before HTTP response | 0.556 s | 40 s |
| Durable outbox claim before publication | 30.534 s | 40 s |
| Publisher confirm before outbox delivery marking | 30.568 s | 40 s |
| Durable projection nodes before head | 5.047 s | 20 s |
| Durable head before consumer completion | 4.981 s | 20 s |
| Before source acknowledgement | 4.973 s | 20 s |
| Stale materializer killed after newer tombstone is published | 0.027 s remaining drain | 20 s |
| Rebuild from SQL/objects without projections or delivery history | 8.331 s | 40 s |

Recovery starts after the killed child exits and includes startup/convergence and
broker observation. Outbox tests wait for the real 30-second lease expiry; they do
not edit lease timestamps or advance clocks. The stale-materializer measurement is
only remaining drain after the newer deletion is already durable, not full deletion
latency. These are local bounded observations, not production SLOs.

## Retry, poison, tombstones and rebuild

A temporarily removed test-owned committed object creates a real object-read failure.
Four process kills retain increasing RabbitMQ quorum delivery counts across fresh
materializer processes. The fifth delivery reaches bounded quarantine with the exact
original bytes, `MaterializationFailed` and five recorded attempts. The test explicitly
restores the same object bytes under the unchanged reference using conditional creation,
confirms a requeue, then acknowledges the retained failure. This proves controlled
repair/requeue behavior, not coordinated backup restoration.

Malformed poison is confirmed to the durable failed queue while the original source
message remains unacknowledged. Killing the worker then redelivering preserves the
poison; up to two quarantine copies are permitted by this cross-queue at-least-once
handoff. They do not create a visible Discussion effect. Removal is an explicit
operator action limited to the test-owned poison. Unknown handoff outcomes cannot
become successful source acknowledgements.

An older generation is held after writing nodes. Another materializer publishes a
newer deletion, then the older process is killed. Redelivery reads current SQL and
cannot replace the tombstone. Historical creation receipt replay returns its original
result without allocating payload registrations or resurrecting content. Ordered
revisions, exact keys, tenant scope and immutable references are preserved.

After all deliveries drain, both processes stop. The test drops both Mongo generation
collections, deletes both RabbitMQ queues and clears delivered outbox history. The
compiled `--rebuild` CLI enumerates authoritative SQL aggregates and queues their
current revisions. Fresh owner/materializer processes reconstruct seven aggregates,
including tombstones, byte-for-byte equal to the saved projections. All canonical
receipts, aggregate bindings/revisions and payload registrations remain equal.
The compiled read-only `--reconcile` CLI then succeeds.

## Retained Docker gateway failure

The final export regression's first invocation fails after 14 shared baseline
groups, before export-specific work or its 1,600-request transport group. On the
first normal profile read after restoring the BFF's Account binding, Docker Nginx
returns HTTP 504 for `/api/me/profile`: its log records a two-second upstream
connection timeout to the BFF. The existing restart helper had already received
a successful loopback BFF health response. This identifies the boundary, not the
cause; the HTTP-status failure path did not collect contemporaneous socket or
direct-health observations. `runtime-export.log` and its nonzero exit remain
retained. No gateway timeout, readiness bound, request retry, pacing or native
Nginx substitution is introduced. Independent regressions continue, and one fresh
unchanged export confirmation is recorded separately from the failed invocation.

The independent final regressions pass operations (11 groups), member (25), public
profiles (25), erasure (31), suite (29), application (31), materialization (four
real-store suites) and Discussion BFF (14 groups, including an unknown opaque
consumer key/payload). The five successful gateway families contribute 8,000
bounded authenticated Docker reads. These passes do not qualify the export
invocation that failed or establish the cause of its connection timeout.
The single fresh unchanged export confirmation passes all 27 groups and 1,600
additional authenticated Docker reads in 95.994 seconds. The combined successful
gateway invocations therefore contribute 9,600 reads. Its result and log are
`runtime-export-confirmation.result.json` and `runtime-export-confirmation.log`;
the original ten-invocation batch still contains the export failure and exits
nonzero. No further confirmation or retry batch is run.

## Reproduce and interpret

Use Node 22.17.1 and a fresh installation of the unchanged lockfile. Set
`NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true`. Finish builds before
any runtime uses the same `dist`:

```sh
npm ci --no-audit --no-fund
npx nx run-many -t build,typecheck --all --parallel=3 --skip-nx-cache
WAPPS_DISCUSSION_CRASH_INTEGRATION=1 WAPPS_RECOVERY_OBSERVE_SCHEMA=1 \
  node --test tools/readiness/discussion-crash-recovery.test.cjs
```

An optional `WAPPS_RECOVERY_EVIDENCE` selects a new dedicated evidence directory;
otherwise the runner creates one and retains it after cleanup. Do not reuse an old
attempt's directory. The explicit integration suite is separately inventoried and
never counts as a portable unit-test pass. Full tests/lint, boundary and Angular
artifact gates, operational readiness and Docker regressions are indexed in the
evidence directory. Every failed attempt is retained and classified there.

BC24/BC28 remain open for the unresolved initialization guard risk, broader service
crash coverage, coordinated SQL/object backup restoration and compatible whole-service
rollback. The Docker gateway connection timeout is also an unresolved transport
reliability risk; a successful confirmation cannot erase the original failure.
The 24-hour mixed-workload soak, deployed probes/alerts, real-provider
activation, archived-data policy and accepted original frontend are separate gates.
No live migration, erasure fence, worker enablement, deployment, branch switch,
commit or push is performed by O02.
