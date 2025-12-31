# Kong + Firebase Authentication - Setup Guide

This guide walks you through setting up Firebase authentication with Kong API Gateway in your wapps platform.

## Prerequisites

1. Firebase project created (or create a new one at https://console.firebase.google.com)
2. Kong deployed in your Kubernetes cluster
3. kubectl access to your cluster
4. Firebase Authentication enabled in your Firebase project

## Step 1: Get Firebase Credentials

### 1.1 Find Your Firebase Project ID

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click the gear icon (⚙️) → Project Settings
4. Copy your **Project ID** (e.g., `wapps-dev-12345`)

### 1.2 Enable Firebase Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable the providers you want to use:
   - Email/Password
   - Google
   - Facebook
   - etc.

### 1.3 Get Public Keys Information

Firebase automatically provides public keys for JWT verification at:
```
https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com
```

No additional configuration needed - Kong will fetch these automatically.

## Step 2: Update Kong Configuration

### 2.1 Update Environment-Specific Configuration

Edit `environments/dev/platform/kong.overlay.yml`:

```yaml
firebase:
  enabled: true
  projectId: "your-actual-firebase-project-id"  # Replace this!
  jwt:
    issuer: "https://securetoken.google.com/your-actual-firebase-project-id"  # Replace this!
    audience: "your-actual-firebase-project-id"  # Replace this!
    jwksUri: "https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com"
    maxExpiration: 3600
    algorithms:
      - RS256
```

### 2.2 Update Kong ConfigMap Template

The `kong.configmap.yaml` contains placeholders like `{{ FIREBASE_PROJECT_ID }}`. These need to be replaced with actual values.

**Option A: Manual Replacement**

Edit `platform/cluster/kong/kong.configmap.yaml` and replace all `{{ FIREBASE_PROJECT_ID }}` with your actual project ID.

**Option B: Use Kustomize (Recommended)**

Create a kustomize patch file:

```yaml
# environments/dev/platform/kong-firebase-patch.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: kong-config
  namespace: kong
data:
  kong.yml: |
    # ... (full config with actual Firebase project ID)
```

### 2.3 Update JWT Credentials

In `kong.configmap.yaml`, update the consumer JWT credentials:

```yaml
consumers:
- username: firebase-user
  custom_id: firebase-authenticated

jwt_secrets:
- consumer: firebase-user
  key: https://securetoken.google.com/YOUR_ACTUAL_PROJECT_ID
  algorithm: RS256
  secret: "firebase-jwt-secret"
```

## Step 3: Deploy Updated Configuration

### 3.1 Apply ConfigMap Changes

```bash
# Navigate to platform/cluster/kong directory
cd platform/cluster/kong

# Apply the updated ConfigMap
kubectl apply -f kong.configmap.yaml

# Restart Kong pods to pick up changes
kubectl rollout restart deployment/kong -n kong

# Watch the rollout
kubectl rollout status deployment/kong -n kong
```

### 3.2 Verify Kong is Running

```bash
# Check pod status
kubectl get pods -n kong

# Check logs for any errors
kubectl logs -n kong -l app=kong --tail=50
```

## Step 4: Configure Frontend Application

### 4.1 Install Firebase SDK

```bash
npm install firebase
```

### 4.2 Initialize Firebase

Create a Firebase configuration file:

```typescript
// src/firebase-config.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIza...",  // From Firebase Console
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

### 4.3 Update Authentication Service

Modify your existing `AuthenticationApiService` to use Firebase:

```typescript
// apps/portals/shared/features/identity/src/infrastructure/firebase-authentication.service.ts
import { Injectable } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  User
} from 'firebase/auth';
import { auth } from './firebase-config';
import { Result, Ok, Err } from '@standard';
import { IAuthenticationHandler } from '../application/authentication-handler.token';
import { CredentialsDto } from '@domains/identity/authentication';

@Injectable()
export class FirebaseAuthenticationService implements IAuthenticationHandler {
  
