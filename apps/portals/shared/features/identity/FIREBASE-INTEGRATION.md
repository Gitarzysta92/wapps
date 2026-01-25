# Integrating Firebase Authentication with Existing Angular Authentication

This document explains how to integrate Firebase authentication into your existing Angular authentication setup while maintaining compatibility with your current architecture.

## Current Architecture

Your current authentication setup consists of:

1. **AuthenticationService** (`apps/portals/shared/features/identity/src/application/authentication.service.ts`)
   - Main authentication service
   - Uses injected `AUTHENTICATION_HANDLER`
   - Manages token storage

2. **AuthenticationStorage** (`apps/portals/shared/features/identity/src/infrastructure/authentication.storage.ts`)
   - Stores JWT tokens
   - Provides observable token stream

3. **AuthenticationInterceptor** (`apps/portals/shared/features/identity/src/infrastructure/authentication.interceptor.ts`)
   - Adds Bearer token to requests
   - Handles 401 errors and token refresh

4. **AUTHENTICATION_HANDLER** token
   - Injectable token for authentication provider
   - Currently uses `AuthenticationApiService`

## Integration Strategy

We'll create a **Firebase implementation** of the authentication handler that integrates seamlessly with your existing architecture.

### Option 1: Pure Firebase Authentication (Recommended)

Replace your custom authentication API with Firebase:

```
User → FirebaseAuthenticationService → Firebase Auth → JWT Token → Kong → Backend
```

**Pros:**
- Firebase handles all auth complexity
- Built-in token refresh
- Multiple auth providers (Google, Facebook, etc.)
- No backend auth API needed

**Cons:**
- Dependent on Firebase service
- Need Firebase project

### Option 2: Hybrid Approach

Use Firebase for authentication but keep your backend API:

```
User → Firebase Auth → JWT Token → Your Backend API (validates) → Kong → Services
```

**Pros:**
- Keep control of user data
- Can add custom claims
- Backend can enforce additional rules

**Cons:**
- More complex
- Need to validate Firebase tokens in backend

## Implementation: Option 1 (Pure Firebase)

### Step 1: Install Firebase SDK

```bash
npm install firebase
```

### Step 2: Create Firebase Configuration

Create `apps/portals/shared/features/identity/src/infrastructure/firebase/firebase.config.ts`:

```typescript
import { InjectionToken } from '@angular/core';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const FIREBASE_CONFIG = new InjectionToken<FirebaseConfig>('FIREBASE_CONFIG');
```

### Step 3: Create Firebase Authentication Service

Create `apps/portals/shared/features/identity/src/infrastructure/firebase/firebase-authentication.service.ts`:

```typescript
import { inject, Injectable } from '@angular/core';
import { Observable, from, map, catchError, of, switchMap } from 'rxjs';
import { 
  Auth, 
  initializeAuth,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  UserCredential,
  getAuth,
  onAuthStateChanged,
  browserLocalPersistence
} from 'firebase/auth';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { IAuthenticationHandler } from '../../application/authentication-handler.token';
import { CredentialsDto } from '@domains/identity/authentication';
import { Result, Ok, Err } from '@foundation/standard';
import { FIREBASE_CONFIG, FirebaseConfig } from './firebase.config';

@Injectable()
export class FirebaseAuthenticationService implements IAuthenticationHandler {
  private readonly _config = inject(FIREBASE_CONFIG);
  private readonly _app: FirebaseApp;
  private readonly _auth: Auth;

  constructor() {
    // Initialize Firebase
    this._app = initializeApp(this._config);
    this._auth = getAuth(this._app);
    
    // Set persistence
    this._auth.setPersistence(browserLocalPersistence);
    
    // Listen to auth state changes
    onAuthStateChanged(this._auth, (user) => {
      console.log('Firebase auth state changed:', user?.uid);
    });
  }

  /**
   * Authenticate user with email and password
   */
  authenticate(credentials: CredentialsDto): Observable<Result<string | null, Error>> {
    return from(
      signInWithEmailAndPassword(
        this._auth, 
        credentials.email, 
        credentials.password
      )
    ).pipe(
      switchMap((userCredential: UserCredential) => 
        from(userCredential.user.getIdToken())
      ),
      map((token: string) => Ok(token)),
      catchError((error) => {
        console.error('Firebase authentication error:', error);
        return of(Err(new Error(this._getErrorMessage(error.code))));
      })
    );
  }

  /**
   * Get refreshed token
   * Firebase automatically refreshes tokens, so we just get a fresh one
   */
  getRefreshedToken(token: string): Observable<Result<string, Error>> {
    const user = this._auth.currentUser;
    
    if (!user) {
      return of(Err(new Error('No user logged in')));
    }

    return from(user.getIdToken(true)).pipe(
      map((token: string) => Ok(token)),
      catchError((error) => {
        console.error('Firebase token refresh error:', error);
        return of(Err(error));
      })
    );
  }

  /**
   * Register new user
   */
  register(credentials: CredentialsDto): Observable<Result<string | null, Error>> {
    return from(
      createUserWithEmailAndPassword(
        this._auth,
        credentials.email,
        credentials.password
      )
    ).pipe(
      switchMap((userCredential: UserCredential) => 
        from(userCredential.user.getIdToken())
      ),
      map((token: string) => Ok(token)),
      catchError((error) => {
        console.error('Firebase registration error:', error);
        return of(Err(new Error(this._getErrorMessage(error.code))));
      })
    );
  }

  /**
   * Sign out current user
   */
  signOut(): Observable<Result<void, Error>> {
    return from(signOut(this._auth)).pipe(
      map(() => Ok(undefined)),
      catchError((error) => {
        console.error('Firebase sign out error:', error);
        return of(Err(error));
      })
    );
  }

  /**
   * Get current user's ID token
   */
  getCurrentToken(): Observable<string | null> {
    const user = this._auth.currentUser;
    if (!user) {
      return of(null);
    }
    return from(user.getIdToken());
  }

  /**
   * Map Firebase error codes to user-friendly messages
   */
  private _getErrorMessage(errorCode: string): string {
    const errorMessages: Record<string, string> = {
      'auth/user-not-found': 'No user found with this email',
      'auth/wrong-password': 'Incorrect password',
      'auth/email-already-in-use': 'Email already in use',
      'auth/weak-password': 'Password should be at least 6 characters',
      'auth/invalid-email': 'Invalid email address',
      'auth/user-disabled': 'This account has been disabled',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later',
      'auth/network-request-failed': 'Network error. Please check your connection'
    };

    return errorMessages[errorCode] || 'Authentication failed. Please try again';
  }
}
```

