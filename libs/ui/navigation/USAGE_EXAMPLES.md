# Usage Examples for SidebarNavigationComponent

## Example 1: Search Results Sidebar (Original Use Case)

This example shows how to refactor the existing `search-results-sidebar` component to use the generic `SidebarNavigationComponent`.

### Before (search-results-sidebar.component.html)

```html
<nav class="sidebar-nav">
  @if (isLoading()) {
    @for (skeleton of [1, 2, 3]; track skeleton) {
      <div class="nav-item nav-item--skeleton" aria-hidden="true">
        <span class="nav-label" [tuiSkeleton]="true"></span>
        <div class="nav-icon" [tuiSkeleton]="true"></div>
      </div>
    }
  } @else {
    <a class="nav-item" tuiButton appearance="ghost" [routerLink]="HOME.path">
      <span class="nav-label">{{ HOME.label }}</span>
      <div class="nav-icon">
        <tui-icon [icon]="HOME.icon"/>
      </div>
    </a>

    @for (item of navigationItems(); track item.type) {
      <button class="nav-item" tuiButton appearance="ghost" 
              [class.active]="isActive(item.type)"
              (click)="scrollToSection(item.type)">
        <span class="nav-label">
          {{ item.label }}
          <span class="nav-count">({{ item.count }})</span>
        </span>
        <div class="nav-icon">
          <tui-icon [icon]="item.icon"/>
        </div>
      </button>
    }
  }
</nav>
```

### After (Using SidebarNavigationComponent)

**Template:**
```html
<ui-sidebar-navigation 
  [config]="navConfig()"
  (itemClicked)="onNavigationItemClick($event)" />
```

**Component:**
```typescript
import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { 
  SidebarNavigationComponent,
  SidebarNavigationConfig,
  SidebarNavigationItem,
  SidebarNavigationItemType
} from '@ui/navigation';
import { NAVIGATION } from '../../navigation';
import { GlobalStateService } from '../../state/global-state.service';

@Component({
  selector: 'search-results-sidebar',
  templateUrl: './search-results-sidebar.component.html',
  styleUrl: './search-results-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [SidebarNavigationComponent]
})
export class SearchResultsSidebarComponent {
  private readonly globalState = inject(GlobalStateService);
  private readonly HOME = NAVIGATION.home;
  
  protected readonly activeSection = toSignal(
    this.globalState.activeSection$, 
    { initialValue: null }
  );
  
  protected readonly resultsData = toSignal(
    this.globalState.searchResultsData$, 
    { initialValue: { itemsNumber: 0, groups: [], query: {}, isLoading: true } }
  );

  // Map of type to icon
  private readonly iconMap: Record<DiscoverySearchResultType, string> = {
    [DiscoverySearchResultType.Suite]: '@tui.briefcase-business',
    [DiscoverySearchResultType.Application]: '@tui.layout-grid',
    [DiscoverySearchResultType.Article]: '@tui.newspaper'
  };

  // Map of type to label
  private readonly labelMap: Record<DiscoverySearchResultType, string> = {
    [DiscoverySearchResultType.Suite]: 'Suites',
    [DiscoverySearchResultType.Application]: 'Applications',
    [DiscoverySearchResultType.Article]: 'Articles'
  };

  // Navigation configuration using computed signal
  protected readonly navConfig = computed<SidebarNavigationConfig>(() => {
    const data = this.resultsData();
    
    if (!data || data.isLoading) {
      return {
        items: [],
        isLoading: true,
        skeletonCount: 3,
        alignment: 'end'
      };
    }

    // Build navigation items
    const items: SidebarNavigationItem[] = [
      // Home link
      {
        id: 'home',
        label: this.HOME.label,
        icon: this.HOME.icon,
        type: SidebarNavigationItemType.Link,
        path: this.HOME.path,
        title: this.HOME.label
      },
      // Dynamic result type sections
      ...data.groups.map((group: DiscoverySearchResultGroupDto) => ({
        id: group.type,
        label: this.labelMap[group.type] || group.type,
        icon: this.iconMap[group.type] || '@tui.file',
        type: SidebarNavigationItemType.Button,
        count: group.entries.length,
        value: group.type,
        active: this.activeSection() === group.type
      }))
    ];

    return {
      items,
      isLoading: false,
      alignment: 'end'
    };
  });

  public onNavigationItemClick(item: SidebarNavigationItem): void {
    if (item.value) {
      this.scrollToSection(item.value as DiscoverySearchResultType);
    }
  }

  private scrollToSection(type: DiscoverySearchResultType): void {
    const element = document.getElementById(type);
    if (element) {
      const yOffset = -80;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }
}
```

## Example 2: User Profile Sidebar

