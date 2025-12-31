# Firebase Auth Validator

External authentication service for ingress-nginx that validates Firebase JWT tokens.

## Overview

This service validates Firebase authentication tokens for ingress-nginx using the external auth pattern. It replaces Kong API Gateway with a simpler, Firebase-specific solution.

## How It Works

```
Client → ingress-nginx → firebase-auth-validator → Backend
         [checks auth]   [validates Firebase JWT]
```

1. Client sends request with `Authorization: Bearer <firebase-token>`
2. ingress-nginx forwards auth check to this service
3. Service validates token with Firebase Admin SDK
4. If valid: returns 200 + user headers
5. If invalid: returns 401
6. ingress-nginx allows/blocks request accordingly

## Endpoints

### `GET /validate`
Validates Firebase JWT token. Returns 401 if no token or invalid token.

**Headers added on success:**
- `X-User-Id`: Firebase user ID
- `X-User-Email`: User email
- `X-Auth-Time`: Authentication timestamp
- `X-User-Claims`: Custom claims (JSON)

### `GET /validate-optional`
Allows requests without token (anonymous access). Validates token if present.

**Headers added:**
- `X-Anonymous: true` (if no token)
- `X-User-Id`, `X-User-Email` (if valid token)

### `GET /health`
Health check endpoint.

## Configuration

### Environment Variables

- `PORT`: Server port (default: 8080)
- `FIREBASE_PROJECT_ID`: Your Firebase project ID (required)

### Kubernetes Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: firebase-config
stringData:
  project-id: "your-firebase-project-id"
```

## Usage with ingress-nginx

### Protected Route (Auth Required)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-protected-api
  annotations:
    nginx.ingress.kubernetes.io/auth-url: "http://firebase-auth-validator.default.svc.cluster.local/validate"
    nginx.ingress.kubernetes.io/auth-response-headers: "X-User-Id,X-User-Email"
spec:
  rules:
  - host: api.development.wapps.com
    http:
      paths:
      - path: /my-listings
        pathType: Prefix
        backend:
          service:
            name: my-service
            port:
              number: 80
```

### Optional Auth Route

```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/auth-url: "http://firebase-auth-validator.default.svc.cluster.local/validate-optional"
    nginx.ingress.kubernetes.io/auth-response-headers: "X-User-Id,X-User-Email,X-Anonymous"
```

## Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Build
npm run build

# Run built version
npm start
```

## Docker

```bash
# Build image
docker build -t firebase-auth-validator .

# Run locally
docker run -p 8080:8080 \
  -e FIREBASE_PROJECT_ID=your-project-id \
  firebase-auth-validator
```

## Testing

```bash
# Get a Firebase token from your app
TOKEN="your-firebase-id-token"

# Test validation
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/validate

# Test without token (should fail)
curl http://localhost:8080/validate

# Test optional auth without token (should succeed)
curl http://localhost:8080/validate-optional
```

## Deployment

Deploy to Kubernetes:

```bash
# Update secret with your Firebase Project ID
kubectl apply -f k8s/deployment.yaml
```

The service will be available at:
- `http://firebase-auth-validator.default.svc.cluster.local`

## Benefits Over Kong

- ✅ Firebase Admin SDK (official, maintained)
- ✅ Written in TypeScript (easier to maintain)
- ✅ Simpler architecture
- ✅ No complex plugin system
- ✅ Easy to customize and extend
- ✅ Better error messages and logging