### Step 4: Update Providers Configuration

Update `apps/portals/shared/features/identity/src/login.providers.ts`:

```typescript
import { ApplicationConfig } from "@angular/core";
import { AUTHENTICATION_HANDLER } from "./application/authentication-handler.token";
import { IDENTITY_PROVIDER } from "./application/identity-provider.token";
import { AuthenticationService } from ".";
import { AuthenticationStorage } from "./infrastructure/authentication.storage";
import { ValidationMessages as LoginValidationMessages, VALIDATION_MESSAGES } from "@ui/login";
import { FirebaseAuthenticationService } from "./infrastructure/firebase/firebase-authentication.service";
import { FIREBASE_CONFIG, FirebaseConfig } from "./infrastructure/firebase/firebase.config";

export interface IdentityLoginFeatureConfig {
  validationMessages: LoginValidationMessages;
  firebaseConfig: FirebaseConfig;
}

export function provideIdentityLoginFeature(c: IdentityLoginFeatureConfig): ApplicationConfig {
  return {
    providers: [
      AuthenticationStorage,
      AuthenticationService,
      { provide: VALIDATION_MESSAGES, useValue: c.validationMessages },
      { provide: FIREBASE_CONFIG, useValue: c.firebaseConfig },
      { provide: AUTHENTICATION_HANDLER, useClass: FirebaseAuthenticationService },
      // Keep identity provider if you need user profile info
      // { provide: IDENTITY_PROVIDER, useClass: IdentityApiService },
    ]
  };
}
```

### Step 5: Update App Configuration

Update your app root configuration (e.g., `apps/portals/aggregator-demo/application/src/root.ts`):

```typescript
import { mergeApplicationConfig } from '@angular/core';
import { provideIdentityLoginFeature } from '@portals/shared/features/identity';
import { LOGIN_VALIDATION_MESSAGES } from './validation-messages';

export const APPLICATION_ROOT = mergeApplicationConfig(
  provideIdentityLoginFeature({
    validationMessages: LOGIN_VALIDATION_MESSAGES,
    firebaseConfig: {
      apiKey: "AIzaSy...",  // From Firebase Console
      authDomain: "your-project.firebaseapp.com",
      projectId: "your-project-id",
      storageBucket: "your-project.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:abc123"
    }
  }),
  // ... other providers
);
```

### Step 6: Environment-Specific Firebase Config

For better configuration management, use environment files:

**Create `apps/portals/aggregator-demo/application/src/environments/environment.ts`:**

```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: "AIzaSy...",
    authDomain: "wapps-dev.firebaseapp.com",
    projectId: "wapps-dev-12345",
    storageBucket: "wapps-dev.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
  }
};
```

**Create `apps/portals/aggregator-demo/application/src/environments/environment.prod.ts`:**

```typescript
export const environment = {
  production: true,
  firebase: {
    apiKey: "AIzaSy...",
    authDomain: "wapps-prod.firebaseapp.com",
    projectId: "wapps-prod-67890",
    storageBucket: "wapps-prod.appspot.com",
    messagingSenderId: "987654321",
    appId: "1:987654321:web:xyz789"
  }
};
```

**Update root.ts:**

```typescript
import { environment } from './environments/environment';

export const APPLICATION_ROOT = mergeApplicationConfig(
  provideIdentityLoginFeature({
    validationMessages: LOGIN_VALIDATION_MESSAGES,
    firebaseConfig: environment.firebase
  }),
  // ... other providers
);
```

### Step 7: No Changes Needed!

