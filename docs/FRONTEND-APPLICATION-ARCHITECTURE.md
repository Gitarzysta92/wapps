# Frontend Application Architecture Handbook

## Purpose

This document describes the frontend application architecture used by the `aggregator` portal and turns it into a reusable blueprint for future Angular applications in this workspace.

The goal is not to freeze the current implementation forever. The goal is to name the important building blocks, explain why they exist, and give developers a shared language for adding new applications, pages, features, and UI without mixing concerns.

The reference implementation is primarily:

- `apps/portals/aggregator/entrypoints/csr`
- `apps/portals/aggregator/application`
- `apps/portals/shared/features`
- `apps/portals/shared/boundary`
- `libs/domains`
- `libs/foundation`
- `libs/ui`
- `libs/infrastructure`
- `libs/cross-cutting`

The most important principles are:

- Depend on abstractions, not concrete implementations.
- Keep pages as high-level orchestration layers.
- Keep feature behavior behind provider functions, services, ports, and adapters.
- Keep reusable UI generic and presentation-focused.
- Keep application entrypoints thin.
- Let routes describe application composition.

## Mental Model

The frontend architecture is built around a route-driven shell application.

At a high level:

```text
entrypoints/csr
  -> application
    -> app config
    -> root providers
    -> routes
    -> shell
    -> pages
    -> partials
    -> shared features
      -> application services
      -> ports / provider tokens
      -> infrastructure adapters
      -> presentation components
    -> domains
    -> foundation
    -> ui
```

The entrypoint starts the app. The application library composes the app. The routes decide which page and shell chrome should be active. Pages coordinate feature/UI composition. Shared features provide behavior. Domains provide business vocabulary. UI libraries provide reusable presentation.

This means a new Angular app should not be a pile of pages importing random services. It should be a small composition root around reusable feature, domain, foundation, and UI building blocks.

## Main Architectural Rule

Pages are the main orchestration layer for features and UI.

A page is allowed to know which features and UI pieces should appear together. It may connect route params, view state, feature services, and local presentation. It should contain high-level glue code only.

A page should not become the place where business rules, HTTP details, persistence, authorization internals, or reusable algorithms live.

Good page responsibilities:

- Read route params or query params.
- Select the feature/service calls needed for this screen.
- Compose shared feature containers and UI components.
- Prepare view-model-level data for the template.
- Connect user interactions to feature services.
- Coordinate screen-level loading, empty, and error states.

Bad page responsibilities:

- Building raw HTTP URLs for domain behavior.
- Choosing low-level infrastructure classes directly.
- Reimplementing feature rules already owned by a shared feature.
- Performing reusable mapping logic that belongs in a feature mapper.
- Owning shell layout behavior that belongs to route data or partials.
- Acting as global state storage for unrelated features.

The page should read like a table of contents for the screen, not like the implementation of the whole product area.

## Dependency Inversion

Dependency inversion is a core architectural rule in this codebase.

High-level code should not depend directly on low-level details. Instead, high-level code depends on ports, provider tokens, and application services. Low-level infrastructure implements those ports.

In Angular terms, this usually means:

```text
component/page
  -> application service
  -> injection token / port interface
  -> infrastructure adapter
```

Example pattern from listing:

```text
AppListingService
  -> APP_LISTING_PROVIDER
  -> IAppListingProvider
  -> AppListingBffApiService or AppListingApiService
```

The host app chooses the implementation through a provider function:

```text
provideListingFeature({ useBff: true })
```

This gives us several benefits:

- Pages do not know whether data comes from a BFF, direct API, mock, cache, or memory adapter.
- Feature behavior can be tested by replacing the provider token.
- New applications can reuse the same feature while choosing different infrastructure.
- Infrastructure can change without rewriting UI composition.
- Domain contracts remain more stable than implementation details.

If a page imports `SomeBffApiService` directly, dependency inversion has probably been broken. The page should usually import `SomeFeatureService` or use a feature-provided presentation component instead.

Angular provider tokens are an application/feature integration mechanism. They should live in Angular-aware layers such as `apps/portals/<app>/application`, `apps/portals/shared/features`, or narrowly scoped boundary packages. They should not live in `libs/domains`.

