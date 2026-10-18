# Review management

Public entrypoint: `@sdk/features/review/libs/management`.

`Reviews` coordinates the Review state transitions, canonical queries and durable
commands. Consumers supply `ReviewsRepository`, `ReviewAuthority`, identifiers,
the anonymous tenant and a clock. Keys remain opaque and case-sensitive. The
library contains no target kinds, consumer key schemas or product role names.

The authority port supplies current parent visibility and explicit action grants.
The use case checks permission before persistence, rechecks visibility under the
repository transaction before receipt replay and rechecks visibility/revision after
snapshots. Staff restoration does not undo author withdrawal; author publication
does not clear staff hiding. Authors cannot vote for, report or moderate their own
review. A denied grant never becomes permission through a role-name heuristic.

Repository implementations must isolate every read, author slot, lock and receipt
by the exact `(tenantId, bindingKey)` context. A transaction atomically commits
content versions, state, helpful membership/report decisions, receipts and its
durable journal. Receipt fingerprints retain `JSON.stringify({ id, change })`;
scope and actor are separate receipt lookup dimensions. A replay returns the
original receipt without applying a transition to the current review again.

Wapps supplies adapters in `apps/services/community/src/app/reviews/application`.
They map its keys to historical application UUID scopes and enforce its existing
OPA/public-parent policy. The Wapps SQL adapter remains consumer-owned; adding a
different consumer requires its authority and persistence composition. An arbitrary
unregistered key is not permission to access Wapps data. No generic product registry
or alternate SQL schema is introduced by this extraction.

Wapps Reviews deliberately read repeatable canonical SQL snapshots and use a
transactional SQL journal. They do not rely on Mongo generations, RabbitMQ delivery
or an object payload store. See `docs/MATERIALIZATION.md` for that variation and
its rollback/replay proof. The unit suite exercises unfamiliar keys and grants;
the HTTP package and Wapps real-store qualifier cover their respective boundaries.
