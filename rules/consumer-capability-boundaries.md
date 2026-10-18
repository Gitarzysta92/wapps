# Consumer-owned capability bindings

- Reusable Review and Identity core/use-case libraries must not import Wapps
  contracts, use cases or adapters. Extend the same consumer-owned boundary used
  by Discussion. A consumer supplies opaque, case-sensitive binding keys and
  owns their namespace, target identifiers, payload schema and version conventions.
- Review management and HTTP use `@sdk/features/review/libs/management` and
  `@sdk/features/review/http`. The owner exposes `/reviews` with required exact
  binding context; BFF owns `/application-reviews` and its response mapping.
  Wapps authority and historical SQL interpretation stay in Community adapters.
  Do not add target-kind or role-name conventions to the reusable packages.
- Keep Wapps review contracts in `libs/domains/community`, account/profile/feed
  composition in `libs/usecases/account`, and Wapps account SQL schemas/adapters
  in `libs/adapters/account-mysql`. Use their public package entrypoints. The
  existing Identity applications compose these consumer packages at bootstrap.
- Generic saved-association and watch mechanics compare exact consumer keys.
  Keep account authorization, canonical locks, idempotency fingerprints, baseline
  revisions and removal/replay during target outages. Notification delivery must
  commit its delivered/suppressed receipt before source acknowledgement; inbox
  reads recheck current account access and consumer target authority.
- Consumers supply required export/erasure provider plans. Require every exact
  provider once, reject missing/duplicate/foreign receipts, and never derive a
  completeness requirement from whichever providers happen to be available.
  Existing Wapps jobs use the fixed roster in `account-provider-plan.ts`. Changing
  it requires an explicit durable-job migration and compatibility proof; a deploy
  or environment flag must not silently redefine already accepted work.
- Storage revisions, leases, immutable payload references, outboxes, projections,
  deletion guards and historical receipt fingerprints retain their durability
  meaning. Moving code is not permission to alter stored representations.
- Exercise a previously unknown key/provider without changing the reusable
  implementation, plus exact-key isolation, denial, failure, replay and incomplete
  provider cases. Run ARCH009/010, composite builds and consumer compatibility
  tests. Architecture scans supplement source review; they cannot prove runtime
  authorization or the semantic meaning of an arbitrary string.
