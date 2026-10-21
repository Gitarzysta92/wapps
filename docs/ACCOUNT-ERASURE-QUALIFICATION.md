# A28 account erasure qualification

October 18, 2026. This work starts from the integrated A27 snapshot
`908e60952cc4100dfcc6807978ff419a432c9dfc`. It qualifies the existing durable
erasure implementation with independent local Authentication and Account,
compiled Editorial/Community/BFF processes, real OPA, MySQL, MongoDB, RabbitMQ
and MinIO. The accepted presentation remains `c965790e...`; live installation
remains A21. No live migrations, worker activation or deployment are included.

The subsequent I28 integration reruns this journey through Docker: 31 groups pass,
including the O01 transport/restart checks. Full combined gates and detailed
fence/artifact and inventory evidence are recorded in `/tmp/wapps-integration-a28-20261018-l4s2868l/`.
The lane evidence below remains historical; I28 supersedes its Docker transport gap.

## Running the amended journey

Use a fresh source snapshot, Node 22.17.1 and unchanged-lockfile `npm ci`.
Complete all builds before starting runtime checks. Leave `WAPPS_NGINX_BINARY`
unset for Docker qualification. All commands use
`NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true`.

```sh
npx nx run-many -t build --all --skip-nx-cache --parallel=3
WAPPS_LOCAL_AUTH_INTEGRATION=1 WAPPS_ERASURE_PARITY_INTEGRATION=1 \
  WAPPS_ERASURE_OUTPUT=/tmp/owned-erasure-evidence \
  node --test tools/readiness/local-auth.test.cjs
```

The qualifier creates and removes its own stores; never point it at shared
databases or object storage. Its erasure extension is mutually exclusive with
the profile, member, export, suite and application extensions. It adapts the existing
Account, Discussion and completion checks through explicit context callbacks;
it does not instantiate a credential provider inside Account or assume that
the provider subject equals the canonical account ID. The old
`qualify-suites.cjs --account-export-runtime --account-erasure-coordinator`
Firebase composition is historical and is not the A28 entrypoint.

The exact erasure plan remains `account`, `editorial`, `discussion`, with a
separate credential-deletion journal. The export plan remains `account`,
`credentials`, `editorial`, `discussion`. No roster, migration, receipt,
outbox, SDK key or persisted representation is changed.

## Evidence and scope

Evidence is retained in `/tmp/wapps-a28-account-erasure-20261018/`.
`verification.json` is the final command/result index; the baseline/final source
manifests and task-only patch identify the source independently of main's dirty
backlog. Failed attempts remain alongside successful reruns.

The final full journey passes 29 groups; the export regression passes 25.
Standalone Account cleanup/coordinator, Discussion and Editorial regressions pass
2/5/14/11 groups. Shared baseline groups overlap. The workspace gate passes 6,869
Jest tests / 426 suites, 34 portable tests, full lint, 140 uncached builds,
49 typechecks, 64 Angular package inspections and zero architecture violations.
The final readiness lint has no errors and four pre-existing warnings. Cleanup
verification finds none of the 40 recorded attempt containers or their temporary
images remaining, and no compiled service from the qualification copy running.

The full journey covers self-deletion through both gateway configurations,
staff read-only combined status, denial and no-fallback behavior, credential
failure/outage, durable participant retries, private Account cleanup, legacy
Discussion inventory, anonymous public contributions/reviews, private object
retirement, current/historical projections, final SQL receipt failure,
12-attempt quarantine, compiled maintenance requeue and actual Account SIGKILL
with real lease-expiry recovery. Malformed participant transports deliberately
return foreign, mismatched, missing and duplicate receipts and must remain
pending. Real providers perform the final successful completion.

Private profiles, avatars, preferences, follows, badges/audit provenance,
notification receipts, watches and export artifacts are checked alongside
Editorial private workspaces and media. Approved suite publication survives
private draft removal and account erasure; referenced public image bytes remain
unchanged while unused private image bytes become permanent retirement markers.
Peer ownership and private state remain intact.

Before either erasure fence is enabled, the harness stops and awaits its owned
Editorial/Community processes and Discussion materializer, then checks frozen
compiled artifact hashes. It records these observations and the payload inventory
plans/fingerprints in `runtime/runtime-evidence.json`. Inventory application runs
with the owned Discussion writer stopped. Only the current qualified binaries
are subsequently restarted. These fresh-store observations do not prove that
all writers in a real installation have been fenced.

Supplemental fresh-store regressions:

```sh
node tools/readiness/qualify-identity-mysql.cjs --account-erasure-cleanup
node tools/readiness/qualify-identity-mysql.cjs --account-erasure-coordinator
node tools/readiness/qualify-materialization.cjs --discussion-author-erasure
WAPPS_SUITES_OPA_DOCKER=1 node tools/readiness/qualify-suites.cjs \
  --editorial-erasure-participant --no-browser
```

These cover bounded large histories, rollback/concurrent writers, lease fencing,
migration reentry/corruption refusal, ownership/proof/audit cleanup, both upload
families, historical projections and retained publication. Their controlled
identity/source fixtures are supplemental evidence, not a replacement for the
independent-process journey. The workspace gate also runs `npm test`, `npm run
lint`, every declared build/typecheck, `npm run check:boundaries` and
`node tools/readiness/check-angular-packages.mjs --all`.

## Explicit limits

The original A28 lane gateway run selects native Nginx 1.28.3 with
`WAPPS_NGINX_BINARY`; both checked-in API/auth configurations are exercised.
That run alone does not qualify Docker-to-host transport; I28 supplies the
subsequent combined Docker evidence. The complete-gateway startup check also uses Docker. Editorial fixture publication uses trusted
canonical setup claims and direct production projection; Discussion uses the
compiled broker materializer. Notification history is seeded as delivered and
suppressed SQL receipts; actual notification delivery is A26 evidence. Retry
`availableAt` values are advanced only on unleased disposable rows. The crash
probe uses a real process kill and waits for the real lease deadline.

Archived backups, object versions, logs and external credential providers need
their own retention/deletion policy and acceptance. Do not describe retained
anonymous public content or permanent tombstones as deletion of every byte.
Production fencing/inventory approval, coordinated version/migration rollout,
backup/restore, rollback/load/soak, browser acceptance and the original frontend
merge remain open. Media gateway parity and other workflow families retain their
own checklist entries.

Shared integration points are `local-auth.test.cjs`, the profile service/content
helpers, `qualification-process.cjs`, the three legacy erasure helpers and the
A28-only fixture/runtime modules. The profile content hook is optional. Existing
extension selection, service endpoints and default-off cleanup configuration
are preserved for other qualifiers.
