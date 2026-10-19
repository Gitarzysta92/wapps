# Accepted frontend integration

The October 19, 2026 instruction is to preserve `codex/coolify-alpha` and
connect its views, one at a time, to the backend on `codex/full-operation`.
The accepted presentation is not replaced with the later API page designs.

## Preserved sources

| Reference | Commit |
| --- | --- |
| `codex/coolify-alpha` (unchanged) | `c965790e063139bcd5e6bacc759f289703e4ea9a` |
| `codex/preserved-coolify-alpha-20261019` | `c965790e063139bcd5e6bacc759f289703e4ea9a` |
| `codex/pre-frontend-integration-20261019` | `1c10bc17c8d546bd2561eb9dd06404d908feb5ff` |

A verified, complete-history local Git bundle also preserves both original
branch tips at `tmp/frontend-preservation-20261019/baselines.bundle`.
Its SHA-256 is
`9444d4441e5f282329c50e1f5a79b51d16449a2a941b75dc8743a805b2b77971`.
This ignored local artifact and the preservation refs have not been published.

## View order

Start with Home/Explore, then Discover. Continue through the original application
overview, health, releases, reviews, discussions and timeline; suite and article
lists/details; personal workspaces and favorites; profiles and settings; Digest
and authentication views. Compare each view with the accepted source before
editing it. Existing backend functionality and feature adapters remain the
integration foundation. This order is not a claim that later views are restored.

## Home/Explore: first integration slice

Home now passes its original item template to the API Explore container. The
existing Explore adapter, preferences/session invalidation, filtering and error
handling remain in use. A feature mapper supplies the
original application, article, suite, release, review and discussion components
with authoritative preview fields. The same template still serves explicit demo
mode.

- Application cards distinguish logos from banners and zero reviews from an
  unavailable review aggregate. Category/tag links retain the selected slug.
- Article cards use published bylines, dates, excerpts and the existing protected
  BFF cover adapter, including failure/retry and object-URL cleanup.
- Suite cards retain the authoritative application total separately from the
  bounded, visibility-filtered member preview.
- Reviews link to the exact review. Releases preserve the exact version,
  including `+`, without double URL encoding, and show the publication date
  without inventing a time of day. Discussion cards use actual bounded posts.
- Favorites receive canonical IDs. Generic voting remains visibly unavailable
  in API cards and cannot read/write browser-local demo votes.
- Original continuous scrolling now appends cursor pages without dropping
  earlier cards. An append failure retains loaded content and requires an explicit
  retry; stalled cursors cannot trigger an automatic request loop. Saved-choice
  and account changes invalidate accumulated content. A Load more action also
  supports keyboard navigation and entirely hidden pages. Existing cursor links
  and browser Back continue to work.

Home is not yet accepted as fully integrated. The Explore contract does not
currently supply health activity, generic article/release/review feed votes,
article comment totals, suite taxonomy, discussion participant/view counts,
reviewer badges/roles, or feed attribution. Existing review helpfulness and discussion voting are separate
capabilities; a helpful count must not be relabeled as an upvote count. Missing values are explicit,
and no unsupported behavior has been declared complete or removed from scope.

## Verification

Evidence is retained locally in `tmp/frontend-home-20261019/`:

- Fresh Node 22.17.1 lockfile installation; full workspace Jest/portable tests,
  lint, all declared builds/typechecks, architecture checks and Angular package
  inspection pass. The release-link fix additionally passes the affected feed
  and aggregator tests, lint, typechecks and builds.
- The compiled production portal passes 36 card/theme/viewport checks at 390,
  768 and 1440 pixels, plus six settled viewport captures. Checks include the
  actual original component selectors, exact destination URLs, continuous append,
  retained cards after failure, retry, old cursor links/Back, empty results,
  hidden-page continuation and cover retry. The final continuous-feed suite has
  44 passing tests, and the aggregator suite has 350. These browser runs use
  deterministic BFF contract fixtures and are not
  proof of real-service persistence or visual acceptance by the user.
