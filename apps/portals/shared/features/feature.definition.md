# Portals/Shared/Features - Generic Architecture

## Structure
- **Location**: `apps/portals/shared/features/{feature-name}/`
- **Type**: Nx library with `@nx/js:tsc` build

## Standard Layers
- **Application**: Business logic services implementing domain interfaces
- **Infrastructure**: Data sources (REST APIs, mocks, databases)
- **Presentation**: View models, mappers, UI directives

## Core Patterns
- **Provider Function**: `provide{Feature}Feature(config)` for DI setup
- **Interface Contracts**: Domain DTOs from `@domains/{domain}/{entity}`
- **Domain Ports**: Create provider tokens based on domain port interfaces (e.g., `ICategoriesProvider`)
- **Reactive Flow**: RxJS observables with `shareReplay` caching
- **Result Types**: `@foundation/standard` Result pattern for error handling

## Standard Exports
```typescript
export * from './application/{feature}.service';
export * from './{feature}.providers';
export * from './presentation/mappings/*';
```

## Characteristics
- **Consumable**: Easy integration with portal apps
- **Configurable**: Path-based configuration
- **Testable**: Clear layer separation
- **Domain-Aligned**: DDD principles with port-based token creation

This ensures consistency across all shared features while maintaining flexibility and proper domain boundary adherence.
