# Kong API Gateway - Firebase Authentication Integration

## 🚀 Quick Start (Automated)

**New!** Kong is now fully automated via GitHub Actions. Just push your code!

```bash
# 1. Add GitHub Secrets (one time - see AUTOMATION-COMPLETE.md)
# 2. Push your changes
git push origin develop
# 3. Done! GitHub Actions deploys automatically ✨
```

See **[AUTOMATION-COMPLETE.md](./AUTOMATION-COMPLETE.md)** for complete setup.

---

## Overview

This Kong deployment is configured to act as the central API Gateway for the wapps platform, providing:
- Request routing to backend services
- Rate limiting and traffic control
- **Firebase JWT authentication validation**
- CORS handling
- Response transformation
- **Automated deployment via GitHub Actions** ⭐

## Architecture

Kong runs in **DB-less mode** (declarative configuration) with:
- 3 replicas (2 in dev)
- NodePort service exposure on ports 30080 (HTTP), 30443 (HTTPS), 30081 (Admin)
- HPA (Horizontal Pod Autoscaling) enabled
- Configuration via ConfigMap mounted at `/kong/declarative/kong.yml`

## Firebase Authentication Integration

### How It Works

1. **Client Authentication Flow**:
   - User authenticates with Firebase (email/password, Google, etc.)
   - Firebase returns a JWT (ID token)
   - Client includes token in `Authorization: Bearer <token>` header

2. **Kong Validation**:
   - Kong intercepts requests
   - JWT plugin validates the token signature using Firebase's public keys (JWKS)
   - Validates claims: `iss` (issuer), `aud` (audience), `exp` (expiration)
   - If valid, forwards request to upstream service
   - If invalid, returns 401 Unauthorized

3. **Upstream Service**:
   - Receives validated request with original JWT in header
   - Can extract user info from JWT claims (uid, email, etc.)
   - No need to re-validate token (Kong already did)

### JWT Plugin Configuration

The JWT plugin is configured with:

```yaml
plugins:
- name: jwt
  config:
    uri_param_names:
      - jwt
    key_claim_name: kid
    secret_is_base64: false
    claims_to_verify:
      - exp
      - iss
    run_on_preflight: false
```

### Consumer Configuration

For Firebase, we create a Kong consumer with credentials matching Firebase's JWT parameters:

- **Issuer (`iss`)**: `https://securetoken.google.com/{PROJECT_ID}`
- **Key ID (`kid`)**: Fetched from Firebase JWKS endpoint
- **Algorithm**: RS256 (RSA with SHA-256)
- **JWKS URI**: `https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com`

### Protected vs Public Routes

Routes can be configured with different security levels:

1. **Protected Routes** (require authentication):
   - Apply JWT plugin at route level
   - Examples: `/api/catalog/my-listings`, `/api/user/profile`

2. **Public Routes** (no authentication):
   - No JWT plugin applied
   - Examples: `/api/catalog/search`, `/api/catalog/listings`

3. **Optional Authentication**:
   - Use `config.anonymous` to allow both authenticated and anonymous access
   - Backend can check for JWT presence to provide personalized responses

## Configuration Files

### Main Configuration
- `kong.configmap.yaml` - Declarative configuration with routes, services, and plugins
- `kong.deployment.yaml` - Kubernetes deployment spec
- `kong.service.yaml` - NodePort service for cluster access
- `kong.hpa.yaml` - Horizontal Pod Autoscaler configuration
- `kong.ingress.yaml` - Ingress resource for external access
- `kong.namespace.yaml` - Namespace definition

### Environment Overlays
- `environments/dev/platform/kong.overlay.yml` - Development-specific settings
- `environments/prod/platform/kong.overlay.yml` - Production-specific settings (future)

## Firebase Project Configuration

To integrate with Firebase, you need:

1. **Firebase Project ID**: Your Firebase project identifier
2. **JWKS Endpoint**: `https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com`
3. **Issuer**: `https://securetoken.google.com/{PROJECT_ID}`
4. **Audience**: `{PROJECT_ID}` (same as project ID)

These values should be configured in environment-specific overlays.

## Testing Authentication

### 1. Get a Firebase ID Token

Using Firebase SDK in your frontend:

```typescript
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;
if (user) {
  const token = await user.getIdToken();
  console.log('Firebase Token:', token);
}
```

### 2. Test with curl

