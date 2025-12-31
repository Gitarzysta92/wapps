# Backend-Proxied Firebase Authentication with Kong

## Architecture Overview

```
┌──────────┐     ┌─────────────┐     ┌──────────┐     ┌──────┐     ┌──────────┐
│ Frontend │────►│ Your Backend│────►│ Firebase │     │ Kong │────►│ Backend  │
│   App    │     │ Auth API    │     │  Admin   │     │      │     │ Services │
└──────────┘     └─────────────┘     └──────────┘     └──────┘     └──────────┘
     │                  │                   │              │              │
     │ 1. Login         │                   │              │              │
     │  (credentials)   │                   │              │              │
     ├─────────────────►│                   │              │              │
     │                  │ 2. Create Custom  │              │              │
     │                  │    Token          │              │              │
     │                  ├──────────────────►│              │              │
     │                  │                   │              │              │
     │                  │ 3. Firebase JWT   │              │              │
     │                  │◄──────────────────┤              │              │
     │                  │                   │              │              │
     │ 4. Return JWT    │                   │              │              │
     │◄─────────────────┤                   │              │              │
     │                  │                   │              │              │
     │ 5. API Call      │                   │              │              │
     │  + JWT Token     │                   │              │              │
     ├────────────────────────────────────────────────────►│              │
     │                  │                   │              │              │
     │                  │                   │              │ 6. Validate  │
     │                  │                   │              │    JWT       │
     │                  │                   │◄─────────────┤              │
     │                  │                   │ (Fetch JWKS) │              │
     │                  │                   │              │              │
     │                  │                   │              │ 7. Forward   │
     │                  │                   │              ├─────────────►│
     │                  │                   │              │              │
     │                  │                   │              │ 8. Response  │
     │ 9. Response      │                   │              │◄─────────────┤
     │◄────────────────────────────────────────────────────┤              │
```

## Why This Approach?

### Benefits
✅ **Security**: Frontend never has direct Firebase credentials  
✅ **Control**: Backend controls authentication logic  
✅ **Flexibility**: Can add custom claims, additional validation, user lookup  
✅ **Centralization**: All auth logic in one place  
✅ **Standard JWT**: Kong validates industry-standard Firebase JWTs  

### How It Works
1. Frontend sends credentials to your backend auth API
2. Backend validates credentials (against your DB or Firebase)
3. Backend creates Firebase custom token using Firebase Admin SDK
4. Backend exchanges custom token for Firebase ID token
5. Frontend receives standard Firebase JWT
6. Kong validates this JWT on subsequent requests
7. Backend services receive validated requests

## Implementation

### Step 1: Backend Authentication Service

Create an authentication endpoint in your backend that uses Firebase Admin SDK:

```typescript
// apps/services/auth-service/src/firebase-auth.service.ts
import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAuthService {
  private readonly auth: admin.auth.Auth;

  constructor() {
    // Initialize Firebase Admin SDK
    const serviceAccount = require('./firebase-service-account.json');
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID
    });

    this.auth = admin.auth();
  }

  /**
   * Authenticate user and create custom Firebase token
   * This is called from your login endpoint
   */
  async authenticateUser(email: string, password: string): Promise<string> {
    // 1. Validate credentials against your database
    const user = await this.validateUserCredentials(email, password);
    
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // 2. Create custom claims (optional)
    const customClaims = {
      role: user.role,
      permissions: user.permissions,
      // Add any custom data you need
    };

    // 3. Create Firebase custom token with user's Firebase UID
    // If user doesn't have Firebase UID yet, create Firebase user first
    let firebaseUid = user.firebaseUid;
    
    if (!firebaseUid) {
      // Create Firebase user
      const firebaseUser = await this.auth.createUser({
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.name,
      });
      firebaseUid = firebaseUser.uid;
      
      // Save Firebase UID to your database
      await this.saveFirebaseUid(user.id, firebaseUid);
    }

    // 4. Set custom claims
    await this.auth.setCustomUserClaims(firebaseUid, customClaims);

    // 5. Create custom token
    const customToken = await this.auth.createCustomToken(firebaseUid, customClaims);

    // 6. Exchange custom token for ID token
    // This is done by calling Firebase REST API
    const idToken = await this.exchangeCustomTokenForIdToken(customToken);

    return idToken;
  }

  /**
   * Exchange custom token for ID token
   */
  private async exchangeCustomTokenForIdToken(customToken: string): Promise<string> {
    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: customToken,
          returnSecureToken: true
        })
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Firebase token exchange failed: ${data.error.message}`);
    }

    return data.idToken; // This is the Firebase JWT that Kong will validate
  }

  /**
   * Validate user credentials against your database
   */
  private async validateUserCredentials(email: string, password: string) {
    // Your existing user validation logic
    // Check database, verify password hash, etc.
    // Return user object or null
  }

  /**
   * Register new user
   */
  async registerUser(email: string, password: string, displayName: string): Promise<string> {
    // 1. Create user in your database
    const user = await this.createUserInDatabase(email, password, displayName);

    // 2. Create Firebase user
    const firebaseUser = await this.auth.createUser({
      email: email,
      emailVerified: false,
      displayName: displayName,
    });

    // 3. Save Firebase UID to your database
    await this.saveFirebaseUid(user.id, firebaseUser.uid);

    // 4. Create custom token and exchange for ID token
    const customToken = await this.auth.createCustomToken(firebaseUser.uid);
    const idToken = await this.exchangeCustomTokenForIdToken(customToken);

    return idToken;
  }

  /**
   * Refresh token (if needed)
   */
  async refreshToken(currentToken: string): Promise<string> {
    // Verify current token
    const decodedToken = await this.auth.verifyIdToken(currentToken);
    
    // Create new custom token
    const customToken = await this.auth.createCustomToken(decodedToken.uid);
    
    // Exchange for new ID token
    const idToken = await this.exchangeCustomTokenForIdToken(customToken);
    
    return idToken;
  }
}
```

### Step 2: Create Authentication Controller

```typescript
// apps/services/auth-service/src/auth.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { FirebaseAuthService } from './firebase-auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: FirebaseAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { email: string; password: string }) {
    const token = await this.authService.authenticateUser(
      body.email,
      body.password
    );

    return {
      token,
      tokenType: 'Bearer'
    };
  }

  @Post('register')
  async register(@Body() body: { email: string; password: string; name: string }) {
    const token = await this.authService.registerUser(
      body.email,
      body.password,
      body.name
    );

    return {
      token,
      tokenType: 'Bearer'
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: { token: string }) {
    const newToken = await this.authService.refreshToken(body.token);

    return {
      token: newToken,
      tokenType: 'Bearer'
    };
  }
}
```

### Step 3: Frontend Integration (No Firebase SDK Needed!)

Your existing frontend code stays mostly the same, but calls your backend instead:

```typescript
// apps/portals/shared/features/identity/src/infrastructure/backend-firebase-authentication.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { IAuthenticationHandler } from '../application/authentication-handler.token';
import { CredentialsDto } from '@domains/identity/authentication';
import { Result, Ok, Err } from '@standard';

