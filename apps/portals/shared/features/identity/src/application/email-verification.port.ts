import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Result } from '@sdk/kernel/standard';
import {
  CredentialEmailRequest,
  CredentialEmailStatus,
} from '@sdk/features/identity/libs/authentication';

export interface EmailVerificationPort {
  readonly mode: 'api' | 'demo';
  status(): Observable<Result<CredentialEmailStatus, Error>>;
  request(): Observable<Result<CredentialEmailRequest, Error>>;
  verify(code: string): Observable<Result<void, Error>>;
  complete(code: string): Observable<Result<void, Error>>;
}

export const EMAIL_VERIFICATION = new InjectionToken<EmailVerificationPort>(
  'EMAIL_VERIFICATION'
);
