# Authentication Security Model

## Overview

This document explains how authentication headers are validated to prevent spoofing attacks.

## The Problem

When using ingress-nginx external auth, the backend services receive headers like `X-User-Id` and `X-User-Email`. Without proper validation, anyone with cluster access could send fake headers:

```bash
# ⚠️ Without validation, this would work!
curl -H "X-User-Id: victim-user-id" \
     http://catalog-bff.catalog.svc.cluster.local/api/my-listings
```

## Security Layers

### Layer 1: Network Policies

**File:** `environments/dev/platform/backend-network-policies.yaml`

Network policies restrict backend services to only accept traffic from:
- `ingress-nginx` namespace
- Same namespace (for service-to-service)
- `kube-system` (for health checks)

```yaml
ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          app.kubernetes.io/name: ingress-nginx
```

**Protection:** Prevents external direct access to backend services.

**Limitation:** Doesn't prevent attacks from compromised pods within the cluster.

### Layer 2: Shared Secret Validation

**Files:**
- `apps/services/firebase-auth-validator/src/main.ts`
- `apps/services/catalog-bff/src/app/middleware/auth-validation.middleware.ts`

A shared secret (`INGRESS_AUTH_SECRET`) is used to verify that authentication headers actually came from the firebase-auth-validator service via ingress-nginx.

#### Flow:

```
1. Client → ingress-nginx
   Authorization: Bearer <firebase-token>

2. ingress-nginx → firebase-auth-validator
   /validate endpoint

3. firebase-auth-validator validates token
   ✓ Token valid

4. firebase-auth-validator → ingress-nginx
   X-User-Id: abc123
   X-User-Email: user@example.com
   X-Ingress-Auth: <shared-secret>

5. ingress-nginx → backend service
   (forwards all headers)

6. backend service validates
   ✓ X-Ingress-Auth matches expected secret
   ✓ Headers are trusted
```

## Configuration

### 1. Generate Shared Secret

```bash
# Generate a random secret
openssl rand -base64 32
```

### 2. Set in Kubernetes

```bash
# Create secret
kubectl create secret generic ingress-auth-secret \
  --from-literal=secret=<your-generated-secret> \
  --namespace=default

# Reference in firebase-auth-validator deployment
kubectl patch deployment firebase-auth-validator -n default --type='json' -p='[
  {
    "op": "add",
    "path": "/spec/template/spec/containers/0/env/-",
    "value": {
      "name": "INGRESS_AUTH_SECRET",
      "valueFrom": {
        "secretKeyRef": {
          "name": "ingress-auth-secret",
          "key": "secret"
        }
      }
    }
  }
]'

# Reference in catalog-bff deployment
kubectl patch deployment catalog-bff -n catalog --type='json' -p='[
  {
    "op": "add",
    "path": "/spec/template/spec/containers/0/env/-",
    "value": {
      "name": "INGRESS_AUTH_SECRET",
      "valueFrom": {
        "secretKeyRef": {
          "name": "ingress-auth-secret",
          "key": "secret"
        }
      }
    }
  }
]'
```

### 3. Update Ingress Configuration

Ensure `X-Ingress-Auth` is in the response headers list:

```yaml
nginx.ingress.kubernetes.io/auth-response-headers: "X-User-Id,X-User-Email,X-Auth-Time,X-User-Claims,X-Ingress-Auth"
```

## Usage in Backend Services

### Apply Middleware

```typescript
// app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AuthValidationMiddleware } from './middleware/auth-validation.middleware';

@Module({
  // ...
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthValidationMiddleware)
      .forRoutes('*'); // Apply to all routes
  }
}
```

### Use in Controllers

```typescript
import { Controller, Get } from '@nestjs/common';
import { AuthUser, AuthenticatedUser } from './decorators/auth-user.decorator';

@Controller('catalog')
export class CatalogController {
  // Required authentication
  @Get('my-listings')
  getMyListings(@AuthUser() user: AuthenticatedUser) {
    return this.catalogService.getUserListings(user.userId);
  }

  // Optional authentication
  @Get('personalized')
  getPersonalized(@AuthUser({ optional: true }) user?: AuthenticatedUser) {
    if (user?.isAnonymous) {
      return this.catalogService.getPublicContent();
    }
    return this.catalogService.getPersonalizedContent(user.userId);
  }
}
```

## Attack Scenarios & Protections

### Scenario 1: External Attacker

**Attack:** Send request directly to backend service
```bash
curl -H "X-User-Id: fake" http://catalog-bff.catalog/api/my-listings
```

**Protection:** Network policy blocks external access

---

### Scenario 2: Compromised Pod in Cluster

**Attack:** Pod sends fake headers directly to backend
```bash
# From inside a pod
curl -H "X-User-Id: fake" http://catalog-bff.catalog/api/my-listings
```

**Protection:** 
- Network policy blocks (if not from ingress-nginx namespace)
- If somehow reaches backend, middleware checks `X-Ingress-Auth` header
- Request rejected: missing or invalid secret

---

### Scenario 3: Man-in-the-Middle in Cluster

**Attack:** Intercept and modify traffic between ingress and backend

**Protection:** 
- Shared secret cannot be guessed
- Attacker would need to compromise both firebase-auth-validator and backend service configurations

---

### Scenario 4: Direct Call to firebase-auth-validator

**Attack:** Call firebase-auth-validator directly with fake token
```bash
curl http://firebase-auth-validator.default/validate
```

**Protection:** 
- Firebase Admin SDK validates token with Google's servers
- Invalid tokens are rejected
- Secret is only added to valid responses

## Monitoring

### Check for Invalid Auth Attempts

```bash
# Check catalog-bff logs for auth failures
kubectl logs -n catalog -l app=catalog-bff | grep "Invalid authentication headers"

# Check firebase-auth-validator logs for token validation failures
kubectl logs -n default -l app=firebase-auth-validator | grep "validation failed"
```

### Verify Secret is Set

```bash
# Firebase auth validator
kubectl exec -n default deployment/firebase-auth-validator -- env | grep INGRESS_AUTH_SECRET

# Catalog BFF
kubectl exec -n catalog deployment/catalog-bff -- env | grep INGRESS_AUTH_SECRET
```

## Best Practices

1. **Rotate the secret regularly** (e.g., every 90 days)
2. **Use different secrets per environment** (dev/staging/prod)
3. **Never commit secrets to git**
4. **Monitor logs for unauthorized access attempts**
5. **Use network policies for all backend services**
6. **Keep Firebase Admin SDK updated**

## References

- [ingress-nginx External Auth](https://kubernetes.github.io/ingress-nginx/examples/auth/external-auth/)
- [Kubernetes Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

