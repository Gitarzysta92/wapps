# Portal gateway route parity

Source inventory for A26, October 18, 2026, on `codex/full-operation` at base
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb` plus the preserved working tree.
This describes checked-in routing, not the live installation (still A21).
The [completion checklist](BACKEND-COMPLETION-CHECKLIST.md) owns release status.

## Account settings slice

Both [local](../deploy/local/nginx/api.conf) and
[alpha](../deploy/alpha/nginx/api.conf) now send the following contracts through
explicit BFF controllers, including case/trailing-slash variants:

| Browser contract | Current portal adapter | BFF handler |
| --- | --- | --- |
| `GET /api/me` | [IdentityApiService](../apps/portals/shared/features/identity/src/infrastructure/identity-api.service.ts) | [PortalAccountController](../apps/services/catalog-bff/src/app/account/portal-account.controller.ts) |
| `DELETE /api/me` | [AccountErasureApiService](../apps/portals/shared/features/identity/src/infrastructure/account-erasure-api.service.ts) | `eraseAccount`, accepts deletion with pending cleanup |
| `GET/PUT /api/me/profile` | [MyProfileApiService](../apps/portals/shared/features/my-profile/src/infrastructure/my-profile-api.service.ts) | `readProfile` / `updateProfile` |
| `PUT/DELETE /api/me/profile/avatar`, `GET .../:id` | [ProfileAvatarApiService](../apps/portals/shared/features/my-profile/src/infrastructure/profile-avatar-api.service.ts) | `uploadAvatar` / `removeAvatar` / `readAvatar` |
| `GET/PUT /api/me/preferences` | [PreferencesApiService](../apps/portals/shared/features/preferences/src/infrastructure/preferences-api.service.ts) | [PortalPreferencesController](../apps/services/catalog-bff/src/app/preferences/portal-preferences.controller.ts) |

The accepted presentation baseline remains `c965790e...`. Its profile/preferences
adapters stored demo values in the browser. The current HTTP adapters implement
the integration seam; their existence does not accept the modified presentation
or prove that every stored preference has a consumer. A24 changes no frontend.

The gateways' broad direct-Account `/me` fallback is removed. Earlier specialized
routes keep their limits; all other `/me` paths reach BFF, whose explicit controllers
reject unknown suffixes and methods. Avatar requests have a 2 MiB ingress limit;
account/profile/preferences have 64 KiB, bounded upstream timeouts and no gateway
retry. Reads reject query selectors and request bodies. BFF preserves trusted
identity, revision, idempotency and no-store semantics; Account owns authorization,
canonical SQL, normalized WebP bytes, command receipts, outboxes and deletion.

`bff-account-settings-runtime-checks.cjs`, invoked by `local-auth.test.cjs`, exercises
the built BFF, independent Authentication and Account services, real OPA, fresh
MySQL/RabbitMQ and both Nginx API/auth configurations. The harness substitutes
dependency addresses and excludes the unrelated application/article media include.
It uses real credential tokens for account/settings requests and no fixture
authentication response. It qualifies rollback/replay, account isolation,
process restarts, avatar bytes and removal, policy/owner failures, and BFF shutdown.
The owner-failure check changes only the test BFF's Account binding to an unavailable
loopback port so real ingress Identity validation remains available. Self-deletion
checks acceptance, tombstone and denied access; full erasure completion is separate.

## Public profiles, follows and badges

A25 aligns the following complete families in both gateway configurations:

| Browser contract | BFF handler |
| --- | --- |
| `GET /api/profiles`, `GET /api/profiles/:id` | `PortalPublicProfilesController` directory/profile |
| `GET /api/profiles/:id/avatar/:avatarId` | Audience-protected WebP read |
| `GET /api/profiles/:id/{favorites,suites,articles,discussions,activity,totals,badges}` | Bounded Account composition and strict result mapping |
| `GET/PUT /api/me/profile-follows`, `GET .../outgoing` | `PortalProfileRelationsController` revisioned follow commands/lists |
| `GET /api/me/{totals,badges}` | Private totals/current badge reads |
| `GET /api/admin/profile-badges`, `GET/PUT .../:id` | `PortalProfileBadgeController` capabilities, history and revisioned commands |

The [profile adapters](../apps/portals/shared/features/user-profile/src/infrastructure/)
consume the [explicit profile BFF](../apps/services/catalog-bff/src/app/profiles/).
The 64 KiB route family includes case/slash variants and unknown suffixes, with
bounded timeouts and no upstream retries. GET bodies are rejected before Account
I/O. Account preserves tenant claims and real OPA denies tenant-scoped global badge
administration; unscoped `admin` and `identity:badge-manager` retain their authority.

The optional public-profile extension of `local-auth.test.cjs` uses real enrolled
sessions, Account/Authentication/BFF, MySQL, OPA and both gateway configurations.
Shared content comes from real Editorial and Community, with Mongo, MinIO and the
Discussion materializer. The readiness README records invocation, source-setup
substitutions and limits. A25's passing run uses explicit native Nginx 1.28.3;
Docker-to-host transport stalls remain unqualified. A26 adds the shared-content
classification filtering described below. Complete author erasure, frontend
acceptance and activation remain open.

## Favorites and notification inboxes

A26 routes the complete `/api/me/favorites/*` and `/api/me/notifications/*`
families through the explicit [member BFF](../apps/services/catalog-bff/src/app/member/)
in both gateway configurations. The alpha Account bypass is removed. The 64 KiB
limit, bounded timeouts, no upstream retry, case/slash variants and unknown-suffix
handling match the local family. GET/HEAD bodies fail before owner I/O.

The [favorites adapters](../apps/portals/shared/features/my-favorites/src/infrastructure/)
and [inbox adapters](../apps/portals/shared/features/identity/src/infrastructure/)
retain their contracts. Account owns saved references, revisioned receipts, watch
baselines, delivered/suppressed decisions and recipient-private read timestamps.
BFF resolves all four favorite kinds and filters current metadata using the
viewer's saved content choice. Hidden favorites retain only a removable reference
and generic unavailable metadata. The five shared-profile content sections apply
the same filter; anonymous viewers see General only. Preference changes during
composition fail with conflict, and filtered pages retain their scan continuation.

Reply, mention and watch delivery and inbox reads use current recipient choices
and source authority. Mature and unclassified content require explicit opt-in;
suppressed receipts cannot be resurrected by enabling the preference later.
Classification comes from current approved source content, including parent
applications for discussions/releases. Missing classification remains unclassified.
Account's shared-favorite Discussion lookup now consumes generic `/discussions/selection`
with the Wapps binding interpretation in its consumer adapter.

`WAPPS_MEMBER_PARITY_INTEGRATION=1` runs the separate A26 extension of
`local-auth.test.cjs`; the readiness README records fresh stores, actual workers,
source setup/projector substitutions, scheduler/acknowledgement fault injection
and native-gateway limitations. Full export/erasure, quarantine operations,
external channels, crash/restore and activation remain separate qualifications.

## Remaining direct routes

All paths below start with `/api`. These are migration work under
`rules/portal-bff-boundary.md`, not architectural exceptions. Existing BFF handlers
do not establish parity until the real workflow and whole route family pass through
both gateways, including denial, failures, case/slash variants and unknown suffixes.

| Family | Local | Alpha | Caller and existing BFF support / next qualification |
| --- | --- | --- | --- |
| `/me/exports/*` including download | BFF | Account | [AccountExportApiService](../apps/portals/shared/features/identity/src/infrastructure/account-export-api.service.ts); [exports BFF](../apps/services/catalog-bff/src/app/exports/). Qualify complete provider capture, durable jobs, authorized bounded streaming, restart and cancellation (BC21). Self-deletion acceptance is already A24; full erasure convergence remains BC22. |
| `/me/suites/*`, `/editorial/suite-reviews/*`, `/catalog/{suites,suite-selection}` | BFF | Editorial | [Suite adapters](../apps/portals/shared/features/suite/src/infrastructure/); [suites BFF](../apps/services/catalog-bff/src/app/suites/). Qualify private workspace, frozen review/publication, parent authority and selection (BC09/12). |
| `/me/application-drafts/*`, `/editorial/application-reviews/*`, `/me/ownership-claims/*`, `/editorial/ownership-reviews/*` | BFF | Editorial | [Application-workspace adapters](../apps/portals/shared/features/application-workspace/src/infrastructure/); [applications BFF](../apps/services/catalog-bff/src/app/applications/). Qualify draft publication and exact ownership proof/provider outcomes (BC10/11/12). |
| `/me/releases/*`, `/editorial/release-reviews/*`, `/catalog/releases/*` | BFF | Editorial | [ReleaseApiService](../apps/portals/shared/features/application-workspace/src/infrastructure/release-api.service.ts); [releases BFF](../apps/services/catalog-bff/src/app/releases/). Qualify immutable history, review/publication and parent revocation (BC14). |
| `/me/articles/*`, `/editorial/article-reviews/*`, `/catalog/{articles,article-selection,article-visibility}` | BFF | Editorial | [Article adapters](../apps/portals/shared/features/articles/src/infrastructure/); [articles BFF](../apps/services/catalog-bff/src/app/articles/). Qualify classification, review, slug/tombstone and current Discussion authority (BC13). No direct portal caller for `article-visibility` was found; BFF retains an explicit handler/client. |
| `/me/{application-images,article-covers}/*`, `/media/{applications,articles}/*` | BFF | Editorial | [ApplicationMediaApiService](../apps/portals/shared/features/application-workspace/src/infrastructure/application-media-api.service.ts), [ArticleCoverApiService](../apps/portals/shared/features/articles/src/infrastructure/article-cover-api.service.ts); explicit BFF media controllers. Also audit media nested under draft/review routes. Qualify byte bounds, source authorization, staging/commit/replay and object-store failures (BC15). |
| `/catalog/application-visibility/:id` | Editorial | Editorial | [EditorialCatalogController](../apps/services/editorial/src/app/http/editorial-catalog.controller.ts); no explicit BFF handler and no current portal caller found. Establish whether this owner route should be exposed at ingress; do not add a blind proxy to achieve parity. |
| `/registration/complete` | Account | Account | [RegistrationController](../sdk/features/identity/applications/management/service/src/app/controllers/registration.controller.ts); no BFF handler or current browser caller found. [IdentityRegistrationApiService](../apps/portals/shared/features/identity/src/infrastructure/identity-registration-api.service.ts) uses `/auth/register` through BFF. Decide legacy enrollment compatibility before retiring or migrating the bypass. |

This inventory compares API/media Nginx rules to production `.ts` caller strings,
route construction in the linked adapters and explicit BFF controller decorators.
It is not a captured browser traffic inventory or proof that no external client uses
the two routes with no discovered portal caller. Alpha's remaining direct rules
are still case-sensitive; those semantics
belong to their future family migrations. Do not interpret mixed-case default-BFF
behavior as completion.

Authentication aliases, all `/admin/users/*`, staff `/editorial/health-monitors/*`,
generic Discussion and dedicated application-discussion/article-comment/review
families already cross BFF in both configurations. Other `/api/*` requests use the
default BFF route; these catch-alls grant no owning-service proxy capability.

Recommended next bounded parity slice: export/privacy (BC21/22/27), with complete
provider capture, durable jobs, authorized downloads and erasure convergence.
Coordinated
activation, archived-data policy, external providers, public monitoring egress,
backup/restore/soak and the original frontend merge remain separate release work.
