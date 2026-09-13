import { inject, Injectable, Injector, InjectionToken } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { defer, finalize, shareReplay, Observable, throwError } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { AuthenticationStorage } from './authentication.storage';
import { Router } from '@angular/router';
import { AUTHENTICATION_HANDLER } from '../application/authentication-handler.token';
import { WA_WINDOW } from '@ng-web-apis/common';
import { AUTH_BFF_URL } from './bff/auth-bff-url.token';
import type { Result } from '@foundation/standard';
import type { IAuthenticationHandler } from '@domains/identity/authentication';


export const AUTHENTICATED_ORIGINS = new InjectionToken<string[]>('AUTHENTICATED_ORIGINS', { factory: () => [] });

@Injectable()
export class AuthenticationInterceptor implements HttpInterceptor {

  private readonly _window = inject(WA_WINDOW);
  private readonly _authUrl = inject(AUTH_BFF_URL, { optional: true });
  private readonly _origins = inject(AUTHENTICATED_ORIGINS);
  private readonly _storage = inject(AuthenticationStorage);
  private readonly _injector = inject(Injector);
  private _refresh$: Observable<Result<string, Error>> | undefined;
  private readonly _router = inject(Router);


  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const origin = new URL(req.url, this._window.location.origin).origin;
    const trusted = [this._window.location.origin, ...this._origins, ...(this._authUrl ? [new URL(this._authUrl, this._window.location.origin).origin] : [])];
    if (!trusted.includes(origin)) return next.handle(req);
    const authToken = this._storage.getToken();
    const clonedRequest = req.clone({
      setHeaders: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });

    return next.handle(clonedRequest).pipe(
      catchError((error) => {
        if (error instanceof HttpErrorResponse && authToken) {
          if (error.status === 401) {
            // Avoid infinite loops for auth endpoints
            const url = req.url || '';
            if (url.includes('/auth/refresh') || url.includes('/auth/signin') || url.includes('/auth/signout')) {
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
    req: HttpRequest<any>,
    next: HttpHandler,
    authToken: string
  ): Observable<HttpEvent<any>> {
    if (!this._refresh$) {
      this._refresh$ = defer(() => this._injector.get(AUTHENTICATION_HANDLER).refreshToken(authToken)).pipe(
        tap(r => { if (r.ok) this._storage.setToken(r.value); }),
        finalize(() => { this._refresh$ = undefined; }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this._refresh$.pipe(
      switchMap((r) => {
        if (!r.ok) {
          return throwError(() => r.error ?? new Error('Token refresh failed'));
        }
        return next.handle(req.clone({ setHeaders: { Authorization: `Bearer ${r.value}` } }));
      }),
      catchError((e) => {
        this._storage.clear();
        void this._router.navigateByUrl('');
        return throwError(() => e);
      })
    );
  }
}
