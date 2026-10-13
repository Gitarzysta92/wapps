import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  EMPTY,
  Observable,
  map,
  catchError,
  of,
  defer,
  switchMap,
  shareReplay,
  firstValueFrom,
} from 'rxjs';
import {
  IAuthenticationHandler,
  CredentialsDto,
  AuthenticationProvider,
  AuthenticationMethodDto,
} from '@sdk/features/identity/libs/authentication';
import { Result, ok, err } from '@sdk/kernel/standard';
import { AUTH_BFF_URL } from './auth-bff-url.token';
import { WA_WINDOW } from '@ng-web-apis/common';
import { AUTHENTICATION_SESSION } from '../../application/authentication-session.port';
import {
  IDENTITY_CONNECTION,
  identityApiError,
  parseIdentitySession,
} from '../identity-connection';
import { OAuthCallbackHandler } from '../../application/oauth-callback.port';

@Injectable()
export class BffAuthenticationService
  implements IAuthenticationHandler, OAuthCallbackHandler
{
  private readonly http = inject(HttpClient);
  private readonly authUrl = inject(AUTH_BFF_URL);
  private readonly window = inject(WA_WINDOW);
  private readonly session = inject(AUTHENTICATION_SESSION);
  private readonly connection = inject(IDENTITY_CONNECTION);

  completeCallback(input: {
    code: string | null;
    state: string | null;
    error: string | null;
  }): Observable<Result<string, Error>> {
    return defer(async () => {
      if (this.connection.mode !== 'api')
        throw new Error('OAuth requires a connected identity service.');
      if (!input.state || !/^[A-Za-z0-9_-]{16,128}$/.test(input.state))
        throw new Error('Invalid OAuth state. Please sign in again.');
      const raw = this.window.localStorage.getItem(`oauth_ctx_${input.state}`);
      this.window.localStorage.removeItem(`oauth_ctx_${input.state}`);
      if (input.error || !input.code || input.code.length > 4096 || !raw)
        throw new Error('Sign-in could not be completed. Please start again.');
      const context: unknown = JSON.parse(raw);
      if (
        !context ||
        typeof context !== 'object' ||
        !('provider' in context) ||
        (context.provider !== 'google' && context.provider !== 'github') ||
        !('redirectUri' in context) ||
        context.redirectUri !==
          `${this.window.location.origin}/auth/callback` ||
        !('createdAt' in context) ||
        typeof context.createdAt !== 'number' ||
        context.createdAt > Date.now() ||
        Date.now() - context.createdAt > 600_000 ||
        !('returnTo' in context) ||
        typeof context.returnTo !== 'string' ||
        !context.returnTo.startsWith('/') ||
        context.returnTo.startsWith('//') ||
        new URL(context.returnTo, this.window.location.origin).origin !==
          this.window.location.origin
      )
        throw new Error(
          'Invalid or expired sign-in context. Please sign in again.'
        );
      const codeVerifier =
        'codeVerifier' in context ? context.codeVerifier : undefined;
      if (
        context.provider === 'google' &&
        (typeof codeVerifier !== 'string' ||
          !/^[A-Za-z0-9_-]{43,128}$/.test(codeVerifier))
      )
        throw new Error(
          'Invalid sign-in verification context. Please sign in again.'
        );
      const value = await firstValueFrom(
        this.http.post<unknown>(`${this.authUrl}/auth/signin/oauth`, {
          provider: context.provider,
          code: input.code,
          redirectUri: context.redirectUri,
          ...(context.provider === 'google' ? { codeVerifier } : {}),
        })
      );
      const session = parseIdentitySession(value);
      this.session.setRefreshToken(session.refreshToken);
      this.session.setToken(session.token);
      return ok(context.returnTo);
    }).pipe(
      catchError((error) =>
        of(
          err(
            identityApiError(error, 'OAuth sign-in failed. Please start again.')
          )
        )
      )
    );
  }

  authenticate(credentials: CredentialsDto): Observable<Result<string, Error>> {
    return this.exchange('/auth/signin', {
      email: credentials.login,
      password: credentials.password,
    });
  }

  authenticateWithProvider(
    provider: AuthenticationProvider
  ): Observable<Result<string, Error>> {
    if (provider === AuthenticationProvider.ANONYMOUS)
      return this.exchange('/auth/signin/anonymous', {});
    if (
      provider !== AuthenticationProvider.GOOGLE &&
      provider !== AuthenticationProvider.GITHUB
    )
      return of(err(new Error('This sign-in provider is not supported.')));
    return defer(() => this.redirectOAuth(provider.toLowerCase())).pipe(
      switchMap(() => EMPTY),
      catchError(() =>
        of(
          err(
            new Error(
              'Sign-in could not start. Check browser storage permissions and try again.'
            )
          )
        )
      )
    );
  }

  getAvailableMethods(): Observable<AuthenticationMethodDto[]> {
    return this.http
      .get<{ methods: AuthenticationMethodDto[] }>(
        `${this.authUrl}/auth/methods`
      )
      .pipe(
        map((response) => {
          if (
            !Array.isArray(response?.methods) ||
            response.methods.some(
              (method) =>
                !Object.values(AuthenticationProvider).includes(
                  method.provider
                ) ||
                typeof method.enabled !== 'boolean' ||
                typeof method.displayName !== 'string'
            )
          )
            throw new Error('Invalid authentication configuration');
          return response.methods;
        }),
        shareReplay({ bufferSize: 1, refCount: true })
      );
  }

  refreshToken(): Observable<Result<string, Error>> {
    return defer(() => {
      const refreshToken = this.session.getRefreshToken();
      const accessToken = this.session.getToken();
      if (!refreshToken)
        return of(
          err(new Error('No refresh token available. Please sign in.'))
        );
      return this.exchange(
        '/auth/refresh',
        { refreshToken },
        () =>
          this.session.getToken() === accessToken &&
          this.session.getRefreshToken() === refreshToken
      );
    });
  }

  signOut(): Observable<Result<void, Error>> {
    const token = this.session.getToken();
    const clearCurrent = () => {
      if (this.session.getToken() === token) this.session.clear();
    };
    return this.http.post<unknown>(`${this.authUrl}/auth/signout`, {}).pipe(
      map(() => {
        clearCurrent();
        return ok(undefined);
      }),
      catchError((error) => {
        clearCurrent();
        return of(
          err(
            identityApiError(
              error,
              'Signed out on this browser. Server session revocation was not confirmed.'
            )
          )
        );
      })
    );
  }

  private exchange(
    path: string,
    body: Record<string, unknown>,
    currentSession: () => boolean = () => true
  ): Observable<Result<string, Error>> {
    return this.http.post<unknown>(`${this.authUrl}${path}`, body).pipe(
      map((value) => {
        if (!currentSession())
          throw new Error('Authentication session changed');
        const session = parseIdentitySession(value);
        this.session.setRefreshToken(session.refreshToken);
        return ok(session.token);
      }),
      catchError((error) => {
        if (
          path === '/auth/refresh' &&
          currentSession() &&
          error instanceof HttpErrorResponse &&
          error.status === 401
        )
          this.session.clearRefreshToken();
        return of(err(identityApiError(error, 'Authentication failed.')));
      })
    );
  }

  private async redirectOAuth(provider: string): Promise<void> {
    const state = this.window.crypto.randomUUID();
    const redirectUri = `${this.window.location.origin}/auth/callback`;
    const context: {
      provider: string;
      redirectUri: string;
      returnTo: string;
      createdAt: number;
      codeVerifier?: string;
    } = {
      provider,
      redirectUri,
      returnTo: `${this.window.location.pathname}${this.window.location.search}${this.window.location.hash}`,
      createdAt: Date.now(),
    };
    const params = new URLSearchParams({ redirect_uri: redirectUri, state });
    if (provider === 'google') {
      const bytes = this.window.crypto.getRandomValues(new Uint8Array(32));
      context.codeVerifier = this.base64Url(bytes);
      const digest = await this.window.crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(context.codeVerifier)
      );
      params.set('code_challenge', this.base64Url(new Uint8Array(digest)));
      params.set('code_challenge_method', 'S256');
    }
    // Failed persistence must stop redirect; a callback without its state cannot be trusted.
    this.window.localStorage.setItem(
      `oauth_ctx_${state}`,
      JSON.stringify(context)
    );
    this.window.location.assign(
      `${this.authUrl}/auth/oauth/${provider}/authorize?${params}`
    );
  }

  private base64Url(bytes: Uint8Array): string {
    return this.window
      .btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }
}
