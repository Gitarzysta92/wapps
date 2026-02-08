import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable, map, catchError, of, switchMap, fromEvent, take, timeout, race } from "rxjs";
import {
  IAuthenticationHandler,
  CredentialsDto,
  AuthenticationProvider,
  AuthenticationMethodDto
} from "@domains/identity/authentication";
import { Result, ok, err } from "@foundation/standard";
import { AUTH_BFF_URL } from "./auth-bff-url.token";
import { WA_WINDOW } from "@ng-web-apis/common";

interface AuthResponse {
  token: string;
  refreshToken: string;
  expiresIn: string;
  uid: string;
}

interface AuthMethodsResponse {
  methods: AuthenticationMethodDto[];
}

@Injectable()
export class BffAuthenticationService implements IAuthenticationHandler {
  private readonly _http = inject(HttpClient);
  private readonly _authBffUrl = inject(AUTH_BFF_URL);
  private readonly _window = inject(WA_WINDOW);

  /**
   * Authenticate with email/password via BFF
   */
  authenticate(credentials: CredentialsDto): Observable<Result<string, Error>> {
    return this._http.post<AuthResponse>(
      `${this._authBffUrl}/auth/signin`,
      {
        email: credentials.login,
        password: credentials.password
      }
    ).pipe(
      map(response => {
        // Store refresh token for later use
        this._storeRefreshToken(response.refreshToken);
        return ok(response.token);
      }),
      catchError(error => {
        console.error('Authentication error:', error);
        const errorMessage = error.error?.error || 'Authentication failed';
        return of(err(new Error(errorMessage)));
      })
    );
  }

  /**
   * Authenticate with OAuth providers via BFF
   */
  authenticateWithProvider(provider: AuthenticationProvider): Observable<Result<string, Error>> {
    switch (provider) {
      case AuthenticationProvider.ANONYMOUS:
        return this._signInAnonymously();
      case AuthenticationProvider.GOOGLE:
      case AuthenticationProvider.GITHUB:
      case AuthenticationProvider.FACEBOOK:
      case AuthenticationProvider.APPLE:
        return this._signInWithOAuth(provider);
      default:
        return of(err(new Error(`Provider ${provider} not supported`)));
    }
  }

  /**
   * Get available authentication methods from BFF
   */
  getAvailableMethods(): Observable<AuthenticationMethodDto[]> {
    return this._http.get<AuthMethodsResponse>(
      `${this._authBffUrl}/auth/methods`
    ).pipe(
      map(response => response.methods.map(m => ({
        ...m,
        provider: m.provider as AuthenticationProvider
      }))),
      catchError(error => {
        console.error('Failed to get auth methods:', error);
        // Return default method as fallback
        return of([{
          provider: AuthenticationProvider.EMAIL_PASSWORD,
          displayName: 'Email & Password',
          enabled: true
        }]);
      })
    );
  }

  /**
   * Refresh the authentication token
   */
  refreshToken(): Observable<Result<string, Error>> {
    const refreshToken = this._getRefreshToken();
    
    if (!refreshToken) {
      return of(err(new Error('No refresh token available')));
    }
    
    return this._http.post<AuthResponse>(
      `${this._authBffUrl}/auth/refresh`,
      { refreshToken }
    ).pipe(
      map(response => {
        this._storeRefreshToken(response.refreshToken);
        return ok(response.token);
      }),
      catchError(error => {
        console.error('Token refresh error:', error);
        this._clearRefreshToken();
        return of(err(new Error('Session expired. Please sign in again.')));
      })
    );
  }

  /**
   * Sign out
   */
  signOut(): Observable<Result<void, Error>> {
    return this._http.post<void>(
      `${this._authBffUrl}/auth/signout`,
      {}
    ).pipe(
      map(() => {
        this._clearRefreshToken();
        return ok(undefined);
      }),
      catchError(error => {
        console.error('Sign out error:', error);
        // Clear tokens anyway
        this._clearRefreshToken();
        return of(ok(undefined));
      })
    );
  }

  /**
   * Sign in anonymously
   */
  private _signInAnonymously(): Observable<Result<string, Error>> {
    return this._http.post<AuthResponse>(
      `${this._authBffUrl}/auth/signin/anonymous`,
      {}
    ).pipe(
      map(response => {
        this._storeRefreshToken(response.refreshToken);
        return ok(response.token);
      }),
      catchError(error => {
        console.error('Anonymous sign in error:', error);
        const errorMessage = error.error?.error || 'Anonymous sign in failed';
        return of(err(new Error(errorMessage)));
      })
    );
  }

