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
- **Favorites**: applications, articles, suites, and discussions share one state provider and persist locally.
- **My Apps**: validated local registration drafts and ownership preparation notes.
- **Account**: profile editing, avatar selection, display/content preferences, notification preferences, privacy preferences, and local data export.

## Responsive navigation

Desktop keeps full sidebars. Tablets (768–1040px at the default browser font size)
use compact icon rails with expandable navigation and account panels around the
centered content column. Only one panel opens at a time; successful navigation or
Escape closes it. Phones below 768px use the bottom navigation and account sheet.

## Local data boundaries

Favorites, profile/preferences, suite drafts, application drafts, and local discussions/replies use browser storage. They are not published or synchronized between devices. Storage failures are reported rather than treated as successful saves. Sample catalog metrics, reviews, and service notices are demonstration data, not live monitoring.

Remote publication, ownership verification, email/push delivery, and remote account deletion require backend integrations. Local screens do not claim to perform those operations.

## Verification

```sh
npx tsc -p apps/portals/aggregator/application/tsconfig.app.json --noEmit
npx jest --config apps/portals/aggregator/application/jest.config.ts --runInBand
NX_DAEMON=false NX_ISOLATE_PLUGINS=false npx nx build aggregator-csr --configuration=development
```

The test suite covers persistence, storage failures, query/filter behavior, pagination, drafts, route parameters, profiles, and feed behavior. Browser checks should cover desktop, tablet, and mobile widths and both color themes. Styling uses the existing design-system tokens, runtime theme variables, layout components, and Taiga UI controls.
