# Kong + Firebase Authentication - Quick Reference

## 🎯 What This Does

**Backend-Proxied Firebase Authentication** (Recommended):
- Your backend authenticates users via Firebase Admin SDK
- Backend returns Firebase JWT to frontend
- Kong validates JWT before forwarding requests
- Backend services receive validated requests

Benefits:
- ✅ Full control over authentication flow
- ✅ No Firebase SDK in frontend
- ✅ Centralized authentication at API Gateway level
- ✅ No need for backend services to re-validate tokens
- ✅ Support for public, protected, and optional-auth routes

**See `AUTHENTICATION-APPROACHES.md` for comparison of approaches.**

## 📋 Prerequisites

- Firebase project with Authentication enabled
- Kong deployed in Kubernetes cluster
- Frontend app with Firebase SDK

## 🚀 Quick Setup (Automated via GitHub Actions) ⭐

### Option 1: Automated (Recommended)

**Step 1: Add GitHub Secrets (One Time)**

Go to: **GitHub Repository → Settings → Secrets and variables → Actions**

```
FIREBASE_PROJECT_ID_DEV = your-firebase-project-id
ARGOCD_SERVER = argocd.development.wapps.com
ARGOCD_TOKEN = <your-argocd-token>
```

**Step 2: Push Your Code**

```bash
# Make changes
vim platform/cluster/kong/kong.configmap.yaml

# Push to develop branch
git add platform/cluster/kong/
git commit -m "feat(kong): update configuration"
git push origin develop
```

**Step 3: Done! ✅**

GitHub Actions automatically:
- Replaces `{{ FIREBASE_PROJECT_ID }}` with your secret
- Deploys to cluster
- Restarts Kong
- Syncs ArgoCD

**No manual intervention needed!** See `.github/workflows/KONG-WORKFLOW-GUIDE.md`

---

### Option 2: Manual (Local Development/Testing)

**Step 1: Get Firebase Project ID**

Firebase Console → ⚙️ Settings → Project ID

**Step 2: Run Configuration Scripts**

```bash
# Configure Firebase
./platform/cluster/kong/configure-firebase.sh YOUR_PROJECT_ID dev

# Configure traffic routing
./platform/cluster/kong/configure-routing.sh dev
```

**Step 3: Deploy**

```bash
kubectl apply -f platform/cluster/kong/kong.configmap.yaml
kubectl rollout restart deployment/kong -n kong
```

---

### Next Steps (Both Options)

**1. Create Backend Auth Service**

```bash
# Create service
nx generate @nx/node:application auth-service

# Install Firebase Admin SDK
npm install firebase-admin

# Implement endpoints (see BACKEND-FIREBASE-AUTH.md)
```

**2. Update Frontend**

```typescript
// No Firebase SDK needed!
{ provide: AUTHENTICATION_HANDLER, useClass: BackendFirebaseAuthenticationService }
```

**3. Test**

```bash
# Test authentication
curl -X POST http://api.development.wapps.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123"}'

# Test API with token
curl http://api.development.wapps.com/catalog/listings \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**See:**
- `AUTOMATED-DEPLOYMENT.md` - GitHub Actions setup
- `BACKEND-FIREBASE-AUTH.md` - Backend implementation
- `.github/workflows/KONG-WORKFLOW-GUIDE.md` - Workflow details

## 📄 Route Configuration

### Public Routes (No Auth)
```yaml
- name: public-route
  service: catalog-bff-service
  paths:
    - /api/catalog/listings
  # No JWT plugin = public access
```

### Protected Routes (Auth Required)
```yaml
- name: protected-route
  service: catalog-bff-service
  paths:
    - /api/catalog/my-listings
  plugins:
    - name: jwt
      config:
        issuer: https://securetoken.google.com/PROJECT_ID
        claims_to_verify:
          - exp
```

### Optional Auth Routes (Personalized if Authenticated)
```yaml
- name: optional-auth-route
  service: catalog-bff-service
  paths:
    - /api/feed
  plugins:
    - name: jwt
      config:
        anonymous: anonymous-user
        issuer: https://securetoken.google.com/PROJECT_ID
```

## 🔑 Firebase Token Format

```json
{
  "iss": "https://securetoken.google.com/YOUR_PROJECT_ID",
  "aud": "YOUR_PROJECT_ID",
  "auth_time": 1234567890,
  "user_id": "...",
  "sub": "...",
  "iat": 1234567890,
  "exp": 1234571490,
  "email": "user@example.com",
  "email_verified": true
}
```

## 🧪 Testing Commands

```bash
# Public endpoint (should work without token)
curl http://kong.development.wapps.com/api/catalog/listings

# Protected endpoint without token (should return 401)
curl http://kong.development.wapps.com/api/catalog/my-listings

# Protected endpoint with token (should work)
curl http://kong.development.wapps.com/api/catalog/my-listings \
  -H "Authorization: Bearer YOUR_TOKEN"

