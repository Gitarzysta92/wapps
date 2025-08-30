# Domains - Generic Architecture

## Structure
- **Location**: `libs/domains/{domain}/{entity}/` or `libs/domains/{domain}/`

## Domain Organization Patterns

### **Hierarchical Domains**
- **Domain**: `{domain}/`
  - **Subdomain**: `{subdomain}/`
    - **Entity**: `{entity}/`
      - **Application**: `application/`
        - **Ports**: `ports/` - Interface contracts
        - **Models**: `models/` - DTOs and domain models

### **Flat Domains**
- **Domain**: `{domain}/`
  - **Entity**: `{entity}/`
    - **Application**: `application/`
      - **Ports**: Provider interfaces
      - **Models**: DTOs


## Standard Layers

### **Application Layer** (`src/application/`)
- **Ports**: Interface contracts defining external dependencies
- **Models**: DTOs, domain entities, and value objects
- **Services**: Core domain logic (when applicable)

## Core Patterns

### **Port-Based Architecture**
- **Interface Contracts**: Define external service contracts
- **Port Naming**: `{feature}-{type}.port.ts`

### **Data Models**
- **DTOs**: Data Transfer Objects with clear structure
- **Domain Entities**: Business objects with identity
- **Value Objects**: Immutable objects without identity

### **Reactive Contracts**
- **Observables**: RxJS-based reactive data contracts
- **Result Types**: `@standard` Result pattern for error handling
- **Async Operations**: All external interactions are asynchronous

## Standard Exports

### **Feature-Based Domains**
```typescript
export * from './application/ports/{feature}-{type}.port';
export * from './application/models/{model}.dto';
```

## Characteristics
- **Pure Domain**: No infrastructure or presentation concerns
- **Port-Based**: Defines contracts for external implementations
- **Reusable**: Shared across multiple features and applications
- **Type-Safe**: Strong typing for domain entities and operations
- **Hierarchical**: Supports nested domain organization
- **Flexible**: Adapts structure based on domain complexity

This ensures clean domain boundaries, provides reusable contracts for feature implementations, and supports both simple and complex domain organizations.
