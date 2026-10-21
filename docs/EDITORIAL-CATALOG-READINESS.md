# Editorial catalog readiness

`GET /api/health` remains process liveness in Editorial and Catalog BFF.
`GET /api/health/ready` reports the bounded `editorial-catalog` scope in both
services. HTTP 200 requires every check to be `ok`; degraded or unavailable
dependencies return HTTP 503 with `Cache-Control: no-store`. This is not a claim
about Account, Community, other BFF journeys or whole-product readiness.

BFF calls the configured `EDITORIAL_URL` owner's readiness contract. It never
connects to owner stores. An unavailable owner is `owner_unavailable`; a malformed,
incomplete, unrelated or status-inconsistent report is `owner_incompatible`.
Only fixed check codes and finite, nonnegative integer metrics cross BFF.

## Checks and bounds

| Check | Evidence | Failure codes |
| --- | --- | --- |
| SQL | Dedicated connection, `SELECT 1`, authoritative reads | `sql_unavailable` |
| Schema | Exact current migration receipts, six classification columns, transactional catalog/state/outbox tables and exact key/revision/outbox timestamp column types | `schema_incompatible`; `not_checked` when SQL cannot be read |
| Outbox | At most 1,001 undelivered rows; pending/failed counts, oldest observed age and expired leases | `dispatch_backlog`, `poison_messages` |
| Projection | Mongo collection existence and a bounded read | `projection_missing`, `projection_unavailable` |
| Policy | The actual Editorial OPA decision for an empty input must explicitly deny | `policy_incompatible`, `policy_unavailable` |
| Materializer | Existing main/failed RabbitMQ queues, consumer count, ready/unacknowledged deliveries and acknowledgement progress | `queue_missing`, `queue_incompatible`, `queue_unavailable`, `worker_missing`, `worker_stalled`, `poison_messages` |

Readiness does not run migrations, declare queues/indexes, publish messages,
acknowledge deliveries, repair projections or retry commands. The probes run
concurrently. SQL has a 1.5-second total socket deadline and 500-ms statement
limits; Mongo has a shared 1.4-second abort deadline plus driver/server limits;
policy/queue HTTP reads have 1.4-second abort deadlines and bounded response sizes.
BFF has a 2.2-second owner abort deadline and an 8-KiB response limit. Redirects
and automatic upstream retries are disabled. SQL sockets and Mongo clients close
after each probe. Concurrent callers share one in-flight probe; Editorial caches
the completed report for one second. No indefinitely pending promise is used as
a substitute for cancelling store/socket work.

Counts from the SQL sample are lower bounds, not a complete backlog census.
Mongo availability does not prove every historical projection is intact; use
reconciliation/rebuild for that. Queue progress observes acknowledgements across
polls in one API process, starting when a backlog is first observed. A restart
resets that observation window. Poll consistently; an idle consumer is not a
proof that every historical event was processed. Broker statistics sampling adds
its own delay. These constraints are deliberate limits of this readiness scope.

## Configuration and response

Owner probes use the explicitly configured `EDITORIAL_DATABASE_*`, `MONGO_*`,
`OPA_URL`, `QUEUE_HOST`, `QUEUE_USERNAME`, `QUEUE_PASSWORD` and optional
`QUEUE_VHOST` bindings. The RabbitMQ management API must be available to the
configured queue user for the two Editorial queues. Set
`EDITORIAL_READINESS_QUEUE_URL` when it differs from `http://QUEUE_HOST:15672`;
the URL remains internal and is never returned in a report.

`EDITORIAL_READINESS_MAX_BACKLOG_MS` defaults to 30,000, accepts integer values
from 1,000 to 300,000 and otherwise uses the default. It applies to observed
outbox age and the interval without a queue acknowledgement while work is
pending. Qualification uses 2,000 ms; that value is not a production rollout.

An example degraded check is:

```json
{
  "code": "worker_stalled",
  "pending": 2,
  "failed": 0,
  "consumers": 1,
  "unacknowledged": 1,
  "stalledMs": 30001
}
```

Reports and transition logs contain no URLs, credentials, SQL text, exceptions,
tenant/actor identities, resource IDs or message bodies. On a code transition,
Editorial emits `editorial_catalog_readiness` at warning level for non-ready
states and normal level on recovery, with aggregate checks and this runbook path.
Unchanged polling does not repeat the alert. Connecting these signals to a
deployed scraper/alert receiver remains deployment work; no live probes or alert
delivery have been changed by this slice.

## Operator response

- `schema_incompatible`: fence writers, compare the installed migration receipts
  and physical schema with the release, and use the reviewed maintenance process.
  Do not delete receipts, enable synchronization or let readiness repair storage.
- `dispatch_backlog` or outbox `poison_messages`: inspect Editorial
  `--outbox-status`, queue connectivity and expired leases. Repair the cause before
  explicitly using `--outbox-requeue <failed-outbox-id>` for reviewed work.
- `worker_missing` or `worker_stalled`: inspect the independently running
  `--materialize` process, its unfinished delivery and SQL/Mongo connectivity.
  Preserve broker deliveries; confirm acknowledgement progress and readiness
  recovery after repair.
- Materializer `poison_messages`: inspect the retained
  `editorial-projection-v1.failed` queue under the operator access policy. Do not
  purge it to turn readiness green. The disposable qualifier acknowledges only
  its own deliberately malformed message after proving retention.
- `projection_missing`: retain SQL authority and restore the materializer indexes,
  then run reviewed `--rebuild` / `--reconcile` recovery. Availability alone does
  not qualify data integrity after projection loss.
- Other dependency failures: restore the named dependency/binding, then verify
  readiness and the catalog journey. Liveness can stay 200 throughout the outage.

## Qualification

Build all dependencies before starting runtime checks. Use Node 22.17.1, the
checked-in lockfile and `NX_DAEMON=false NX_ISOLATE_PLUGINS=false` in a fresh
isolated installation. The external suite is separate from `npm test`:

```sh
WAPPS_OPERATIONAL_INTEGRATION=1 node --test tools/readiness/operational-foundations.test.cjs
```

It owns disposable Docker MySQL, MongoDB, RabbitMQ and OPA instances and built
Editorial/BFF/materializer processes. It runs both historical Editorial recovery
qualifiers with explicit passing, nonempty TAP evidence, then proves a real
catalog read, independent owner restart, paused SQL/Mongo/OPA/broker, concurrent
bounded failure checks, physical schema incompatibility, absent/frozen worker,
retained poison and SQL backlog/expired-lease recovery. Cleanup removes only the
invocation's named resources. SQL fixtures use a controlled allowing policy in
the historical adapter qualifier; the runtime readiness journey uses real OPA.

The transport regression is separate:

```sh
WAPPS_LOCAL_AUTH_INTEGRATION=1 node --test tools/readiness/local-auth.test.cjs
```

Leave `WAPPS_NGINX_BINARY` unset for Docker evidence. Each invocation uses both
local/alpha API/auth includes and both complete gateway configurations, real
Authentication/Account/BFF services, 1,600 repeated authenticated reads, invalid
tokens, outages and restarts. Profile, member, export and suite extension flags
remain mutually exclusive and must be run in separate invocations.

The complete alpha fixture replaces absent unrelated domain origins with an
unavailable test endpoint; the complete local gateway retains its runtime DNS
behavior for absent domains. Fixture endpoint/port substitutions, accelerated
qualification rate limits and the existing controlled alternate authentication
implementation do not prove deployment, external identity-provider acceptance,
whole-product load/soak or original frontend acceptance.