  authenticate(credentials: CredentialsDto): Observable<Result<string | null, Error>> {
    return from(
      signInWithEmailAndPassword(auth, credentials.email, credentials.password)
    ).pipe(
      map(async (userCredential) => {
        const token = await userCredential.user.getIdToken();
        return Ok(token);
      }),
      map(promise => promise),
      catchError(error => of(Err(new Error(error.message))))
    );
  }

  async getIdToken(): Promise<string | null> {
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
    return null;
  }

  // Token refresh is handled automatically by Firebase
  getRefreshedToken(token: string): Observable<Result<string, Error>> {
    return from(auth.currentUser?.getIdToken(true) || Promise.resolve(null)).pipe(
      map(token => token ? Ok(token) : Err(new Error('No user logged in'))),
      catchError(error => of(Err(error)))
    );
  }
}
```

### 4.4 Update HTTP Interceptor

Your existing `AuthenticationInterceptor` already adds the Bearer token - just ensure it's getting the Firebase token:

```typescript
// apps/portals/shared/features/identity/src/infrastructure/authentication.interceptor.ts
intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
  const authToken = this._storage.getToken(); // This should be the Firebase token
  const clonedRequest = req.clone({
    setHeaders: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });

  return next.handle(clonedRequest).pipe(
    catchError((error) => {
      if (error instanceof HttpErrorResponse && authToken) {
        if (error.status === 401) {
          return this._handle401Error(req, next, authToken);
        } 
      }
      return throwError(() => error);
    })
  );
}
```

### 4.5 Update Providers

Update your app configuration to use Firebase authentication:

```typescript
// apps/portals/aggregator-demo/application/src/root.ts
import { FirebaseAuthenticationService } from '@portals/shared/features/identity';

export const APPLICATION_ROOT = mergeApplicationConfig(
  {
    providers: [
      { provide: AUTHENTICATION_HANDLER, useClass: FirebaseAuthenticationService },
      // ... other providers
    ]
  },
  // ... other configs
);
```

## Step 5: Testing

### 5.1 Test Authentication Flow

1. **Sign Up / Sign In**:
   ```typescript
   // In your login component
   async login(email: string, password: string) {
     const result = await this.authService.authenticate({
       email,
       password
     }).toPromise();
     
     if (result.ok) {
       console.log('Firebase Token:', result.value);
     }
   }
   ```

2. **Check Token in Browser DevTools**:
   - Go to Application → Local Storage
   - Look for Firebase token storage
   - Copy the token

3. **Decode Token** (optional - for debugging):
   ```bash
   # Use jwt.io or decode manually
   echo "YOUR_TOKEN" | cut -d. -f2 | base64 -d | jq
   ```

   Should show:
   ```json
   {
     "iss": "https://securetoken.google.com/your-project-id",
     "aud": "your-project-id",
     "auth_time": 1234567890,
     "user_id": "...",
     "sub": "...",
     "iat": 1234567890,
     "exp": 1234571490,
     "email": "user@example.com",
     "email_verified": true,
     "firebase": {
       "identities": {
         "email": ["user@example.com"]
       },
       "sign_in_provider": "password"
     }
   }
   ```

### 5.2 Test API Calls

**Public Endpoint (No Auth)**:
```bash
curl -v http://kong.development.wapps.com/api/catalog/listings
# Should return 200 OK
```

**Protected Endpoint (Without Token)**:
```bash
curl -v http://kong.development.wapps.com/api/catalog/my-listings
# Should return 401 Unauthorized
```

**Protected Endpoint (With Token)**:
```bash
curl -v http://kong.development.wapps.com/api/catalog/my-listings \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
# Should return 200 OK (if backend is ready)
```

### 5.3 Check Kong Logs

```bash
# Watch Kong logs in real-time
kubectl logs -n kong -l app=kong --tail=100 -f

# Look for JWT validation messages
# Successful: "JWT plugin: token validated"
# Failed: "JWT plugin: token validation failed"
```

### 5.4 Use Kong Admin API

```bash
# Port-forward Kong Admin API
kubectl port-forward -n kong svc/kong 8001:8001

