# Kong GitHub Actions Workflow - Setup Guide

This guide explains how to use the automated GitHub Actions workflow for Kong configuration and deployment.

## Overview

The workflow automates:
- ✅ Firebase Project ID substitution
- ✅ Kong configuration deployment
- ✅ API Gateway ingress setup
- ✅ Network policies (optional)
- ✅ Kong restart
- ✅ ArgoCD sync

**No manual scripts needed!** Just push your code.

## Setup (One-Time Configuration)

### Step 1: Add GitHub Secrets

Go to: **GitHub Repository → Settings → Secrets and variables → Actions**

Add the following secrets:

#### Development Environment
```
FIREBASE_PROJECT_ID_DEV = your-dev-firebase-project-id
ARGOCD_SERVER = argocd.development.wapps.com
ARGOCD_TOKEN = your-argocd-auth-token
```

#### Production Environment (Optional)
```
FIREBASE_PROJECT_ID_PROD = your-prod-firebase-project-id
ARGOCD_SERVER_PROD = argocd.production.wapps.com
ARGOCD_TOKEN_PROD = your-prod-argocd-token
```

#### Optional
```
ENABLE_NETWORK_POLICIES = true  # Enforce Kong-only access to backends
```

### Step 2: Get ArgoCD Token

```bash
# Login to ArgoCD
argocd login argocd.development.wapps.com \
  --username admin \
  --password YOUR_PASSWORD

# Generate token
argocd account generate-token

# Copy the token and add to GitHub Secrets
```

### Step 3: Verify Self-Hosted Runner

The workflow uses `self-hosted` runner for deployment steps that need cluster access.

Check your runner:
```bash
# In GitHub: Settings → Actions → Runners
# Should show: self-hosted, development (or similar)
```

The runner should have:
- ✅ kubectl configured
- ✅ Access to Kubernetes cluster
- ✅ Network access to ArgoCD

## Usage

### Automatic Deployment (Recommended)

Just push changes to Kong configuration:

```bash
# Make changes to Kong configuration
vim platform/cluster/kong/kong.configmap.yaml

# Commit and push
git add platform/cluster/kong/
git commit -m "feat(kong): update routes configuration"
git push origin develop

# GitHub Actions automatically:
# 1. Detects changes to platform/cluster/kong/**
# 2. Replaces {{ FIREBASE_PROJECT_ID }} with secret
# 3. Deploys to cluster
# 4. Restarts Kong
# 5. Syncs ArgoCD
```

**That's it!** No manual intervention needed.

### Manual Trigger

You can also trigger manually:

1. Go to **Actions** tab in GitHub
2. Select **"Kong API Gateway - Configuration & Deployment"**
3. Click **"Run workflow"**
4. Choose:
   - Environment: `development` or `production`
   - Apply Network Policies: `true` or `false`
5. Click **"Run workflow"**

## Workflow Behavior

### Triggered Automatically On:

```yaml
on:
  push:
    branches: [develop, main]
    paths:
      - 'platform/cluster/kong/**'
      - 'environments/*/platform/kong.overlay.yml'
      - 'environments/*/platform/api-gateway-ingress.yaml'
      - 'environments/*/platform/backend-network-policies.yaml'
```

- **`develop` branch** → Deploys to development
- **`main` branch** → Deploys to production

### What It Does:

#### Job 1: Configure
1. ✅ Checks out code
2. ✅ Sets environment (dev or prod)
3. ✅ Gets Firebase Project ID from secrets
4. ✅ Replaces `{{ FIREBASE_PROJECT_ID }}` placeholders
5. ✅ Validates YAML syntax
6. ✅ Shows configuration diff

#### Job 2: Deploy
1. ✅ Labels Kong namespace
2. ✅ Deploys API Gateway ingress
3. ✅ Deploys Network Policies (if enabled)
4. ✅ Applies Kong ConfigMap
5. ✅ Restarts Kong deployment
6. ✅ Verifies deployment
7. ✅ Tests Kong health

#### Job 3: ArgoCD Sync
1. ✅ Installs ArgoCD CLI
2. ✅ Logs in to ArgoCD
3. ✅ Forces sync of Kong application
4. ✅ Waits for sync completion

#### Job 4: Summary
1. ✅ Shows deployment summary
2. ✅ Provides next steps

## Monitoring

### View Workflow Runs

GitHub → Actions → "Kong API Gateway - Configuration & Deployment"