## Workspace Layers

### Entrypoints

Example:

`apps/portals/aggregator/entrypoints/csr`

Entrypoints are runtime wrappers. They know how to bootstrap and package an application for a specific environment or rendering mode.

They may contain:

- `main.ts`
- `index.html`
- runtime styles/assets
- Docker/nginx/k8s deployment files
- Nx project configuration

They should not contain:

- product logic
- route definitions
- feature providers
- domain behavior
- page composition

The CSR entrypoint should stay thin:

```text
bootstrapApplication(AppRootComponent, mergeApplicationConfig(...))
```

### Application Library

Example:

`apps/portals/aggregator/application`

The application library is the real frontend application. It owns application-level composition.

It typically exports:

- `AppRootComponent`
- `routes`
- `createAppConfig`
- `APPLICATION_ROOT`

Recommended structure:

```text
apps/portals/my-app/application/src/
  app-config.ts
  app-root.component.ts
  root.ts
  routes.ts
  navigation.ts
  environment.ts
  shells/
  pages/
  partials/
  resolvers/
  state/
  utils/
```

### Shared Portal Features

Example:

`apps/portals/shared/features/listing`

Shared features are reusable frontend feature slices. They should be reusable across multiple portal applications.

Recommended structure:

```text
apps/portals/shared/features/my-feature/src/
  my-feature.providers.ts
  application/
    my-feature.service.ts
    my-feature-provider.port.ts
    my-feature-state.ts
    models/
  infrastructure/
    my-feature-api.service.ts
    my-feature-bff-api.service.ts
  presentation/
    components/
    directives/
    mappings/
  index.ts
```

Shared features are where most reusable product behavior belongs.

### Shared Boundaries

Example:

`apps/portals/shared/boundary`

Boundary libraries contain thin cross-application contracts and utilities. They are not full features.

Current examples include:

- navigation DTOs
- breadcrumb route data
- route path builders
- resolver typing helpers
- HTTP base URL tokens

### Domains

Example:

`libs/domains/catalog/tags`

Domain libraries hold business vocabulary.

They may contain:

- DTOs
- query DTOs
- domain enums
- provider interfaces
- repository/provider ports
- pure TypeScript contracts

They should not contain:

- page composition
- shell layout
- Angular `InjectionToken`
- Angular dependency injection providers
- Angular components
- Angular services
- frontend-specific display decisions
- app-specific routing

Domain libraries must be framework-agnostic. If a domain package imports `@angular/core` or exposes an Angular `InjectionToken`, that is an architectural mistake, not an accepted convention.

The correct split is:

```text
libs/domains/<bounded-context>
  -> pure DTOs, enums, interfaces, ports

apps/portals/shared/features/<feature>/src/application
  -> Angular InjectionToken for a domain port

apps/portals/shared/features/<feature>/src/infrastructure
  -> concrete adapter implementing the port
```

If an existing domain token is found, migrate it out of `libs/domains` into the feature/application layer that performs the Angular DI binding. Keep the domain interface in `libs/domains`; move only the Angular token/provider concern.

### Foundation

Example:

`libs/foundation/standard`

Foundation libraries provide generic reusable primitives and kernel abstractions.

Examples:

- `Result`
- `ok`
- `err`
- provider state types
- primitive queues
- generic workflow/content/authority concepts

Foundation should not depend on domains or portal applications.

### UI

Example:

`libs/ui/filters`

UI libraries provide reusable presentation building blocks.

They may contain:

- components
- directives
- pipes
- generic view models
- styling
- low-level interaction behavior

They should not contain:

- app-specific routing
- BFF/API integration
- domain orchestration
- application services
- portal-specific shell decisions

Generic UI should receive data through inputs and emit events. It should not decide where product data comes from.

### Infrastructure

Example:

`libs/infrastructure/mongo`

Workspace infrastructure libraries are mostly technology adapters, especially for backend/service use. Aggregator-demo frontend does not directly rely on these packages.

Frontend feature infrastructure usually lives inside:

```text
apps/portals/shared/features/<feature>/src/infrastructure
```

That distinction matters. Frontend infrastructure adapters are part of a frontend feature. Backend infrastructure packages are shared service-side technology adapters.

