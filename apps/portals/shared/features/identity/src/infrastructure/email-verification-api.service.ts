import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, defer, map, Observable, of } from 'rxjs';
import { err, ok, Result } from '@sdk/kernel/standard';
import {
  CredentialEmailRequest,
  CredentialEmailStatus,
} from '@sdk/features/identity/libs/authentication';
import { EmailVerificationPort } from '../application/email-verification.port';
import {
  IDENTITY_CONNECTION,
  identityApiError,
  identityEndpoint,
} from './identity-connection';

@Injectable()
export class EmailVerificationApiService implements EmailVerificationPort {
  private readonly http = inject(HttpClient);
  private readonly connection = inject(IDENTITY_CONNECTION);
  readonly mode = this.connection.mode;

  status(): Observable<Result<CredentialEmailStatus, Error>> {
    return this.call('status', undefined, (data) => {
      if (
        (data['email'] !== null &&
          (typeof data['email'] !== 'string' ||
            data['email'].length > 254 ||
            !/^[^\s@]+@[^\s@]+$/.test(data['email']))) ||
        typeof data['verified'] !== 'boolean' ||
        (data['email'] === null && data['verified'])
      )
        throw new Error(
          'Verification status is unavailable. Please refresh it.'
        );
      return { email: data['email'], verified: data['verified'] };
    });
  }

  request(): Observable<Result<CredentialEmailRequest, Error>> {
    return this.call('request', {}, (data) => {
      if (
        data['outcome'] !== 'requested' &&
        data['outcome'] !== 'already-verified'
      )
        throw new Error(
          'The request could not be confirmed. Check your inbox before trying again.'
        );
      return data['outcome'];
    });
  }

  verify(code: string): Observable<Result<void, Error>> {
    return this.call('verify', { code }, (data) => {
      if (data['valid'] !== true)
        throw new Error('This verification link could not be checked.');
    });
  }

  complete(code: string): Observable<Result<void, Error>> {
    return this.call('complete', { code }, (data) => {
      if (data['completed'] !== true)
        throw new Error(
          'Verification could not be confirmed. Refresh your status in Profile Settings.'
        );
    });
  }

  private call<T>(
    path: string,
    body: object | undefined,
    parse: (data: Record<string, unknown>) => T
  ): Observable<Result<T, Error>> {
    return defer(() => {
      const url = identityEndpoint(
        this.connection,
        'auth',
        `/auth/email-verification/${path}`
      );
      return body === undefined
        ? this.http.get<unknown>(url)
        : this.http.post<unknown>(url, body);
    }).pipe(
      map((data) => {
        if (!data || typeof data !== 'object' || Array.isArray(data))
          throw new Error(
            'The verification service returned an invalid response.'
          );
        return ok(parse(data as Record<string, unknown>));
      }),
      catchError((error) =>
        of(
          err(
            identityApiError(
              error,
              'Email verification could not be confirmed. Check your inbox or refresh your status in Profile Settings.'
            )
          )
        )
      )
    );
  }
}
