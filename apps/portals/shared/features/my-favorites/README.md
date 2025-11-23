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

A presentational component that displays favorite apps as avatars in a grid layout. Perfect for sidebars and compact spaces. This component follows the container/presentational pattern - it receives data via a view model and uses content projection for the empty state CTA.

**View Model Interface:**
```typescript
export interface FavoriteAppItem {
  slug: string;          // Unique identifier
  path: string;          // Route path for the item
  avatarUrl?: string;    // Optional custom avatar URL
  title?: string;        // Optional title for accessibility
}

export interface MyFavoritesGridViewModel {
  items: FavoriteAppItem[];
  hasItems: boolean;
}
```

**Usage:**
```typescript
// In your container component
import { MyFavoritesGridViewModel, MY_FAVORITES_STATE_PROVIDER } from '@portals/shared/features/my-favorites';

export class MyContainerComponent {
  private favoritesProvider = inject(MY_FAVORITES_STATE_PROVIDER);
  
  public favoritesVm$ = this.favoritesProvider.myFavorites$.pipe(
    map(state => ({
      items: state.data.applications.map(slug => ({
        slug,
        path: `/app/${slug}`,
        title: slug,
        avatarUrl: `https://api.dicebear.com/7.x/shapes/svg?seed=${slug}`
      })),
      hasItems: state.data.applications.length > 0
    } as MyFavoritesGridViewModel))
  );
}
```

```html
<!-- In your template -->
<section class="favorites-section">
  <h3 class="section-title">
    <tui-icon icon="@tui.star"/>
    <span>Favorite Apps</span>
  </h3>
  
  @let vm = favoritesVm$ | async;
  @if (vm) {
    <my-favorites-grid [vm]="vm" [maxItems]="15">
      <div empty-state>
        <tui-icon icon="@tui.star" [style.height.rem]="2"/>
        <p>No favorite apps yet</p>
        <a [routerLink]="['/apps']" tuiButton>Browse Apps</a>
      </div>
    </my-favorites-grid>
  }
</section>
```

**Inputs:**
- `vm` (required): View model containing the items and state
- `maxItems` (optional): Maximum number of items to display (default: 15)

**Content Projection:**
- `[empty-state]`: Content to display when there are no items

**Features:**
- Pure presentational component - no direct provider dependencies
- View model pattern for clean data flow
- Content projection for flexible empty state CTA
- 3-column grid layout with centered avatars
- Avatar display with hover effects
- Responsive design

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

