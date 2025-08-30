# Portals/Aggregator/Application/Components/Partials - Generic Architecture

## Structure
- **Location**: `apps/portals/aggregator/application/src/components/partials/{partial-name}/`
- **Type**: Angular standalone components with dedicated templates and styles

## Standard Layers
- **Presentation**: UI components, templates, and styling
- **Business Logic**: Component logic, state management, and service integration
- **Integration**: Host directives, dependency injection, and external service consumption

## Core Patterns
- **Standalone Components**: All partials use Angular standalone component architecture
- **Host Directives**: Integration with container directives for state management and routing
- **Service Injection**: Direct injection of domain services and UI utilities
- **Reactive State**: RxJS observables for reactive data flow and state management
- **Event-Driven**: Output events for parent component communication

## Standard Architecture
```typescript
@Component({
  selector: '{partial-name}',
  templateUrl: './{partial-name}.component.html',
  styleUrl: './{partial-name}.component.scss',
  standalone: true,
  hostDirectives: [
    // Container directives for state management
  ],
  imports: [
    // UI components and utilities
  ]
})
export class {PartialName}Component {
  // Service injection
  // State management
  // Event handling
}
```

## Component Categories

### Layout Partials
- **Header**: Main navigation, user authentication, and branding
- **Footer**: Secondary navigation and legal information
- **Main Menu**: Primary navigation structure

### User Interface Partials
- **User Panel**: Authenticated user controls and profile
- **Guest Panel**: Unauthenticated user options
- **Applications Panel**: Category navigation and trending tags

### Functional Partials
- **App Listing**: Main content display with infinite scroll
- **Filters Panel**: Comprehensive filtering interface
- **Filters Bar**: Compact filter controls
- **Category Multiselect**: Category selection component
- **Sorting Select**: Content ordering controls

## Standard Exports
```typescript
// Component class
export { PartialNameComponent } from './partial-name.component';

// Types and interfaces (if applicable)
export * from './models/partial-name.types';
```

## Characteristics
- **Reusable**: Designed for integration across different portal contexts
- **Configurable**: Accept input properties and emit output events
- **Testable**: Clear separation of concerns and dependency injection
- **Responsive**: Modern UI patterns with Taiga UI components
- **Accessible**: Built-in accessibility features and semantic markup

## Integration Patterns
- **Container Directives**: Use of `RouteDrivenContainerDirective`, `ItemListingContainerDirective`
- **Service Consumption**: Direct integration with domain services and UI libraries
- **State Management**: Reactive state through RxJS observables and container patterns
- **Event Communication**: Output events for parent component coordination

This ensures consistency across all partial components while maintaining flexibility and proper separation of concerns in the portal architecture.