@Injectable()
export class BackendFirebaseAuthenticationService implements IAuthenticationHandler {
  private readonly http = inject(HttpClient);
  private readonly authApiUrl = 'https://auth-api.wapps.com'; // Your auth service URL

  /**
   * Authenticate via backend (which uses Firebase Admin SDK)
   */
  authenticate(credentials: CredentialsDto): Observable<Result<string | null, Error>> {
    return this.http.post<{ token: string }>(`${this.authApiUrl}/auth/login`, {
      email: credentials.email,
      password: credentials.password
    }).pipe(
      map(response => Ok(response.token)), // This is a Firebase JWT!
      catchError(error => {
        console.error('Authentication error:', error);
        return of(Err(new Error(error.error?.message || 'Authentication failed')));
      })
    );
  }

  /**
   * Get refreshed token from backend
   */
  getRefreshedToken(token: string): Observable<Result<string, Error>> {
    return this.http.post<{ token: string }>(`${this.authApiUrl}/auth/refresh`, {
      token
    }).pipe(
      map(response => Ok(response.token)),
      catchError(error => of(Err(error)))
    );
  }

  /**
   * Register new user via backend
   */
  register(credentials: CredentialsDto & { name: string }): Observable<Result<string | null, Error>> {
    return this.http.post<{ token: string }>(`${this.authApiUrl}/auth/register`, {
      email: credentials.email,
      password: credentials.password,
      name: credentials.name
    }).pipe(
      map(response => Ok(response.token)),
      catchError(error => of(Err(new Error(error.error?.message || 'Registration failed'))))
    );
  }
}
```

### Step 4: Update Providers

```typescript
// apps/portals/shared/features/identity/src/login.providers.ts
import { ApplicationConfig } from "@angular/core";
import { AUTHENTICATION_HANDLER } from "./application/authentication-handler.token";
import { AuthenticationService } from ".";
import { AuthenticationStorage } from "./infrastructure/authentication.storage";
import { BackendFirebaseAuthenticationService } from "./infrastructure/backend-firebase-authentication.service";

export function provideIdentityLoginFeature(c: {
  validationMessages: LoginValidationMessages;
  authApiUrl: string; // Your backend auth API URL
}): ApplicationConfig {
  return {
    providers: [
      AuthenticationStorage,
      AuthenticationService,
      { provide: VALIDATION_MESSAGES, useValue: c.validationMessages },
      { provide: AUTHENTICATION_HANDLER, useClass: BackendFirebaseAuthenticationService },
      // Optionally provide auth API URL
      { provide: 'AUTH_API_URL', useValue: c.authApiUrl }
    ]
  };
}
```

### Step 5: Environment Configuration

```typescript
// apps/portals/aggregator-demo/application/src/environments/environment.ts
export const environment = {
  production: false,
  authApiUrl: 'http://auth-service.wapps.com', // Your backend auth service
};
```

## Kong Configuration

Kong configuration **stays the same** as before! Kong still validates Firebase JWTs:

```yaml
# Kong validates tokens issued by Firebase
plugins:
  - name: jwt
    config:
      issuer: https://securetoken.google.com/YOUR_PROJECT_ID
      claims_to_verify:
        - exp