- The existing real-service Explore qualifier was attempted twice, retaining
  both failures. Its legacy Account setup requires a Firebase emulator at
  `127.0.0.1:9099`, which refused the connection. The qualifier failed before
  reaching Explore/browser assertions. Current full-path runtime verification
  remains outstanding; the successful fixture checks do not replace it.
- The initial sandboxed workspace test invocation failed on local HTTP listener
  permissions (`listen EPERM`) and was stopped. The rerun with local listeners
  enabled passes. Existing build warnings remain visible in the logs.

Home's remaining contract/interaction gaps and real-service verification stay
open. The next supported presentation slice is Discover; proceeding there does
not declare Home complete or defer its missing behavior out of product scope.

## Discover: second integration slice

The API view now uses the accepted article/application/suite card templates and
loading skeletons. The existing search feature adapter and explicit BFF endpoint
remain the data boundary. The accepted page stylesheet is unchanged.

- A typed feature mapper supplies published article bylines, excerpts, protected
  cover references and tag labels; application logos, review averages/totals and
  exact review previews; suite totals and bounded visible member previews.
- Original application/suite voting and comment indicators are restored with
  explicit unavailable states. Unknown ratings are not zero; a verified empty
  application review aggregate says "No reviews yet". No demo badges, authors,
  dates, local votes or review counts are used.
- Detail and tag destinations use the accepted navigation declarations. Favorites
  retain canonical target IDs. Review previews retain their real publication date
  and exact review destination. Original section intersection tracking is wired.
- The original aggregate result summary is restored. Source totals remain distinct
  from page-local hidden results; an entirely hidden page retains continuation.
  Search, filters, independent paging, Back, loading, dependency errors and retry
  remain connected. Article tag selection now allows the multiple tags already
  supported by the BFF.

Discover is not fully accepted: generic application/suite votes, discussion
totals, suite ratings/taxonomy/top comments and author/reviewer badges still lack
the required card contracts. Article filter options currently come from the
returned page, rather than a complete BFF facet contract. These are unfinished
integration requirements, not permission to replace the original presentation.

The next view in the accepted order is application overview. Keep remaining
Home/Discover capabilities and user visual acceptance visible alongside it.

### Discover verification

Evidence is retained in `tmp/frontend-discover-20261019/`. The unchanged lockfile
installation from the Home pass is reused, with an updated source manifest.

- Full workspace tests pass: 6,906 Jest tests in 431 suites, plus 34 portable
  readiness tests. Full lint passes. Changed Angular libraries and the portal,
  with 86 prerequisite tasks, pass builds/typechecks/lint; architecture and emitted
  Angular package checks pass. The initial composition-test failures are retained;
  their shell-state setup and accepted-route assertions were repaired before the
  successful full run.
- `qualify-suites.cjs --discovery-view` passes through the compiled portal, BFF,
  Editorial and Community with disposable SQL/Mongo/MinIO/RabbitMQ/OPA. It creates
  published applications, articles, suites and a review through real APIs, checks
  exact totals, independent pages, sort, classification/visibility, projection
  failures, service outages and restart persistence. No live stores are used.
- Independent browsers pass search/filter loading, paging, Back, real detail/tag
  links, canonical review preview, empty/error/retry and legacy URL checks. All
  six 390/768/1440 light/dark layouts pass. Six full-page captures and 18 settled
  card viewport captures are retained; settled captures confirm the content that
  Chromium did not fully paint offscreen in some full-page captures.
- Trusted ingress identities and shell/profile/preferences remain explicit
  harness fixtures. Publication materialization is invoked directly. This is not
  qualification of deployed authentication, broker delivery or the entire beta.
- The broader `--discovery` run passes the backend checks, then times out during
  its separate Home search-preview browser journey after the preference-loading
  captures. Its failure remains recorded in `discovery-runtime.log`; the focused
  view run does not claim to pass that broader journey or the earlier Explore
  qualifier. User visual acceptance remains outstanding.

## Application overview: third integration slice