  /**
   * Sign in with OAuth provider
   */
  private _signInWithOAuth(provider: AuthenticationProvider): Observable<Result<string, Error>> {
    const providerName = provider.toLowerCase();
    const redirectUri = `${this._window.location.origin}/auth/callback`;
    const state = this._generateState();
    
    // Store state for verification
    sessionStorage.setItem('oauth_state', state);
    // Store context for redirect-based fallback (no opener window)
    sessionStorage.setItem('oauth_provider', providerName);
    sessionStorage.setItem('oauth_redirect_uri', redirectUri);
    
    // Open OAuth popup
    const authUrl = `${this._authBffUrl}/auth/oauth/${providerName}/authorize?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
    
    let popup = this._window.open(
      authUrl,
      'oauth_popup',
      'width=500,height=600,left=100,top=100'
    );
    
    // Fallback: open a new tab if popup is blocked
    if (!popup) {
      popup = this._window.open(authUrl, '_blank');
    }

    // Last resort: full-page redirect (handled by OAuthCallbackComponent without opener)
    if (!popup) {
      this._window.location.assign(authUrl);
      return new Observable<Result<string, Error>>(() => undefined);
    }
    
    // Listen for OAuth callback via postMessage/BroadcastChannel/localStorage and popup close
    return new Observable<Result<string, Error>>(observer => {
      let completed = false;

      const finish = (result: Result<string, Error>) => {
        if (completed) return;
        completed = true;
        cleanup();
        observer.next(result);
        observer.complete();
      };

      const handleOAuthCallback = (data: any) => {
        if (completed) return;

        const { code, state: returnedState, error } = data ?? {};

        // Verify state (CSRF protection)
        const savedState = sessionStorage.getItem('oauth_state');
        sessionStorage.removeItem('oauth_state');
        sessionStorage.removeItem('oauth_provider');
        sessionStorage.removeItem('oauth_redirect_uri');

        if (error) {
          finish(err(new Error(String(error))));
          return;
        }

        if (!code) {
          finish(err(new Error('Missing OAuth code')));
          return;
        }

        if (returnedState !== savedState) {
          finish(err(new Error('Invalid OAuth state. Please try again.')));
          return;
        }

        // Exchange code for token
        this._exchangeOAuthCode(providerName, code, redirectUri).subscribe({
          next: result => finish(result),
          error: e => finish(err(e)),
        });
      };
      
      const handleMessage = (event: MessageEvent) => {
        // Verify origin
        if (event.origin !== this._window.location.origin) {
          return;
        }
        
        if (event.data?.type === 'oauth_callback') {
          handleOAuthCallback(event.data);
        }
      };

      // BroadcastChannel fallback (works even when COOP severs window.opener)
      const bc = 'BroadcastChannel' in this._window ? new (this._window as any).BroadcastChannel('wapps_oauth') : null;
      const handleBroadcast = (event: any) => {
        const data = event?.data;
        if (data?.type === 'oauth_callback') {
          handleOAuthCallback(data);
        }
      };
      if (bc) {
        bc.addEventListener('message', handleBroadcast);
      }

      // localStorage "storage" event fallback (cross-tab communication)
      const handleStorage = (event: StorageEvent) => {
        if (event.key !== 'oauth_callback' || !event.newValue) return;
        try {
          const payload = JSON.parse(event.newValue);
          if (payload?.type === 'oauth_callback') {
            handleOAuthCallback(payload);
          }
        } catch {
          // ignore
        }
      };
      
      // Check if popup is closed without completing
      const checkPopupClosed = setInterval(() => {
        try {
          // Under Cross-Origin-Opener-Policy, accessing popup.closed may throw — ignore and keep waiting.
          if (popup.closed && !completed) {
            finish(err(new Error('Sign-in cancelled')));
          }
        } catch {
          // ignore
        }
      }, 500);
      
      // Timeout after 5 minutes
      const timeoutId = setTimeout(() => {
        if (!completed) {
          try {
            popup.close();
          } catch {
            // ignore
          }
          finish(err(new Error('Sign-in timed out')));
        }
      }, 300000);
      
      const cleanup = () => {
        this._window.removeEventListener('message', handleMessage);
        this._window.removeEventListener('storage', handleStorage);
        clearInterval(checkPopupClosed);
        clearTimeout(timeoutId);
        sessionStorage.removeItem('oauth_state');
        sessionStorage.removeItem('oauth_provider');
        sessionStorage.removeItem('oauth_redirect_uri');
        if (bc) {
          bc.removeEventListener('message', handleBroadcast);
          bc.close();
        }
      };
      
      this._window.addEventListener('message', handleMessage);
      this._window.addEventListener('storage', handleStorage);
      
      return cleanup;
    });
  }

  /**
   * Exchange OAuth code for token
   */
  private _exchangeOAuthCode(provider: string, code: string, redirectUri: string): Observable<Result<string, Error>> {
    return this._http.post<AuthResponse>(
      `${this._authBffUrl}/auth/signin/oauth`,
      {
        provider,
        code,
        redirectUri
      }
    ).pipe(
      map(response => {
        this._storeRefreshToken(response.refreshToken);
        return ok(response.token);
      }),
      catchError(error => {
        console.error('OAuth code exchange error:', error);
        const errorMessage = error.error?.error || 'OAuth authentication failed';
        return of(err(new Error(errorMessage)));
      })
    );
  }

  /**
   * Generate random state for OAuth
   */
  private _generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Store refresh token securely
   */
  private _storeRefreshToken(token: string): void {
    try {
      localStorage.setItem('auth_refresh_token', token);
    } catch (e) {
      console.warn('Could not store refresh token:', e);
    }
  }

  /**
   * Get stored refresh token
   */
  private _getRefreshToken(): string | null {
    try {
      return localStorage.getItem('auth_refresh_token');
    } catch (e) {
      return null;
    }
  }

  /**
   * Clear refresh token
   */
  private _clearRefreshToken(): void {
    try {
      localStorage.removeItem('auth_refresh_token');
    } catch (e) {
      // Ignore
    }
  }
}

