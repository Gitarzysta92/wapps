# Catalog BFF (Backend for Frontend)

A NestJS-based Backend for Frontend service that provides API endpoints for the catalog domain.

## Overview

The Catalog BFF acts as an intermediary layer between frontend applications and backend services (primarily the Editorial/Strapi service). It:

- Fetches data from the Editorial service (Strapi CMS)
- Transforms Strapi API responses into domain DTOs (`@domains/catalog/*`)
- Enriches data with computed fields (review counts, category metadata)
- Provides a stable API contract for frontends
- Handles caching and lazy loading of computed data

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                          │
│              (consumes AppRecordDto)                 │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│                  Catalog BFF                         │
│         (composes domain DTOs from sources)          │
└─────────────────────────────────────────────────────┘
         ↓                ↓              ↓
┌───────────────┐  ┌──────────┐  ┌─────────────┐
│   Editorial   │  │ Reviews  │  │   Other     │
│   (Strapi)    │  │ Service  │  │  Services   │
│               │  │ (future) │  │  (future)   │
└───────────────┘  └──────────┘  └─────────────┘
```

## API Documentation

**Swagger UI**: http://localhost:3000/api/docs

Interactive API documentation with request/response schemas, examples, and the ability to test endpoints directly.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/catalog/apps` | GET | List app records with pagination and filtering |
| `/api/catalog/apps/:slug` | GET | Get single app record by slug |
| `/api/catalog/apps/:slug/preview` | GET | Get app preview (lighter version) |
| `/api/catalog/categories` | GET | List all categories (flat) |
| `/api/catalog/categories/tree` | GET | Get category tree structure |
| `/api/catalog/tags` | GET | List all tags |
| `/api/catalog/tags/:slug` | GET | Get single tag by slug |
| `/api/health` | GET | Health check |
| `/api/health/ready` | GET | Readiness check |
| `/api/docs` | GET | Swagger API documentation |

### Query Parameters

#### `/api/catalog/apps`

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |
| `category` | string | Filter by category slug |
| `tags` | string | Filter by tag slugs (comma-separated) |
| `search` | string | Search in name and description |

## Development

### Prerequisites

- Node.js 20+
- npm
- Running Editorial (Strapi) service

### Running Locally

```bash
# Install dependencies
npm install

# Start in development mode
npx nx serve apps.services.catalog-bff

# Build for production
npx nx build apps.services.catalog-bff
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `EDITORIAL_URL` | Editorial service URL | `http://editorial-service.editorial:1337` |
| `EDITORIAL_API_TOKEN` | Strapi API token | - |
| `CORS_ORIGIN` | CORS allowed origins | `*` |

## Domain DTOs

The BFF uses domain DTOs from `@domains/catalog/*`:

- `AppRecordDto` - Full app record
- `AppPreviewDto` - Lightweight preview
- `CategoryDto` - Category with computed depth/rootId
- `CategoryTreeDto` - Category tree structure
- `TagDto` - Tag

## Computed Fields

The following fields are computed by the BFF:

- `AppRecordDto.reviewNumber` - Lazy-loaded, cached for 5 minutes
- `CategoryDto.depth` - Computed from parent chain
- `CategoryDto.rootId` - Computed from parent chain

## Deployment

The service is deployed via ArgoCD:

- **Namespace:** `catalog`
- **Replicas:** 2 (production), 1 (development)
- **Health checks:** `/api/health`, `/api/health/ready`

## Related Projects

- `apps/services/editorial` - Editorial Strapi service
- `libs/domains/catalog` - Catalog domain DTOs and ports

