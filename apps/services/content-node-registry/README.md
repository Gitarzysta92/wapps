# Content Node Registry

A NestJS-based registry service for managing and discovering content nodes.

## Overview

The Content Node Registry provides a centralized service for:
- Registering content nodes
- Discovering available content nodes
- Managing content node metadata
- Providing a stable API contract for content node operations

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Client Applications                      │
│         (consume registry endpoints)                 │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│            Content Node Registry                     │
│         (manages content node registry)              │
└─────────────────────────────────────────────────────┘
```

## API Documentation

**Swagger UI**: http://localhost:3000/api/docs

Interactive API documentation with request/response schemas, examples, and the ability to test endpoints directly.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/health/ready` | GET | Readiness check |
| `/api/docs` | GET | Swagger API documentation |

## Development

### Prerequisites

- Node.js 20+
- npm

### Running Locally

```bash
# Install dependencies
npm install

# Start in development mode
npx nx serve apps.services.content-node-registry

# Build for production
npx nx build apps.services.content-node-registry
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `CORS_ORIGIN` | CORS allowed origins | `*` |
| `CONTENT_NODE_REGISTRY_DATABASE_HOST` | MySQL database host | `localhost` |
| `CONTENT_NODE_REGISTRY_DATABASE_PORT` | MySQL database port | `3306` |
| `CONTENT_NODE_REGISTRY_DATABASE_USERNAME` | MySQL database username | `root` |
| `CONTENT_NODE_REGISTRY_DATABASE_PASSWORD` | MySQL database password | `password` |
| `CONTENT_NODE_REGISTRY_DATABASE_NAME` | MySQL database name | `content_node_registry` |

## Deployment

The service is deployed via ArgoCD:

- **Namespace:** `content-node-registry`
- **Replicas:** 2 (production), 1 (development)
- **Health checks:** `/api/health`, `/api/health/ready`
