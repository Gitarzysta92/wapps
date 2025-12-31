# Ensuring All Traffic Flows Through Kong

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Host Machine (NGINX)                            │
│  *.development.wapps.com → 127.0.0.1:32080 (ingress-nginx NodePort)    │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                                    │
│                                                                          │
│  ┌────────────────────────────────────────────────────────┐            │
│  │  Ingress-NGINX Controller (Port 32080)                │            │
│  │  Routes based on Host header                           │            │
│  └────────────────────────────┬───────────────────────────┘            │
│                                │                                         │
│        Currently routes to:    │                                         │
│        ├─ aggregator-csr      │                                         │
│        ├─ catalog-bff          │                                         │
│        ├─ editorial            │                                         │
│        └─ ... (direct to services!) ❌                                   │
│                                                                          │
│  ⚠️  PROBLEM: Services are directly exposed via ingress!                │
│      Kong is bypassed!                                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Goal: Route All API Traffic Through Kong

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Host Machine (NGINX)                            │
│  *.development.wapps.com → 127.0.0.1:32080 (ingress-nginx NodePort)    │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                                    │
│                                                                          │
│  ┌────────────────────────────────────────────────────────┐            │
│  │  Ingress-NGINX Controller (Port 32080)                │            │
│  └────────────────────────────┬───────────────────────────┘            │
│                                │                                         │
│  ┌─────────────────────────────┼─────────────────────────────────┐     │
│  │ Routes to Kong for API      │                                 │     │
│  │ traffic:                    │                                 │     │
│  │ • api.*.wapps.com          │                                 │     │
│  │ • /api/* paths             │                                 │     │
│  └─────────────────────────────┼─────────────────────────────────┘     │
│                                ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │              Kong API Gateway (Port 30080)                   │       │
│  │  • Validates JWT tokens                                      │       │
│  │  • Applies rate limiting                                     │       │
│  │  • Routes to backend services                                │       │
│  └────────────────────────┬────────────────────────────────────┘       │
│                           │                                              │
│                  ┌────────┼────────┬──────────────┐                    │
│                  ▼        ▼        ▼              ▼                    │
│           ┌─────────┐ ┌────────┐ ┌────────┐ ┌─────────┐              │
│           │Catalog  │ │Editorial││Aggregator│ │Other    │              │
│           │  BFF    │ │Service  │ │  SSR   │ │Services │              │
│           └─────────┘ └────────┘ └────────┘ └─────────┘              │
│           (No direct ingress!)                                         │
└────────────────────────────────────────────────────────────────────────┘

✅ All API traffic goes through Kong
✅ Frontend apps can still be accessed directly
✅ Kong validates authentication
✅ Services cannot be bypassed
```

## Implementation Strategy

### Option 1: Single API Domain Through Kong (Recommended) ⭐

**All API traffic** goes through `api.development.wapps.com` → Kong:

```
api.development.wapps.com/catalog/* → Kong → catalog-bff
api.development.wapps.com/editorial/* → Kong → editorial
api.development.wapps.com/aggregator/* → Kong → aggregator-ssr
```

**Frontend apps** accessed directly:
```
aggregator-csr.development.wapps.com → ingress-nginx → aggregator-csr
aggregator-ssr.development.wapps.com → ingress-nginx → aggregator-ssr (HTML)
```

### Option 2: Per-Service Domains Through Kong

Each service accessible via Kong:
```
catalog-api.development.wapps.com → Kong → catalog-bff
editorial-api.development.wapps.com → Kong → editorial
```

### Option 3: Path-Based Routing Through Kong

All domains route `/api/*` paths through Kong:
```
*.development.wapps.com/api/* → Kong → backend services
*.development.wapps.com/* → ingress-nginx → frontend apps
```

## Implementation: Option 1 (Recommended)

### Step 1: Create API Ingress to Kong

Create a new ingress that routes all API traffic to Kong:

```yaml
# environments/dev/platform/api-to-kong-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-kong-ingress
  namespace: kong
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
    nginx.ingress.kubernetes.io/ssl-redirect: "false"
    # Important: preserve the original Host header
    nginx.ingress.kubernetes.io/configuration-snippet: |
      proxy_set_header X-Forwarded-Prefix /api;
spec:
  ingressClassName: nginx
  rules:
    # Main API domain - ALL API traffic goes through Kong
    - host: api.development.wapps.com
      http:
        paths:
          - path: /(/|$)(.*)
            pathType: Prefix
            backend:
              service:
                name: kong
                port:
                  number: 8000
    
    # Alternative: Support /api paths on any domain
    - host: "*.development.wapps.com"
      http:
        paths:
          - path: /api(/|$)(.*)
            pathType: Prefix
            backend:
              service:
                name: kong
                port:
                  number: 8000
```

### Step 2: Remove Direct Service Ingresses for APIs

**IMPORTANT**: Remove or disable direct ingress access to backend API services:

```bash
# Remove direct API access (keep frontend ingresses)
# These services should ONLY be accessible via Kong

# Option A: Delete the ingress files
rm apps/services/catalog-bff/provisioning/k8s/ingress.yaml
rm apps/services/editorial/provisioning/k8s/editorial.ingress.yaml

# Option B: Comment them out in ArgoCD applications
# Or add annotations to disable them
```

**Keep frontend app ingresses** (users need direct access):
```
aggregator-csr.development.wapps.com → OK (frontend)
aggregator-ssr.development.wapps.com → OK (frontend + API)
```

### Step 3: Update Kong Configuration

Ensure Kong routes match the expected paths:

```yaml
# platform/cluster/kong/kong.configmap.yaml
services:
  - name: catalog-bff-service
    url: http://catalog-bff-service.catalog:80  # Internal service URL
    
  - name: editorial-service
    url: http://editorial.editorial:1337
    
  - name: aggregator-ssr-service
    url: http://aggregator-ssr-service.aggregator:80

routes:
  # Catalog BFF - Public
  - name: catalog-public-route
    service: catalog-bff-service
    hosts:
      - api.development.wapps.com
    paths:
      - /catalog/listings
      - /catalog/search
    strip_path: false  # Keep /catalog in the path
    
  # Catalog BFF - Protected
  - name: catalog-protected-route
    service: catalog-bff-service
    hosts:
      - api.development.wapps.com
    paths:
      - /catalog/my-listings
      - /catalog/favorites
    strip_path: false
    plugins:
      - name: jwt
        config:
          issuer: https://securetoken.google.com/YOUR_PROJECT_ID
          claims_to_verify:
            - exp
  
  # Editorial Service
  - name: editorial-route
    service: editorial-service
    hosts:
      - api.development.wapps.com
    paths:
      - /editorial
    strip_path: false
    
  # Aggregator SSR API
  - name: aggregator-api-route
    service: aggregator-ssr-service
    hosts:
      - api.development.wapps.com
    paths:
      - /aggregator
    strip_path: false
```

### Step 4: Update Frontend API URLs

Update your frontend to use the Kong gateway:

```typescript
// apps/portals/aggregator-demo/application/src/environments/environment.ts
export const environment = {
  production: false,
  apiBaseUrl: 'http://api.development.wapps.com',  // All APIs through Kong
  authApiUrl: 'http://api.development.wapps.com/auth',
  
  // Service-specific endpoints
  endpoints: {
    catalog: 'http://api.development.wapps.com/catalog',
    editorial: 'http://api.development.wapps.com/editorial',
    aggregator: 'http://api.development.wapps.com/aggregator',
  }
};
```

### Step 5: Configure Network Policies (Optional but Recommended)

Ensure backend services can ONLY be accessed via Kong:

```yaml
# platform/cluster/kong/backend-network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: catalog-bff-allow-kong-only
  namespace: catalog
spec:
  podSelector:
    matchLabels:
      app: catalog-bff
  policyTypes:
    - Ingress
  ingress:
    # Allow traffic ONLY from Kong namespace
    - from:
      - namespaceSelector:
          matchLabels:
            name: kong
      ports:
      - protocol: TCP
        port: 80
    
    # Allow traffic from same namespace (for health checks, etc.)
    - from:
      - podSelector: {}
      ports:
      - protocol: TCP
        port: 80

---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: editorial-allow-kong-only
  namespace: editorial
spec:
  podSelector:
    matchLabels:
      app: editorial
  policyTypes:
    - Ingress
  ingress:
    - from:
      - namespaceSelector:
          matchLabels:
            name: kong
      ports:
      - protocol: TCP
        port: 1337
    - from:
      - podSelector: {}
      ports:
      - protocol: TCP
        port: 1337
```

### Step 6: Label Kong Namespace

```bash
kubectl label namespace kong name=kong
```

### Step 7: Deploy Configuration

```bash
# 1. Apply API ingress to Kong
kubectl apply -f environments/dev/platform/api-to-kong-ingress.yaml

# 2. Update Kong configuration
kubectl apply -f platform/cluster/kong/kong.configmap.yaml
kubectl rollout restart deployment/kong -n kong

# 3. Remove direct service ingresses
kubectl delete ingress catalog-bff-ingress -n catalog
kubectl delete ingress editorial-ingress -n editorial

# 4. Apply network policies (optional)
kubectl apply -f platform/cluster/kong/backend-network-policy.yaml

# 5. Verify
kubectl get ingress -A
kubectl get networkpolicies -A
```

## Verification

### Test Traffic Flow

```bash
# 1. Test API through Kong (should work)
curl http://api.development.wapps.com/catalog/listings
curl http://api.development.wapps.com/editorial

# 2. Try to bypass Kong (should fail with network policy)
curl http://catalog-bff-service.catalog.svc.cluster.local

# 3. Test with authentication
curl http://api.development.wapps.com/catalog/my-listings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 4. Check Kong logs
kubectl logs -n kong -l app=kong --tail=50 -f
```

### Verify No Direct Access

```bash
# These should NOT have ingress (except Kong's own ingress)
kubectl get ingress -n catalog
kubectl get ingress -n editorial

# Should return "No resources found" or only Kong ingress
```

### Check Network Policies

```bash
# Verify policies are applied
kubectl get networkpolicies -A

# Test from a pod in different namespace (should fail)
kubectl run test-pod --rm -i --tty --image=curlimages/curl -- sh
curl http://catalog-bff-service.catalog
# Should timeout or be rejected
```

## Traffic Flow Diagram

### Before (Direct Access - Insecure)

```
Browser
  │
  ├─→ aggregator-csr.dev.wapps.com → Ingress-NGINX → aggregator-csr ✓
  │
  ├─→ api.wapps.local/catalog → Ingress-NGINX → catalog-bff ❌ (bypasses Kong!)
  │
  └─→ editorial-service.wapps.com → Ingress-NGINX → editorial ❌ (bypasses Kong!)
```

### After (All API via Kong - Secure)

```
Browser
  │
  ├─→ aggregator-csr.dev.wapps.com → Ingress-NGINX → aggregator-csr ✓
  │
  ├─→ api.dev.wapps.com/catalog → Ingress-NGINX → Kong → catalog-bff ✓
  │                                                    │
  │                                          (JWT validation,
  │                                           rate limiting,
  │                                           logging)
  │
  └─→ api.dev.wapps.com/editorial → Ingress-NGINX → Kong → editorial ✓
```

## Complete Configuration Example

Here's a complete example with all pieces:

```yaml
# environments/dev/platform/kong-api-gateway.yaml
---
# Ingress: Route API traffic to Kong
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-gateway-ingress
  namespace: kong
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "false"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
spec:
  ingressClassName: nginx
  rules:
    - host: api.development.wapps.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: kong
                port:
                  number: 8000

---
# NetworkPolicy: Catalog BFF only accessible from Kong
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: catalog-bff-kong-only
  namespace: catalog
spec:
  podSelector:
    matchLabels:
      app: catalog-bff
  policyTypes:
    - Ingress
  ingress:
    - from:
      - namespaceSelector:
          matchLabels:
            name: kong

---
# NetworkPolicy: Editorial only accessible from Kong
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: editorial-kong-only
  namespace: editorial
spec:
  podSelector:
    matchLabels:
      app: editorial
  policyTypes:
    - Ingress
  ingress:
    - from:
      - namespaceSelector:
          matchLabels:
            name: kong
```

## Alternative: Host-Level Routing

If you want to route at the host NGINX level:

```nginx
# platform/host/nginx/templates/nginx-site.conf.j2

# API Gateway - route all API traffic to Kong
server {
    listen 80;
    listen 443 ssl http2;
    server_name api.{{ target_env }}.wapps.com;
    
    # SSL configuration
    ssl_certificate /etc/ssl/certs/nginx-selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/nginx-selfsigned.key;
    
    # Route to Kong (bypassing ingress-nginx)
    location / {
        proxy_pass http://127.0.0.1:30080;  # Kong NodePort directly
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

## Monitoring

### Kong Access Logs

```bash
# Watch Kong logs to see all API traffic
kubectl logs -n kong -l app=kong --tail=100 -f

# You should see:
# - All API requests coming through
# - JWT validation
# - Route matching
# - Upstream service calls
```

### Verify Traffic Pattern

```bash
# All API requests should show in Kong logs
kubectl logs -n kong -l app=kong | grep "GET /catalog"

# Backend service logs should show requests from Kong IP
kubectl logs -n catalog -l app=catalog-bff | grep "X-Forwarded-For"
```

## Troubleshooting

### Problem: Services still accessible directly

**Solution**: Check and remove direct ingresses:
```bash
kubectl get ingress -A | grep -E "catalog|editorial"
kubectl delete ingress <ingress-name> -n <namespace>
```

### Problem: Network policy blocks legitimate traffic

**Solution**: Check namespace labels:
```bash
kubectl get namespace kong --show-labels
# Should have: name=kong

# If missing:
kubectl label namespace kong name=kong
```

### Problem: 404 from Kong

**Solution**: Check Kong routes:
```bash
kubectl port-forward -n kong svc/kong 8001:8001
curl http://localhost:8001/routes | jq '.data[] | {name, hosts, paths}'
```

## Summary

To ensure all API traffic goes through Kong:

1. ✅ **Create ingress** that routes `api.development.wapps.com` to Kong
2. ✅ **Remove direct service ingresses** for backend APIs
3. ✅ **Update Kong routes** to handle all API paths
4. ✅ **Apply network policies** to enforce Kong-only access
5. ✅ **Update frontend** to use Kong API URL
6. ✅ **Test and verify** traffic flows through Kong

This ensures:
- 🔒 All API requests are authenticated by Kong
- 🛡️ Rate limiting and security policies applied
- 📊 Centralized logging and monitoring
- ⚠️ Backend services cannot be bypassed

See the `api-to-kong-ingress.yaml` example above for complete configuration.

