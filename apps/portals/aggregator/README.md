# Aggregator portal

Angular portal for discovering applications, reading articles, collecting suites, and following app discussions and updates.

## Run locally

From the repository root, with dependencies installed:

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx serve aggregator-csr --host=127.0.0.1 --port=4300
```

Open http://localhost:4300. The development environment uses the bundled catalog. `Continue as Guest` opens the local demo account. A deployed environment selects the catalog BFF through `application/src/environment.ts`; its `/api/catalog` requests require a configured API reverse proxy.

## Main flows

- **Explore**: mixed feed and global search; saved feed preferences control ordering.
- **Discover**: application catalog with URL-backed search, filters, sorting, view selection, and pagination.
- **Digest**: articles with readable detail pages.
- **Suites**: curated collections and personal collections created under `/suites/create`.
- **Application pages**: overview, timeline, reviews, development log, status, and discussions; unknown slugs get explicit not-found states.
- **Favorites**: applications and suites use canonical account storage in API mode; demo mode keeps browser-local favorites.
- **My Apps**: canonical private application drafts in API mode; browser-local drafts in demo mode. Ownership notes remain local preparation.
- **Account**: profile editing, avatar selection, display/content preferences, notification preferences, privacy preferences, and local data export.

## Digest

API-mode `/digest` uses Catalog BFF `GET /api/digest` for independent recent activity,
article, application and discussion selections. It displays at most 3/2/2/1 cards,
with real article summaries/covers and current detail links. Saved category exclusions
apply before these limits. Popular and recommended order compare only items in each
bounded selection; personalization opt-out restores recent recommendation order.
An empty selection does not claim the whole catalog is empty. Missing saved choices
or required sources show explicit failure and retry; a failed cover keeps the article
readable and independently retryable. Account changes cancel pending content.

The BFF needs compatible Editorial/Discussion Explore readers, their existing
`EXPLORE_SERVICE_SECRET`, and source URLs. The public article and application catalog
APIs also remain required. There is no new Digest projection or migration. The local
gateway and development API ingress route `/api/digest` through their existing BFF
prefix. Explicit demo mode retains the demonstration Digest separately. See
`docs/MATERIALIZATION.md` and the readiness qualifier for bounds and operational limits.

## Explore activity

API-mode Explore uses Catalog BFF `/api/explore` and displays current public
applications, suites, articles, releases, application topics and member reviews.
It replaces pages of up to ten items and preserves the opaque `activity` cursor
when following a detail link and returning. Saved category exclusions apply to
each page; popular/recommended order is limited to that chronological page. Popular
uses actual discussion votes and review helpful marks; recommendations use saved
favorites and preferred categories/tags. Personalization opt-out restores recent
order, and account switching cancels old requests. Missing source configuration or
saved choices produce explicit failure/retry states. Demo mode stays separate.
Mature-content filtering needs an authoritative classification model and remains
unavailable. See the Explore materialization/qualification contract for activation
and exact taxonomy matching limits.

## Responsive navigation

Desktop keeps full sidebars. Tablets (768–1040px at the default browser font size)
use compact icon rails with expandable navigation and account panels around the
centered content column. Only one panel opens at a time; successful navigation or
Escape closes it. Phones below 768px use the bottom navigation and account sheet.

## Local data boundaries

API mode uses canonical account services for private profile text, preferences and
application/suite favorites. Favorite membership uses stable UUIDs; names/links come from
current catalog reads. Failed metadata reads preserve removable saved items.
`/my/favourite/apps` selects application favorites; `/my/favourites/suites` selects
suites against current publication visibility. `/me/favorite` is the
general view. Account switches cancel old work and clear private state.

Demo profile/preferences/favorites, suite drafts, application drafts and local
discussions/replies use browser storage. Demo data is never imported into account
APIs. Article/discussion favorite adds and account-wide export/erasure remain
unfinished. Sample metrics, reviews and service notices are demonstration data,
not live monitoring. See the readiness evidence for real-service qualification.

Ownership verification, email/push delivery, and full
account erasure still require integration. Local preparation screens do not claim
to perform those operations.

API-mode `/apps/register` and `/my/apps` use Editorial's
`/api/me/application-drafts` endpoints through the configured API origin. Run the
application-draft migration before starting Editorial. Save/reopen/edit/delete
work across sessions; commands bind to a loaded revision and retain the same key
when a response is unconfirmed. Success rereads canonical state. Account changes
clear private forms and obsolete work. Drafts are private; they do not reserve a
public slug or verify ownership. Existing catalog records cannot be adopted for
editing through this workspace. The local gateway routes these endpoints to
Editorial. Browser-local data is never imported automatically.

Choose **Manage publication** to open `/my/apps/:applicationId/publication`.
Submit copies the saved draft into an immutable review version. Assigned reviewers
use `/editorial/apps` and `/editorial/apps/:applicationId`; they cannot review their
own applications, including as administrators. Rejection requires a reason and
preserves the previous public version. Approval publishes the submitted fields;
later private edits remain private. Public slugs must be globally unique.

Commands preserve the same key/intent after an unconfirmed response. A changed
canonical public revision prevents stale approval. Withdrawal hides the application
immediately, including during projection lag. Deleting the draft also withdraws
and scrubs its public content. Approval does not verify real-world ownership.
Run `ApplicationPublication1791676811000` before startup; it adds review/receipt
tables and widens public website storage to match the 2,048-character draft limit.
Ownership claims, existing-record authoring, media and account-wide erasure remain
unfinished. Real-service qualification and its substitutions are recorded in the
application-publication checkpoint.

## Walkthrough recordings

Run `npm ci --prefix tools/recordings` once, then `npm run record:app` to build the
current app and record its responsive layouts. Each size includes a full
walkthrough, discovery showcase, 15-second excerpt, and chapter stills. See
[`tools/recordings/README.md`](../../../tools/recordings/README.md) for sizes,
rehearsal mode, and choreography settings.

`npm run record:tour` records the complete navigation checklist at 768 × 1024,
with 1.5× movement and pauses, against the running app at `localhost:4040`.
It produces 20 separate MP4 clips and a player with chapter navigation.

## Verification

```sh
npx tsc -p apps/portals/aggregator/application/tsconfig.app.json --noEmit
npx jest --config apps/portals/aggregator/application/jest.config.ts --runInBand
NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx build aggregator-csr --configuration=development
```

The test suite covers persistence, storage failures, query/filter behavior, pagination, drafts, route parameters, profiles, and feed behavior. Browser checks should cover desktop, tablet, and mobile widths and both color themes. Styling uses the existing design-system tokens, runtime theme variables, layout components, and Taiga UI controls.

## Private suites in API mode

`/my/suites` lists account-owned private collections. `/suites/create` creates one;
`/my/suites/:suiteId` reopens, edits or deletes it. The suite feature uses
`GET/POST /api/me/suites` and `GET/PUT/DELETE /api/me/suites/:id` through the
configured API origin. The local gateway routes those requests to Editorial.
Run Editorial migrations (including `SuiteWorkspace1791676808000`) and deploy the
updated editorial OPA bundle before enabling this workflow in another environment.

Titles are limited to 100 characters, descriptions to 1000, membership to 50
applications and active suites to 100 per account/tenant. Application IDs remain
stable through renames; unavailable members remain removable. A lost save response
shows an explicit retry of the same command. Account changes clear private state.
Demo mode keeps its existing local routes and never imports browser drafts into
an account. Private saves do not publish suites. Account-wide export/erasure
remains unfinished.

## Suite publication in API mode

Open a saved draft and choose **Manage publication** to submit it at
`/my/suites/:suiteId/publication`. Submitted content is frozen for review; editing
the private draft does not change the submission or the approved version. The owner
can see rejection reasons and withdraw pending/public content.

Reviewers use `/editorial/suites` and `/editorial/suites/:suiteId`. The backend
requires the `editorial:reviewer` or administrator role in the same tenant and
forbids self-review. The public `/suites` listing supports title search and pagination;
`/suites/:suiteId` shows the approved version. Loading a missing/stale projection
reports a retryable failure, and withdrawal/deletion revokes visibility immediately.

Run `SuitePublication1791676809000`, deploy the updated Editorial OPA bundle and
upgrade the Editorial materializer before exposing the new commands. The local
gateway routes `/api/editorial/suite-reviews` and `/api/catalog/suites` to Editorial.
Qualification uses disposable SQL/Mongo/OPA plus optional RabbitMQ; production
sessions, deployment and restore/rollback remain unverified. Mixed-content search,
suite facets/legacy listing URLs remain separate work.

## Suite favorites in API mode

Use **Add to Favorites** on an approved suite's detail or public listing card.
`/my/favourites/suites` shows saved suites; `/me/favorite` groups them with saved
applications. Titles reflect reviewed public content, including later approved
replacements. Private edits do not change them. Withdrawn/deleted suites have no
public title/link in favorites, but their saved reference can still be removed.

The portal's catalog origin must serve both `/api/catalog/app-selection` and
`/api/catalog/suite-selection`. The local gateway routes the latter to Editorial.
Account Management needs the updated eligibility adapter and `EDITORIAL_URL`;
no new favorite migration is required beyond `AccountFavorites1791676807000`.
Uncertain responses preserve the same command key for retry. Projection/metadata
outages are explicit and do not prevent removing saved references.