### Cross-Cutting

Example:

`libs/cross-cutting/events`

Cross-cutting libraries hold workspace-wide technical concerns. They should be used sparingly and intentionally. If something is actually a feature, it should not be placed here.

## Building Blocks

### Entrypoint

Runtime bootstrap package.

Responsibilities:

- start Angular
- provide runtime packaging
- include runtime assets/configuration

Does not own product architecture.

### Application Config

Example:

`createAppConfig`

Responsibilities:

- router setup
- HTTP client setup
- animation providers
- external UI framework setup
- global Angular framework options

This is framework configuration, not product feature composition.

### Application Root

Example:

`APPLICATION_ROOT`

Responsibilities:

- register shared feature providers
- provide global app services
- configure feature options
- connect app-level tokens to implementations

This is where the app says: "these are the features available in this application."

### Root Component

Example:

`AppRootComponent`

Responsibilities:

- host root `router-outlet`
- host named outlets such as dialogs
- install root host directives
- provide root-level visual/theming concerns

It should stay mostly structural.

### Routes

Example:

`routes.ts`

Routes are a central orchestration layer in this architecture.

They select:

- page components
- lazy-loaded components
- guards
- route-level providers
- shell partials
- breadcrumbs
- footer/header/sidebar/bottom-bar composition
- dialog routing
- custom matchers

This route file is important architecture, not incidental configuration.

### Shell

Example:

`AppShellComponent`

The shell owns layout regions and renders route-selected partials.

Typical shell regions:

- top bar
- header
- left sidebar
- right sidebar
- main content
- footer
- bottom bar

The shell reads route data and route params, then builds dynamic component inputs for partials.

### Route Data Contract

Example:

`IAppShellRouteData`

This contract describes what shell regions a route can configure.

Route data should not be an arbitrary untyped bag. It is an application composition API.

### Page

A routed screen-level component.

Pages are high-level orchestrators.

They may compose:

- feature services
- feature presentation components
- UI components
- local state
- route params
- page-specific view models

They should avoid:

- direct low-level API implementations
- reusable business logic
- generic formatting/mapping logic that belongs in a feature
- shell layout state that belongs in shell/route data

### Partial

Examples:

- `HeaderPartialComponent`
- `FooterPartialComponent`
- `CommonSidebarComponent`
- `UserAuxiliarySidebarComponent`
- `ApplicationCommonSidebarComponent`
- `CommonMobileBottomBarPartialComponent`

Partials are reusable portal chrome, often selected by route data and rendered by the shell.

They are more application-aware than generic `libs/ui` components, but less page-specific than a page.

### Resolver

Examples:

- `sidebarResolver`
- `navigationResolver`
- `breadcrumbResolver`
- `profileAvatarResolver`

Resolvers are route-time glue.

They are useful when shell data depends on route params, feature state, or async data.

Resolvers should prepare data for composition. They should not become feature services.

### Feature Provider

Examples:

- `provideListingFeature`
- `provideIdentityLoginFeature`
- `provideApplicationOverviewFeature`
- `provideTagsFeature`
- `provideCategoryFeature`

Feature providers are the public composition API of a shared feature.

They register:

- application services
- provider tokens
- infrastructure adapter implementations
- config values
- validation messages
- feature-specific state/providers

This is one of the main places where dependency inversion is enforced.

### Application Service

Example:

`AppListingService`

Application services expose use-case-level operations to pages and presentation components.

They should depend on ports/tokens, not concrete infrastructure classes.

### Port / Provider Token

Example:

`APP_LISTING_PROVIDER`

A port describes what a feature needs from the outside world. The token lets Angular inject the selected implementation.

Ports are a key mechanism for dependency inversion.

Keep the distinction strict:

- A domain port is a pure TypeScript interface and may live in `libs/domains`.
- An Angular provider token is a DI mechanism and should live in an Angular-aware application, feature, or boundary layer.
- A concrete adapter implements the port and is selected by a provider function.

### Infrastructure Adapter

Examples:

- `AppListingBffApiService`
- `AppListingApiService`
- `BffAuthenticationService`
- `AuthenticationApiService`

Adapters implement ports. They know about HTTP, BFF endpoints, mocks, storage, or external implementation details.