# Check JWT plugin status
curl http://localhost:8001/plugins | jq '.data[] | select(.name == "jwt")'

# Check consumers
curl http://localhost:8001/consumers | jq

# Check routes
curl http://localhost:8001/routes | jq '.data[] | {name, paths, plugins}'
```

## Step 6: Backend Service Integration

Your backend services will receive the validated JWT in the `Authorization` header. You can extract user information:

```typescript
// In your NestJS backend
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    
    if (!authHeader) {
      return false; // Kong should have already rejected this
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '');
    
    // Decode token (already validated by Kong, so just extract claims)
    const payload = this.decodeToken(token);
    
    // Add user info to request
    request.user = {
      uid: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified
    };
    
    return true;
  }

  private decodeToken(token: string): any {
    // Simple base64 decode of payload (no verification needed - Kong did it)
    const parts = token.split('.');
    const payload = Buffer.from(parts[1], 'base64').toString();
    return JSON.parse(payload);
  }
}
```

**Important**: Your backend doesn't need to re-validate the JWT since Kong already did. Just decode and extract user info.

## Step 7: Monitoring and Troubleshooting

### Common Issues

**Issue: 401 Unauthorized with valid token**

Check:
1. Token not expired: `exp` claim should be in the future
2. Issuer matches: `iss` should be `https://securetoken.google.com/YOUR_PROJECT_ID`
3. Audience matches: `aud` should be `YOUR_PROJECT_ID`
4. Kong config has correct project ID

**Issue: CORS errors**

- Ensure CORS plugin is enabled in Kong
- Check browser console for specific CORS error
- Verify `Access-Control-Allow-Origin` header in response

**Issue: Token refresh not working**

- Firebase handles token refresh automatically
- Implement refresh logic in your interceptor
- Check Firebase SDK documentation for auto-refresh

### Monitoring

Set up monitoring for:
- JWT validation success/failure rate
- 401 error rate
- Token expiration patterns
- Kong response times

```bash
# Get Kong metrics
kubectl exec -n kong -it deployment/kong -- kong health
```

## Step 8: Production Considerations

### Security Checklist

- [ ] Use HTTPS only in production
- [ ] Set appropriate CORS origins (not `*`)
- [ ] Implement rate limiting per user
- [ ] Add request/response size limits
- [ ] Enable Kong logging and monitoring
- [ ] Rotate secrets regularly
- [ ] Use Kubernetes Secrets for sensitive data
- [ ] Implement proper token refresh logic
- [ ] Add custom claims for RBAC if needed
- [ ] Set up alerts for high 401 rates

### Performance Optimization

- [ ] Enable JWKS caching (Kong does this by default)
- [ ] Scale Kong replicas based on load
- [ ] Tune HPA settings
- [ ] Monitor JWT validation latency
- [ ] Consider using Kong's proxy cache plugin for public endpoints

### Create Production Configuration

```bash
# Create production overlay
cp environments/dev/platform/kong.overlay.yml environments/prod/platform/kong.overlay.yml

# Update with production values:
# - Production Firebase project ID
# - Stricter rate limits
# - More replicas
# - Resource limits
# - HTTPS enforcement
```

## Next Steps

1. **Add Custom Claims**: Use Firebase custom claims for role-based access control
2. **Implement Refresh Logic**: Handle token expiration gracefully
3. **Add Logging**: Implement comprehensive request/response logging
4. **Set up Monitoring**: Use Prometheus + Grafana for Kong metrics
5. **Add More Plugins**: Explore Kong's plugin ecosystem (caching, transformation, etc.)

## Resources

- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [Firebase ID Token Verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Kong JWT Plugin](https://docs.konghq.com/hub/kong-inc/jwt/)
- [Kong Declarative Config](https://docs.konghq.com/gateway/latest/production/deployment-topologies/db-less-and-declarative-config/)

## Support

If you encounter issues:
1. Check Kong logs: `kubectl logs -n kong -l app=kong`
2. Verify Firebase configuration in Firebase Console
3. Test with curl commands
4. Decode JWT to verify claims
5. Check Kong Admin API for configuration

