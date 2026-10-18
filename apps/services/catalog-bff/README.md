# Catalog BFF

The portal architecture requires the original frontend to connect through this
BFF boundary for its application APIs. Catalog/feed composition and local
account, export, private suite, suite publication/review/catalog, application
drafts/images/publication/review/ownership, release authoring/review/publication,
article authoring/publication/review/covers/comments, application discussions/replies/reviews,
private/public profile, photo, follow,
badge, preferences, favorites, notification and local authentication workflows cover part of that requirement.
Authentication, account administration, staff health, private account/settings,
public profiles/follows/badges and favorites/inboxes
now cross BFF in both local and alpha configurations. The
[route/caller inventory](../../../docs/BFF-ROUTE-PARITY.md) records remaining
alpha bypasses and two legacy routes without a discovered portal caller.
See `rules/portal-bff-boundary.md`; full portal integration remains unfinished.

## Local authentication

`AUTHENTICATOR_URL` is a required HTTP(S) service origin for authentication calls.
BFF exposes `/api/auth/{signin,refresh,signout,methods,register}` plus explicit
anonymous/OAuth/reset/verification handlers. Local gateway `/auth/*` maps here;
`/api/password-recovery` delegates to Account. Unsupported configured-owner actions
remain errors; BFF never invents credential success or selects an identity provider.
Requests are bounded, credentials are allowlisted, sessions are noncacheable, and
refresh/sign-out are sent once. Invalid or expired bearer tokens do not block a
refresh exchange at ingress. Account/Authenticator retain canonical lifecycle and
credential authority. Both checked-in gateway configurations route authentication
through BFF; deployment of the alpha configuration remains separate.

See [local authentication](../../../docs/LOCAL-AUTHENTICATION.md) for provider ports,
explicit local configuration, operator setup, durable migration and qualification.

## Account lifecycle administration