Pages should almost never inject these directly.

### Domain DTO / Domain Port

Domain DTOs and ports define business vocabulary independent from one specific page.

Examples:

- profile DTOs
- catalog DTOs
- identity authentication contracts
- discovery result DTOs

Domain DTOs and ports must remain free of Angular concepts. They should be usable from frontend, backend, tests, scripts, or another framework without pulling Angular into the dependency graph.

### UI Component

Reusable presentation component.

UI components should be easy to reuse in different features or apps because they do not own application-specific decisions.

## Dependency Direction

The intended dependency direction is:

```text
apps/portals/<app>/entrypoints
  -> apps/portals/<app>/application

apps/portals/<app>/application
  -> apps/portals/shared/features
  -> apps/portals/shared/boundary
  -> apps/portals/shared/data
  -> apps/portals/shared/cross-cutting
  -> libs/domains
  -> libs/foundation
  -> libs/ui

apps/portals/shared/features
  -> libs/domains
  -> libs/foundation
  -> libs/ui

libs/domains
  -> libs/foundation

libs/ui
  -> Angular / Taiga / generic presentation dependencies
```

The direction should feel boring. Higher-level code composes lower-level abstractions. Lower-level packages do not reach back into apps.

## Forbidden Or Suspicious Dependencies

Treat these as architecture smells:

- `libs/ui` importing from `apps/portals/*`.
- `libs/ui` importing domain services or app feature services.
- `libs/domains` importing `@angular/core`.
- `libs/domains` importing app pages, UI components, or portal routes.
- `libs/domains` exporting Angular `InjectionToken` values.
- Entrypoints importing feature internals.
- Pages injecting concrete BFF/API adapters directly.
- Shared feature infrastructure importing app-specific routes/components.
- Generic features importing `aggregator` implementation details.
- Components deep-importing internal files instead of public barrels.

Some exceptions may be practical during migration, but they should be explicit and temporary.

## Routing As Application Composition

In this architecture, routes are not only URL mappings.

Routes compose the screen.

A route may define:

- the page component
- breadcrumb entries
- shell sidebars
- bottom bar
- footer
- header
- route-level providers
- auth requirements
- dialog outlets
- dynamic resolvers

Example shape:

```text
{
  path: NAVIGATION.somePage.path,
  loadComponent: () => import('./pages/some-page/some-page.component')
    .then(m => m.SomePageComponent),
  resolve: {
    leftSidebar: sidebarResolver(...)
  },
  data: {
    breadcrumb: [...],
    rightSidebar: {
      component: UserAuxiliarySidebarComponent,
      inputs: {...}
    },
    footer: {
      component: FooterPartialComponent,
      inputs: {...}
    }
  }
}
```

This convention keeps shell composition declarative and close to navigation structure.

## Shell Composition Rules

The shell owns layout. Pages own content. Routes decide which shell parts appear.

Do:

- Put layout region selection in route data.
- Keep sidebars, footer, header, and bottom bar as partials.
- Use resolvers when shell inputs depend on route params or resolved data.
- Keep shell state behind a shell state provider token.

Avoid:

- Pages manually showing/hiding global sidebars.
- Partials reaching into route internals when route data can pass inputs.
- Shell knowing about every concrete page.
- Duplicating shell layout inside pages.

## Page Orchestration Rules

Pages are the best place for high-level glue code.

Good:

```text
Page
  -> read route params
  -> call feature service
  -> select presentation components
  -> expose view model
  -> handle page-level events
```

Bad:

```text
Page
  -> build HTTP request
  -> parse backend-specific response shape
  -> implement domain rule
  -> store global state for unrelated feature
  -> directly instantiate infrastructure adapter
```

A page should answer:

- What is this screen?
- Which feature capabilities does it use?
- Which UI blocks does it compose?
- How do route params affect the screen?

A page should not answer:

- How does authentication persist tokens?
- Which URL does the listing BFF expose?
- How does a catalog record map from backend storage?
- How do all apps globally manage shell state?

## Feature Implementation Pattern

A reusable feature should usually follow this pattern:

