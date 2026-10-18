# Discussion consumer boundary

- Discussion accepts an opaque, case-sensitive binding key supplied by its consumer.
  The consumer owns the key's meaning, namespace, identifiers and any format/version
  convention. Do not parse these in the Discussion SDK or materializer, or add a
  registry of application/article/content types there.
- Keep Wapps target types, payload schemas, parent visibility adapters and product
  permission mappings in consumer code. The BFF owns dedicated frontend routes
  and key/request/response mapping; the owning service enforces current authority
  through explicit consumer ports. Follow `capability-api-boundary.md`.
  Existing Wapps code in `libs/domains/community` and `apps/services/community`
  consumes the Discussion management library through its public entrypoint and
  supplies ports to `@sdk/features/discussion/http`. Application topics, article
  comments, participation and selection map through BFF to `/discussions`;
  do not reintroduce their dedicated routes on Community. Review follows the same
  boundary through `@sdk/features/review/http` and `/reviews`; its dedicated
  application routes also belong only in BFF.
- Expose Discussion operations through one `/discussions` resource family.
  Consumer bindings are request context, not a separate HTTP resource. Preserve
  keyless isolation; malformed or repeated keys must never fall back to unbound
  access. Portal generic routes must not forward caller-supplied scope selectors.
- Bind every read and mutation to the exact stored key and current tenant/ownership
  authority. Consumer ports must fail closed. Generic endpoints cannot bypass a
  consumer's current parent-access rules.
- Concurrency revisions, immutable payload references and projection schema metadata
  are storage guarantees, not consumer key versions. Preserve them and their replay,
  tombstone, rebuild and erasure protections as required by `materialization.md`.
- Changing the representation requires forward migration and historical command
  replay proof. Keep compatibility interpretation in the consumer, never the SDK.
- Qualify a previously unknown key and payload through commands, reads and
  materialization without modifying the Discussion implementation.
