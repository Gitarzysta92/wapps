import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type {
  PrivateSuite,
  SuiteFields,
  SuiteReceipt,
} from '@domains/publication/suite';
import type { CatalogApp, CatalogPage } from '@domains/catalog/record';

export interface SuiteChange {
  type: 'create' | 'update' | 'delete';
  id: string | null;
  expectedRevision: number | null;
  fields: SuiteFields | null;
}
export interface PrivateSuitesPort {
  list(): Observable<Result<PrivateSuite[], Error>>;
  read(id: string): Observable<Result<PrivateSuite, Error>>;
  change(
    command: SuiteChange,
    key: string
  ): Observable<Result<SuiteReceipt, Error>>;
  search(search: string, page: number): Observable<Result<CatalogPage, Error>>;
  resolve(ids: string[]): Observable<Result<CatalogApp[], Error>>;
}
export interface SuiteSession {
  key$: Observable<string | null>;
  currentKey(): string | null;
}
export class SuiteRequestError extends Error {
  constructor(readonly uncertain: boolean, message: string) {
    super(message);
  }
}
export const PRIVATE_SUITES = new InjectionToken<PrivateSuitesPort>(
  'PRIVATE_SUITES'
);
export const SUITE_SESSION = new InjectionToken<SuiteSession>('SUITE_SESSION');
export const SUITE_API_ORIGIN = new InjectionToken<string>('SUITE_API_ORIGIN');
