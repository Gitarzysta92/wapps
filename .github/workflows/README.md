# GitHub Actions Workflows

## Firebase Auth Validator Workflow

**File:** `firebase-auth-validator.workflow.yml`

### Purpose

Builds and deploys the Firebase authentication validator service that replaces Kong API Gateway.

### Triggers

**Automatic:**
- Push to `develop` → Deploys to development
- Push to `main` → Deploys to production
- Changes to:
  - `apps/services/firebase-auth-validator/**`
  - `environments/*/apps/catalog-bff-kustomization/**`

**Manual:**
- Workflow dispatch with environment selection

### Required Secrets

#### Development Environment
```
FIREBASE_PROJECT_ID_DEV = your-firebase-dev-project-id
```

#### Production Environment
```
FIREBASE_PROJECT_ID_PROD = your-firebase-prod-project-id
```

### What It Does

#### Job 1: Build
1. ✅ Checks out code
2. ✅ Sets environment (dev/prod)
3. ✅ Installs Node.js dependencies
4. ✅ Builds TypeScript → JavaScript
5. ✅ Builds Docker image
6. ✅ Pushes to GitHub Container Registry (ghcr.io)

#### Job 2: Deploy
1. ✅ Updates Firebase config secret in Kubernetes
2. ✅ Deploys auth validator service
3. ✅ Waits for rollout completion
4. ✅ Verifies deployment health
5. ✅ Applies ingress configurations with external auth
6. ✅ Applies network policies

#### Job 3: Summary
1. ✅ Shows deployment summary
2. ✅ Provides service endpoints
3. ✅ Suggests next steps

### Setup Instructions

#### 1. Add GitHub Secrets

Go to: **GitHub Repository → Settings → Secrets and variables → Actions**

Add:
```
FIREBASE_PROJECT_ID_DEV = your-dev-firebase-project-id
FIREBASE_PROJECT_ID_PROD = your-prod-firebase-project-id
```

#### 2. Enable GitHub Container Registry

The workflow automatically publishes to GitHub Container Registry (ghcr.io). No additional setup needed - it uses `GITHUB_TOKEN` which is automatically provided.

Images are published to:
```
ghcr.io/YOUR_USERNAME/YOUR_REPO/firebase-auth-validator:latest
```

#### 3. Configure Self-Hosted Runner

The deploy job uses `self-hosted` runner. Ensure your runner has:
- ✅ kubectl installed and configured
- ✅ Access to Kubernetes cluster
- ✅ Permissions to create secrets and deployments

### Manual Trigger

1. Go to **Actions** tab in GitHub
2. Select **"Firebase Auth Validator - Build & Deploy"**
3. Click **"Run workflow"**
4. Choose environment: `development` or `production`
5. Click **"Run workflow"**

### Monitoring

#### View Workflow Runs
GitHub → Actions → "Firebase Auth Validator - Build & Deploy"

#### Check Deployment
```bash
# Check pods
kubectl get pods -n default -l app=firebase-auth-validator

# Check logs
kubectl logs -n default -l app=firebase-auth-validator --tail=100 -f

# Test health endpoint
kubectl port-forward -n default svc/firebase-auth-validator 8080:80
curl http://localhost:8080/health
```

#### Test Authentication
```bash
# With valid Firebase token
curl -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  http://firebase-auth-validator.default.svc.cluster.local/validate

# Without token (should fail)
curl http://firebase-auth-validator.default.svc.cluster.local/validate

# Optional auth (should succeed)
curl http://firebase-auth-validator.default.svc.cluster.local/validate-optional
```

### Image Tags

The workflow creates multiple tags:
- `latest` - Latest build from main branch
- `main-SHA` - Specific commit from main
- `develop-SHA` - Specific commit from develop

### Troubleshooting

#### Issue: "Firebase Project ID not configured"

**Solution:** Add secret in GitHub repository settings
```
Settings → Secrets → New repository secret
Name: FIREBASE_PROJECT_ID_DEV
Value: your-firebase-project-id
```

#### Issue: "Self-hosted runner offline"

**Solution:** 
1. Check runner status: Settings → Actions → Runners
2. Restart runner on your server

#### Issue: "kubectl command not found"

**Solution:** Install kubectl on self-hosted runner:
```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

#### Issue: "Permission denied" when pushing to ghcr.io

**Solution:** Ensure workflow has `packages: write` permission (already configured)

### Workflow Output Example

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Firebase Auth Validator - Deployment Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Environment: development
Image: ghcr.io/your-org/your-repo/firebase-auth-validator:develop-abc123

Job Results:
  - Build: success
  - Deploy: success

✅ Firebase Auth Validator deployed successfully!

Service endpoints:
  - Validate: http://firebase-auth-validator.default.svc.cluster.local/validate
  - Validate Optional: http://firebase-auth-validator.default.svc.cluster.local/validate-optional
  - Health: http://firebase-auth-validator.default.svc.cluster.local/health

Next steps:
  1. Test with a Firebase token
  2. Check logs: kubectl logs -n default -l app=firebase-auth-validator --tail=50
  3. Verify ingress: kubectl get ingress -n catalog

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Comparison: Kong vs Firebase Auth Validator

### Before (Kong)
```bash
# Kong workflow had to:
- Replace Firebase placeholders manually
- Deploy ConfigMap
- Restart Kong
- Manually sync ArgoCD
- Deal with Enterprise-only plugins
```

### After (Firebase Auth Validator)
```bash
# New workflow:
- Builds proper Docker image
- Deploys to Kubernetes
- Uses official Firebase SDK
- Actually works!
```

## Benefits

- ✅ **Automated builds** - TypeScript compiled and Docker image built
- ✅ **Container registry** - Images stored in GitHub Container Registry
- ✅ **Environment-specific** - Dev and prod configurations
- ✅ **Self-contained** - No manual scripts needed
- ✅ **Proper versioning** - Git SHA tags for rollback
- ✅ **Health checks** - Automatic verification after deployment

