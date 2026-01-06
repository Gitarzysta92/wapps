# Editor Agent Implementation

## Overview

The editor agent is now fully operational and configured to consume messages from the `store.app-scrapper` RabbitMQ queue and create/update entries in the Editorial (Strapi) service.

## Architecture

```
┌─────────────────┐     RabbitMQ Queue        ┌──────────────┐      Strapi API       ┌───────────────┐
│  Store-App      │───► store.app-scrapper ──►│ Editor Agent │────────────────────►│   Editorial   │
│  Scrapper       │     (JSON messages)        │              │   (HTTP/REST)        │   (Strapi)    │
└─────────────────┘                            └──────────────┘                      └───────────────┘
                                                       │
                                                       │ Downloads images from URLs
                                                       ▼
                                                  Uploads to Strapi
```

## What Was Implemented

### 1. **Editor Source Code** (`apps/agents/editor/src/index.ts`)

The editor agent now:
- ✅ Connects to RabbitMQ and consumes from `store.app-scrapper` queue
- ✅ Parses scraped app data from messages
- ✅ Creates or updates app records in Strapi
- ✅ Manages tags (creates if not exists, links to app records)
- ✅ Downloads images from URLs and uploads them to Strapi
- ✅ Handles errors gracefully with message requeuing
- ✅ Provides detailed logging

**Key Features:**
- Message acknowledgment (prevents data loss)
- Automatic tag creation with slug generation
- Image handling (logo + screenshots)
- Idempotent updates (checks for existing records)
- Comprehensive error handling

### 2. **Dependencies** (`package.json`)

Added:
- `axios` - HTTP client for Strapi API calls
- `form-data` - Form data handling for image uploads
- `@types/amqplib` - TypeScript definitions

### 3. **Configuration** (`provisioning/k8s/editor-agent.config-map.yaml`)

Updated ConfigMap with:
- `EDITORIAL_SERVICE_HOST` - Strapi service URL with port
- `MEDIA_STORAGE_HOST` - MinIO service URL (for future enhancements)
- RabbitMQ connection details

### 4. **Docker Configuration** (`Dockerfile`)

Fixed entrypoint to use `src/index.js` (was incorrectly set to `src/main.js`)

### 5. **ArgoCD Application** (`argocd/applications/backend/editor-agent.yaml`)

Created ArgoCD application manifest:
- Namespace: `editorial`
- Source: `environments/dev/apps/editor-agent-kustomization`
- Auto-sync enabled with self-heal
- Proper labels and metadata

### 6. **Kustomization** (`environments/dev/apps/editor-agent-kustomization/`)

Created Kustomization structure:
- `kustomization.yaml` - References base K8s manifests
- `deployment-patch.yaml` - Overrides image to use GHCR registry
- Resource limits: 100m-500m CPU, 256Mi-512Mi memory

### 7. **CI/CD Pipeline** (`.github/workflows/editor-agent.yml`)

Created GitHub Actions workflow:
- Triggers on changes to `apps/agents/editor/**`
- Builds with Nx: `nx build editor-agent`
- Creates Docker image
- Pushes to GitHub Container Registry (ghcr.io)
- Tags: `latest` and `<branch>-<sha>`

## Required GitHub Secrets

Add these secrets to your GitHub repository (**Settings** → **Secrets and variables** → **Actions**):

### 1. `EDITORIAL_SERVICE_API_TOKEN`
- Get from Strapi admin panel (`/admin` → Settings → API Tokens)
- Create token with permissions: app-record, tag, upload (or Full Access)

### 2. `RABBITMQ_USERNAME`
- RabbitMQ username (same as store-app-scrapper)

### 3. `RABBITMQ_PASSWORD`
- RabbitMQ password (same as store-app-scrapper)

## Deployment Steps

### 1. Prerequisites

Ensure these services are running:
- ✅ RabbitMQ (with credentials in Vault)
- ✅ Editorial (Strapi) service
- ✅ Vault with proper policies
- ✅ ArgoCD

### 2. Build and Push Image

**Option A: Via GitHub Actions (Recommended)**
```bash
git add .
git commit -m "feat: implement editor agent for content ingestion"
git push origin main
```

GitHub Actions will automatically build and push the image to GHCR.

**Option B: Manual Build**
```bash
# Build with Nx
npx nx build editor-agent

# Build Docker image
docker build -f apps/agents/editor/Dockerfile \
  -t ghcr.io/gitarzysta92/wapps/editor-agent:latest .

# Push to registry (requires authentication)
docker push ghcr.io/gitarzysta92/wapps/editor-agent:latest
```

### 3. Deploy via ArgoCD

The editor-agent ArgoCD application should be included in the backend-services app-of-apps:

```bash
# Apply the ArgoCD application
kubectl apply -f argocd/applications/backend/editor-agent.yaml

# Sync the application
argocd app sync editor-agent

# Check status
argocd app get editor-agent
kubectl get pods -n editorial -l app=editor-agent
```