```text
feature.providers.ts
  -> public setup function

application/
  -> feature service
  -> ports
  -> provider tokens
  -> feature models/state

infrastructure/
  -> HTTP/BFF/mock/storage adapters

presentation/
  -> feature-specific components/directives
  -> view models
  -> mappings
```

### Provider Function

The provider function is the feature's public setup API.

Example:

```text
provideListingFeature({ useBff: true })
```

It should hide implementation selection from pages.

### Application Service

The application service is what pages and feature containers normally consume.

It should expose behavior in feature language, not infrastructure language.

### Port

The port describes what the feature needs.

Example:

```text
IAppListingProvider
```

### Adapter

The adapter implements the port.

Example:

```text
AppListingBffApiService
```

Adapters are replaceable. That is the point.

## Data Access Rules

Data access belongs behind feature ports and infrastructure adapters.

Use this flow:

```text
page/component
  -> feature application service
  -> provider token / port
  -> infrastructure adapter
  -> HTTP/BFF/mock/storage
```

Avoid this flow:

```text
page/component
  -> HTTP client
  -> hardcoded endpoint
```

Direct HTTP in a page is acceptable only for short-lived prototypes or highly local experiments. If the behavior is product behavior, promote it into a feature.

## BFF And Mock Switching

Several features support implementation switching through provider options:

```text
provideListingFeature({ useBff: true })
provideTagsFeature({ useBff: true })
provideCategoryFeature({ useBff: true })
provideApplicationOverviewFeature({ useBff: true })
```

This is a good convention.

Apps should choose the adapter. Pages should not care.

## Navigation And URL Rules

Navigation vocabulary should be centralized.

Use:

- `NAVIGATION`
- route param constants
- navigation arrays
- breadcrumb data
- route path builders

Avoid:

- hardcoded duplicate paths inside pages
- repeated breadcrumb literals without reason
- ad hoc string replacement for route params
- feature components that assume one concrete app URL structure

Navigation declarations are shared language between routes, shell partials, breadcrumbs, and menus.

## State Management Rules

Use the smallest state scope that fits.

### Shell State

Shell state is for layout/application coordination.

Examples:

- sidebar expanded/collapsed
- user panel open/closed
- shell-level loading indicator
- current theme

### Page State

Page state is for one routed screen.

Examples:

- active tab
- current section
- page-local loading state
- selected local filter

### Feature State

Feature state belongs with the feature when multiple pages/components need the same behavior.

Examples:

- authenticated identity state
- profile state
- listing state
- preferences state

### Avoid Global State Creep

Do not put data into a global service just because it is convenient.

Global state should be rare. Most state should live in a page, feature, or shell-specific provider.

## Presentation Rules

Use the right presentation layer:

```text
Page component
  -> routed screen composition

Partial component
  -> portal chrome selected by shell/route data

Feature presentation component
  -> reusable feature-specific UI

libs/ui component
  -> generic reusable UI
```

When a component becomes reusable across apps and does not need app-specific behavior, move it toward `libs/ui`.

When a component is reusable only inside portal features and has feature semantics, keep it in `apps/portals/shared/features/<feature>/presentation`.

When a component is app chrome, keep it in app `partials`.

## Theming And Layout

Global theming is configured at root level.

The application root may provide:

- theme provider token
- theme config token
- visual viewport/platform host directives
- global UI framework overlays/dialog hosts

Component styling should remain local unless it is genuinely global application styling.

Use app-level styles for:

- theme setup
- global layout baseline
- imported framework styles
- design-system-level overrides

Use component styles for:

- component layout
- component variants
- local visual behavior

## Naming Conventions

Use predictable names. Developers should be able to guess where something lives.

Recommended names:

- `provideXFeature`
- `XService`
- `XProvider`
- `IXProvider`
- `X_PROVIDER`
- `XApiService`
- `XBffApiService`
- `XStorage`
- `XResolver`
- `XPageComponent`
- `XPartialComponent`
- `XDto`
- `XVm`
- `XQueryDto`
- `XStateService`

Prefer names that describe architectural role, not only implementation detail.

## Import Conventions

Prefer public aliases and barrels:

```text
@portals/shared/features/listing
@portals/shared/boundary/navigation
@domains/catalog/tags
@foundation/standard
@ui/filters
```

