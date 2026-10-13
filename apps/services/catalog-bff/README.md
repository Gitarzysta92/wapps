# Catalog BFF

The BFF serves the pure `CatalogReadPort` contract exported by
`@domains/catalog/record`. Its application service depends on that port; Nest
composition supplies the Editorial HTTP adapter. Editorial owns public-tenant
selection, SQL filtering and revision-checked materialized application content.
See `docs/MATERIALIZATION.md` for the consistency and recovery protocol.

## HTTP contract

| GET route | Result |
| --- | --- |
| `/api/catalog/apps` | `CatalogPage`: items, total, page, pageSize, totalPages, facets |
| `/api/catalog/apps/:slug` | `CatalogApp` at the current public revision |
| `/api/catalog/apps/:slug/preview` | Alias of the canonical application response |
| `/api/catalog/facets` | Current public categories, tags, platforms, devices and monetizations |
| `/api/catalog/categories` | Flat canonical categories with nullable parent UUIDs |
| `/api/catalog/categories/tree` | Categories with nested `childs` arrays |
| `/api/catalog/tags` | Canonical tag facets |
| `/api/catalog/tags/:slug` | One current tag |

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