```

The key point: Your backend **creates valid Firebase tokens** using Firebase Admin SDK, so Kong can validate them just like any Firebase token.

## Firebase Admin SDK Setup

### Install Dependencies

```bash
npm install firebase-admin
```

### Get Service Account Key

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Store it securely (use Kubernetes Secret in production)

### Configure in NestJS

```typescript
// apps/services/auth-service/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as admin from 'firebase-admin';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Initialize Firebase Admin (if not done in service)
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      })
    });
  }

  await app.listen(3000);
}
bootstrap();
```

### Kubernetes Secret for Firebase Service Account

```yaml
# platform/cluster/auth-service/firebase-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: firebase-admin-credentials
  namespace: auth
type: Opaque
stringData:
  service-account.json: |
    {
      "type": "service_account",
      "project_id": "your-project-id",
      "private_key_id": "...",
      "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
      "client_email": "firebase-adminsdk@your-project.iam.gserviceaccount.com",
      "client_id": "...",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "..."
    }
  
  # Alternative: separate environment variables
  FIREBASE_PROJECT_ID: "your-project-id"
  FIREBASE_CLIENT_EMAIL: "firebase-adminsdk@your-project.iam.gserviceaccount.com"
  FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
  FIREBASE_WEB_API_KEY: "AIza..."  # For token exchange
```

## Complete Flow

### 1. User Login
```
Frontend → POST /auth/login → Backend
  { email, password }

Backend:
  1. Validates credentials against database
  2. Gets/creates Firebase UID for user
  3. Sets custom claims (role, permissions)
  4. Creates Firebase custom token
  5. Exchanges for Firebase ID token
  6. Returns ID token to frontend

Frontend ← { token: "eyJhbG..." } ← Backend
```

### 2. API Request
```
Frontend → GET /api/catalog/my-listings → Kong
  Authorization: Bearer eyJhbG...

Kong:
  1. Extracts JWT from header
  2. Fetches Firebase JWKS (public keys)
  3. Validates signature, expiration, issuer
  4. Forwards to backend if valid

Kong → Backend Service
  Authorization: Bearer eyJhbG...

Backend Service:
  1. Extracts user info from validated JWT
  2. No need to re-validate (Kong did it)
  3. Process request
```

## Benefits of This Architecture

### 1. **Security**
- Frontend never has Firebase credentials
- Backend controls authentication flow
- Can add rate limiting, brute force protection
- Can audit authentication attempts

### 2. **Flexibility**
- Can integrate with multiple auth providers
- Can add custom validation logic
- Can enrich user data before token creation
- Can add custom claims for RBAC

### 3. **Control**
- Backend owns user data
- Can sync with your database
- Can enforce business rules
- Can implement custom flows (2FA, email verification, etc.)

### 4. **Standard JWT**
- Kong validates using standard JWT plugin
- Compatible with any JWT-compliant system
- Can be used across multiple services
- Industry-standard security

## Testing

### Test Backend Authentication

```bash
# Login
curl -X POST http://auth-service.wapps.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Response:
# { "token": "eyJhbGciOiJSUzI1NiIs...", "tokenType": "Bearer" }

# Use token with Kong
curl http://kong.development.wapps.com/api/catalog/my-listings \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

### Decode Token

```bash
# The token is a valid Firebase JWT
echo "TOKEN_PAYLOAD_PART" | base64 -d | jq

# Shows:
{
  "iss": "https://securetoken.google.com/your-project-id",
  "aud": "your-project-id",
  "sub": "firebase-uid",
  "email": "user@example.com",
  "role": "admin",  // Your custom claim
  "permissions": ["read", "write"]  // Your custom claim
}
```

## Next Steps

1. ✅ Create auth service (NestJS)
2. ✅ Install Firebase Admin SDK
3. ✅ Get Firebase service account key
4. ✅ Implement authentication endpoints
5. ✅ Update frontend to call your backend
6. ✅ Deploy auth service
7. ✅ Configure Kong with Firebase project ID
8. ✅ Test end-to-end

## Comparison: Direct vs Backend-Proxied

| Aspect | Direct Firebase | Backend-Proxied (This Approach) |
|--------|----------------|----------------------------------|
| Frontend Code | Firebase SDK | HTTP calls to your API |
| Firebase Credentials | In frontend | In backend only |
| User Database | Firebase only | Your DB + Firebase sync |
| Custom Logic | Limited | Full control |
| Token Creation | Firebase | Your backend via Admin SDK |
| Token Validation | Kong | Kong (same) |
| Custom Claims | Limited | Full control |
| Authentication Flow | Firebase handles | You control |

## Summary

This architecture gives you the best of both worlds:
- ✅ **Your backend controls authentication** (no Firebase SDK in frontend)
- ✅ **Kong validates standard Firebase JWTs** (centralized security)
- ✅ **Full control over user data and flow**
- ✅ **Can add custom claims for RBAC**
- ✅ **Industry-standard JWT security**

The frontend just calls your API and gets a token. Kong validates that token. Simple and secure!

