import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type {
  ApplicationPublicationAction,
  ApplicationPublicationInput,
  ApplicationPublicationReceipt,
  ApplicationPublicationStatus,
  ApplicationReviewPage,
} from '@domains/catalog/record';

export interface ApplicationPublicationChange {
  id: string;
  action: ApplicationPublicationAction;
  input: ApplicationPublicationInput;
}
export interface ApplicationPublicationPort {
  status(
    id: string,
    review: boolean
  ): Observable<Result<ApplicationPublicationStatus, Error>>;
  reviews(page: number): Observable<Result<ApplicationReviewPage, Error>>;
  change(
    command: ApplicationPublicationChange,
    key: string
  ): Observable<Result<ApplicationPublicationReceipt, Error>>;
}
export const APPLICATION_PUBLICATION =
  new InjectionToken<ApplicationPublicationPort>('APPLICATION_PUBLICATION');
