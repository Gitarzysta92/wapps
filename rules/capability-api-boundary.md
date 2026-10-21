# Owning-service API boundary

- Owning services expose APIs for their own domain capabilities, independent of
  portal screens and consumer content kinds. This applies to deployed HTTP
  contracts as well as reusable libraries. Generic means generic within the
  capability: Discussion owns threads and comments; Catalog can own applications.
- The BFF owns dedicated frontend routes, consumer binding-key construction,
  request mapping, bounded cross-service composition and frontend response shapes.
  Application-discussion and article-comment routes belong at this boundary.
  Forwarding a dedicated route to an identical owning-service route does not
  complete this separation.
- Reusable capabilities receive opaque, case-sensitive consumer keys. Their
  controllers, use cases and materializers must not parse consumer kinds,
  identifiers or key-version conventions. Consumer schemas and compatibility
  interpretation belong in consumer code, outside the generic capability.
- Owning services retain canonical tenant, ownership and lifecycle enforcement,
  exact-key isolation, authoritative writes, transactions, receipts, outboxes and
  materialization. Consumer-dependent authorization uses explicit trusted ports
  or contracts and fails closed. A caller-supplied key or a successful BFF check
  is not authority; BFF presentation mapping cannot replace service enforcement.
- Migrate each workflow through frontend -> dedicated BFF contract -> generic
  owning-service contract. Preserve public frontend behavior, error semantics,
  expected revisions, idempotency fingerprints and persisted representations.
  Qualify exact-key isolation, parent-access revocation, denial, replay, dependency
  failure and projection lag before retiring the dedicated internal routes.
- Record remaining dedicated owning-service routes as migration work. Generic
  SDK interfaces alone do not establish compliance with this API boundary.
