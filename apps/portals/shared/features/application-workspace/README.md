# Application workspace

Canonical private application drafts for API-mode portal routes. The pure
`@domains/catalog/record` contracts validate fields and snapshots. Application
state depends on draft and session ports; the HTTP adapter owns transport and
strict response parsing. `provideApplicationWorkspace` explicitly selects API
composition. Demo mode retains the portal's existing local pages.

Commands use expected revisions and idempotency keys. Unconfirmed intent retains
its exact command/key until retried; a different command is blocked. Account
changes cancel obsolete work, clear private state and prevent prepared commands
from executing under a new account. Route cancellation retains uncertain intent.
Confirmed saves must reread canonical state. Pages handle routes, form bindings
and receipt navigation without owning storage or authorization.

The API is `/api/me/application-drafts` with list/create and per-ID read/update/
delete. Saving does not publish, reserve public slugs, verify ownership or grant
editing rights over existing applications. No public projection is introduced.
See `docs/MATERIALIZATION.md` and `tools/readiness/README.md` for the transactional
contract, real-service qualification command and remaining limitations.
