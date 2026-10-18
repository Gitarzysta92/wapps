# Discovery and feed contract inventory

Discovery lane, October 18, 2026. Source baseline:
`3d54604d8b4f85f1fed826601f76948885b78f0c` (preserved A26); presentation reference:
`c965790e063139bcd5e6bacc759f289703e4ea9a`. This inventory describes contracts, not
acceptance of the current frontend or a deployment. BC01/BC02/BC07 remain partial.

## Original controls and query semantics

The original `apps/portals/aggregator/application/src/filters.ts` names `platform`,
`category`, `tag`, `page`, `device`, `monetization`, `social`, `estimated-users`,
and `search`. The original shared filtering mappers preserve sets. The original
`apps/portals/shared/features/listing/src/application/catalog-listing.ts` defines
OR within categories/platforms/devices/pricing, AND across dimensions, and AND
across every tag. `search/src/application/discovery-search.ts` merges `tag` and
`tags`, recognizes `q`, and applies social/user-range filters only to applications.
Its demo values are not authority.

| Original control / URL | Canonical owner and current path | A26 status / remaining interpretation |
| --- | --- | --- |
| `search` / `q` | BFF `/catalog/discover` -> Catalog application browse; Article/Suite publication browse | Implemented bounded search; original fixture search also searched author/tag labels. Current application search uses name/description/slug; article and suite queries use titles. Cross-field search parity remains missing. |
| `type=application/article/suite`; singular/plural and `all` | Discovery domain normalization; bounded independent owner reads | Implemented. Original absent type grouped all kinds. No new ranking. |
| `category` | Application category UUID/slug hierarchy from Editorial SQL; article approved category text | Application OR/descendant matching and one article category implemented. Mixed-kind categories and multiple article categories rejected. Mapping application taxonomy slugs to article free-text categories needs an explicit shared taxonomy decision. |
| `tag` / `tags` | Application relation tables; article approved `article_publications.fields.tags` | Application all-tags matching implemented. A26 article query allowed one tag only. This slice adds bounded article all-tags matching, keeping legacy `tag` intact. |
| `platform`, `device`, `monetization` | Catalog facets and application relation tables | Implemented for application-only queries; nonapplication/mixed queries reject. Original demo pricing expansion matched plan names to pricing models; no authoritative equivalence contract exists for that expansion. |
| `social` | Original options: Facebook, X, Reddit, Discord, LinkedIn, Medium; fixtures compared reference types | Missing canonical published reference types/URLs, catalog facet and query. Generic website is not a social reference. Owner schema/approval/retirement contract required before implementation. |
| `estimated-users` | Original half-open ranges `[0,1000)`, `[1000,10000)`, `[10000,100000)`, `[100000,1000000)`, `1000000+` | Catalog exposes nullable `estimatedNumberOfUsers`, but approved application fields/Editorial commands do not accept an estimate. Its provenance, measurement date/update authority, and unknown handling need a product/owner decision. No values are inferred or populated here. |
| `sort=name/name-desc/newest` | Each owner sorts before slicing; stable identifier tie-break | Implemented. Recommended/popular/top-author order is not implied by these contracts. |
| `page`, independent kind pages, `pageSize`; grid/list | Owner count/page plus BFF bounded correction; feature preferences control size/view | Implemented source totals and bounded pages. Preference exclusions affect displayed page only; source totals are not personalized counts. |
| Legacy `/search`, `/search/page/:page`, `/app`, `/app/page/:page`, `/app/:category/page/:page`, `/apps`, `/discover/page/:page`, `/discover/:category/page/:page` | Original `discover-redirect.routes.ts` preserves query/fragment/path values; app aliases default to application | Query normalization exists. Original `/discover/:category/...` with no type remains incompatible with current mixed-kind restriction. Historical numeric fixture facet IDs are not canonical UUID/slug aliases. |
| Suite directory/category/tag/slug links | Suite owner has title/description/classification/ordered application IDs and UUID destination | Canonical suite taxonomy and historical slug aliases are missing. Do not infer suite taxonomy from members or modify suite publication in this lane. |
| Recent searches; current exclusions/mature choice | Feature session storage; Account preferences and classification contracts | Existing consumer filtering/session fencing remains. Discover filtering is still in the feature layer; its public response contains classified source items. A26 BFF filtering for favorites/profile/inbox must not be claimed for Discover. |

## Original cards and overview fields

Original field names come from
`libs/domains/discovery/src/application/discovery-search-result.dto.ts`,
`libs/domains/feed/src/application/*.dto.ts`, the original shared feed components,
and the original aggregator `application-overview-page` template. Current contracts
are `CatalogApp`, `PublicDiscoveryItem.details`, and `ExploreItem.details` /
`ActivityDetails`. A null/missing metric is distinct from an authoritative zero.

