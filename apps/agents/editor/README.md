# Editor Agent

An automated agent that consumes app data from RabbitMQ and creates/updates content in the Editorial (Strapi) service.

## Purpose

The editor agent bridges the gap between the store-app scrapper and the editorial service:
- Consumes messages from RabbitMQ queue `store.app-scrapper`
- Processes scraped app data
- Creates or updates app records in Strapi
- Manages tags and uploads images

## Architecture

```
Store-App Scrapper → RabbitMQ → Editor Agent → Editorial (Strapi) → Catalog BFF → Frontend
```

## Building

```bash
nx build editor-agent
```

## Local Development

```bash
# Set environment variables
export QUEUE_USERNAME=guest
export QUEUE_PASSWORD=guest
export QUEUE_HOST=localhost
export QUEUE_PORT=5672
export EDITORIAL_SERVICE_HOST=http://localhost:1337
export EDITORIAL_SERVICE_API_TOKEN=your-strapi-token

# Run in development mode
nx serve editor-agent
```

## Docker Build

```bash
# Build the Nx project first
nx build editor-agent

# Build Docker image
docker build -f apps/agents/editor/Dockerfile -t editor-agent:latest .
```

## Deployment

See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for complete deployment guide including:
- Vault secret configuration
- ArgoCD setup
- Kubernetes deployment
- Testing and troubleshooting

## Running unit tests

Run `nx test editor-agent` to execute the unit tests via [Jest](https://jestjs.io).
