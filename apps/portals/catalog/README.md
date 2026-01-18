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

The portal uses **catalog-bff** as the only data source. Edit `application/src/environment.ts`:

- **Local** (`ENVIRONMENT_NAME = ""`): `http://localhost:3000/api`
- **Deployed**: `http://catalog.<env>.wapps.com/api` (e.g. `http://catalog.development.wapps.com/api`)

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

The portal uses **catalog-bff** (`apps/services/catalog-bff`) as the only data source. catalog-bff uses `app.setGlobalPrefix('api')` and `@Controller('catalog')`.

### Endpoints used

- `GET /api/catalog/apps` – list apps (query: `page`, `pageSize`, `category`, `tags`, `search`)
- `GET /api/catalog/apps/:slug` – app by slug

### Local development

1. Start catalog-bff (default port 3000):
   ```bash
   nx serve catalog-bff
   ```

2. Start the catalog portal:
   ```bash
   nx serve catalog-csr
   ```

The portal calls `http://localhost:3000/api/catalog/apps` and `http://localhost:3000/api/catalog/apps/:slug`. If catalog-bff is not running, requests will fail.

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
