# Wapps Community application

This application consumes the reusable Discussion capability and owns Wapps topics,
article comments, reviews, community profiles and notification integration. Its
source previously lived inside `sdk/features/discussion/applications/management`.
The existing Nx target `sdk-features-discussion-applications-management`, output
path and deployed service name remain compatible with current tooling. The
Discussion HTTP contract is generic; frontend-specific routes live in BFF.

`@sdk/features/discussion/libs/management` owns structural commands and queries,
exact binding-key isolation, aggregate revision checks and storage ports. It does
not import this application or `@domains/community`. The materializer reads the
opaque key from canonical SQL and includes it unchanged in the snapshot fingerprint.

`@domains/community` owns Wapps public payloads, target types and portal/notification
contracts. `CommunityDiscussionBindings` supplies current parent access, content
validation, policy mapping, mention resolution and old request-fingerprint
compatibility. `CommunityDiscussionAccess` supplies only read access and anonymous
presentation. `communityDiscussionKey()` owns the Wapps key format. Other consumers
may choose entirely different keys and payloads without changing Discussion.

The portal continues through explicit BFF routes to this owning application.
Browser routes, payloads, expected revisions, idempotency headers and response
contracts are unchanged. Imports move to the consumer contract library; templates,
styles, UI components and interactions are not part of this refactor.

## Generic HTTP contract

`@sdk/features/discussion/http` supplies one controller under `/api/discussions` for
creation/listing, detail/edit/removal, replies, votes, pins, participation and
public selection. `discussion-http.options.ts` composes its command/query ports,
trusted actor resolution and Wapps parent/content/policy adapters. The reusable
controller never interprets consumer keys or payloads. See the
[HTTP package](../../../sdk/features/discussion/packages/infrastructure/http/README.md)
for the route and host contract.

Community no longer registers `/api/application-discussions`,
`/api/article-comments`, `/api/me/discussions` or `/api/discussion-selection`.
Both portal ingress configurations route these families through BFF, which owns
Wapps keys and maps generic results to the existing frontend contracts. Account
favorite validation calls generic public selection directly as a service client.
An empty query retains the legacy unbound contract; `bindingKey` selects the
consumer-scoped contract. Missing or wrong keys cannot access a bound resource,
and malformed selectors fail with 400 instead of falling back to unbound access.
The earlier `/api/discussion-bindings` family is retired. Like/unlike stays unbound;
votes/pins require a key, and participation/selection require a prefix. Consolidation
changes routing only, with no new migration or stored representation.
Reviews now use the separate generic `@sdk/features/review/http` controller under
`/api/reviews`, with a required exact `bindingKey` on all ten handlers. BFF owns
`/api/application-reviews/:applicationId` and constructs `wapps:application:<uuid>`.
`ApplicationReviewAuthority` supplies existing OPA/public-parent decisions and
`ApplicationReviewRepository` maps the key to the historical SQL application UUID.
The reusable management library has no Wapps keys, target kinds or role rules.
The internal `ApplicationReviews` facade remains for profile/feed composition;
Community no longer registers its old application-specific HTTP controller.

This Review change needs no new migration: SQL scopes, content versions, receipts,
fingerprints, locks, journal and account-erasure behavior retain their representation.
Current canonical SQL reads remain independent of the Discussion materializer.
Coordinate Community, BFF and ingress versions; old direct Review clients receive
404. Both checked-in gateway configurations now route application reviews to BFF.
The [Review HTTP contract](../../../sdk/features/review/packages/infrastructure/http/README.md)
describes routes and host responsibilities.

## Migration and activation

1. Fence Community/Discussion writers and the old Discussion materializer.
2. Preserve the current SQL, immutable objects, Mongo projections and application
   artifacts. Do not reset or reseed stores.
3. Run the existing migrations followed by
   `CommunityDiscussionBindingKeys1792080000000`. It adds a binary, bounded
   `bindingKey`, backfills Wapps bindings, and transactionally schedules each
   current aggregate revision for rebuild. It preserves IDs, aggregate revisions,
   command receipts, payload references and tombstones. Restart resumes safely.
   Then run `DiscussionBindingIndex1792150000000`, which adds
   `discussion_binding_page (tenantId, bindingKey, pinned, createdAt, id)` without
   rewriting rows or changing projections. Already migrated stores need only the
   new index migration; the maintenance entrypoint applies missing migrations in order.
4. Coordinate the new Community, Catalog BFF, Account Management and ingress
   configuration versions: old clients use retired dedicated or
   `/api/discussion-bindings` routes; new clients use scoped `/api/discussions`.
   Fence traffic during the switch; this is not
   a mixed-version rolling rollout. Start the materializer and Community. Schema 4
   replaces older stable nodes at the same revision with guarded writes; current
   reads return pending until the matching key/revision is materialized.
5. Refresh gateway upstream resolution after container recreation. Verify outbox
   convergence, authoritative reconciliation, Account favorite checks and BFF
   workflows before reopening traffic.

The old `subjectKind`/`subjectId` columns remain Wapps consumer metadata for its
existing queries and historical migration chain. Wapps writes maintain and verify
both representations. An explicitly configured other consumer can store only its
opaque key with null Wapps target metadata. Neither the SDK engine nor materializer
reads `subjectKind`.
Discussion keys have no built-in version registry. Aggregate revisions, immutable
payload paths and projection schema metadata remain internal durability mechanisms.

Do not roll back only the binary or start an old writer against the new runtime.
Rollback requires a coordinated fenced snapshot restore or a reviewed forward fix.
Account erasure waits for any schema-3 stable guards to be upgraded; it never deletes
those guards as historical cache garbage. See `docs/MATERIALIZATION.md` and
`tools/readiness/README.md` for qualification and operational limits.
