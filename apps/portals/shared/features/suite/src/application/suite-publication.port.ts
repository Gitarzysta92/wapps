import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type {
  PublicSuite,
  PublicSuitePage,
  PublicSuiteQuery,
  SuitePublicationAction,
  SuitePublicationInput,
  SuitePublicationReceipt,
  SuitePublicationStatus,
  SuiteReviewPage,
} from '@domains/publication/suite';

export interface SuitePublicationChange {
  id: string;
  action: SuitePublicationAction;
  input: SuitePublicationInput;
}
export interface SuitePublicationPort {
  status(
    id: string,
    review: boolean
  ): Observable<Result<SuitePublicationStatus, Error>>;
  reviews(page: number): Observable<Result<SuiteReviewPage, Error>>;
  change(
    command: SuitePublicationChange,
    key: string
  ): Observable<Result<SuitePublicationReceipt, Error>>;
  browse(query: PublicSuiteQuery): Observable<Result<PublicSuitePage, Error>>;
  find(id: string): Observable<Result<PublicSuite, Error>>;
}
export const SUITE_PUBLICATION = new InjectionToken<SuitePublicationPort>(
  'SUITE_PUBLICATION'
);