# Decode token to check claims
echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d | jq
```

## 🔍 Debugging

### Check Kong Logs
```bash
kubectl logs -n kong -l app=kong --tail=100 -f
```

### Check Kong Configuration
```bash
kubectl get configmap kong-config -n kong -o yaml
```

### Port-forward Admin API
```bash
kubectl port-forward -n kong svc/kong 8001:8001
curl http://localhost:8001/routes | jq
curl http://localhost:8001/plugins | jq '.data[] | select(.name == "jwt")'
```

### Verify Token
```bash
# Check if token is expired
node -e "console.log(JSON.parse(Buffer.from('TOKEN_PAYLOAD_PART'.split('.')[1], 'base64')))"
```

## 🚨 Common Issues

### Issue: 401 Unauthorized with valid token

**Check:**
- Token not expired (Firebase tokens last 1 hour)
- Issuer in token matches Kong config
- Audience in token matches your project ID
- Kong has correct Firebase project ID

**Fix:**
```bash
# Verify Kong config has correct project ID
kubectl get configmap kong-config -n kong -o yaml | grep securetoken

# Should show: https://securetoken.google.com/YOUR_PROJECT_ID
```

### Issue: CORS errors in browser

**Check:**
- CORS plugin enabled in Kong config
- Correct origins configured

**Fix:**
```yaml
plugins:
  - name: cors
    config:
      origins:
        - "https://your-frontend-domain.com"
      credentials: true
```

### Issue: Token refresh not working

**Fix:**
Firebase handles this automatically. Ensure your interceptor calls:
```typescript
await firebase.auth().currentUser.getIdToken(true) // true = force refresh
```

## 📁 Key Files

| File | Purpose |
|------|---------|
| `platform/cluster/kong/kong.configmap.yaml` | Main Kong configuration with routes and plugins |
| `platform/cluster/kong/kong.firebase-config.yaml` | Firebase-specific config template |
| `environments/dev/platform/kong.overlay.yml` | Dev environment Firebase settings |
| `platform/cluster/kong/README.md` | Detailed documentation |
| `platform/cluster/kong/SETUP-FIREBASE.md` | Step-by-step setup guide |
| `platform/cluster/kong/configure-firebase.sh` | Configuration automation script |
| `platform/cluster/kong/test-firebase-auth.sh` | Testing script |

## 🔐 Security Best Practices

- ✅ Use HTTPS only in production
- ✅ Set specific CORS origins (not `*`)
- ✅ Implement rate limiting per route
- ✅ Monitor 401 error rates
- ✅ Use Kubernetes Secrets for sensitive data
- ✅ Rotate secrets regularly
- ✅ Enable token refresh in frontend
- ✅ Validate audience claim matches your project
- ✅ Set appropriate token expiration (default: 1 hour)

## 📊 Monitoring

**Key Metrics:**
- JWT validation success/failure rate
- 401 error rate by endpoint
- Token expiration patterns
- Kong response latency
- JWKS fetch errors

**Access Metrics:**
```bash
kubectl exec -n kong deployment/kong -- kong health
kubectl top pods -n kong
```

## 🎓 Learning Resources

- [Kong JWT Plugin](https://docs.konghq.com/hub/kong-inc/jwt/)
- [Firebase Auth](https://firebase.google.com/docs/auth)
- [Firebase ID Tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Kong Declarative Config](https://docs.konghq.com/gateway/latest/production/deployment-topologies/db-less-and-declarative-config/)

## 🔄 Workflow

```
┌─────────────┐
│   User      │
│  Logs In    │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Firebase Auth  │
│  Returns JWT    │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Frontend       │
│  Stores Token   │
└──────┬──────────┘
       │
       ▼
┌─────────────────────────┐
│  API Request            │
│  + Authorization Header │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│  Kong API Gateway       │
│  Validates JWT          │
│  ├─ Valid → Forward     │
│  └─ Invalid → 401       │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────┐
│  Backend        │
│  Services       │
│  (No auth       │
│   validation    │
│   needed)       │
└─────────────────┘
```

## 📞 Support

For issues:
1. Check Kong logs: `kubectl logs -n kong -l app=kong`
2. Verify Firebase config in console
3. Test with curl commands
4. Decode JWT to verify claims
5. Check Kong Admin API configuration

## ✅ Checklist

Setup:
- [ ] Firebase project created
- [ ] Firebase Authentication enabled
- [ ] Kong configured with Firebase project ID
- [ ] Kong deployed to cluster
- [ ] Frontend configured with Firebase SDK
- [ ] Routes configured (public/protected/optional)
- [ ] CORS configured

Testing:
- [ ] Can sign in with Firebase
- [ ] Token appears in request headers
- [ ] Public routes work without token
- [ ] Protected routes reject without token
- [ ] Protected routes work with valid token
- [ ] Token refresh works
- [ ] CORS works from browser

Production:
- [ ] Production Firebase project configured
- [ ] HTTPS enforced
- [ ] Specific CORS origins set
- [ ] Rate limiting configured
- [ ] Monitoring set up
- [ ] Alerts configured

