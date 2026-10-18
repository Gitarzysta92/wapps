import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, of, type Observable } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  reviewChange,
  reviewId,
  reviewObject,
  reviewReportPage,
  reviewRevision,
  reviewSummary,
} from '@sdk/features/review/core';
import { memberReview, reviewPage } from '@domains/community';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import {
  REVIEWS_ORIGIN,
  ReviewRequestError,
  type ReviewAttempt,
  type ReviewsPort,
} from '../application/reviews.port';

@Injectable()
export class ReviewsApiService implements ReviewsPort {
  private readonly http = inject(HttpClient);
  private readonly origin = inject(REVIEWS_ORIGIN);
  private readonly session = inject(AUTHENTICATION_SESSION);
  private base(id: string) {
    return `${this.origin}/api/application-reviews/${reviewId(id)}`;
  }
  summary(applicationId: string) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(this.base(applicationId) + '/summary')
      ).pipe(map(reviewSummary))
    );
  }
  page(applicationId: string, cursor: string | null, moderation: boolean) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(
          this.base(applicationId) + (moderation ? '/moderation' : ''),
          {
            params: cursor ? { cursor } : {},
          }
        )
      ).pipe(map((value) => reviewPage(value, applicationId, moderation)))
    );
  }
  read(applicationId: string, id: string) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(`${this.base(applicationId)}/${reviewId(id)}`)
      ).pipe(
        map((value) => {
          const review = memberReview(value, applicationId);
          if (review.id !== id) throw new Error('Unexpected review');
          return review;
        })
      )
    );
  }
  reports(applicationId: string, id: string, cursor: string | null) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(
          `${this.base(applicationId)}/${reviewId(id)}/reports`,
          {
            params: cursor ? { cursor } : {},
          }
        )
      ).pipe(map(reviewReportPage))
    );
  }
  change(attempt: ReviewAttempt) {
    const token = this.session.getToken();
    return this.result(
      defer(() => {
        if (!token || token !== this.session.getToken())
          throw new ReviewRequestError('Sign in to write a review.', 401);
        const { type, ...body } = attempt.change;
        let url: string;
        try {
          reviewChange(type, body);
          url =
            this.base(attempt.applicationId) +
            (type === 'publish' ? '/mine' : `/${reviewId(attempt.id)}`);
        } catch (error) {
          throw new ReviewRequestError(
            error instanceof Error ? error.message : 'Check the review.',
            400
          );
        }
        if (type === 'helpful') url += '/helpful';
        if (type === 'report') url += '/reports';
        if (type === 'moderate') url += '/moderation';
        return this.http.request<unknown>(
          type === 'withdraw' ? 'DELETE' : type === 'report' ? 'POST' : 'PUT',
          url,
          {
            body,
            headers: { 'Idempotency-Key': attempt.key },
          }
        );
      }).pipe(
        map((value) => {
          const row = reviewObject(value, ['id', 'revision']);
          const id = reviewId(row['id']);
          const revision = reviewRevision(row['revision']);
          if (
            (attempt.id !== null && id !== attempt.id) ||
            revision !== attempt.change.expectedRevision + 1
          )
            throw new Error('Unexpected review receipt');
          return { id, revision };
        })
      ),
      true
    );
  }
  private result<T>(
    request: Observable<T>,
    mutation = false
  ): Observable<Result<T, Error>> {
    return request.pipe(
      map(ok),
      catchError((error: unknown) => {
        if (error instanceof ReviewRequestError) return of(err(error));
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        const message =
          status === 401
            ? 'Sign in to write a review.'
            : status === 403
            ? 'You cannot perform this review action.'
            : status === 404
            ? 'This application or review is no longer available.'
            : status === 409
            ? 'The review changed. Reload before trying again; your text is still here.'
            : status === 400
            ? 'Check the public name, rating, text and saved revision.'
            : mutation
            ? 'The change could not be confirmed. Retry the same request.'
            : 'Reviews are unavailable. Try loading them again.';
        return of(
          err(
            new ReviewRequestError(
              message,
              status,
              mutation && (status === 0 || status >= 500)
            )
          )
        );
      })
    );
  }
}
