# Portal gateway route parity

Source inventory through I28 integrated erasure, application/ownership and operational
foundations, October 18, 2026, on `codex/full-operation` at base
`95e3bfd3d552cc2fb31753b5d059f0bcfc346bdb` plus the preserved working tree.
This describes checked-in routing, not the live installation (still A21).
The [completion checklist](BACKEND-COMPLETION-CHECKLIST.md) owns release status.

## Combined Docker qualification

I28 preserves all six separate local-auth extensions and verifies both complete
Docker gateways plus API/auth include fixtures. Erasure/application/export/suite/
profile/member runs pass 31/31/27/29/25/25 groups respectively, with 1,600 bounded
authenticated reads and independent Account/BFF restart recovery per invocation.
Alpha application/ownership routes use the shared `portal_bff` upstream. Evidence
and exact source identity: `/tmp/wapps-integration-a28-20261018-l4s2868l/verification.json`.
Earlier sections retain their native-lane results; I28 supersedes their bounded
Docker transport gap. It does not qualify deployed routing, broad media families,
public DNS/TLS or original frontend acceptance. Remaining direct routes stay below.

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

## Account exports

A27 aligns `/api/me/exports/*` in both gateway configurations. Explicit BFF
handlers implement request/latest/status/cancel/download; alpha no longer sends
canonical export paths directly to Account. Case/slash and unknown suffixes retain
the BFF boundary. The family has a 64 KiB request limit, bounded timeouts and no
upstream retry. Downloads disable Nginx buffering, caching, temporary files and gzip
recompression; BFF validates metadata, byte length and SHA-256 while retaining the
last chunk until integrity validation. Current Account authority remains required.

`WAPPS_EXPORT_PARITY_INTEGRATION=1` extends the fresh-store local-auth qualifier
with real independent Authentication, Account, BFF, Editorial and Community, all
required providers and both native gateway configurations. It verifies exact
`account`, `credentials`, `editorial`, `discussion` receipts, registered historical
payloads, bounded invalid inputs/streams, replay/conflict, account isolation,
private attachments, source/credential/policy outages, BFF failure, expiry,
cancellation and actual Account SIGKILL/restart. The readiness README records the
fault probes and accelerated disposable lease/expiry timestamps. Separate source
and storage regressions cover larger histories, corruption and snapshot bounds.

Native Nginx does not qualify the unresolved Docker-to-host transport. No frontend,
live activation, external provider or full erasure acceptance is included. A28 must
qualify cleanup convergence and retained-public-content policy separately.

## Suite lifecycle and publication lane

The suite lane starts at A26 snapshot
`3d54604d8b4f85f1fed826601f76948885b78f0c` and is integrated with A27 and discovery.
Both configurations now route the
complete `/api/me/suites`, `/api/editorial/suite-reviews` and
`/api/catalog/{suites,suite-selection}` families through the existing explicit
[suite BFF handlers](../apps/services/catalog-bff/src/app/suites/). Alpha's suite
alternatives are removed from its direct Editorial routes. Case/trailing-slash,
unknown suffixes and command methods keep the same boundary, 64 KiB bodies,
bounded timeouts and no upstream retry.

`WAPPS_SUITE_PARITY_INTEGRATION=1` extends the disposable local-auth qualifier.
Twenty-seven combined groups pass with real credentials, canonical identities,
Account, Editorial, OPA, MySQL, Mongo and RabbitMQ. Suite setup and independent
review cross BFF using real reviewer sessions, and the compiled Editorial worker
materializes publications through the broker. Private edits/removal preserve the
approved snapshot; explicit withdrawal denies current reads despite stale Mongo
content. The complete route matrix fails when BFF is stopped, without owner fallback.
Existing Editorial export and suite-only erasure hooks are exercised separately
from full Account privacy completion. Evidence and exact source manifest are in
`/tmp/wappsB-suites-publication-20261018-9gw_04jl/`.

Both gateway configurations use the explicit native Nginx comparison. This does
not resolve the A25/A26 Docker-to-host stalls or establish deployed alpha routing.
The integrated alpha config and local-auth harness retain both export and suite
extensions. Profile, member, export, erasure, suite and application must run separately;
their remaining routes retain their own status.

## Application publication and ownership

The application lane starts from integrated baseline
`908e60952cc4100dfcc6807978ff419a432c9dfc` in `wappsB`. After the explicit local
BFF workflow passed, alpha's direct Editorial alternatives were removed for
`/api/me/application-drafts/*`, `/api/editorial/application-reviews/*`,
`/api/me/ownership-claims/*` and `/api/editorial/ownership-reviews/*`. Both
configurations now require the existing explicit [application BFF handlers](../apps/services/catalog-bff/src/app/applications/)
for each complete family, including case/slash variants and unknown suffixes.
They retain 64 KiB bodies, bounded timeouts and disabled upstream retries.

`WAPPS_APPLICATION_PARITY_INTEGRATION=1` runs separately from profile/member/export/
erasure/suite extensions. The fresh-source qualifier passes 29 combined groups with real
local credential sessions, canonical Identity/Account, Editorial, OPA, SQL, Mongo,
MinIO and RabbitMQ. It proves frozen independent publication, exact DNS proof and
independent grant decisions, canonical revoke/release during projection lag,
claim-bound editing, transactional rollback, crash/replay, successor ownership and
withdrawal. Both configuration matrices fail with BFF stopped and no owner fallback.
The shared controlled UDP fixture uses the production DNS resolver; external DNS
propagation is substituted. Evidence: `/tmp/wappsB-application-ownership-20261018-5_ffh246/verification.json`.

Existing Editorial erasure hooks remove the old owner's grants/private provenance
before a successor acquires a new claim. This is participant compatibility, not
A28 full Account erasure completion. Local application-media bytes are exercised
only as needed for frozen publication and retained content; alpha's independent
media families remain migration work. Both API/auth comparisons use native Nginx
1.28.3; Docker-to-host transport, original frontend acceptance, public DNS/TLS and
deployment remain unqualified by this lane. Live installation stays A21.

## Remaining direct routes

All paths below start with `/api`. These are migration work under
`rules/portal-bff-boundary.md`, not architectural exceptions. Existing BFF handlers
do not establish parity until the real workflow and whole route family pass through
both gateways, including denial, failures, case/slash variants and unknown suffixes.

| Family | Local | Alpha | Caller and existing BFF support / next qualification |
| --- | --- | --- | --- |
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

### A28 erasure qualification

The [A28 journey](ACCOUNT-ERASURE-QUALIFICATION.md) qualifies existing
`DELETE /api/me`, staff `DELETE /api/admin/users/:uid` and read-only
`GET /api/admin/users/:uid/deletion-status` through both native gateway
configurations. Independent Authentication removes the verified provider subject;
Account reports completion only after its credential journal and the fixed
Account/Editorial/Discussion erasure plan complete. Denial, dependency/BFF outage,
pending/failed/completed status, replay/restart, final receipt failure,
quarantine/requeue, process crash and retained-public-content convergence are
covered. No ingress family or presentation is changed by A28. Media assertions
use owning-service/object-store evidence, not media gateway parity.

Coordinated
activation, archived-data policy, external providers, public monitoring egress,
backup/restore/soak and the original frontend merge remain separate release work.
