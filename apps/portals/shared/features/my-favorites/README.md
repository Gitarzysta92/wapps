# My Favorites Feature

This feature provides functionality for managing user favorites across different content types.

## Features

- Display user favorites organized by category (applications, suites, articles, discussions)
- Add items to favorites
- Remove items from favorites
- Check if an item is favorited
- Reactive state management with RxJS

## Components

### MyFavoritesListComponent

Displays all user favorites organized by category.

**Usage:**
```html
<my-favorites-list></my-favorites-list>
```

### MyFavoritesGridComponent

Displays favorite apps as avatars in a grid layout. Perfect for sidebars and compact spaces. This component only renders the avatar grid itself - wrap it in your own section/container for headers and titles.

**Usage:**
```html
<section class="favorites-section">
  <h3 class="section-title">
    <tui-icon icon="@tui.star"/>
    <span>Favorite Apps</span>
  </h3>
  <my-favorites-grid 
    [maxItems]="15"
    ctaRoute="/apps"
    ctaLabel="Browse Apps"
    itemRoutePrefix="/app">
  </my-favorites-grid>
</section>
```

**Inputs:**
- `maxItems` (optional): Maximum number of items to display (default: 15)
- `ctaRoute` (optional): Route for the CTA button when empty (default: '/apps')
- `ctaLabel` (optional): Label for the CTA button (default: 'Browse Apps')
- `itemRoutePrefix` (optional): Route prefix for each item (default: '/app')

**Features:**
- Pure grid component - no section wrapper or header
- 3-column grid in expanded view
- 2-column grid in collapsed view
- Avatar display with hover effects
- Empty state with CTA button
- Responsive design with `:host-context`

### FavoriteToggleButtonComponent

A button component that allows users to add/remove items from their favorites.

**Usage:**
```html
<favorite-toggle-button 
  [type]="'applications'" 
  [slug]="'my-app-slug'">
</favorite-toggle-button>
```

**Inputs:**
- `type` (required): The type of content - `'applications' | 'suites' | 'articles' | 'discussions'`
- `slug` (required): The unique identifier for the item

## Setup

Add the feature provider to your application configuration:

```typescript
import { provideMyFavoritesFeature } from '@portals/shared/features/my-favorites';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... other providers
    provideMyFavoritesFeature({
      apiBaseUrl: 'https://api.example.com'
    })
  ]
};
```

## Service

The `MyFavoritesService` provides programmatic access to favorites functionality:

```typescript
import { MyFavoritesService } from '@portals/shared/features/my-favorites';

class MyComponent {
  private favoritesService = inject(MyFavoritesService);

  addToFavorites() {
    this.favoritesService
      .addToFavorites('applications', 'my-app-slug')
      .subscribe();
  }

  removeFromFavorites() {
    this.favoritesService
      .removeFromFavorites('applications', 'my-app-slug')
      .subscribe();
  }

  checkIfFavorite() {
    this.favoritesService
      .isFavorite$('applications', 'my-app-slug')
      .subscribe(isFav => console.log(isFav));
  }
}
```

## Architecture

This feature follows a clean architecture pattern with:

- **Application Layer**: Business logic and state management
- **Infrastructure Layer**: API communication
- **Presentation Layer**: UI components

The feature uses dependency injection tokens to maintain loose coupling and testability.