### 4. Verify Deployment

Check logs:
```bash
kubectl logs -n editorial -l app=editor-agent -f
```

Expected output:
```
🚀 Starting Editor Agent...
📡 Editorial Service: http://editorial-service.editorial.svc.cluster.local:1337
🐰 RabbitMQ Queue: store.app-scrapper
🔐 API Token: ✓ Set
✅ Connected to RabbitMQ, waiting for messages...
👂 Listening for messages...
```

## Testing

### 1. Trigger Store-App Scrapper

Run the store-app scrapper to populate the queue:
```bash
kubectl create job --from=cronjob/store-app-scrapper test-run -n ingestion-scrappers-store-app
```

### 2. Monitor Editor Agent

Watch logs to see messages being processed:
```bash
kubectl logs -n editorial -l app=editor-agent -f
```

Expected output per message:
```
📥 Received message for: <App Name>
📝 Processing app: <App Name>
✅ Created app: <App Name>
✓ Message acknowledged for: <App Name>
```

### 3. Verify in Strapi

1. Log into Strapi admin: `http://editorial.yourdomain.com/admin`
2. Navigate to Content Manager → App Records
3. Verify newly created entries
4. Check tags are properly linked
5. Verify images are uploaded

## Troubleshooting

### Editor Agent Not Starting

**Check Vault secrets:**
```bash
kubectl exec -n editorial deploy/editor-agent -- cat /vault/secrets/editorial-service
kubectl exec -n editorial deploy/editor-agent -- cat /vault/secrets/queue
```

**Check pod status:**
```bash
kubectl describe pod -n editorial -l app=editor-agent
```

### Messages Not Being Processed

**Check RabbitMQ connection:**
```bash
# Access RabbitMQ management UI or CLI
kubectl port-forward -n rabbitmq svc/rabbitmq 15672:15672

# Check queue: store.app-scrapper
# Verify messages are in the queue
```

**Check Strapi API connectivity:**
```bash
kubectl exec -n editorial deploy/editor-agent -- \
  wget -O- http://editorial-service.editorial.svc.cluster.local:1337/api/app-records
```

### Image Upload Failures

- Verify Strapi upload plugin is enabled
- Check file size limits in Strapi configuration
- Ensure proper permissions on the API token

### Messages Being Requeued

Check logs for specific error messages:
```bash
kubectl logs -n editorial -l app=editor-agent | grep "Error processing message"
```

Common issues:
- Invalid Strapi API token
- Network connectivity to Strapi
- Malformed message payload
- Strapi validation errors

## Data Flow Details

### Message Format

The editor expects messages in this format:
```typescript
interface ScrapedApp {
  name: string;              // App name
  slug: string;              // URL-friendly slug
  detailsLink: string;       // Original store URL
  tags: string[];            // Array of tag names
  description: string;       // App description
  links: Array<{             // Social/external links
    id: number;              // Link type ID
    link: string;            // URL
  }>;
  assets: Array<{            // Images
    src: string;             // Image URL
    type: 'logo' | 'gallery';  // Image type
  }>;
}
```

### Strapi Mapping

| Scraped Field | Strapi Field | Notes |
|---------------|--------------|-------|
| `name` | `name` | Direct mapping |
| `slug` | `slug` | Direct mapping |
| `description` | `description` | Direct mapping |
| `detailsLink` | `website` | Original store link |
| `tags[]` | `tags` (relation) | Creates tags if missing |
| `assets[type=logo]` | `logo` (media) | First logo found |
| `assets[type=gallery]` | `screenshots` (media) | All gallery images |

## Future Enhancements

1. **MinIO Integration**: Currently images are downloaded from public URLs. Could enhance to retrieve from MinIO bucket.
2. **AI Enrichment**: Use OpenAI API to enhance descriptions or categorize apps
3. **Duplicate Detection**: More sophisticated duplicate checking
4. **Category Assignment**: Auto-assign categories based on tags
5. **Rate Limiting**: Add rate limiting for Strapi API calls
6. **Metrics**: Export Prometheus metrics for monitoring
7. **Dead Letter Queue**: Handle permanently failed messages

## Monitoring

Key metrics to monitor:
- Messages consumed per minute
- Processing time per message
- Error rate
- Strapi API response times
- Queue depth

## Maintenance

### Scaling

To handle higher load:
```bash
kubectl scale deployment editor-agent -n editorial --replicas=3
```

### Log Retention

Configure log aggregation (e.g., ELK, Loki) to retain processing logs.

### Backup

Ensure Strapi database backups include:
- App records
- Tags
- Media files (via MinIO backup)

## Summary

The editor agent is now fully operational and will automatically:
1. Consume messages from RabbitMQ as they arrive
2. Create/update app records in Strapi
3. Manage tags and images
4. Handle errors gracefully

The CI/CD pipeline ensures automatic deployment on code changes, and ArgoCD manages the Kubernetes resources with GitOps principles.