Avoid deep imports into another library's internal folders unless there is no public API yet and the dependency is intentional.

If developers repeatedly need a deep import, the target library probably needs a better `index.ts`.

## Testing Expectations

Architecture should make testing easier.

Recommended approach:

- Test application services by replacing provider tokens.
- Test infrastructure adapters separately from presentation.
- Test feature presentation with mocked feature services.
- Test pages as composition points, not as full backend simulations.
- Review routes carefully because route data is orchestration logic.
- Test custom matchers and resolvers when route behavior is non-trivial.

Dependency inversion should reduce test friction. If testing a page requires real HTTP or real backend configuration, the page probably depends on too much.

## Decision Guide

Use this when deciding where code belongs.

### I need a new routed screen

Put it in:

```text
apps/portals/<app>/application/src/pages
```

Wire it in `routes.ts`.

### I need reusable app chrome

Put it in:

```text
apps/portals/<app>/application/src/partials
```

Select it through route data.

### I need app-wide feature setup

Put it in:

```text
apps/portals/<app>/application/src/root.ts
```

Use shared feature provider functions.

### I need reusable portal feature behavior

Put it in:

```text
apps/portals/shared/features/<feature>
```

Use provider functions, application services, ports, and adapters.

### I need pure reusable UI

Put it in:

```text
libs/ui/<area>
```

Keep it presentation-focused.

### I need a business DTO or provider contract

Put it in:

```text
libs/domains/<bounded-context>
```

Only put the pure TypeScript contract there. If Angular DI is needed, place the `InjectionToken` in the consuming feature/application layer.

### I need a generic primitive or result type

Put it in:

```text
libs/foundation
```

### I need HTTP/BFF integration for a frontend feature

Put it in:

```text
apps/portals/shared/features/<feature>/src/infrastructure
```

Expose it through a port and provider function.

### I need route-aware app layout composition

Put it in:

```text
routes.ts
```

Use `IAppShellRouteData`, partials, and resolvers.

## Anti-Patterns

Avoid these:

- Putting HTTP logic directly in pages.
- Making pages implement reusable business rules.
- Letting a page become a feature service.
- Letting route data become an untyped dumping ground.
- Putting all state into one global state service.
- Making shell partials know too much about concrete pages.
- Making generic UI depend on app-specific services.
- Making domain libraries aware of frontend routing.
- Duplicating provider setup in many places.
- Importing concrete infrastructure where a token/port exists.
- Deep-importing implementation files across library boundaries.
- Adding new shared features without a clear provider API.

## Blueprint For A New Angular Portal App

Start with this structure:

```text
apps/portals/my-app/
  entrypoints/
    csr/
      src/main.ts
      src/index.html
      src/styles.scss
      project.json
      Dockerfile
      nginx.conf
  application/
    src/
      app-config.ts
      app-root.component.ts
      root.ts
      routes.ts
      navigation.ts
      environment.ts
      shells/
        app-shell/
      pages/
      partials/
      resolvers/
      state/
      index.ts
```

Then follow this order:

1. Create the thin CSR entrypoint.
2. Create the application library public API.
3. Add `createAppConfig`.
4. Add `APPLICATION_ROOT`.
5. Add root component and shell.
6. Define navigation vocabulary.
7. Define routes as the screen composition layer.
8. Register shared feature providers.
9. Add pages as lazy standalone components.
10. Add partials for route-selected chrome.
11. Push reusable behavior into shared features.
12. Push business vocabulary into domains.
13. Push generic presentation into `libs/ui`.
14. Verify dependency direction.

## Review Checklist

Before merging a new app, page, or feature, ask:

- Is the entrypoint thin?
- Is app composition in the application library?
- Are pages only doing high-level glue?
- Are feature rules behind feature services?
- Are infrastructure details behind ports/tokens?
- Are concrete adapters selected by provider functions?
- Are route data and shell partials used for layout composition?
- Is reusable UI in `libs/ui` or feature presentation?
- Is business vocabulary in `libs/domains`?
- Is global state really global?
- Are imports using public barrels?
- Does dependency direction still flow downward?

If the answer is unclear, pause and name the missing abstraction. Most architecture drift starts when unnamed glue code silently becomes business logic.