```bash
# Without token (should fail with 401)
curl -v http://kong.development.wapps.com/api/catalog/my-listings

# With valid token (should succeed)
curl -v http://kong.development.wapps.com/api/catalog/my-listings \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

### 3. Check Kong Logs

```bash
kubectl logs -n kong -l app=kong --tail=100 -f
```

## Route Configuration Examples

### Public Route (No Auth)
```yaml
- name: public-listings-route
  service: catalog-bff-service
  paths:
    - /api/catalog/listings
  strip_path: false
  plugins:
    - name: rate-limiting
      config:
        minute: 100
```

### Protected Route (Auth Required)
```yaml
- name: my-listings-route
  service: catalog-bff-service
  paths:
    - /api/catalog/my-listings
  strip_path: false
  plugins:
    - name: jwt
      config:
        uri_param_names:
          - jwt
        claims_to_verify:
          - exp
          - iss
    - name: rate-limiting
      config:
        minute: 60
```

### Optional Auth Route
```yaml
- name: personalized-feed-route
  service: catalog-bff-service
  paths:
    - /api/feed
  strip_path: false
  plugins:
    - name: jwt
      config:
        anonymous: anonymous-consumer
        uri_param_names:
          - jwt
        claims_to_verify:
          - exp
          - iss
```

## Admin API Access

Kong Admin API is exposed on port 30081 (internal only):

```bash
# List all routes
curl http://localhost:30081/routes

# List all services
curl http://localhost:30081/services

# Check plugin configuration
curl http://localhost:30081/plugins
```

## Troubleshooting

### Token Validation Fails

**Issue**: 401 Unauthorized even with valid Firebase token

**Possible Causes**:
1. Incorrect Firebase Project ID in configuration
2. Token expired (Firebase tokens expire after 1 hour)
3. JWKS keys not cached/refreshed properly
4. Issuer (`iss`) claim mismatch

**Solutions**:
```bash
# Decode JWT to check claims
echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d | jq

# Verify issuer and audience match your Firebase project
# Check token expiration time
```

### CORS Issues

**Issue**: CORS errors in browser

**Solution**: Ensure CORS plugin is configured globally or on specific routes:

```yaml
plugins:
  - name: cors
    config:
      origins:
        - "https://your-frontend-domain.com"
      methods:
        - GET
        - POST
        - PUT
        - DELETE
        - OPTIONS
      headers:
        - Accept
        - Authorization
        - Content-Type
      credentials: true
```

### High Latency

**Issue**: Slow response times

**Possible Causes**:
1. JWKS fetching on every request
2. Resource limits too low
3. Too few replicas

**Solutions**:
- Kong caches JWKS keys automatically
- Increase resource limits in deployment
- Scale up replicas via HPA or manual scaling

## Performance Considerations

- **JWKS Caching**: Kong caches public keys from Firebase JWKS endpoint
- **Token Validation**: Validation happens in-memory after initial JWKS fetch
- **Resource Usage**: JWT validation adds ~1-2ms latency per request
- **Scaling**: HPA configured to scale based on CPU (70%) and Memory (80%)

## Security Best Practices

1. **Token Storage**: Store Firebase tokens securely (HttpOnly cookies or secure storage)
2. **Token Refresh**: Implement token refresh logic in frontend (Firebase does this automatically)
3. **HTTPS Only**: Always use HTTPS in production
4. **Rate Limiting**: Apply appropriate rate limits per route
5. **Audience Validation**: Always validate the `aud` claim matches your project
6. **Scope/Claims**: Use custom claims for role-based access control (RBAC)

## Monitoring

Key metrics to monitor:
- JWT validation success/failure rates
- Request latency with JWT validation
- JWKS fetch errors
- 401 unauthorized rate
- Token expiration patterns

Access metrics via Kong Admin API:
```bash
curl http://localhost:30081/metrics
```

## Future Enhancements

- [ ] Add custom claims validation for RBAC
- [ ] Implement token introspection for revocation checking
- [ ] Add request/response logging plugin
- [ ] Set up Prometheus metrics export
- [ ] Add OpenTelemetry tracing
- [ ] Implement API key fallback for service-to-service communication
- [ ] Add GraphQL support with authentication

## References

- [Kong JWT Plugin Documentation](https://docs.konghq.com/hub/kong-inc/jwt/)
- [Firebase ID Token Verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Kong Declarative Configuration](https://docs.konghq.com/gateway/latest/production/deployment-topologies/db-less-and-declarative-config/)
- [Firebase JWKS Endpoint](https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com)

