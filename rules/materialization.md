# Materialization

Follow `architecture-abstract.md` section 6 and `docs/MATERIALIZATION.md`.

- Authoritative structural facts, domain payload references, ownership and
  lifecycle state belong to the write model. A read projection is disposable.
  Never use projection availability or projection fields to grant permission.
- Commit a mutation and its durable materialization intent together. Object
  payloads must be immutable and referenced only by committed metadata. A failed
  SQL transaction may leave an unreferenced object, never a visible partial write.
- Use monotonically increasing aggregate revisions, not arrival order or wall
  clock timestamps, to prevent stale events from replacing current projections.
- Materialize complete, consistent snapshots. Compute counters from authoritative
  facts instead of incrementing them for each delivery. Replays and concurrent
  duplicate messages must converge to the same result.
- Acknowledge work only after a durable projection write or confirmed transfer
  to a retry/dead-letter destination. Broker publisher confirms and consumer
  acknowledgements solve different parts of delivery; neither creates an atomic
  database/broker transaction.
- Preserve tombstones and revision information for deletion. An older event must
  not resurrect deleted content. Validate tenant/visibility access against the
  current write model while projections lag.
- Bound retries, payload sizes, batch sizes and graph traversal. Treat missing or
  cyclic authoritative relations as errors, not invented roots or empty content.
- Provide rebuild/reconciliation from authoritative stores without depending on
  retained broker messages or the old projection. Test crash windows, duplicates,
  reordering, edit/delete propagation and concurrent writers before release.

Apply these requirements to each new projected feature. Document any deliberate
variation with its failure/recovery proof; do not silently replace them with
best-effort publication or success-shaped fallback data.
