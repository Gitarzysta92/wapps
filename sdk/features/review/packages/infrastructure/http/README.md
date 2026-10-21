# Review HTTP capability

Public entrypoint: `@sdk/features/review/http`. Register `ReviewsController` and
provide `REVIEW_HTTP_OPTIONS` with the Review use case, a trusted actor resolver
and, optionally, a consumer error translator. The host authenticates request
provenance and configures body limits; Wapps does this in Community.

All routes require exactly one `bindingKey` query parameter. It is an opaque,
case-sensitive consumer key, not a resource with its own CRUD API. The adapter
does not interpret namespaces, target identifiers or consumer version conventions.
There is no keyless fallback or `/review-bindings` alias. Only paged routes accept
an optional `cursor`; extra, missing, empty or repeated selectors fail with 400.

With the host's `/api` prefix:

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/reviews` | Public page, current member slot and canonical summary |
| GET | `/api/reviews/summary` | Current count, average and rating distribution |
| GET | `/api/reviews/moderation` | Authorized moderation page |
| PUT | `/api/reviews/mine` | Publish or update the member's slot |
| GET / DELETE | `/api/reviews/:id` | Detail or author withdrawal |
| PUT | `/api/reviews/:id/helpful` | Set or remove helpful membership |
| GET / POST | `/api/reviews/:id/reports` | Staff evidence page or member report |
| PUT | `/api/reviews/:id/moderation` | Independent staff hide or restore |

Commands preserve `expectedRevision` and `Idempotency-Key`. The use case validates
content and command shape. Reads reject request bodies; duplicate command headers
are invalid. Responses are no-store. Input, denied, missing and conflicting
operations return 400, 403, 404 and 409; the actor resolver can return 401.
Unclassified dependency failures return a redacted 503, never a success fallback.

The owning service supplies current authority and a scoped canonical repository.
BFF mapping is not authorization. Wapps maps its dedicated application-review
routes and response fields in BFF, then interprets its own key through Community
adapters. Its SQL table shapes and historical receipt fingerprints do not change.
Community no longer exposes `/api/application-reviews/:applicationId`; both local
and alpha portal ingress configurations send that family to BFF.

`reviews-http.spec.ts` exercises all handlers and hostile selectors with controlled
use-case/identity ports. The disposable real-store qualifier
`node tools/readiness/qualify-materialization.cjs --discussion-bff` also executes
the actual Wapps use case, SQL adapter, BFF and both nginx configurations. It uses
controlled authentication/policy/parent providers; it does not qualify deployed
Firebase/OPA/Editorial or the accepted frontend.
