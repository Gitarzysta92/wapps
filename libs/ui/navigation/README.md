# Navigation UI Library

Simple, lightweight navigation components that encapsulate appearance using content projection.

## Components

### `NavigationListComponent`
Container component with selector `nav[navigation-list], navigation-list`

### `NavigationItemDirective`
Directive that applies navigation item styling to buttons and anchors with selector `[navigation-item]`

### `NavigationItemSkeletonComponent`
Skeleton component for loading states with selector `a[navigation-item-skeleton], button[navigation-item-skeleton]`

### `NavigationLabelDirective`
Directive that applies label styling with selector `[label]`

### `NavigationIconDirective`
Directive that applies icon container styling with selector `[icon]`

## Usage

```typescript
import { 
  NavigationListComponent, 
  NavigationItemDirective,
  NavigationItemSkeletonComponent,
  NavigationLabelDirective,
  NavigationIconDirective
} from '@ui/navigation';

@Component({
  standalone: true,
  imports: [
    NavigationListComponent, 
    NavigationItemDirective,
    NavigationItemSkeletonComponent,
    NavigationLabelDirective,
    NavigationIconDirective,
    TuiButton,
    TuiIcon,
    RouterLink,
    RouterLinkActive
  ],
  template: `
    <nav navigation-list alignment="end">
      <a navigation-item 
         tuiButton 
         appearance="ghost"
         [routerLink]="'/home'" 
         routerLinkActive="active">
        <span label>Home</span>
        <tui-icon icon [icon]="'@tui.home'"/>
      </a>
      
      <button navigation-item 
              tuiButton 
              appearance="ghost"
              [class.active]="isActive()"
              (click)="scrollTo()">
        <span label>
          Articles
          <span class="nav-count">(42)</span>
        </span>
        <tui-icon icon [icon]="'@tui.newspaper'"/>
      </button>
    </nav>
  `
})
```

## With Loading State

Use the `NavigationItemSkeletonComponent` for loading states:

```html
<nav navigation-list alignment="end">
  @if (isLoading()) {
    <!-- Show all skeleton items, first one selected -->
    <a navigation-item-skeleton [selected]="true"></a>
    @for (skeleton of [false, false]; track $index) {
      <a navigation-item-skeleton [selected]="skeleton"></a>
    }
  } @else {
    <a navigation-item 
       tuiButton 
       appearance="ghost"
       [routerLink]="HOME.path">
      <span label>{{ HOME.label }}</span>
      <tui-icon icon [icon]="HOME.icon"/>
    </a>

    @for (item of navigationItems(); track item.type) {
      <button navigation-item 
              tuiButton 
              appearance="ghost"
              [class.active]="isActive(item.type)"
              (click)="scrollToSection(item.type)">
        <span label>
          {{ item.label }}
          <span class="nav-count">({{ item.count }})</span>
        </span>
        <tui-icon icon [icon]="item.icon"/>
      </button>
    }
  }
</nav>
```

### Skeleton Options

The skeleton component accepts the following inputs:
- `[label]` - Show label skeleton (default: `true`)
- `[icon]` - Show icon skeleton (default: `true`)
- `[selected]` - Apply selected/active styling (default: `false`)

```html
<!-- Full skeleton with selected state -->
<a navigation-item-skeleton [selected]="true"></a>

<!-- Skeleton with only label -->
<a navigation-item-skeleton [icon]="false"></a>

<!-- Skeleton with only icon -->
<a navigation-item-skeleton [label]="false"></a>
```

## Alignment

```html
<nav navigation-list alignment="end">
  <!-- Right-aligned with icon on right (default) -->
</nav>

<nav navigation-list alignment="start">
  <!-- Left-aligned with icon on left -->
</nav>
```

## Structure

You can use either class-based or directive-based markup:

```html
<!-- Directive-based (recommended) -->
<a navigation-item>
  <span label>
    Label text
    <span class="nav-count">(count)</span>
  </span>
  <tui-icon icon [icon]="'...'"/>
</a>

<!-- Class-based (legacy) -->
<a navigation-item>
  <span class="nav-label">
    Label text
    <span class="nav-count">(count)</span>
  </span>
  <div class="nav-icon">
    <tui-icon icon="..."/>
  </div>
</a>
```

### CSS Classes

- `.nav-label` - Container for label text
- `.nav-count` - Optional count badge (inside nav-label)
- `.nav-icon` - Container for icon
- `.nav-item--skeleton` - Apply to skeleton items
- `.active` - Active state

## Styling

CSS custom properties:
- `--tui-text-primary` - Text color
- `--tui-background-accent-1` - Hover and active background
