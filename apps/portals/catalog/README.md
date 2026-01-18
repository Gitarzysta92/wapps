# Catalog Portal

A simple web portal for displaying application catalogs from the catalog-bff service.

## Structure

This portal follows the aggregator-demo architecture pattern:

```
apps/portals/catalog/
├── application/              # Core library
│   ├── src/
│   │   ├── pages/           # Page components
│   │   │   ├── home/        # List of all apps
│   │   │   └── app-details/ # App detail view
│   │   ├── partials/        # Reusable UI sections
│   │   │   ├── header/      # Header component
│   │   │   └── footer/      # Footer component
│   │   ├── shells/          # Layout shells
│   │   │   └── app-shell/   # Main app shell
│   │   ├── services/        # API services
│   │   ├── state/           # State management
│   │   ├── app-config.ts    # Angular config
│   │   ├── root.ts          # Feature providers
│   │   ├── routes.ts        # Route definitions
│   │   ├── navigation.ts    # Navigation config
│   │   ├── environment.ts   # Environment config
│   │   └── index.ts         # Public API
│   └── project.json
└── entrypoints/
    └── csr/                 # Client-side rendering
        ├── src/
        │   ├── main.ts      # Bootstrap
        │   └── index.html   # HTML shell
        └── project.json
```

## Features

- **Home Page**: Displays a grid of all applications with:
  - App logo, name, and description
  - Rating and review count
  - PWA badge
  - Last update date
  - Responsive card layout

- **App Details Page**: Shows full application information:
  - Large app logo and header
  - Detailed description
  - Rating and reviews
  - Platform and tag information
  - Listing and update dates
  - Back navigation

## Configuration

### Environment

Edit `application/src/environment.ts`:

```typescript
export const ENVIRONMENT_NAME = ""; // Local dev with mock data
export const CATALOG_BFF_URL = buildServiceUrl("catalog", 3000);
```

- **Local Development**: Empty `ENVIRONMENT_NAME` uses mock data
- **With API**: Set port to 3000 for `http://localhost:3000`
- **Production**: Set `ENVIRONMENT_NAME` to "production" for `https://catalog.production.wapps.com`

## Development

### Serve the application

```bash
nx serve catalog-csr
```

The application will be available at `http://localhost:4200`

### Build for production

```bash
nx build catalog-csr --configuration=production
```

### Run tests

```bash
nx test catalog-angular
```

### Lint

```bash
nx lint catalog-csr
```

## API Integration

The portal connects to the catalog-bff service (`apps/services/catalog-bff`):

### Endpoints Used

- `GET /catalog/apps` - List all applications
- `GET /catalog/apps/:slug` - Get app by slug

### Mock Data

When `CATALOG_BFF_URL` is empty or unavailable, the service returns mock data with 6 sample applications.

### Real API

To connect to the real API:

1. Start the catalog-bff service:
   ```bash
   nx serve catalog-bff
   ```

2. The portal will automatically connect to `http://localhost:3000`

## UI Components

Uses Taiga UI library (`@taiga-ui/core`, `@taiga-ui/kit`) and custom `@ui/*` components:

- `TuiIcon` - Icons
- `TuiButton` - Buttons
- `TuiBadge` - Badges
- `TuiLoader` - Loading states
- `SafeComponentOutletDirective` - Dynamic component loading

## Routing

- `/` - Redirects to `/catalog`
- `/catalog` - Home page (list of apps)
- `/apps/:appSlug` - App details page

## Styling

- Uses SCSS with Taiga UI theming
- CSS custom properties for theming
- Responsive design with mobile-first approach
- Card-based layouts

## Next Steps

- Add pagination to home page
- Add filtering and search
- Add category and tag navigation
- Implement real authentication
- Add loading skeletons
- Add error boundaries
- Implement caching strategy
