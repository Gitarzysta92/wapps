import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable, map, catchError, of } from "rxjs";
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
    const returnTo = `${this._window.location.pathname}${this._window.location.search}${this._window.location.hash}`;

    // Redirect (industry standard): no popup/opener/COOP complexity.
    void this._redirectOAuth(providerName, redirectUri, state, returnTo);
    return new Observable<Result<string, Error>>(() => undefined);
  }

  private async _redirectOAuth(providerName: string, redirectUri: string, state: string, returnTo: string) {
    // Persist context (works across redirects/tabs)
    const ctx: any = { provider: providerName, redirectUri, returnTo, createdAt: Date.now() };

    // PKCE only for Google (optional, but recommended for SPA-style redirect flows)
    if (providerName === 'google') {
      const pkce = await this._createPkce();
      ctx.codeVerifier = pkce.codeVerifier;
      ctx.codeChallenge = pkce.codeChallenge;
      ctx.codeChallengeMethod = 'S256';
    }

    try {
      localStorage.setItem(`oauth_ctx_${state}`, JSON.stringify(ctx));
    } catch {
      // ignore
    }

    const qs = new URLSearchParams({
      redirect_uri: redirectUri,
      state,
    });

    if (providerName === 'google' && ctx.codeChallenge) {
      qs.set('code_challenge', ctx.codeChallenge);
      qs.set('code_challenge_method', 'S256');
    }

    const authUrl = `${this._authBffUrl}/auth/oauth/${providerName}/authorize?${qs.toString()}`;
    this._window.location.assign(authUrl);
  }

  private async _createPkce(): Promise<{ codeVerifier: string; codeChallenge: string }> {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const codeVerifier = this._base64UrlEncode(bytes);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
    const codeChallenge = this._base64UrlEncode(new Uint8Array(digest));
    return { codeVerifier, codeChallenge };
  }

  private _base64UrlEncode(bytes: Uint8Array): string {
    let str = '';
    for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
    const b64 = btoa(str);
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
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

