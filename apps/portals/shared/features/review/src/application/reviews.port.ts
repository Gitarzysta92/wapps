import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type {
  ReviewChange,
  ReviewReceipt,
  ReviewReportPage,
} from '@sdk/features/review/core';
import type { MemberReview, ReviewPage } from '@domains/community';

export interface ReviewAttempt {
  applicationId: string;
  id: string | null;
  change: ReviewChange;
  key: string;
}
export interface ReviewsPort {
  summary(
    applicationId: string
  ): Observable<Result<ReviewPage['summary'], Error>>;
  page(
    applicationId: string,
    cursor: string | null,
    moderation: boolean
  ): Observable<Result<ReviewPage, Error>>;
  read(
    applicationId: string,
    id: string
  ): Observable<Result<MemberReview, Error>>;
  reports(
    applicationId: string,
    id: string,
    cursor: string | null
  ): Observable<Result<ReviewReportPage, Error>>;
  change(attempt: ReviewAttempt): Observable<Result<ReviewReceipt, Error>>;
}
export const REVIEWS = new InjectionToken<ReviewsPort>('REVIEWS');
export const REVIEWS_ORIGIN = new InjectionToken<string>('REVIEWS_ORIGIN');
export class ReviewRequestError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly uncertain = false
  ) {
    super(message);
  }
}