Your existing components don't need changes! They continue using `AuthenticationService`:

```typescript
// This still works exactly the same
@Component({...})
export class LoginComponent {
  private readonly _authService = inject(AuthenticationService);

  login(credentials: { email: string; password: string }) {
    this._authService.authenticate(credentials).subscribe(result => {
      if (result.ok) {
        // User is authenticated, token is stored
        this.router.navigateByUrl('/home');
      } else {
        // Show error
        this.errorMessage = result.error.message;
      }
    });
  }
}
```

## Token Flow

Here's what happens when a user logs in:

1. **User enters credentials** → Login component
2. **Component calls** → `AuthenticationService.authenticate()`
3. **Service delegates to** → `FirebaseAuthenticationService.authenticate()`
4. **Firebase authenticates** → Returns JWT token
5. **Service stores token** → `AuthenticationStorage.setToken()`
6. **User makes API call** → `AuthenticationInterceptor` adds token to header
7. **Request goes to Kong** → Kong validates Firebase JWT
8. **Kong forwards to backend** → Backend receives validated request

## Token Refresh

Firebase automatically handles token refresh. Your `AuthenticationInterceptor` already handles 401 errors:

```typescript
private _handle401Error(
  req: HttpRequest<any>,
  next: HttpHandler,
  authToken: string
): Observable<HttpEvent<any>> {
  return this._apiClient.getRefreshedToken(authToken)
    .pipe(
      tap(t => t.ok && this._storage.setToken(t.value)),
      switchMap(t => next.handle(req.clone({ 
        setHeaders: { Authorization: `Bearer ${t.value}` } 
      }))),
      catchError((e) => {
        this._storage.clear();
        this._router.navigateByUrl('');
        return throwError(() => e);
      })
    );
}
```

With Firebase, this will automatically get a fresh token from Firebase.

## Additional Firebase Features

### Social Login (Google, Facebook, etc.)

Add to `FirebaseAuthenticationService`:

```typescript
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

signInWithGoogle(): Observable<Result<string | null, Error>> {
  const provider = new GoogleAuthProvider();
  return from(signInWithPopup(this._auth, provider)).pipe(
    switchMap((result) => from(result.user.getIdToken())),
    map((token) => Ok(token)),
    catchError((error) => of(Err(error)))
  );
}
```

### Password Reset

```typescript
import { sendPasswordResetEmail } from 'firebase/auth';

resetPassword(email: string): Observable<Result<void, Error>> {
  return from(sendPasswordResetEmail(this._auth, email)).pipe(
    map(() => Ok(undefined)),
    catchError((error) => of(Err(error)))
  );
}
```

### Email Verification

```typescript
import { sendEmailVerification } from 'firebase/auth';

sendVerificationEmail(): Observable<Result<void, Error>> {
  const user = this._auth.currentUser;
  if (!user) {
    return of(Err(new Error('No user logged in')));
  }
  return from(sendEmailVerification(user)).pipe(
    map(() => Ok(undefined)),
    catchError((error) => of(Err(error)))
  );
}
```

## Testing

Your existing authentication tests should continue to work. Just mock `FirebaseAuthenticationService`:

```typescript
const mockFirebaseAuth: Partial<FirebaseAuthenticationService> = {
  authenticate: jest.fn().mockReturnValue(of(Ok('mock-token'))),
  getRefreshedToken: jest.fn().mockReturnValue(of(Ok('new-mock-token')))
};

TestBed.configureTestingModule({
  providers: [
    { provide: AUTHENTICATION_HANDLER, useValue: mockFirebaseAuth }
  ]
});
```

## Migration Checklist

- [ ] Install Firebase SDK
- [ ] Create Firebase project and get config
- [ ] Create `FirebaseAuthenticationService`
- [ ] Update `provideIdentityLoginFeature` to accept Firebase config
- [ ] Add Firebase config to environment files
- [ ] Update app root with Firebase config
- [ ] Test login flow
- [ ] Test token refresh
- [ ] Test logout
- [ ] Configure Kong with Firebase project ID
- [ ] Test end-to-end with Kong
- [ ] Update production environment with prod Firebase config

## Rollback Plan

If you need to rollback to the old authentication:

1. Change the provider back:
   ```typescript
   { provide: AUTHENTICATION_HANDLER, useClass: AuthenticationApiService }
   ```

2. Remove Firebase config from providers

3. Keep Firebase SDK installed (no harm in keeping it)

## Benefits of This Approach

✅ **Minimal Changes**: Only need to create one new service
✅ **No UI Changes**: All your components work as-is
✅ **Type Safe**: Still uses your existing interfaces
✅ **Testable**: Easy to mock
✅ **Flexible**: Can switch back or use hybrid approach
✅ **Production Ready**: Firebase is battle-tested
✅ **Feature Rich**: Get social login, MFA, etc. for free

## Next Steps

1. Implement `FirebaseAuthenticationService`
2. Configure Firebase in your apps
3. Test locally
4. Deploy Kong with Firebase config
5. Test end-to-end
6. Enable additional Firebase features as needed