The overview keeps the accepted hero, metadata, four Quick Access cards, About,
Application Details, Community Discussions and Included in Suites composition.
The existing feature adapters continue to read explicit Catalog, Review and
Discussion BFF routes. The overview page stylesheet is unchanged in this pass;
it retains the existing shared-spacing and absent-cover fixes. The later
ownership button is removed from the hero; ownership remains available through
its existing route. The resolved website link remains in Application Details.

- The original rating chip, score and review total use the authoritative Community
  summary. A successful zero-review response says "No reviews yet"; unavailable
  summaries expose retry. Application and account changes invalidate old ratings.
- The original two `DiscussionSmallCardComponent` previews receive canonical
  thread IDs, root attribution/text/date, tags, pin state and reply totals through
  a feature mapper. Reply totals retain the service's inclusion of removed posts.
  Loading skeletons, empty conversations, failure and retry use the original
  page composition. Other discussion consumers retain their current presentation.
- Catalog data remains resolved by the feature adapter: taxonomy, platforms,
  pricing, PWA status, dates and estimated users do not use bundled demo values.
  Missing banners no longer display the application logo as a cover. Favorites
  keep their canonical application ID; shortcut/detail routes are unchanged.
- The existing application content reader binds visible details to the exact
  route and preference request. It clears old content on route/account changes
  and preserves hidden, loading, missing, unavailable and retry states.
- Included in Suites is now visibly unavailable in API mode, rather than silently
  omitted. The current suite API cannot select suites by member application.
  Original suite cards remain available for a future authoritative binding.

Overview remains partially integrated. Missing contracts are suite membership
(including suite media/author/member previews), discussion view counts and author
avatars, and a globally newest discussion query. The existing discussion API
orders pinned topics first, then newest; this pass shows its first two items and
does not misrepresent a bounded page as a global newest selection. These are
unfinished capabilities, not removed product requirements. User visual acceptance
and the final frontend merge remain outstanding. The next view is application
health; earlier Home/Discover gaps remain open.

### Overview verification

Evidence is retained in `tmp/frontend-overview-20261019/`. The isolated Node
22.17.1 lockfile installation from the Home pass is reused; dependencies are
unchanged. The final source manifest and per-command logs identify this local,
uncommitted change set against `1c10bc17c8d546bd2561eb9dd06404d908feb5ff`.

- Full workspace tests pass: 6,912 Jest tests in 433 suites, plus 34 portable
  readiness tests. Full lint, affected library/portal builds and typechecks,
  architecture checks and emitted Angular package inspection pass. The external
  suites excluded by the workspace test gate remain separately qualified.
- `qualify-suites.cjs --overview-view` passes using compiled portal/BFF/Editorial/
  Community processes with disposable MySQL, Mongo, MinIO, RabbitMQ and OPA.
  Discussion topics and replies are created through BFF and projected from their
  actual SQL/immutable payloads using the production materializer. A persisted
  review supplies the rating. Community/BFF restart and independent browsers
  retain the same previews and average.
- Browser checks pass canonical routes/IDs, the original two-card layout,
  unknown versus measured-empty values, real service outage/recovery, explicit
  retries, navigation/Back, missing applications and account/preference changes.
  Six layouts at 390/768/1440 in light/dark pass, with full-page captures and 18
  settled section captures. Settled captures were visually inspected.
- Trusted ingress, shell/profile/preferences remain harness fixtures. Broker
  delivery, application image publication, account favorite persistence and later
  application views are not proved by this run. Suite membership, discussion
  view totals/avatars and globally newest ordering remain the gaps listed above.
- Failed attempts are retained: the initial template/compiler checks caught an
  unsupported alias in an `else if` and a nullable date; subsequent tests caught
  an incomplete discussion response fixture and resource-settlement timing.
  The first runtime harness lacked anonymous ingress headers; the second used a
  draft receipt as if it contained a public slug. Both harness issues are fixed;
  `runtime-view-3/qualification.json` and `browser.json` record the passing run.

No implementation commit, push, merge or deployment is performed in this pass.
Both preserved refs and the original `codex/coolify-alpha` branch remain intact.
