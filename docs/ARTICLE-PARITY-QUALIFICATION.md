# Article publication, covers and comment authority

This BC13/BC15/BC27 slice starts from I28 commit
`2c4a78797bb7bf4df2d3365c3490cd0a91a4fa7a` on `codex/full-operation`.
It qualifies the article contract with independent credential sessions, Editorial
publication and cover storage, and Community's generic Discussion API. BC15 here
covers article images only. Application-image alpha routing remains separate.
The live installation remains A21.

## Accepted frontend requirements

The presentation source of truth remains
`c965790e063139bcd5e6bacc759f289703e4ea9a`. Its `articles.component.html`
composes `results-page` with article kind. Its article DTO and detail template
require titles, excerpts, categories/tags, public authors, publication/update
dates, cover URL/alternative text and structured sections/paragraphs. The detail
page has a real unavailable-body state and a favorite control. Original fixture
copy and counts are not authoritative content.

| Required behavior | Current BFF integration seam |
| --- | --- |
| Article browse, filters, sorting, page size and details | `ArticleApiService` -> `/api/catalog/articles` and `/:slug` |
| Current selected references and parent eligibility | `/api/catalog/article-selection` and `/article-visibility/:id` |
| Durable author drafts, revision conflicts and publication state | `/api/me/articles`, `/:id`, `/:id/publication`, `/:id/{submit,withdraw}` |
| Independent review of frozen text/classification/media | `/api/editorial/article-reviews`, `/:id`, `/:id/decision` |
| Private cover reservations, uploads and previews | `ArticleCoverApiService` -> `/api/me/article-covers` and `/:id/content` |
| Frozen submission previews and current public cover | Owner/reviewer `.../:id/submissions/:revision/cover`; `/api/media/articles/:id/:imageId` |
| Article comments and replies, author edits and redaction | `/api/article-comments/:articleId` -> exact consumer key on owner `/api/discussions` |

The authoring/review workflows are current backend contracts, not evidence that
the later presentation was accepted. No templates, styles, components, browser
routes or frontend providers change in this slice. Favorites, account preference
filtering and public-profile composition retain their separately qualified owners.
Classification is a frozen publication field; it is not an invented article
comment permission. Canonical publication/withdrawal controls comment eligibility.

## Disposable qualification

Use Node 22.17.1 and the checked-in lockfile in a fresh source snapshot. Build
before starting any process that consumes `dist`. Keep `WAPPS_NGINX_BINARY` unset
for acceptance; both Nginx configurations run in Docker.

```sh
export NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true
npm ci --no-audit --no-fund
npx nx run-many -t build --all --skip-nx-cache --parallel=3
WAPPS_LOCAL_AUTH_INTEGRATION=1 WAPPS_ARTICLE_PARITY_INTEGRATION=1 \
  WAPPS_ARTICLE_LOCAL_ONLY=1 node --test tools/readiness/local-auth.test.cjs
WAPPS_LOCAL_AUTH_INTEGRATION=1 WAPPS_ARTICLE_PARITY_INTEGRATION=1 \
  node --test tools/readiness/local-auth.test.cjs
```

The local-only mode repeats local article checks while leaving the inherited
two-environment Authentication/Account and complete-gateway transport tests intact.
Run it before migrating alpha article routes. The full mode uses each checked-in
API/auth/media include independently. Domain fallback addresses are deliberately
unavailable loopback targets; the local media include never substitutes for alpha.

`article-parity-services.cjs` reuses the existing disposable Editorial store
helper and adds an independent Community API, Discussion SQL schema, Mongo
generation collections and real Discussion materializer. The helper also starts
an unused controlled ownership-DNS listener; article workflows make no ownership
or public DNS claims. Fresh MySQL, MongoDB, RabbitMQ, MinIO and two domain OPA
containers belong only to the test. The standard independent Authentication and
Identity/Account processes retain their distinct database grants.

Reviewer and foreign-tenant claims are assigned to this run's disposable
credentials through the operator fixture, followed by real sign-in and canonical
Identity resolution. Normal workflow requests use bearer tokens through Nginx;
they do not inject trusted owner headers. SQL triggers inject receipt/outbox
failures; SQL and Mongo observers verify rollback and retained state. Object
bytes and projections are produced by real services/workers. No primary-journey
projection is manually published.

The seventh extension remains mutually exclusive with the six original profile,
member, export, erasure, suite and application extensions. Every invocation keeps
O01's two phases of 200 authenticated reads through four gateway origins: 1,600
requests, invalid tokens, and Account/BFF restart without request retries or pacing.

## Assertions

- Draft commands cover independent sessions, owner/tenant/forged-context denial,
  strict keys, concurrent revisions, multilingual bodies above 64 KiB, receipt
  rollback, historical replay and retained deletion.
- Cover commands cover declared byte/hash/type/size limits, quoted revisions,
  unsupported compression/content type, actual PNG normalization, private preview
  denial, a cancelled partial stream, explicit cancellation/replay and referenced
  cover retention. Storage failure returns 503; normalized bytes survive restart.
- Submission freezes sections, title, classification and cover despite later
  draft edits. Review denies the author, excludes their own submissions, supports
  rejection/resubmission, and protects owner/reviewer submission previews.
- Approval and outbox commit atomically. While the worker is stopped, current
  canonical covers and visibility remain usable; missing/stale article text is
  503. Actual broker delivery recovers the exact published revision. Browse,
  filtering, selection and immutable unique published slugs retain their contract.
- Community receives consumer keys through generic Discussion HTTP. Concurrent
  replay, keyless/forged scope and tenant denial, replies, edits, redacted replies,
  receipt/outbox rollback and actual immutable-payload materialization are checked.
