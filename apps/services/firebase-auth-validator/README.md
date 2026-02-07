# Firebase Auth Validator

Authentication BFF (Backend-for-Frontend) service that handles:
1. Token validation for ingress-nginx external auth
2. Authentication flows for frontend apps (email/password, OAuth providers)

## Overview

This service provides two main functions:
- **Token Validation**: Validates Firebase JWT tokens for ingress-nginx external auth pattern
- **Authentication BFF**: Provides authentication endpoints for frontend apps, keeping all secrets on the backend

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Authentication Flow                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Frontend App                 firebase-auth-validator       Firebase    │
│  (no secrets)                     (has secrets)                         │
│       │                              │                         │        │
│       │  POST /auth/signin           │                         │        │
│       │ ────────────────────────────►│  REST API call          │        │
│       │                              │ ────────────────────────►│        │
│       │                              │◄───────────────────────  │        │
│       │◄──────────────────────────── │  JWT token              │        │
│       │     { token, refreshToken }  │                         │        │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                            API Request Flow                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Frontend App          ingress-nginx    firebase-auth-validator         │
│       │                     │                    │                      │
│       │  API request        │                    │                      │
│       │  + Bearer token     │                    │                      │
│       │ ───────────────────►│  GET /validate     │                      │
│       │                     │ ──────────────────►│                      │
│       │                     │◄─────────────────  │                      │
│       │                     │  200 + X-User-Id   │                      │
│       │◄─────────────────── │                    │                      │
│       │    Response         │                    │                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Endpoints

### Health & Documentation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check endpoint |
| `/api-docs` | GET | Interactive Swagger/OpenAPI documentation |

### Token Validation (for ingress-nginx)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/validate` | GET | Validates Firebase JWT token. Returns 401 if invalid. |
| `/validate-optional` | GET | Validates token if present, allows anonymous access otherwise. |

**Headers added on successful validation:**
- `X-User-Id`: Firebase user ID
- `X-User-Email`: User email
- `X-Auth-Time`: Authentication timestamp
- `X-User-Claims`: Custom claims (JSON)
- `X-Anonymous`: "true" if anonymous access (validate-optional only)

### Authentication BFF (for frontend apps)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/methods` | GET | Get available authentication methods |
| `/auth/signin` | POST | Sign in with email/password |
| `/auth/signin/anonymous` | POST | Sign in anonymously |
| `/auth/signin/oauth` | POST | Exchange OAuth code for token |
| `/auth/refresh` | POST | Refresh authentication token |
| `/auth/signout` | POST | Sign out (cleanup) |
| `/auth/oauth/:provider/authorize` | GET | Get OAuth authorization URL |

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 8080 | Server port |
| `FIREBASE_PROJECT_ID` | Yes | - | Firebase project ID |
| `FIREBASE_WEB_API_KEY` | Yes* | - | Firebase Web API Key (for auth BFF) |
| `INGRESS_AUTH_SECRET` | No | - | Shared secret for backend validation |
| `ALLOWED_ORIGINS` | No | - | Comma-separated CORS origins |
| `ENABLE_EMAIL_PASSWORD` | No | true | Enable email/password auth |
| `ENABLE_GOOGLE` | No | false | Enable Google OAuth |
| `ENABLE_GITHUB` | No | false | Enable GitHub OAuth |
| `ENABLE_ANONYMOUS` | No | false | Enable anonymous auth |
| `GOOGLE_CLIENT_ID` | No* | - | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No* | - | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | No* | - | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | No* | - | GitHub OAuth client secret |

\* Required if the corresponding feature is enabled.

**Note:** The bundled Kubernetes deployment (`provisioning/k8s/deployment.yaml`) reads from the `firebase-config` secret. For email/password sign-in to work, ensure that secret contains the key `web-api-key` (Firebase Web API Key). Without it, `POST /auth/signin` returns 500 with "Email/password authentication not configured".

### Kubernetes ConfigMap & Secret

