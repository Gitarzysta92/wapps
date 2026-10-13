import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { WA_WINDOW } from '@ng-web-apis/common';
import { catchError, defer, map, Observable, of } from 'rxjs';
import { err, ok, Result } from '@sdk/kernel/standard';
import {
  IRegistrationHandler,
  RegistrationDto,
} from '@sdk/features/identity/libs/authentication';
import {
  IDENTITY_CONNECTION,
  identityApiError,
  identityEndpoint,
  parseIdentitySession,
} from './identity-connection';

@Injectable()
export class IdentityRegistrationApiService implements IRegistrationHandler {
  private readonly http = inject(HttpClient);
  private readonly connection = inject(IDENTITY_CONNECTION);
  private readonly window = inject(WA_WINDOW);
  private command?: { signature: string; key: string };

  register(input: RegistrationDto): Observable<Result<boolean, Error>> {
    return defer(() => {
      const url = identityEndpoint(this.connection, 'auth', '/auth/register');
      const signature = JSON.stringify([input.email, input.nickname]);
      // Keep a retry key for this form lifetime. Passwords are never retained in browser storage.
      if (this.command?.signature !== signature)
        this.command = { signature, key: this.window.crypto.randomUUID() };
      return this.http.post<unknown>(url, input, {
        headers: { 'Idempotency-Key': this.command.key },
      });
    }).pipe(
      map((value) => {
        parseIdentitySession(value);
        return ok(true);
      }),
      catchError((error) =>
        of(
          err(
            identityApiError(
              error,
              'Registration failed. If an earlier attempt completed, sign in to continue.'
            )
          )
        )
      )
    );
  }
}
