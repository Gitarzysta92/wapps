import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';

export interface ErasureAccount {
  identityId: string;
  name: string;
}
export interface AccountErasureAcceptance {
  identityId: string;
  revision: number;
  status: 'accepted';
  cleanup: 'pending' | 'completed' | 'failed';
}
export interface AccountErasurePort {
  prepare(): Observable<Result<ErasureAccount, Error>>;
  request(
    identityId: string
  ): Observable<Result<AccountErasureAcceptance, Error>>;
}
export const ACCOUNT_ERASURE = new InjectionToken<AccountErasurePort>(
  'ACCOUNT_ERASURE'
);
export const ACCOUNT_ERASURE_URL = new InjectionToken<string>(
  'ACCOUNT_ERASURE_URL'
);
