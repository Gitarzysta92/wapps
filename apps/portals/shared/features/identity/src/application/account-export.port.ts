import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type { AccountExportJob } from '@sdk/features/identity/core';

export class AccountExportError extends Error {
  constructor(
    readonly reason: 'denied' | 'conflict' | 'invalid' | 'unavailable',
    message: string
  ) {
    super(message);
  }
}
export interface AccountExportPort {
  latest(): Observable<Result<AccountExportJob | null, AccountExportError>>;
  request(
    key: string
  ): Observable<Result<AccountExportJob, AccountExportError>>;
  cancel(id: string): Observable<Result<AccountExportJob, AccountExportError>>;
  download(job: AccountExportJob): Observable<Result<Blob, AccountExportError>>;
  save(blob: Blob, id: string): void;
  newKey(): string;
}
export const ACCOUNT_EXPORT = new InjectionToken<AccountExportPort>(
  'ACCOUNT_EXPORT'
);
export const ACCOUNT_EXPORT_URL = new InjectionToken<string>(
  'ACCOUNT_EXPORT_URL'
);
