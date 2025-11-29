# Changelog - @ui/navigation

## [0.0.1] - 2025-11-24

### Added

#### SidebarNavigationComponent
- **Generic sidebar navigation component** with support for:
  - Link-based navigation (using Angular Router)
  - Button-based navigation (custom click handlers)
  - Loading states with skeleton loaders
  - Count badges on navigation items
  - Flexible alignment (start/end)
  - Active state management (automatic for links, manual for buttons)
  - Smooth hover animations

#### Models
- `SidebarNavigationItem` - Interface for individual navigation items
- `SidebarNavigationConfig` - Interface for component configuration
- `SidebarNavigationItemType` - Enum for navigation item types (Link, Button)

#### Documentation
- `README.md` - Comprehensive API documentation
- `USAGE_EXAMPLES.md` - Real-world usage examples including:
  - Search results sidebar refactoring example
  - User profile sidebar
  - Admin dashboard navigation
  - Loading state handling
  - Mixed link/button navigation

### Configuration Files
- `ng-package.json` - Angular package configuration
- `package.json` - Package metadata with peer dependencies
- `tsconfig.lib.prod.json` - Production TypeScript configuration

### Exports
All components, types, and enums are properly exported through `src/index.ts`:
- `SidebarNavigationComponent`
- `SidebarNavigationItem` (type)
- `SidebarNavigationConfig` (type)
- `SidebarNavigationItemType` (enum)
- `NAVIGATION_CONFIGURATION` (token)
- `NavigationDeclaration` (type)

### Features Highlights
1. **Reactive Design** - Works seamlessly with Angular signals and computed values
2. **Type-Safe** - Full TypeScript support with comprehensive interfaces
3. **Accessible** - Includes proper ARIA attributes and semantic HTML
4. **Customizable** - Flexible styling with CSS custom properties
5. **Performant** - ChangeDetectionStrategy.OnPush for optimal performance

### Use Cases
- Search results sidebars with dynamic sections
- User profile navigation
- Admin dashboard menus
- Content navigation with scroll-to-section
- Any sidebar navigation requiring loading states and counts

### Migration Path
Components using custom navigation implementations can easily migrate to this generic component by:
1. Creating a `SidebarNavigationConfig` from existing data
2. Replacing custom template with `<ui-sidebar-navigation>`
3. Handling item clicks through the `itemClicked` output
4. Removing custom navigation styling (now provided by the component)

See `USAGE_EXAMPLES.md` for detailed migration examples.