`POST /api/admin/users/:uid/{disable,enable,revoke-tokens}` crosses BFF in both
gateway configurations. A22 also implements explicit credential edits, provider
unlinking, action links, deletion, identity and cleanup-status handlers described in
[the administration contract](../../../docs/LOCAL-AUTHENTICATION.md#staff-administration-through-bff).
The three lifecycle commands accept no body/query parameters, preserve the
case-sensitive credential subject, and return the owner's HTTP 201 boolean receipt
(`disabled`, `enabled` or `revoked`) with `private, no-store`. The bounded client
allows only verified actor/role/tenant context, refuses redirects and malformed or
false receipts, and never retries an uncertain write. Owner denials/conflicts are
preserved; unavailable dependencies return 503 without internal diagnostics.

Account rechecks canonical actor lifecycle and OPA before writes. The three actions
require global staff authority: canonical identities are global, so a tenant-scoped
claim is denied even for an administrator. No role names or tenant policy are added
to the BFF or credential adapter. Deploy the generated Identity OPA policy with the
Account/BFF versions; preserving a tenant claim alone is not authorization.

Disable/enable change canonical SQL lifecycle and its existing durable outbox.
They do not claim provider disablement or session deletion. Revocation independently
invalidates the selected provider's existing sessions; re-enablement alone does
not revoke old credentials. Revoke during suspension if old sessions must remain
invalid after re-enabling. New sign-in is allowed once the account is enabled.
Account logs actor, exact target, action and confirmed/denied/unconfirmed outcome
without credentials. Logs are operational evidence, not a durable command journal;
provider revocation has no new asynchronous receipt or cross-store transaction.

## Application discussions and replies

`PortalDiscussionsModule` supplies ten explicit handlers:

| Method | Route | Behavior |
| ------ | ----- | -------- |
| GET/POST | `/api/application-discussions/:applicationId` | Ten-topic cursor pages and new topics |
| GET/PUT/DELETE | `/api/application-discussions/:applicationId/:id` | Full thread, owner edit and authorized deletion |
| POST | `/api/application-discussions/:applicationId/:id/replies` | Reply to a topic or another reply |
| PUT | `/api/application-discussions/:applicationId/:id/vote` | Upvote, downvote or clear the current member's vote |
| PUT | `/api/application-discussions/:applicationId/:id/pin` | Moderator pin/unpin with a saved aggregate revision |
| GET | `/api/me/discussions` | Current member's authored/participated topics |
| GET | `/api/discussion-selection` | Up to fifty distinct public topic references |

The complete three gateway families, including case/slash variants and unknown
suffixes, require BFF in both local and alpha configurations. There is no wildcard
downstream proxy. Unbound `/api/discussions` also crosses explicit BFF handlers.
Article comments and member
reviews use the explicit routes described below. Existing feature adapters and all frontend source remain unchanged;
original presentation merge and visual acceptance are still outstanding.

The BFF validates ingress provenance, forwards only verified identity/tenant/role
context and uses the fixed `DISCUSSION_URL` origin. It preserves idempotency keys,
expected aggregate revisions, topic/reply content, mentions, tags, vote totals,
viewer choices, moderator capabilities and deleted-ancestor placeholders. The
owning service's consumer adapter selects root/reply schemas and enforces resource, parent, tenant,
identity lifecycle and policy access. BFF validation grants no authority.

`portal-bound-discussions.contract.ts` owns the `application:<UUID>` and
`article:<UUID>` key construction and maps generic content/structure back to portal
DTOs. The clients call Community's `/api/discussions` API for topics,
comments, replies, votes and pins, and its `participation`/`selection` endpoints
for member pages and public references. Community no longer registers the four
corresponding frontend route families. Binding-prefix discovery never grants
authority: each result is checked against its full stored key and current parent.

The owner now serves both contracts from one `/api/discussions` controller. Empty
queries preserve unbound behavior; explicit keys select scoped behavior. The old
`/api/discussion-bindings` path is removed. Portal generic handlers continue to
reject browser scope selectors; only dedicated BFF clients construct consumer
keys. Account's favorite client uses the same consolidated selection endpoint.

Responses are checked for IDs, revisions, tree ancestry/unique nodes, redaction,
vote consistency, page/selection bounds and command receipt correlation. Topic
pages contain only roots; full reads allow 2,000 nodes and depth 64. Participation
pages can legitimately be short or empty with a continuation when parents become
hidden. Selection is deliberately public and never resolves a private topic by
using the viewer's privileges.

JSON requests are bounded to 32 KiB, ordinary responses to 512 KiB, and full thread
transport to 64 MiB with two concurrent full-thread requests. Generic public
selection allows 2 MiB downstream because fifty roots carry their complete consumer
payloads; BFF still returns only validated portal summaries. The full-thread limit covers
JSON-escaped UTF-16 content within the portal contract; owning-service generation
byte limits still apply independently. Downstream requests have a 15-second
deadline, no redirects and no automatic retries. Errors are sanitized and all
responses are private/no-store. A failed response remains uncertain; only
Discussion can replay a durable command receipt. No projection preflight or BFF
database access is introduced.

Run the production-AppModule HTTP specs under `src/app/discussions/` and the local
qualifier `node tools/readiness/qualify-materialization.cjs --discussion-bff`.
Apply Community's additive `DiscussionBindingIndex1792150000000` migration after
the existing binding migration. Roll out Community, BFF, Account Management and
ingress configuration together; old dedicated internal routes are retired. See
the Community README for ordering and readiness instructions for qualification limits.

## Article comments and application reviews

Six article-comment handlers in `PortalDiscussionsModule` and ten member-review
handlers in `PortalReviewsModule` preserve the existing feature adapter contracts:

| Method | Route | Behavior |
| ------ | ----- | -------- |
| GET/POST | `/api/article-comments/:articleId` | Ten-root cursor pages and new comments |
| GET/PUT/DELETE | `/api/article-comments/:articleId/:id` | Full thread, author edit and authorized deletion |
| POST | `/api/article-comments/:articleId/:id/replies` | Nested reply |
| GET | `/api/application-reviews/:applicationId` | Public page plus the current member's review slot |
| GET | `/api/application-reviews/:applicationId/summary` | Current canonical rating totals/distribution |
| GET | `/api/application-reviews/:applicationId/moderation` | Staff page including hidden/withdrawn reviews |
| PUT | `/api/application-reviews/:applicationId/mine` | Publish/edit the member's review |
| GET/DELETE | `/api/application-reviews/:applicationId/:id` | Read or author withdrawal |
| PUT | `/api/application-reviews/:applicationId/:id/helpful` | Member helpful choice |
| GET/POST | `/api/application-reviews/:applicationId/:id/reports` | Staff report page or member report |
| PUT | `/api/application-reviews/:applicationId/:id/moderation` | Staff hide/restore with reason |

The complete case-insensitive families require BFF, including bare family paths,
trailing slashes and unknown suffixes. Unknown paths never become a downstream
proxy. Only verified ingress identity/tenant/roles reach the fixed `DISCUSSION_URL`;
browser tokens, cookies and private profile data are not forwarded. Responses are
private/no-store, validated and sanitized. Resource/parent/policy checks stay in
Discussion, including independent review moderation and author-only withdrawal.

Comments keep 4,000-character text, optional profile mentions, aggregate revisions,
pending receipts, ten-root pagination, 2,000-node/depth-64 threads and deleted-parent
placeholders. Their cursor grammar preserves valid leading zeros. Full threads share
the existing two-slot/64-MiB discussion bound; ordinary responses are 512 KiB.
Member reviews reuse pure review contracts for 1-5 ratings, 6,000-character text,
helpful membership, immutable report content and staff decisions. Their canonical
SQL reads do not wait for a Mongo generation or broker delivery. Hidden reviews can
remain in the owner's slot and staff pages while public totals exclude them.

Review clients now call generic owner `/api/reviews` routes with the exact consumer
key `wapps:application:<uuid>`. BFF constructs and encodes this key, rejects browser
scope selectors and maps validated `bindingKey` responses back to `applicationId`.
Discovery previews and Explore/timeline rating summaries use the same owner API.
Both local and alpha nginx configurations route the dedicated portal family through
BFF. Community's old `/api/application-reviews` route family is retired, without an
alias. Coordinate Community/BFF/ingress versions when activating the change.

Both transports use 32-KiB request limits and 15-second deadlines without redirects
or automatic retries. Review responses are bounded to 512 KiB. Comment keys retain
`[A-Za-z0-9._:-]{1,128}`; review keys retain `[A-Za-z0-9_-]{16,128}`. Expected
revisions and original keys pass through unchanged. A receipt must correlate with
the command, but may describe a historical state. There is no projection preflight,
database access, domain-policy replacement or materialization protocol change.

Run `src/app/reviews/portal-comments-reviews.spec.ts` through the production AppModule
and `tools/readiness/bff-comments-reviews-runtime-checks.cjs` through the local
gateway. Setup, failure/cleanup behavior and evidence limits are in the readiness
instructions. No new migration is needed. Frontend source is unchanged; original
presentation merge and visual acceptance remain outstanding.

## Articles and cover media

`PortalArticlesModule` provides 24 explicit portal handlers:

- Private articles: list, detail, create, update, delete, publication status,
  submit and withdraw under `/api/me/articles`.
- Independent staff review: queue, frozen detail and decision under
  `/api/editorial/article-reviews`.
- Public content: `/api/catalog/articles`, exact slug, article selection and
  canonical article visibility.
- Private covers: list by `articleId`, reservation, detail, cancellation, raw
  upload and normalized preview under `/api/me/article-covers`.
- Frozen owner/staff submission covers and canonical public covers under
  `/api/media/articles/:id/:imageId`.

Gateway routes the complete families, including case/slash variants and unknown
suffixes, to BFF. Unknown endpoints never become an open Editorial proxy. Existing
article feature ports/adapters keep their contracts and frontend source unchanged;
the original frontend merge and visual acceptance remain outstanding.

The BFF verifies ingress identity, forwards only allowed identity/tenant/role
context, validates strict pure article/media contracts, selectors, response IDs,
page sizes, category/tag matches and command receipts. It preserves keys, expected
draft/publication revisions, omitted legacy classification/cover fields and exact
frozen submission content. Title search and sort execution stay in Editorial.
Public reads and public covers also require verified optional identity provenance.
Errors remain explicit and sanitized; there is no demo fallback or automatic retry.

JSON requests are bounded to 96 KiB; ordinary/page responses to 2 MiB; the exact
private draft list to 8 MiB. The latter accommodates 100 valid articles of 24,000
multibyte UTF-16 units each. Cover sources and outputs are bounded to 8 MiB.
Uploads authorize with Editorial before buffering, verify reservation length/hash,
and forward the original bytes, quoted `If-Match` and key. Two upload slots and
four preview slots bound buffers; disconnects release/cancel work. JSON/previews
have 15-second deadlines and upload transport 30 seconds, without redirects.
Normalized WebP responses validate media type, size, length, encoding and RIFF
framing and receive no-store, nosniff, sandbox and fixed inline disposition headers.

Editorial remains the authority for ownership, staff independence, current access,
slug uniqueness, classification review, immutable submissions, cover references,
normalization/storage, SQL revisions, receipts and atomic outbox/materialization.
BFF has no database access and never gates historical replay on a fresh projection
or current publication/upload lifecycle. A lost command reply remains uncertain;
the caller can replay the original request and key.

Run the production-AppModule specs in `src/app/articles/` and the disposable local
qualifier `tools/readiness/bff-articles-runtime-checks.cjs`; setup, outage/cleanup
behavior and qualification limits are in `tools/readiness/README.md`.

## Releases

The unchanged release feature adapter now consumes 16 explicit BFF handlers:

| Method | Route | Behavior |
| ------ | ----- | -------- |
| GET/POST | `/api/me/releases` | Private workspace (at most 100 drafts) and claim-bound creation |
| GET | `/api/me/releases/source/:applicationId` | Canonical authoring source, optional `releaseId` |
| GET/PUT/DELETE | `/api/me/releases/:id` | Private read, revision-fenced update and deletion |
| POST | `/api/me/releases/open` | Open a canonical release under the current ownership grant |
| POST | `/api/me/releases/:id/rebase` | Explicit merge against the current publication revision |
| GET | `/api/me/releases/:id/publication` | Publication state and immutable submitted content |
| POST | `/api/me/releases/:id/submit` | Submit saved notes for independent review |
| POST | `/api/me/releases/:id/withdraw` | Cancel pending review and/or withdraw publication |
| GET | `/api/editorial/release-reviews` | Staff pending queue, pages 1-10,000 with at most 20 items |
| GET | `/api/editorial/release-reviews/:id` | Staff review detail |
| POST | `/api/editorial/release-reviews/:id/decision` | Approve/reject the selected submission |
| GET | `/api/catalog/releases/:slug` | Public pages with optional channel and exclusive `before` date |
| GET | `/api/catalog/releases/:slug/:version` | Exact public version, preserving `+`, `_`, `-` and `.` |

`PortalReleasesClient` validates pure catalog versioning contracts, requested
IDs, page/filter consistency and receipt identity/action/revisions. The transport
forwards only verified ingress context, original command keys and both expected
draft/publication revisions. Anonymous public reads still require trusted ingress.
All responses are private/no-store. Requests are bounded to 64 KiB, individual
and paginated responses to 2 MiB, and the exact private list response to 6 MiB:
100 valid multibyte drafts can exceed 2 MiB. The deadline is 15 seconds, with no
redirects or automatic retries. Unconfirmed operations return 503; caller replay
recovers historical receipts without granting current permissions.

Editorial retains identity/tenant and current-grant checks, independent staff
review, immutable submissions, version uniqueness and immutable public URLs,
SQL transactions, receipts, outbox and materialization. Private update/deletion
remain available after ownership revocation. Publication uses canonical authority
and exact projections; lag is unavailable, and withdrawal hides an older projection
immediately. Missing/null legacy application context remains distinguishable.

The complete local private-release, release-review and release-catalog families
route to BFF, including case/slash variants and unknown suffixes. No frontend,
owning-service, schema or projection changes are required. Tests are
`portal-releases.spec.ts` and `tools/readiness/bff-releases-runtime-checks.cjs`.
Article authoring/covers and remaining unmigrated routes are separate work.

## Application ownership

The existing ownership adapter consumes nine explicit BFF handlers:

| Method | Route | Behavior |
| ------ | ----- | -------- |
| GET | `/api/me/ownership-claims` | Claimant's private claims, page 1-10,000 |
| POST | `/api/me/ownership-claims` | Request ownership of a canonical application |
| GET | `/api/me/ownership-claims/:id` | Private proof challenge and current claim state |
| POST | `/api/me/ownership-claims/:id/verify` | Check the canonical website's DNS proof |
| POST | `/api/me/ownership-claims/:id/cancel` | Cancel a pending claim |
| POST | `/api/me/ownership-claims/:id/release` | Release an active grant |
| GET | `/api/editorial/ownership-reviews` | Independent staff queue, `view=pending` or `view=grants` |
| GET | `/api/editorial/ownership-reviews/:id` | Staff claim and evidence detail |
| POST | `/api/editorial/ownership-reviews/:id/decision` | Approve, reject or revoke with expected revision and reason |

`PortalApplicationOwnershipClient` uses pure catalog ownership contracts and the
existing bounded Editorial transport: 64 KiB JSON requests, 2 MiB responses,
15-second deadlines and no redirects or automatic retries. The BFF requires
verified signed-in ingress, strict selectors/commands and a single idempotency key.
It checks response IDs, claimant/queue consistency, page bounds and matching
receipt action/revision. Reads remain private/no-store; commands preserve 201
and safe error statuses. Unconfirmed/dependency failures return 503. A command
receipt describes its original result, not the current grant; no state preflight
or permission inference is made from it.

Editorial owns resource/tenant authorization, DNS challenge generation and checks,
proof freshness/rate limits, separate staff approval and required rejection or
revocation reasons. Claim creation cannot override the canonical website. Grant,
release and revocation commit canonical authority, application revision, decision,
receipt and outbox together. Canonical editing and publication recheck the current
grant even when projections lag; future content changes require separate review.
The BFF accesses no database or DNS resolver.

The local gateway sends both complete ownership route families to BFF, including
case/slash variants and unknown suffixes. Existing frontend adapters keep their
contracts; no presentation, owning-service behavior, migration or projection changes.
Tests: `portal-application-ownership.spec.ts` and
`tools/readiness/bff-ownership-runtime-checks.cjs`.

## Application publication and review

The existing application-publication adapter now consumes six explicit BFF routes:

| Method | Route | Behavior |
| ------ | ----- | -------- |
| GET | `/api/me/application-drafts/:id/publication` | Owner status and latest frozen submission |
| POST | `/api/me/application-drafts/:id/submit` | Submit the current saved draft |
| POST | `/api/me/application-drafts/:id/withdraw` | Cancel pending review and/or withdraw public content |
| GET | `/api/editorial/application-reviews` | Staff pending queue, page 1-10,000, at most 20 items |
| GET | `/api/editorial/application-reviews/:id` | Staff view of the frozen proposal |
| POST | `/api/editorial/application-reviews/:id/decision` | Independent approval/rejection of a submitted revision |

`PortalApplicationPublicationClient` shares the bounded Editorial transport with
drafts/images: 64 KiB JSON requests, 2 MiB responses, 15-second deadlines and no
redirects or automatic retries. The controller requires verified signed-in ingress,
valid IDs, strict selectors/commands and a single bounded idempotency key. Commands
preserve expected/submitted revisions and 201 receipts; reads preserve 200 and
private/no-store. Safe owner errors retain their status, and unconfirmed/dependency
failures return 503 with Retry-After. Receipt identity, action, revision and submitted
revision must match the request. A historical receipt is not a current-state claim.

Status retains complete submitted fields, classification, frozen image descriptors
and any canonical editing binding. Legacy missing/null image snapshots remain
distinguishable. A stale editing source revision is passed through for the owner
to explicitly rebase. BFF does not reinterpret transitions or approve from a read.
Editorial enforces canonical owner/tenant access, independent staff review, required
rejection reasons, source revision fencing and public slug uniqueness. Its SQL
transaction still commits decisions, public revisions, immutable receipts and
outbox together; public reads still recheck canonical visibility around projection
I/O. BFF gains no storage access or materialization responsibility.

The local gateway routes the complete application-draft and application-review
families, including case/slash variants and unknown suffixes, to BFF. The existing
image-preview routes retain their binary bounds. No frontend source/assets,
owning-service behavior, schema migration or projection protocol changes.
Article authoring and other unmigrated workflows
remain separate BFF work. Tests: `portal-application-publication.spec.ts` and
`tools/readiness/bff-application-publication-runtime-checks.cjs`.

## Application drafts and images

Existing application-workspace and ownership adapters use these explicit BFF
routes without frontend source or presentation changes:

- `GET/POST /api/me/application-drafts`, `GET/PUT/DELETE /:id`,
  `GET /canonical/:id`, `POST /from-application`, `POST /:id/rebase` and
  `PUT /:id/images`.
- `GET /api/me/application-images?draftId=:id`, `POST /api/me/application-images`,
  `GET/DELETE /:id` and `PUT/GET /:id/content`.
- Draft, canonical-source and frozen-submission image reads below
  `/api/me/application-drafts`; reviewer submission images below
  `/api/editorial/application-reviews/:id/submissions/:revision/images/:purpose/content`;
  public images at `/api/media/applications/:id/:purpose/:imageId`.

`PortalApplicationsModule` uses pure catalog record/media contracts and a bounded
`EDITORIAL_URL` HTTP client. It validates verified ingress identity, tenant/roles,
selectors, commands, result identities/revisions and complete image descriptors.
Only allowed identity context is forwarded; browser cookies, bearer tokens and
claimed identity headers never become service authority. Public image reads accept
verified anonymous ingress. Canonical editing still requires a current ownership
grant checked by Editorial; importing/rebasing a draft does not publish it.

JSON requests are limited to 64 KiB, responses to 2 MiB and downstream reads to
15 seconds. Uploads admit two concurrent requests per BFF process, including
authorization, buffering and forwarding. Editorial authorization runs before the
raw buffer is allocated. The BFF checks the reserved source size/hash, 8 MiB limit,
uncompressed octet-stream transport and quoted `If-Match`; it forwards original
bytes, revision and key with a 30-second deadline. Body buffering has a 15-second
deadline. Editorial owns actual image decoding, normalization and persistence.

Six preview variants admit four concurrent buffers per process through response
completion. They validate bounded, exact-length WebP containers, reject compressed
or malformed responses, use private/no-store, nosniff and sandbox headers, and abort
downstream work when the caller disconnects. No local files or object-store SDKs
are used. Errors preserve safe 400/401/403/404/409/413/415/422/429 semantics;
unconfirmed/dependency failures return 503. Commands are never automatically retried
or redirected. A historical upload receipt can replay after cancellation; the BFF
must not infer current lifecycle from that receipt or reject it using current state.

Editorial retains canonical authorization, SQL revisions/receipts, immutable
objects, fenced processing leases, reference checks, tombstones and outbox/
materialization. No owning-service change, migration or projection is introduced.
Gateway families, including case/slash variants and unknown suffixes, require BFF.
Private/public image responses disable gateway buffering and upstream retries.
Application publication, review and ownership commands use the BFF routes above.
Article/release authoring and article-cover routes remain migration work.

`portal-applications.spec.ts` checks production routes with a real HTTP upstream.
`tools/readiness/bff-application-workspace-runtime-checks.cjs` qualifies real local
draft/image persistence, ownership, binary previews, restarts, outages and replay.
Its publication and ownership fixture calls also pass through BFF.

## Suite publication, review and public reads

The existing suite-publication and catalog-listing adapters consume explicit BFF
routes backed by Editorial:

| Method | Route | Behavior |
| ------ | ----- | -------- |
| GET | `/api/me/suites/:id/publication` | Owner's current publication status and latest frozen submission |
| POST | `/api/me/suites/:id/submit` | Submit current draft with expectedRevision and Idempotency-Key |
| POST | `/api/me/suites/:id/withdraw` | Cancel pending submission and/or withdraw public publication |
| GET | `/api/editorial/suite-reviews` | Staff pending queue, bounded page selector |
| GET | `/api/editorial/suite-reviews/:id` | Staff review of the exact frozen proposal |
| POST | `/api/editorial/suite-reviews/:id/decision` | Approve/reject with expectedRevision, submittedRevision and original key |
| GET | `/api/catalog/suites` | Public q/page/pageSize/sort browse contract |
| GET | `/api/catalog/suites/:id` | Current public snapshot |
| GET | `/api/catalog/suite-selection` | Up to 50 requested IDs; only available public members returned |

Commands preserve 201 receipts; reads preserve 200. Public reads require verified
optional ingress identity; private/review operations require sign-in. Editorial
still decides resource/tenant access, staff permission and independent review.
Only verified identity context crosses the boundary, without bearer/cookie/email,
auth-time or worker credentials. BFF validates strict shared domain contracts,
response IDs, receipt action/revisions, requested page/page size and selection
membership. Public DTOs reject private owner/reviewer/reason fields. Selection
preserves Editorial's result order; requested IDs need not all be available.

Transport uses the same 64 KiB command, 1 MiB response and fifteen-second limits
as private suites, with no redirects or automatic retries. Safe errors retain
400/401/403/404/409/413/429; dependency or response uncertainty returns 503 with
Retry-After. All responses are private/no-store. Public success responses vary by
Authorization. Unknown suffixes stop at BFF; they are never forwarded generically.

Editorial retains SQL transactions, immutable submissions and receipts, public
revisions, canonical visibility checks, outbox and materialization. Draft edits
cannot change submitted content. Missing/stale public projections return 503;
withdrawal returns 404 immediately even while an old projection remains present.
Receipt replay does not reapply approval or resurrect a withdrawn suite. BFF has
no database access or new materialization protocol. No frontend source/assets,
owning-service implementation or migration changes are required.

See `portal-suite-publication.spec.ts` and
`tools/readiness/bff-suite-publication-runtime-checks.cjs`. This activates only the
local gateway; other ingress deployments and original-frontend visual acceptance
remain open.

## Private suite workspaces

The existing private-suite feature adapter uses explicit BFF routes:

| Method | Route                | Behavior                                                         |
| ------ | -------------------- | ---------------------------------------------------------------- |
| GET    | `/api/me/suites`     | Up to 100 canonical private suites for the current owner/tenant  |
| GET    | `/api/me/suites/:id` | Current canonical draft and ordered application IDs              |
| POST   | `/api/me/suites`     | Create with Idempotency-Key; preserve 201 and revision-1 receipt |
| PUT    | `/api/me/suites/:id` | Edit fields/membership with expectedRevision and Idempotency-Key |
| DELETE | `/api/me/suites/:id` | Delete with expectedRevision and Idempotency-Key                 |

Editorial owns private suites. `EDITORIAL_URL` and verified ingress context are
used for every operation; owner/tenant overrides are not accepted from query or
body. Only verified identity, tenant and roles cross the boundary, without bearer,
cookie, email, auth-time or worker credentials. Shared pure domain parsers validate
fields, UUIDs, revisions, classification proposals and the 50-member limit. BFF
also checks response identities, duplicate/oversized lists and receipt revision/
deletion semantics. Legacy unclassified drafts remain unclassified.

Transport bounds commands to 64 KiB, JSON responses to 1 MiB and downstream calls
to fifteen seconds, with no redirects or automatic retries. Safe errors preserve
400/401/403/404/409/413/429; uncertainty is 503 with Retry-After. Responses are
private/no-store. Retries preserve the original key/revision; historical receipts
do not assert that a suite still exists. Editorial retains canonical SQL, owner/
tenant authorization, transactional receipts, tombstones and the existing atomic
publication revocation/outbox on deletion. BFF adds no storage or materialization.

Application search and selection use the existing BFF `/api/catalog/apps` and
`/api/catalog/app-selection` contracts. Stored membership is ordered canonical
IDs; metadata is a separate current observation. Missing/ineligible records are
omitted by the catalog without altering membership. Metadata failure does not
replace private suite authority or prevent editing/removing existing references.

The local gateway routes the complete suite path families, including case/slash
variants, to BFF with bounded timeouts, 64 KiB bodies and upstream retries disabled.
The existing application search/selection gateway routes receive the same bounds.
Nested publication/submission/withdrawal and public suite catalog routes use the
publication handlers described above. No frontend source/assets, migration or owning
service changes are required. See `portal-suites.spec.ts` and
`bff-suites-runtime-checks.cjs`; the original frontend merge and deployed activation
are still pending.

## Account exports

The existing frontend export adapter uses these explicit BFF routes:

| Method | Route                          | Behavior                                                      |
| ------ | ------------------------------ | ------------------------------------------------------------- |
| POST   | `/api/me/exports`              | Empty JSON body and Idempotency-Key; preserves 202 acceptance |
| GET    | `/api/me/exports`              | Latest canonical job, or `{job: null}`                        |
| GET    | `/api/me/exports/:id`          | Current job lifecycle and ready archive metadata              |
| DELETE | `/api/me/exports/:id`          | Cancel capture or revoke the archive; repeatable by job ID    |
| GET    | `/api/me/exports/:id/download` | Complete authenticated gzip attachment                        |

Account retains policy/ownership, durable jobs, capture leases, immutable archive
chunks, request limits, retention and erasure. BFF uses `ACCOUNT_MANAGEMENT_URL`
and verified ingress identity only; no bearer, cookie, email, auth-time or internal
export-source credential is forwarded. IDs, empty bodies/queries, request keys and
job responses are strictly validated. Inspect/cancel responses must match the job;
cancellation must report cancelled or expired. A repeated request key returns the
same job at its current lifecycle state, not necessarily its initial queued state.

JSON requests/responses are bounded to 64 KiB and fifteen seconds. Download metadata
and bytes are fetched from Account under the same identity, re-entering ownership
checks. Four concurrent downloads per BFF process include metadata lookup. Streaming
respects backpressure, the canonical 1 GiB archive ceiling and fifteen-minute total
deadline; the downstream HTTP timeout is thirty seconds. The BFF forwards raw gzip,
checks exact media type/declared length and the final SHA-256, and withholds the final
chunk until EOF validation. Before output, failures return a safe error; after
partial output, they terminate the incomplete transfer. Disconnects abort upstream
HTTP work. No complete archive is buffered or written to disk by BFF.

Attachment names are generated from validated IDs. Responses are private/no-store;
downloads and errors include nosniff/sandbox headers. Range and HEAD downloads are
rejected. No redirects, automatic retries, conditional/range forwarding or signed
storage URL bypasses are introduced. Nginx covers case/slash variants, disables
archive buffering/cache/temporary-file spill and compression, and bounds inactivity.
The existing frontend adapter still buffers and verifies downloads; large-device/memory
qualification remains open.

See `portal-exports.spec.ts`, `portal-exports.download.spec.ts` and the live
`bff-export-runtime-checks.cjs` qualifier. No frontend source/assets, owning-service
behavior, migration or projection change. Alpha/Kubernetes activation and the
original presentation merge remain separate work.

## Public profiles, follows and badges

Both local and alpha gateway configurations route these fixed contracts through BFF; existing frontend
feature adapters consume the same responses without source or presentation changes.

| Method    | Route                                                                | Behavior                                                                    |
| --------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| GET       | `/api/profiles`                                                      | Audience-filtered public directory with UUID continuation                   |
| GET       | `/api/profiles/:id`                                                  | Current public profile or explicit followers-only state                     |
| GET       | `/api/profiles/:id/avatar/:avatarId`                                 | Current, audience-protected WebP photo                                      |
| GET       | `/api/profiles/:id/{favorites,suites,articles,discussions,activity}` | Shared content with typed continuation or explicit hidden state             |
| GET       | `/api/profiles/:id/{totals,badges}`                                  | Shared totals/badges; hidden totals remain null                             |
| GET / PUT | `/api/me/profile-follows`                                            | Incoming requests/access; revision-bound request, cancel, approve or remove |
| GET       | `/api/me/profile-follows/outgoing`                                   | Current member's outgoing requests/access                                   |
| GET       | `/api/me/{totals,badges}`                                            | Private totals/current badges                                               |
| GET       | `/api/admin/profile-badges`                                          | Staff badge capabilities                                                    |
| GET / PUT | `/api/admin/profile-badges/:id`                                      | Staff audit history; award/revoke with reason and expected revision         |

`ACCOUNT_MANAGEMENT_URL` and `INGRESS_AUTH_SECRET` are required. Public reads accept
anonymous viewers only with verified ingress provenance and no conflicting
identity headers. Signed-in routes retain strict identity validation. Forwarding
excludes bearer tokens, cookies, credential email and unrelated service credentials.
Account retains lifecycle, audience, ownership and staff-policy decisions, canonical
storage, receipts and materialization; the BFF never substitutes a projection for
authorization. Directory results cannot contain contact email. Response parsers
validate IDs, cursors, ordering, hidden states and command receipts.

Transport permits 64 KiB commands, 1 MiB JSON responses and 256 KiB WebP responses,
with a thirty-second deadline for Account's existing bounded content composition.
No redirects or automatic mutation retries occur. Commands preserve their keys and
expected revisions; uncertain outcomes return 503, and 429/503 include Retry-After.
Responses are private/no-store; public responses vary by Authorization and photos
include nosniff/sandbox headers. Nginx covers case variants and trailing slashes,
with a two-second connection timeout and thirty-five-second read/write timeouts.

`portal-profiles.spec.ts` covers the bounded BFF contract. The earlier
`bff-public-profiles-runtime-checks.cjs` records local-stack qualification; use
the disposable A25 extension below for current source/gateway parity.
No migration or projection representation change is introduced.
Alpha/Kubernetes activation and the original frontend merge remain outstanding.

The A25 gateway configuration sends this entire family through BFF in both local
and alpha, with case/slash variants and unknown suffixes covered by the same
64 KiB ingress limit, bounded timeouts and no upstream retries. Profile GET/HEAD
requests reject nonempty or chunked bodies before owner I/O. Account preserves
tenant context for badge policy; global badge administration requires an unscoped
`admin` or `identity:badge-manager`, and rejects tenant-scoped staff.

`WAPPS_LOCAL_AUTH_INTEGRATION=1 WAPPS_PUBLIC_PROFILES_INTEGRATION=1 node --test
tools/readiness/local-auth.test.cjs` adds the disposable profile parity extension.
It uses real credential/Account/BFF processes, OPA, SQL, Editorial, Community,
Mongo, MinIO and a test-owned Discussion materializer. See the readiness README
for source setup, projection substitutions, coverage and explicit limits. This
does not deploy the changed Account policy, BFF or gateway configuration.

## Favorites and notifications

Both local and alpha gateways route the entire `/api/me/favorites` and
`/api/me/notifications` families through explicit BFF handlers, including
case variants and trailing slashes. Unknown suffixes return 404. Reads reject
nonempty or chunked bodies before owner I/O. Both families have a 64 KiB ingress
limit, bounded timeouts and no gateway retry.

| Method    | Route                             | Behavior                                                                 |
| --------- | --------------------------------- | ------------------------------------------------------------------------ |
| GET / PUT | `/api/me/favorites`               | Canonical saved references / revision-bound save or removal              |
| GET       | `/api/me/favorites/content`       | Composed metadata for the current member's saved references              |
| GET       | `/api/me/notifications`           | Paginated discussion reply inbox                                         |
| GET       | `/api/me/notifications/mentions`  | Paginated mention inbox                                                  |
| GET       | `/api/me/notifications/favorites` | Paginated favorite-update inbox                                          |
| PUT       | Each inbox route plus `/read`     | Mark `{id}` read, preserving Account's original read timestamp on replay |

Account requests use `ACCOUNT_MANAGEMENT_URL` and verified ingress identity/claims.
No bearer, cookie, email or worker credentials are forwarded. Account retains
lifecycle/policy checks, canonical favorites, revisions, idempotency receipts,
transactional outbox work and recipient-scoped notification delivery/read state.
Favorite commands preserve `Idempotency-Key` and `expectedRevision`; mark-read
keeps the existing natural idempotency by recipient and notification ID. Strict
parsers reject extra fields, malformed results and mismatched receipt identities.
Transport is bounded to 64 KiB and fifteen seconds, with no redirects or automatic
mutation retries. Private responses are no-store; access/conflict statuses remain
explicit and uncertainty returns 503 with `Retry-After: 2`.

Metadata composition moves out of the browser adapter into BFF. It reads only
the member's canonical saved references, then queries public Editorial/Discussion
selection contracts without account credentials. All four kinds are supported;
discussion links and classification come from the current parent application.
At most 200 references are resolved in batches of 50, with 1 MiB/five-second
selection bounds and a twelve-second overall deadline. A final Account read
rejects a changed revision/reference set with 409. Unavailable targets retain a
removable reference; dependency failure fails the read. Removal never requires
successful metadata loading. These reads are current observations, not a global
cross-service snapshot. BFF applies the viewer's current saved content choice;
Mature and unclassified metadata require explicit opt-in. Hidden targets retain
only their removable reference and generic unavailable metadata. The five shared
profile content sections use the same server filter, with General-only anonymous
defaults. Preferences are read before and after composition; concurrent changes
return conflict. Filtered pages may be empty with a continuation past scanned items.

Account's Wapps source adapters enforce classification on both notification
delivery and current inbox reads. Reply/mention selection checks recipient
preferences around source resolution; watch decisions check canonical choices
under the account transaction. Inactive recipients settle as suppressed.
Delivered/suppressed receipts commit before source acknowledgement, and enabling
content later cannot revive suppressed events. Classification fields are optional
on source responses; absence remains unclassified. Persisted receipts/events and
schema are unchanged. OPA packaging must include
`identity-admin/profile-audience.rego`, since mention resolution uses that policy;
the local and alpha image mergers now include every non-test Rego module.
`portal-member.spec.ts`, the favorite domain/feature suites and
`tools/readiness/bff-member-runtime-checks.cjs` cover the original contract.
The A26 `WAPPS_MEMBER_PARITY_INTEGRATION=1` local-auth extension additionally
qualifies real credentials, OPA, source services and actual delivery workers through
both gateway configurations. See the readiness README for invocation and explicit
native-gateway/source-setup limitations. Coordinated source/Account/BFF/gateway
activation, full privacy cleanup and the original frontend merge remain outstanding.
A26 changes one frontend parser test for filtered pagination; presentation and
runtime frontend source remain unchanged.

## Account and private profile

The local gateway now routes these explicit contracts through BFF:

| Method       | Route                        | Behavior                                                                         |
| ------------ | ---------------------------- | -------------------------------------------------------------------------------- |
| GET          | `/api/me`                    | Current account and shell identity; verified credential email is preserved       |
| DELETE       | `/api/me`                    | Existing account erasure request; preserves the 202 acceptance and cleanup state |
| GET / PUT    | `/api/me/profile`            | Private profile snapshot / revision-bound text update                            |
| PUT / DELETE | `/api/me/profile/avatar`     | Upload/replace / remove the current photo                                        |
| GET          | `/api/me/profile/avatar/:id` | Authenticated private WebP bytes                                                 |

The module uses the same `ACCOUNT_MANAGEMENT_URL` and `INGRESS_AUTH_SECRET` as
preferences. It reconstructs trusted context and forwards credential email only
for the account summary. Cookies, bearer tokens, auth-time and service-worker
credentials are excluded. Account Management still checks lifecycle, policy and
ownership; it alone owns SQL, normalization, receipts and transactional outbox work.
Strict parsers reject extra fields, mismatched identities and invalid revisions.
Erasure acceptance is not evidence that background cleanup has completed.

Profile updates retain `Idempotency-Key` and `expectedRevision`, including contact
email omission semantics. Photo commands retain the key and quoted `If-Match`.
Uploads accept uncompressed PNG/JPEG/WebP bytes, bound buffering to 2 MiB and two
concurrent uploads, impose a fifteen-second body deadline, and verify declared
length/SHA-256. Account retains image decoding/resizing and current-photo ownership.
Private downloads are bounded to 256 KiB, validate WebP framing, and include
private/no-store, nosniff and sandbox headers. JSON responses are bounded to 64 KiB;
downstream requests time out at fifteen seconds, follow no redirects and never
automatically retry mutations. Access/conflict/media status codes remain explicit.

Local and alpha Nginx route canonical, trailing-slash and case-variant paths with separate
64 KiB JSON / 2 MiB photo body limits, bounded timeouts and no upstream retries.
The owning service contracts and frontend adapters remain unchanged. Public profile
audiences/photos, follows, totals and badges are covered above.
Alpha/Kubernetes activation and the original frontend merge
are still pending; this adds no migration, projection or frontend build.

`portal-account.spec.ts` exercises the production BFF module against an HTTP
fixture. `tools/readiness/bff-profile-runtime-checks.cjs` separately qualifies the
real local stack with a disposable account, including erasure acceptance. See the
readiness README and implementation checkpoint for scope, evidence and cleanup.
A24 adds `bff-account-settings-runtime-checks.cjs` to the disposable local-auth
qualifier: real credential/Identity processes, OPA/SQL, both gateways, independent
sessions, rollback/replay, photo persistence/removal and BFF outage without owner
fallback. Unknown account suffixes also reach BFF. GET bodies and query selectors
are rejected before owner I/O; self-deletion returns acceptance with pending cleanup.

## Account preferences

`GET/PUT /api/me/preferences` now follows frontend feature adapter -> gateway ->
BFF -> Account Management -> BFF -> frontend. The frontend endpoint and its strict
preferences contract are unchanged. The BFF validates the command, trusted identity
provenance and response shape, including account identity and save revision.
It forwards only verified user ID, roles/tenant context and the shared ingress
credential; bearer tokens, cookies and unrelated worker credentials are excluded.
Account Management still rechecks canonical lifecycle and self-access policy and
owns the transactional preferences/revision/receipt/outbox write.

Configure `ACCOUNT_MANAGEMENT_URL` as an HTTP(S) origin without a path, credentials,
query or fragment, and `INGRESS_AUTH_SECRET` to match trusted ingress and Account.
The fixed downstream route is `/api/me/preferences`. Transport permits 64 KiB,
times out after 15 seconds and follows no redirects. PUT preserves the original
`Idempotency-Key` and `expectedRevision`; the BFF never automatically retries it.
Reads and receipts are no-store. Input/access/conflict/rate-limit status codes are
preserved with public error messages; unavailable, malformed and cross-account
responses become 503. A failed save can have committed: retry the identical command
with its original key, or reload to inspect saved state. 429/503 advertise a
two-second retry delay. Missing configuration fails closed.

Local Compose now configures Account's origin. Both gateway configurations route canonical,
trailing-slash and case-variant preferences paths through BFF, with a 64 KiB body
limit, two-second connection timeout, twenty-second read/write timeouts and no
upstream retry. Unknown preferences suffixes also cross BFF, and GET bodies are
rejected. Remaining alpha account bypasses are explicit in the route inventory.
Alpha/Kubernetes configuration activation remains pending; deploy this module
and its required configuration with the gateway change.
There is no new migration, projection, worker or frontend presentation change.

The BFF HTTP suite exercises the production AppModule against an Account contract
fixture. The separate `tools/readiness/bff-preferences-runtime-checks.cjs` qualifier
checks the real local gateway, identity provider emulator, Account/OPA/MySQL,
command replay/conflicts, independent accounts, service outages and restart
persistence. See `tools/readiness/README.md` for invocation and test-data cleanup.
A24's disposable local-auth qualifier additionally covers both gateway variants
with the independent local Authentication process, shared profile/preferences
revisions, SQL rollback and concurrent/historical replay. It does not activate
the live installation or establish that every saved preference has a consumer.

The BFF serves the pure `CatalogReadPort` contract exported by
`@domains/catalog/record`. Its application service depends on that port; Nest
composition supplies the Editorial HTTP adapter. Editorial owns public-tenant
selection, SQL filtering and revision-checked materialized application content.
See `docs/MATERIALIZATION.md` for the consistency and recovery protocol.

## HTTP contract

| GET route                         | Result                                                                |
| --------------------------------- | --------------------------------------------------------------------- |
| `/api/catalog/apps`               | `CatalogPage`: items, total, page, pageSize, totalPages, facets       |
| `/api/catalog/apps/:slug`         | `CatalogApp` at the current public revision                           |
| `/api/catalog/apps/:slug/preview` | Alias of the canonical application response                           |
| `/api/catalog/facets`             | Current public categories, tags, platforms, devices and monetizations |
| `/api/catalog/categories`         | Flat canonical categories with nullable parent UUIDs                  |
| `/api/catalog/categories/tree`    | Categories with nested `childs` arrays                                |
| `/api/catalog/tags`               | Canonical tag facets                                                  |
| `/api/catalog/tags/:slug`         | One current tag                                                       |

Application and relation IDs are UUID strings. Relations contain their actual
names/slugs. Dates are UTC ISO strings. `reviews` is null until a real review
aggregate exists; neither ratings nor counts are fabricated. The old numeric-ID
and `data/meta` responses are replaced. Portal adapters must consume the new
contract; this backend checkpoint does not establish portal readiness.

All catalog responses use `Cache-Control: no-store`. Bad queries return 400;
currently absent/private/suspended/deleted applications return 404. Missing,
corrupt or stale projections, dependency failure and malformed upstream responses
return 503 with `Retry-After: 2`, without fixture or empty-catalog fallback.

### Browse parameters

- `search`: at most 160 characters and eight words. Every word must occur in the
  application's name, description or slug, case-insensitively. `%`, `_` and `!`
  are literal search characters.
- `category`, `platform`, `device`, `monetization`: repeated or comma-separated
  slugs, at most 20 per dimension. OR within a dimension, AND between dimensions.
  Categories include descendants.
- `tag` / `tags`: at most 20 distinct slugs; every selected tag is required.
- `sort`: `name` (default), `name-desc`, or `newest`, with UUID tie-breaking.
- `page`: integer 1-10000, default 1, clamped to the last available page.
- `pageSize`: integer 1-100, default 20. An empty catalog has page 1 of 1.

Unknown fields, object-valued selectors, invalid slugs and malformed numbers are
rejected. Taxonomy is bounded at 2000 items per dimension and 64 ancestor levels.
The BFF validates upstream structure and pagination before returning success.
It makes bounded requests with a 15-second timeout, a 16 MiB response limit and
no redirects. It maintains no eligibility or category cache.

## Configuration and checks

### Explore activity

`GET /api/explore` returns `{items, after}`: up to ten current public applications,
suites, articles, releases, application topics and member reviews, ordered by
activity time and kind/UUID. Only optional `after` is accepted; it is an opaque
24-hour encrypted cursor. Invalid/expired cursors return 400. Required source
outages, missing configuration and projection lag return 503 with `Retry-After: 2`.
All responses are no-store. A hidden scan page may be empty with a continuation.
Successive pages are current observations, not a fixed database snapshot.

Configure `EDITORIAL_URL`, `DISCUSSION_URL` and the same dedicated
`EXPLORE_SERVICE_SECRET` in BFF, Editorial and Discussion. The secret is 32-128
URL-safe characters and must differ from ingress, notification, export and erasure
credentials. Update both source-generated OPA bundles. Sources accept only the
exact Explore service identity/role/scope through `x-explore-reader`. Rotation
invalidates cursors. Kubernetes reads the optional `explore-service-secret` Secret,
key `secret`, in each service namespace; an absent secret leaves Explore explicitly
unavailable. Compose uses `LOCAL_EXPLORE_SERVICE_SECRET`.

Explore reuses canonical source selection and existing revision-checked readers;
there is no feed database, projection, queue, migration or writer change. Internal
scan boundaries can contain hidden IDs, so BFF encrypts rather than exposes them.
Transport is bounded at fifteen seconds and 512 KiB per source. See
`docs/MATERIALIZATION.md` for visibility/recovery and
`tools/readiness/README.md` for the real-service/browser qualifier. The existing
static health route does not prove these dependencies ready.

### Catalog setup

`EDITORIAL_URL` is required and must be an HTTP(S) origin without credentials,
path, query or fragment. `PORT` defaults to 3000. `EDITORIAL_API_TOKEN` is obsolete:
this catalog contract is public and uses Editorial's configured public tenant.

Use Node from `.nvmrc`, `npm ci`, and the workspace quality commands. Focused checks:

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true npx nx run-many -t build,test,lint -p catalog-record,apps.services.editorial,apps.services.catalog-bff --skip-nx-cache
node tools/readiness/qualify-materialization.cjs
```

The qualification runner requires the four locally available container images
listed in that script. It creates disposable stores and starts the compiled
Editorial/BFF HTTP services; build them first. It records exact image digests,
checks catalog filters and failure states, restarts the services, drops/rebuilds
projections, and cleans up its own containers. It does not deploy Wapps or prove
browser, ingress, load, database-restart, backup-restoration or production readiness.