- Current replacement removes the former cover while the article projection is
  still old. Withdrawal denies text, covers, visibility, selection, comment reads
  and new replies even while old article/comment generations remain. Historical
  command replay cannot restore access. Republication restores the same comment
  association; final delivery converges to a retained article tombstone.
- Storage, Mongo, policy, Editorial and Community outages fail truthfully. API,
  Account and BFF restarts preserve state. The BFF-stopped matrix includes 90
  requests across both selected gateways: family roots, case, trailing slash,
  unknown suffixes, frozen previews, uploads and public media.

## Supplemental checks and limits

Run the existing real-store suites separately, using a verified OPA 1.4.2 binary:

```sh
OPA_BINARY=/absolute/path/to/opa-1.4.2 WAPPS_SUITES_OUTPUT=/fresh/articles \
  node tools/readiness/qualify-suites.cjs --articles --delivery --no-browser
OPA_BINARY=/absolute/path/to/opa-1.4.2 WAPPS_SUITES_OUTPUT=/fresh/covers \
  node tools/readiness/qualify-suites.cjs --article-covers --delivery --no-browser
OPA_BINARY=/absolute/path/to/opa-1.4.2 WAPPS_SUITES_OUTPUT=/fresh/comments \
  node tools/readiness/qualify-suites.cjs --article-comments --delivery --no-browser
node tools/readiness/qualify-materialization.cjs
```

These supplements exercise lower-level capacity, lease/retry, immutable-object,
recovery, migration, deletion, retention and opaque-key behavior. They deliberately
use controlled trusted identities and some direct projection setup; they are not
the independent-session gateway proof. Browser flows are not rerun or claimed as
accepted presentation. The existing fixed export/erasure provider plans and privacy
retention rules remain unchanged.

Generic Discussion recovery runs in its own fresh object store. Do not append
`--discussion-regression` to the article-comment run: the retained failed attempt
confirms that the fresh-store guard refuses the already populated article store.
The standalone materialization runner also covers Editorial recovery and Catalog;
its policy/projection fixture limits remain explicit in the individual tests.

Full workspace test/lint/typecheck/build, boundaries and Angular artifact gates
remain required. Exact commands, failed attempts, source manifests, cleanup and
results are retained in `/tmp/wapps-article-parity-20261018-ow5ug443/`.
The local-first and two-gateway runs pass 29 groups each. The final two-gateway
run also pauses actual MinIO during an upload, verifies pending state, and replays
the identical key successfully after storage resumes. Supplemental publication,
covers and comments pass 9, 17 and 9 groups; the standalone materialization run
passes all four non-skipped Discussion/Editorial/Catalog tests, including unknown
opaque consumer keys. Full gates pass 6,879 Jest tests / 428 suites, 34 portable
tests, 143 lint targets, 140 builds, 49 typechecks and 64 Angular inspections.
Existing lint warnings remain visible; source boundaries report zero violations.

The six original extensions also pass separately on the final runtime source,
with `WAPPS_LOCAL_AUTH_INTEGRATION=1`, the corresponding extension flag, and
`node --test tools/readiness/local-auth.test.cjs`:

| Extension flag | Passing groups | Retained passing log |
| --- | --- | --- |
| `WAPPS_PUBLIC_PROFILES_INTEGRATION=1` | 25 | `regression-public_profiles.log` |
| `WAPPS_MEMBER_PARITY_INTEGRATION=1` | 25 | `regression-member_parity-2.log` |
| `WAPPS_EXPORT_PARITY_INTEGRATION=1` | 27 | `regression-export_parity.log` |
| `WAPPS_ERASURE_PARITY_INTEGRATION=1` | 31 | `regression-erasure_parity.log` |
| `WAPPS_SUITE_PARITY_INTEGRATION=1` | 29 | `regression-suite_parity.log` |
| `WAPPS_APPLICATION_PARITY_INTEGRATION=1` | 31 | `regression-application_parity.log` |

These counts include overlapping baseline groups. Each passing run preserves
the 1,600-request transport check; the six runs account for 9,600 authenticated
reads, not 9,600 distinct behavior assertions.

Retained failures include three primary harness expectation/observer corrections,
the supplemental publication check's obsolete migration-error wording, and the
refused nested recovery run against a populated object store. The article migration
assertion now requires the exact independent-review attribution error; production
migrations and the fresh-store guard are unchanged.

The first member regression fails before its member-specific checks: while BFF
is deliberately stopped, `/api/me/profile/` returns 504 after the bounded
two-second upstream connection timeout, whereas the inherited Account matrix
requires exactly 502. The unchanged rerun passes all 25 groups. Both attempts
remain in `extensions-results.json` and `extensions-retry-results.json`; the
shared assertion and transport configuration are unchanged. This is not an
active-service transport failure, but the stopped-service assertion remains
sensitive to the Docker connection outcome.

`verification.json` in the evidence directory indexes commands, hashed logs,
source manifests, retained failures and cleanup. `source-hashes-final.json`
covers all 4,322 final source files; `task-files.json` identifies exactly 15
changed files. `task-only.patch` reproduces those hashes when applied to a fresh
archive of the baseline. HEAD, branch, index and lockfile are preserved, and
the isolated qualification source matches the checkout. `cleanup.json` records
the task container/image and qualification-process checks. The interrupted initial
installation and corrected local attempts remain in `attempts.json`.

This does not qualify live deployment, production credentials, migration activation,
erasure fences, archived-data policy, public DNS/TLS, whole-product load/soak or
the eventual merge and visual acceptance of the original frontend.
