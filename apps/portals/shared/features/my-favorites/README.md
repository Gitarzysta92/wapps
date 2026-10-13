# My Favorites Feature

Canonical account favorites and explicit browser-local demo behavior.

## API mode

Applications and approved public suites support add/remove. Article/discussion
adds remain unavailable; previously saved references can still be removed.
Membership uses canonical UUIDs, independent of titles, slugs and target metadata.

Compose the feature with the identity session and HTTP providers:

```typescript
const favorites = provideMyFavoritesFeature({
  mode: 'api',
  apiBaseUrl: '',
  catalogBaseUrl: '',
});
```

The empty origins deliberately select the same-origin gateway. Merge the returned
application configuration at the host composition root. The account origin must
provide `GET/PUT /api/me/favorites`; the catalog origin must provide both
`/api/catalog/app-selection` and `/api/catalog/suite-selection`. A bare
application-only BFF does not supply the suite endpoint.

```html
<favorite-toggle-button type="suites" [targetId]="suite.id" />
```

`type` selects the content family. `targetId` is a canonical UUID in API mode;
`slug` is the demo identifier. Optional `iconOnly` and `appearance` configure
presentation. The component exposes sign-in/loading/saving/error states and
retains the original command intent for a retry after an uncertain response.

`MyFavoritesService` owns session-scoped membership, loaded revision and commands.
`FavoriteContentService` resolves display metadata through its port. Use its view
for saved-content screens; raw IDs must never be presented as a fabricated title,
slug, image or route. `MyFavoritesGridComponent` is a presentation-only avatar grid
with `vm` and `maxItems` inputs and an `empty-state` projection slot.

## Consistency and recovery

- Account authorization and current lifecycle are enforced by the backend.
- Relation, shared account revision, receipt and outbox commit atomically.
- Adds check current target eligibility; removal and completed retries do not need
  target metadata. An old add receipt cannot restore a removed relation.
- Suite titles come from the approved public version. Private edits do not alter
  them; withdrawal/deletion removes metadata and links while retaining a removable
  saved reference.
- At most 200 relations resolve in bounded batches of 50 per content family.
  Malformed/failed metadata invalidates the displayed details without deleting
  canonical membership. Batch reads do not form a global cross-service snapshot.
- Account switches cancel obsolete reads/writes and clear private UI state.
  Cancelling a browser request cannot retract a server commit.

## Demo mode

`mode: 'demo'` explicitly selects browser storage and slug-based sample content.
Demo data never seeds account storage. Use `slug` when composing demo toggle
buttons. Do not fall back to the demo adapter after a missing configuration or
failed service request.

## Qualification

Feature behavior is covered by `favorites.spec.ts`. Real application favorite
checks use `tools/readiness/qualify-materialization.cjs --favorites-browser`.
Suite publication/favorite checks use `tools/readiness/qualify-suites.cjs
--favorites`, with compiled API-mode portal, account and Editorial services plus
SQL/Mongo/OPA and independent browsers. See the repository readiness evidence for
fixture boundaries and the still-open production qualification gates.
