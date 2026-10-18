# Reusable Discussion HTTP adapter

Public entrypoint: `@sdk/features/discussion/http`. This Nest adapter exposes the
Discussion capability without application/article types, consumer payload schemas
or key-version conventions. The host sets the global `/api` prefix.

The scoped contract uses these routes:

| Method | Route                        | Input                                                                         |
| ------ | ---------------------------- | ----------------------------------------------------------------------------- |
| GET    | `/discussions`               | `bindingKey`, optional `cursor`, `order=created\|pinned`, `includeVotes=true` |
| POST   | `/discussions`               | `bindingKey`; body `{ content, subjectId?, state?, visibility? }`             |
| GET    | `/discussions/:id`           | `bindingKey`, optional `rootOnly=true`, `includeVotes=true`                   |
| PUT    | `/discussions/:id`           | `bindingKey`; body `{ content, expectedRevision, state?, visibility? }`       |
| DELETE | `/discussions/:id`           | `bindingKey`; body `{ expectedRevision }`                                     |
| POST   | `/discussions/:id/comments`  | `bindingKey`; body `{ content }`                                              |
| PUT    | `/discussions/:id/vote`      | `bindingKey`; body `{ value: -1\|0\|1, expectedRevision }`                    |
| PUT    | `/discussions/:id/pin`       | `bindingKey`; body `{ pinned, expectedRevision }`                             |
| GET    | `/discussions/participation` | `bindingPrefix`, optional `cursor`, `includeVotes=true`                       |
| GET    | `/discussions/selection`     | `bindingPrefix`, comma-separated `ids`, optional `includeVotes=true`          |

All commands require trusted actor context and `Idempotency-Key`. Editing,
deleting, voting and pinning require a positive expected aggregate revision.
Keys are case-sensitive strings of 1-256 printable ASCII characters without spaces;
URL-encode them. There is no built-in namespace registry. `subjectId` is an optional
opaque UUID reference, not a content-kind selector. The consumer determines its use.
Unknown query/body fields fail validation. Creation and editing content is further
validated by the configured consumer, as are allowable lifecycle transitions.

All routes use the single `/discussions` resource family. An empty query selects
the historical unbound list/detail/create/reply/edit/delete contract. A nonempty
query must explicitly contain a valid `bindingKey` and only the fields allowed
for that operation; empty, repeated, malformed or unknown selectors fail with 400. They never fall back to unbound access. Keyless requests cannot reach bound
resources, and keyed requests cannot reach unbound resources.

Unbound list/detail responses retain their historical generation-head and
`{ aggregate, nodes }` shapes. Keyed reads retain the generic consumer content and
structure described below. Commands retain their original receipts. Legacy
`POST/DELETE /discussions/comments/:id/like` remain available only for unbound
comments with no query and an empty body. Votes and pins require a key;
participation and selection require a prefix. Static discovery routes are
registered before `/:id` so they cannot be interpreted as discussion IDs.

There is no binding-resource endpoint. The former `/discussion-bindings` family
is retired, with no alias or redirect. BFF's existing frontend routes remain
unchanged and do not accept browser-supplied consumer keys.

## Host composition

Register `DiscussionsController` and provide `DISCUSSION_HTTP_OPTIONS`:

```ts
import { Module } from '@nestjs/common';
import {
  DiscussionsController,
  DISCUSSION_HTTP_OPTIONS,
  type DiscussionHttpOptions,
} from '@sdk/features/discussion/http';

// Supplied by the host's composition root.
declare function createDiscussionOptions(): DiscussionHttpOptions;

@Module({
  controllers: [DiscussionsController],
  providers: [
    { provide: DISCUSSION_HTTP_OPTIONS, useFactory: createDiscussionOptions },
  ],
})
export class DiscussionHttpModule {}
```

The options supply `DurableDiscussionCommands`, `BoundDiscussionQueries` as
`queries`, `DiscussionQueries` as `unboundQueries`, `DiscussionDiscovery`, a trusted
`actor(request, required)` resolver and optionally
an error translator for consumer exceptions. Compose these with explicit canonical
write/index/vote/participation adapters, projection readers and consumer binding
ports. An unknown or inaccessible key must fail closed. Do not resolve identity
from unverified browser headers. `required=false` permits anonymous reads; it does
not permit forged credentials. The Wapps example is
`apps/services/community/src/app/discussions/discussion-http.options.ts`.

The consumer supplies current parent authority, content validation, policy mapping
and historical command-fingerprint compatibility. Canonical tenant, ownership,
lifecycle, exact binding, revisions, receipts, immutable payload references and
transactional outbox enforcement remain in Discussion's command/query engine and
its adapters. Prefix discovery filters candidates only; it never authorizes them.
Selection always uses public authority even when a caller is authenticated.

Responses carry generic content and structural fields, including `bindingKey`,
`revision`, `replyCount`, `pinned`, `canPin` and comments. Removed ancestors retain
their structural position with null content and timestamps. Optional vote totals
come from canonical state at the same revision. Permission fields are hints;
commands always reauthorize. BFF owns frontend routes, key construction and DTO
mapping. It must validate the returned full key before exposing consumer content.

## Limits and consistency

Pages scan at most ten candidates plus one lookahead. Participation pages may be
short or empty with a continuation when parents become inaccessible. Selection
accepts at most fifty distinct UUIDs. Full threads retain the engine's 2,000-node
and depth-64 limits. A missing/currently stale generation fails with 503; it is not
returned as an empty or older thread. Canonical authority is checked again after
external reads. No transport retry is added to commands.

Hosts must configure body-size limits, request deadlines and concurrency limits
appropriate to their payload contracts. The library does not configure an Express
body parser or ingress. Wapps retains bounded 32-KiB portal requests and separate
response limits; a different consumer must supply its own host limits.

Route consolidation introduces no migration, projection schema or event format.
Wapps still requires the previously introduced
additive `DiscussionBindingIndex1792150000000` index after its existing binding
migration. It retains its historical receipts and target metadata. Another host
may supply different persistence adapters without editing the HTTP implementation.

## Qualification

Run `sdk-features-discussion-http:test`, its build/lint/typecheck targets and the
consumer's tests. `node tools/readiness/qualify-materialization.cjs --discussion-bff`
uses disposable MySQL, MongoDB, RabbitMQ and MinIO to exercise Wapps through both
ingress configurations and a second consumer through these same handlers and the
production materializer. The latter supplies an unfamiliar case-sensitive key and
payload, and covers pagination, isolation, votes/pins, discovery, revocation,
service recreation, replay and tombstones. Auth/policy/parent services are fixtures;
production provider, deployment and process-crash qualification remain separate.
The HTTP suite checks both contracts on one controller, key omission/substitution,
malformed selectors, anonymous/policy denial and unbound likes. Community module
metadata checks enforce exactly one controller for `/discussions` and retirement
of the old binding route family.
