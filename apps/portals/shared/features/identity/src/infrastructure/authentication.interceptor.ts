import { inject, Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { AuthenticationStorage } from './authentication.storage';
import { AuthenticationApiService } from './authentication-api.service';
import { Router } from '@angular/router';


@Injectable()
export class AuthenticationInterceptor implements HttpInterceptor {

  private readonly _storage = inject(AuthenticationStorage);
  private readonly _apiClient = inject(AuthenticationApiService);
  private readonly _router = inject(Router);


  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const authToken = this._storage.getToken();
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

  private _handle401Error(
    req: HttpRequest<any>,
    next: HttpHandler,
    authToken: string
  ): Observable<HttpEvent<any>> {
    return this._apiClient.getRefreshedToken(authToken)
      .pipe(
        tap(t => this._storage.setToken(t.value)),
        switchMap(t => next.handle(req.clone({ setHeaders: { Authorization: `Bearer ${t}` } }))),
        catchError((e) => {
          this._storage.clear();
          this._router.navigateByUrl('');
          return throwError(() => e);
        })
      )
  }
}
