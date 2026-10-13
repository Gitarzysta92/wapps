import { inject, Injectable, Injector, InjectionToken } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';
import { defer, finalize, shareReplay, Observable, throwError } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { AUTHENTICATION_SESSION } from '../application/authentication-session.port';
import { Router } from '@angular/router';
import { AUTHENTICATION_HANDLER } from '../application/authentication-handler.token';
import { WA_WINDOW } from '@ng-web-apis/common';
import { AUTH_BFF_URL } from './bff/auth-bff-url.token';
import type { Result } from '@sdk/kernel/standard';
import { SKIP_AUTHENTICATION_RECOVERY } from './authentication-request-context';
import { AUTHENTICATION_RECOVERY_CONTROL } from '../application/authentication-recovery-control';

export const AUTHENTICATED_ORIGINS = new InjectionToken<string[]>(
  'AUTHENTICATED_ORIGINS',
  { factory: () => [] }
);

@Injectable()
export class AuthenticationInterceptor implements HttpInterceptor {
  private readonly _window = inject(WA_WINDOW);
  private readonly _authUrl = inject(AUTH_BFF_URL, { optional: true });
  private readonly _origins = inject(AUTHENTICATED_ORIGINS);
  private readonly _storage = inject(AUTHENTICATION_SESSION);
  private readonly _recovery = inject(AUTHENTICATION_RECOVERY_CONTROL);
  private readonly _injector = inject(Injector);
  private _refresh:
    | { token: string; stream: Observable<Result<string, Error>> }
    | undefined;
  private readonly _router = inject(Router);

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    const origin = new URL(req.url, this._window.location.origin).origin;
    const trusted = [
      this._window.location.origin,
      ...this._origins,
      ...(this._authUrl
        ? [new URL(this._authUrl, this._window.location.origin).origin]
        : []),
    ];
    if (!trusted.includes(origin)) return next.handle(req);
    const authToken = this._storage.getToken();
    const clonedRequest = req.clone({
      setHeaders: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });

    return next.handle(clonedRequest).pipe(
      catchError((error) => {
        if (
          req.context.get(SKIP_AUTHENTICATION_RECOVERY) ||
          (authToken && this._recovery.hold?.token === authToken)
        )
          return throwError(() => error);
        if (error instanceof HttpErrorResponse && authToken) {
          if (error.status === 401) {
            // Avoid infinite loops for auth endpoints
            const url = req.url || '';
            if (
              url.includes('/auth/refresh') ||
              url.includes('/auth/signin') ||
              url.includes('/auth/signout')
            ) {
              return throwError(() => error);
            }

            return this._handle401Error(req, next, authToken);
          }
        }
        return throwError(() => error);
      })
    );
  }

  private _handle401Error(
    req: HttpRequest<unknown>,
    next: HttpHandler,
    authToken: string
  ): Observable<HttpEvent<unknown>> {
    if (this._storage.getToken() !== authToken)
      return throwError(() => new Error('Authentication session changed'));
    if (!this._refresh || this._refresh.token !== authToken) {
      const refresh = {
        token: authToken,
        stream: new Observable<Result<string, Error>>(),
      };
      refresh.stream = defer(() =>
        this._injector.get(AUTHENTICATION_HANDLER).refreshToken(authToken)
      ).pipe(
        tap((r) => {
          if (
            this._recovery.hold?.token === authToken ||
            this._storage.getToken() !== authToken
          )
            throw new Error('Authentication session changed');
          if (r.ok) this._storage.setToken(r.value);
        }),
        finalize(() => {
          if (this._refresh === refresh) this._refresh = undefined;
        }),
        shareReplay({ bufferSize: 1, refCount: true })
      );
      this._refresh = refresh;
    }
    let retryToken = authToken;
    return this._refresh.stream.pipe(
      switchMap((r) => {
        if (!r.ok) {
          return throwError(() => r.error ?? new Error('Token refresh failed'));
        }
        retryToken = r.value;
        if (this._storage.getToken() !== retryToken)
          return throwError(() => new Error('Authentication session changed'));
        return next.handle(
          req.clone({ setHeaders: { Authorization: `Bearer ${r.value}` } })
        );
      }),
      catchError((e) => {
        if (
          this._recovery.hold?.token !== authToken &&
          [authToken, retryToken].includes(this._storage.getToken() ?? '')
        ) {
          this._storage.clear();
          void this._router.navigateByUrl('');
        }
        return throwError(() => e);
      })
    );
  }
}
