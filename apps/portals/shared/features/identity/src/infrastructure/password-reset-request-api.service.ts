import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, defer, map, Observable, of } from 'rxjs';
import { err, ok, Result } from '@sdk/kernel/standard';
import {
  IPasswordResetRequestHandler,
  PasswordResetRequestDto,
} from '@sdk/features/identity/libs/authentication';
import {
  IDENTITY_CONNECTION,
  identityApiError,
  identityEndpoint,
} from './identity-connection';

@Injectable()
export class PasswordResetRequestApiService
  implements IPasswordResetRequestHandler
{
  private readonly http = inject(HttpClient);
  private readonly connection = inject(IDENTITY_CONNECTION);

  requestPasswordReset(
    input: PasswordResetRequestDto
  ): Observable<Result<void, Error>> {
    return defer(() =>
      this.http.post<{ accepted: boolean }>(
        identityEndpoint(this.connection, 'account', '/api/password-recovery'),
        { email: input.login }
      )
    ).pipe(
      map((response) => {
        if (response?.accepted !== true)
          throw new Error(
            'Password recovery was not accepted. Please try again.'
          );
        return ok(undefined);
      }),
      catchError((error) =>
        of(err(identityApiError(error, 'Password recovery failed.')))
      )
    );
  }
}
