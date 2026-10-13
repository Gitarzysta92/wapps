import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, defer, map, Observable, of } from 'rxjs';
import { err, ok, Result } from '@sdk/kernel/standard';
import {
  IPasswordResetHandler,
  ResetPasswordInput,
} from '@sdk/features/identity/libs/authentication';
import {
  IDENTITY_CONNECTION,
  identityApiError,
  identityEndpoint,
} from './identity-connection';

@Injectable()
export class PasswordResetApiService implements IPasswordResetHandler {
  private readonly http = inject(HttpClient);
  private readonly connection = inject(IDENTITY_CONNECTION);

  verifyCode(code: string): Observable<Result<void, Error>> {
    return defer(() =>
      this.http.post<{ valid: boolean }>(
        identityEndpoint(
          this.connection,
          'auth',
          '/auth/password-reset/verify'
        ),
        { code }
      )
    ).pipe(
      map((response) => {
        if (response?.valid !== true)
          throw new Error('This password reset link could not be verified.');
        return ok(undefined);
      }),
      catchError((error) =>
        of(
          err(
            identityApiError(
              error,
              'This reset link is invalid or no longer available. Request a new link.'
            )
          )
        )
      )
    );
  }

  resetPassword(input: ResetPasswordInput): Observable<Result<boolean, Error>> {
    return defer(() =>
      this.http.post<{ completed: boolean }>(
        identityEndpoint(
          this.connection,
          'auth',
          '/auth/password-reset/complete'
        ),
        input
      )
    ).pipe(
      map((response) => {
        if (response?.completed !== true)
          throw new Error(
            'Password reset was not confirmed. Try signing in or request a new link.'
          );
        return ok(true);
      }),
      catchError((error) =>
        of(
          err(
            identityApiError(
              error,
              'Password reset failed. Try signing in if an earlier attempt completed, or request a new link.'
            )
          )
        )
      )
    );
  }
}
