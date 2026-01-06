# store-app

Store app scrapper that scrapes app data and uploads to MinIO.

## Building

Run `nx build store-app` to build the library.

### Note on `package.json`

This project includes a local `package.json` file that lists the runtime dependencies:
- `amqplib` - RabbitMQ client
- `dotenv` - Environment variable loader
- `puppeteer` - Headless browser automation
- `node-fetch` - HTTP client for image downloads
- `@aws-sdk/client-s3` - AWS S3 client (used for MinIO)

**Why is this needed?** Nx's `generatePackageJson: true` feature uses this local `package.json` to determine which dependencies to include in the generated `package.json` in the `dist/` folder. Without it, the generated `package.json` would be missing dependencies, causing `npm install` in the Docker container to fail.

The generated `package.json` in `dist/apps/scrappers/store-app/` is used by the Dockerfile to install only the production dependencies needed at runtime.

## Running unit tests

Run `nx test store-app` to execute the unit tests via [Jest](https://jestjs.io).

## Local Development with Docker

### Prerequisites
- Docker installed
- RabbitMQ running (default: localhost:5672)
- MinIO running (default: localhost:9000)

### Quick Start

1. **Create `.env` file** (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env`** with your local values:
   ```bash
   # RabbitMQ Configuration
   QUEUE_HOST=localhost
   QUEUE_PORT=5672
   QUEUE_USERNAME=admin
   QUEUE_PASSWORD=changeme

   # MinIO Configuration
   MEDIA_STORAGE_HOST=http://localhost:9000
   MEDIA_STORAGE_ACCESSKEY=minioadmin
   MEDIA_STORAGE_SECRETKEY=minioadmin

   # Puppeteer Configuration
   HEADLESS=true
   ```

3. **Build and run using the script**:
   ```bash
   ./docker-run-local.sh
   ```

   Or manually:
   ```bash
   # Build the project
   npx nx build store-app

   # Build Docker image
   docker build -f apps/scrappers/store-app/Dockerfile -t store-app-scrapper:local .

   # Run with .env file
   docker run --rm --env-file apps/scrappers/store-app/.env store-app-scrapper:local
   ```

### Environment Variables

The container expects these environment variables:

- **RabbitMQ**: `QUEUE_HOST`, `QUEUE_PORT`, `QUEUE_USERNAME`, `QUEUE_PASSWORD`
- **MinIO**: `MEDIA_STORAGE_HOST`, `MEDIA_STORAGE_ACCESSKEY`, `MEDIA_STORAGE_SECRETKEY`
- **Puppeteer**: `HEADLESS` (true/false)

In Kubernetes, these are provided via:
- Secrets: `rabbitmq-credentials`, `minio-credentials`
- ConfigMap: `store-app-config`