| Original field / action | Authoritative source and composition | Status / missing parity |
| --- | --- | --- |
| Common `id`, kind, name/title, slug/detail destination, excerpt/description, timestamp | Catalog or approved Article/Suite/Release publication; BFF maps stable IDs and current routes | Present. Suites use UUID, not demo slug. Feed is bounded current facts, not a complete edit journal. |
| Application cover/logo, category/tags, platforms/devices, pricing, PWA, listed/updated dates, website | Catalog SQL eligibility + exact-revision Editorial projection and taxonomy; application detail adapter | Present, with explicit null media/optional data. Protected media retains owner access. |
| Legacy overview DTO `owner.id/name/email/avatarUrl`, `references[].id/name/type`, metric `number`, numeric compatibility/pricing IDs | Application ownership proof is separate from Account public identity; Catalog uses canonical facet UUIDs/slugs and nullable estimate | Declared by the original overview DTO, beyond the rendered overview subset. Public owner/contact projection and social-reference contracts are missing; do not expose an owner's private email or reinterpret demo numeric IDs as canonical references. |
| Application `rating` / `aggregatedScore`, `reviewsCount`, `topReview.rate/content/authorName` | Generic Review owner summaries through consumer binding and BFF review client | Current rating/total and bounded review preview are present. Preview is owner selection, not a newly defined best-review ranking. |
| `commentsNumber`, review author avatar, category/link label | Discussion/Review and Account would need bounded current-authority composition | Discovery application details currently carry review total/byline/text/rating, not topic/comment totals or review author avatar. Keep distinct metrics; review total is not comments total. |
| Article title/excerpt/slug, cover/alt, publication date, category, tags, `authorName` / `author` | Approved article publication and protected cover reference | Present as approved public byline. It is not automatically the current Account display name. |
| Article `commentsNumber`, `authorAvatarUrl`, author badges, upvote action/count | Discussion exact article binding; Account public profile/badges; no general article-vote owner | Missing card composition. Live author metadata needs audience/erasure/revocation handling and a defined identity/byline relationship. Generic feed votes require a real owner, not local vote state. |
| Suite `numberOfApps`, ordered `applications[].name/slug/avatarUrl`, description | Frozen approved suite membership plus bounded current Catalog selection; BFF rechecks publication | Membership count and up-to-six current public previews present; withdrawn members are omitted. Count describes approved membership, not visible-preview count. |
| Suite cover, category/tags, author/avatar, rating/votes, `commentsNumber`, `topComment.content/author/date/upvotes` | No equivalent complete suite taxonomy/community/attribution contract | Missing/undecided. Do not copy member categories, invent a cover/author, or substitute review totals. Suite lifecycle lane remains separately owned. |
| Review card rating/testimonial/reviewDate/reviewerName, app identity/name | Review approved payload and current application authority | Present. Reviewer role, badges, avatar, helpfulCount and generic feed-vote presentation lack equivalent composed evidence. |
| Discussion title/messages/byline/date, replyCount, canonical topic route | Generic Discussion owner; consumer binding and current application authority | Present bounded excerpts and replies. `participantsCount` is not replyCount; `viewsCount` and top-author ranking have no accepted event/aggregation definition. |
| Release version/description/date/change type and text, application details | Approved immutable Release owner data, current application authority | Present. Full public historical edit/deletion timeline is not provided by a feed of current snapshots. General vote/attribution extras remain separate gaps. |
| Health overallStatus/statusMessage/history/notices | Application health observations and BFF health contracts (A23) | Current observations/status supported in dedicated flow; complete original feed notice/history parity and operational probing remain separately qualified. No invented uptime/view numbers. |
| Overview recent discussions, Included in Suites, shortcuts, favorites | Discussion discovery, current suite selection, Account favorites and BFF adapters | Existing real workflows; complete original overview composition/metadata and frontend acceptance remain unverified here. Do not remove navigation/actions to match a smaller contract. |
| General feed vote/save/discussion/copy-share actions | Favorites and Discussion have owners; public URLs map canonical routes | Existing favorites/discussion contracts remain; general feed votes are local/demo behavior and need a domain decision. No reusable capability key interpretation added. |

## Completed bounded contract

Selected gap: article multi-tag intersection, directly defined by the original
`query.tags.every(...)` and backed by approved owner tag arrays. No estimated
metric, suite taxonomy, ranking, author, count or badge is invented.

- Owner `GET /api/catalog/articles` accepts optional `tags` as comma-separated
  slugs or repeated values; maximum 12 raw values, 1-40 lowercase alphanumeric/
  hyphen characters per value, canonical dedup/sort, AND with legacy `tag` and
  the existing category/search. More than 12 distinct combined tags fails.
- Discovery `GET /api/catalog/discover?type=article&tags=offline,web` maps the whole
  normalized set into the owner query. Applications retain their existing tag
  semantics; unsupported mixed-kind/suite filters still fail explicitly.
- Owner SQL applies a parameterized JSON containment predicate for each tag to
  both count and page queries within the canonical tenant/lifecycle transaction.
  Approved publications, not private edits or projections, choose eligibility.
  Existing exact-revision projection checks and post-I/O authority rechecks remain.
- Both BFF article consumers serialize explicitly and reject source rows missing
  any requested tag. The article feature adapter uses the same owner query
  serializer. Discovery's existing adapter already preserves every selected tag.
- No stored representation, schema, migration, worker, bootstrap, gateway, visual
  component, stylesheet, lockfile or action changes are required.

Evidence directory: `/tmp/wappsA-discovery-parity-20261018-vqcziq5l/`.
The final `verification.json`, source hashes/diff and logs define the exact tested
scope. `tools/readiness/discovery-tags-runtime-checks.cjs` is invoked through
`qualify-suites.cjs --discovery-tags --no-browser` using disposable stores and
compiled processes. Trusted author/reviewer claims and direct production projection
delivery are explicit substitutions. It does not qualify real login, gateway
transport, Account preference persistence, broker delivery or original visual
acceptance. Existing A25/A26 Docker-to-host stalls remain unresolved.