```typescript
@Component({
  selector: 'user-profile-sidebar',
  standalone: true,
  imports: [SidebarNavigationComponent],
  template: `
    <ui-sidebar-navigation 
      [config]="navConfig"
      (itemClicked)="onSectionClick($event)" />
  `
})
export class UserProfileSidebarComponent {
  navConfig: SidebarNavigationConfig = {
    items: [
      {
        id: 'profile',
        label: 'My Profile',
        icon: '@tui.user',
        type: SidebarNavigationItemType.Link,
        path: '/profile'
      },
      {
        id: 'favorites',
        label: 'Favorites',
        icon: '@tui.heart',
        type: SidebarNavigationItemType.Link,
        path: '/profile/favorites',
        count: 24
      },
      {
        id: 'discussions',
        label: 'My Discussions',
        icon: '@tui.message-circle',
        type: SidebarNavigationItemType.Link,
        path: '/profile/discussions',
        count: 8
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: '@tui.settings',
        type: SidebarNavigationItemType.Link,
        path: '/profile/settings'
      }
    ],
    alignment: 'start'
  };
}
```

## Example 3: Admin Dashboard Navigation

```typescript
@Component({
  selector: 'admin-nav',
  standalone: true,
  imports: [SidebarNavigationComponent],
  template: `
    <ui-sidebar-navigation [config]="navConfig()" />
  `
})
export class AdminNavigationComponent {
  private readonly notificationCount = signal(5);
  private readonly pendingApprovals = signal(12);

  navConfig = computed<SidebarNavigationConfig>(() => ({
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: '@tui.layout-dashboard',
        type: SidebarNavigationItemType.Link,
        path: '/admin/dashboard',
        exactMatch: true
      },
      {
        id: 'users',
        label: 'Users',
        icon: '@tui.users',
        type: SidebarNavigationItemType.Link,
        path: '/admin/users'
      },
      {
        id: 'notifications',
        label: 'Notifications',
        icon: '@tui.bell',
        type: SidebarNavigationItemType.Link,
        path: '/admin/notifications',
        count: this.notificationCount()
      },
      {
        id: 'approvals',
        label: 'Approvals',
        icon: '@tui.check-circle',
        type: SidebarNavigationItemType.Link,
        path: '/admin/approvals',
        count: this.pendingApprovals()
      }
    ],
    alignment: 'start'
  }));
}
```

## Example 4: Loading State

```typescript
@Component({
  selector: 'dynamic-nav',
  standalone: true,
  imports: [SidebarNavigationComponent],
  template: `
    <ui-sidebar-navigation [config]="navConfig()" />
  `
})
export class DynamicNavigationComponent {
  private readonly dataService = inject(DataService);
  private readonly items = toSignal(this.dataService.getNavigationItems(), {
    initialValue: null
  });

  navConfig = computed<SidebarNavigationConfig>(() => {
    const items = this.items();
    
    if (!items) {
      return {
        items: [],
        isLoading: true,
        skeletonCount: 5
      };
    }

    return {
      items: items.map(item => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        type: SidebarNavigationItemType.Link,
        path: item.path,
        count: item.count
      })),
      isLoading: false,
      alignment: 'start'
    };
  });
}
```

## Example 5: Mixed Link and Button Navigation

```typescript
@Component({
  selector: 'content-sidebar',
  standalone: true,
  imports: [SidebarNavigationComponent],
  template: `
    <ui-sidebar-navigation 
      [config]="navConfig"
      (itemClicked)="handleAction($event)" />
  `
})
export class ContentSidebarComponent {
  navConfig: SidebarNavigationConfig = {
    items: [
      // Links for page navigation
      {
        id: 'overview',
        label: 'Overview',
        icon: '@tui.layout',
        type: SidebarNavigationItemType.Link,
        path: '/content/overview'
      },
      // Buttons for scroll-to-section
      {
        id: 'section-introduction',
        label: 'Introduction',
        icon: '@tui.book-open',
        type: SidebarNavigationItemType.Button,
        value: 'introduction',
        active: false
      },
      {
        id: 'section-features',
        label: 'Features',
        icon: '@tui.star',
        type: SidebarNavigationItemType.Button,
        value: 'features',
        active: true,
        count: 5
      },
      {
        id: 'section-examples',
        label: 'Examples',
        icon: '@tui.code',
        type: SidebarNavigationItemType.Button,
        value: 'examples',
        active: false,
        count: 12
      }
    ],
    alignment: 'end'
  };

  handleAction(item: SidebarNavigationItem): void {
    if (item.value) {
      // Scroll to section
      const element = document.getElementById(item.value as string);
      element?.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
```

## Styling Customization

You can customize the component's appearance by overriding CSS custom properties in your component's stylesheet:

```scss
:host ::ng-deep ui-sidebar-navigation {
  // Change hover background
  .nav-item:hover {
    background: rgba(0, 123, 255, 0.1);
  }

  // Change active state
  .nav-item.active {
    background: rgba(0, 123, 255, 0.2);
    border-left: 3px solid var(--tui-primary);
  }

  // Customize count badge
  .nav-count {
    background: var(--tui-error-bg);
    color: var(--tui-error-text);
    padding: 0.125rem 0.5rem;
    border-radius: 1rem;
  }
}
```