```yaml
# ConfigMap - Public identifiers (not secret)
apiVersion: v1
kind: ConfigMap
metadata:
  name: firebase-auth-validator-config
data:
  FIREBASE_PROJECT_ID: "your-project-id"
  GOOGLE_CLIENT_ID: "123456789.apps.googleusercontent.com"
  GITHUB_CLIENT_ID: "your-github-client-id"
  ENABLE_EMAIL_PASSWORD: "true"
  ENABLE_GOOGLE: "true"
  ENABLE_GITHUB: "true"
  ENABLE_ANONYMOUS: "true"
---
# Secret - Actual secrets (must protect!)
apiVersion: v1
kind: Secret
metadata:
  name: firebase-auth-validator-secrets
type: Opaque
stringData:
  FIREBASE_WEB_API_KEY: "AIza..."
  GOOGLE_CLIENT_SECRET: "GOCSPX-..."
  GITHUB_CLIENT_SECRET: "ghp_..."
  INGRESS_AUTH_SECRET: "shared-secret-for-backend-validation"
```

## Usage

### Frontend Integration

The frontend builds the auth URL dynamically based on `ENVIRONMENT_NAME`:

```typescript
// In environment.ts (patched by CI)
export const ENVIRONMENT_NAME = "development"; // Set by CI

// URL is built as: auth.<environment>.wapps.ai
export const AUTH_BFF_URL = buildServiceUrl("auth");
// Results in: https://auth.development.wapps.ai

// In root.ts
provideIdentityLoginFeature({
  validationMessages: LOGIN_VALIDATION_MESSAGES,
  authBffUrl: AUTH_BFF_URL || undefined
})
```

### ingress-nginx Integration

```yaml
# Protected route (auth required)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-protected-api
  annotations:
    nginx.ingress.kubernetes.io/auth-url: "http://firebase-auth-validator.default.svc.cluster.local/validate"
    nginx.ingress.kubernetes.io/auth-response-headers: "X-User-Id,X-User-Email,X-Ingress-Auth"
spec:
  rules:
  - host: api.development.wapps.ai
    http:
      paths:
      - path: /my-api
        pathType: Prefix
        backend:
          service:
            name: my-service
            port:
              number: 80

---
# Optional auth route
metadata:
  annotations:
    nginx.ingress.kubernetes.io/auth-url: "http://firebase-auth-validator.default.svc.cluster.local/validate-optional"
    nginx.ingress.kubernetes.io/auth-response-headers: "X-User-Id,X-User-Email,X-Anonymous,X-Ingress-Auth"
```

## Development

```bash
# Install dependencies (from workspace root)
npm install

# Run locally with Nx
npx nx serve apps.services.firebase-auth-validator

# Build
npx nx build apps.services.firebase-auth-validator
```

## Docker

```bash
# Build image
docker build -t firebase-auth-validator -f apps/services/firebase-auth-validator/Dockerfile .

# Run locally
docker run -p 8080:8080 \
  -e FIREBASE_PROJECT_ID=your-project-id \
  -e FIREBASE_WEB_API_KEY=your-web-api-key \
  -e ENABLE_EMAIL_PASSWORD=true \
  firebase-auth-validator
```

## Testing

```bash
# Health check
curl http://localhost:8080/health

# Get available auth methods
curl http://localhost:8080/auth/methods

# Sign in with email/password
curl -X POST http://localhost:8080/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'

# Validate token
TOKEN="your-firebase-id-token"
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/validate
```

## Security Considerations

1. **No secrets in frontend**: Frontend only needs the BFF URL
2. **OAuth secrets on backend**: Client secrets never leave the server
3. **CORS protection**: Configure `ALLOWED_ORIGINS` for production
4. **Ingress auth secret**: Backend services can verify requests came through ingress

## Benefits

- ✅ **Zero secrets in frontend** - Only the BFF URL is needed
- ✅ **Provider agnostic** - Frontend doesn't know about Firebase
- ✅ **Easy to switch** - Can migrate to Auth0/Keycloak without frontend changes
- ✅ **Centralized auth logic** - Single place to audit and secure
- ✅ **Multiple providers** - Email, Google, GitHub, anonymous
- ✅ **Token validation** - Integrates with ingress-nginx