Each run shows:
- Configuration changes
- Deployment status
- ArgoCD sync status
- Summary with next steps

### Check Logs

```bash
# Kong logs
kubectl logs -n kong -l app=kong --tail=100 -f

# Check Kong health
kubectl get pods -n kong
kubectl exec -n kong <pod-name> -- curl -s http://localhost:8001/status
```

### ArgoCD

Monitor in ArgoCD UI:
- https://argocd.development.wapps.com
- Application: `kong`
- Check sync status and health

## Troubleshooting

### Issue: "Firebase Project ID not configured"

**Error:**
```
Firebase Project ID not configured for development environment
Add FIREBASE_PROJECT_ID_DEV to GitHub Secrets
```

**Solution:**
Add the secret: Settings → Secrets → New repository secret
- Name: `FIREBASE_PROJECT_ID_DEV`
- Value: Your Firebase project ID

### Issue: "No Kong pods found"

**Cause:** Kong not deployed yet or in wrong namespace

**Solution:**
```bash
# Check if Kong is deployed
kubectl get pods -n kong

# Check ArgoCD app status
argocd app get kong
```

### Issue: "Self-hosted runner offline"

**Error:** Deployment job waiting for runner

**Solution:**
1. Check runner status: Settings → Actions → Runners
2. Restart runner on your server:
```bash
cd actions-runner
./run.sh
```

### Issue: "kubectl command not found"

**Cause:** Self-hosted runner doesn't have kubectl

**Solution:**
Install kubectl on runner machine:
```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

## Comparison: Manual vs Automated

### Before (Manual)
```bash
# 1. Clone repo
git clone ...

# 2. Run script manually
./platform/cluster/kong/configure-firebase.sh YOUR_PROJECT_ID dev

# 3. Run routing script
./platform/cluster/kong/configure-routing.sh dev

# 4. Apply manually
kubectl apply -f platform/cluster/kong/kong.configmap.yaml
kubectl rollout restart deployment/kong -n kong

# 5. Check status
kubectl get pods -n kong
```

### After (Automated)
```bash
# 1. Make changes
vim platform/cluster/kong/kong.configmap.yaml

# 2. Push
git add .
git commit -m "feat: update kong"
git push

# Done! ✨
# GitHub Actions handles everything automatically
```

## When to Use Manual Scripts

The manual scripts (`configure-firebase.sh`, `configure-routing.sh`) are still useful for:

1. **Local Development**
   ```bash
   # Test changes locally before pushing
   ./platform/cluster/kong/configure-firebase.sh test-project-id dev
   ```

2. **Initial Setup**
   ```bash
   # First-time cluster setup
   ./platform/cluster/kong/implement-solution.sh dev YOUR_PROJECT_ID
   ```

3. **Emergency Fixes**
   ```bash
   # Quick manual fix without waiting for CI/CD
   ./platform/cluster/kong/configure-routing.sh dev
   ```

4. **CI/CD Troubleshooting**
   - Test workflow steps manually
   - Debug configuration issues

## Environment Variables

The workflow uses these environment variables:

```yaml
env:
  APP_NAME: kong
  NAMESPACE: kong
```

## Advanced Configuration

### Enable Network Policies by Default

Add to GitHub Secrets:
```
ENABLE_NETWORK_POLICIES = true
```

This will automatically apply NetworkPolicies on every deployment.

### Multiple Environments

The workflow supports multiple environments:

- `develop` branch → development environment
- `main` branch → production environment

Just add the corresponding secrets for each environment.

### Custom ArgoCD Sync Options

Modify the workflow to add custom sync options:

```yaml
argocd app sync kong \
  --force \
  --prune \
  --grpc-web
```

## Summary

**What you need to do:**
1. ✅ Add GitHub Secrets (one time)
2. ✅ Push code to `develop` branch
3. ✅ Watch GitHub Actions deploy automatically

**What GitHub Actions does:**
1. ✅ Replaces Firebase placeholders
2. ✅ Deploys configuration
3. ✅ Restarts Kong
4. ✅ Syncs ArgoCD

**Result:** Zero manual intervention! 🎉

## Next Steps

1. **Add secrets** to GitHub repository
2. **Push a test change** to Kong configuration
3. **Watch the workflow** run in GitHub Actions
4. **Verify deployment** in ArgoCD and cluster

See `platform/cluster/kong/IMPLEMENTATION-CHECKLIST.md` for complete implementation guide.

