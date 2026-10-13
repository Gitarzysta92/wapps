import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, of, type Observable } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  parsePublicSuite,
  parsePublicSuitePage,
  parseSuitePublicationReceipt,
  parseSuitePublicationStatus,
  parseSuiteReviewPage,
  suiteId,
  type PublicSuiteQuery,
} from '@domains/publication/suite';
import {
  SUITE_API_ORIGIN,
  SuiteRequestError,
} from '../application/private-suites.port';
import type {
  SuitePublicationChange,
  SuitePublicationPort,
} from '../application/suite-publication.port';

@Injectable()
export class SuitePublicationApiService implements SuitePublicationPort {
  private readonly http = inject(HttpClient);
  private readonly origin = inject(SUITE_API_ORIGIN);
  status(id: string, review: boolean) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(
          review
            ? `${this.origin}/api/editorial/suite-reviews/${suiteId(id)}`
            : `${this.origin}/api/me/suites/${suiteId(id)}/publication`
        )
      ).pipe(
        map((value) => {
          const status = parseSuitePublicationStatus(value);
          if (status.id !== id) throw new Error('Unexpected suite publication');
          return status;
        })
      )
    );
  }
  reviews(page: number) {
    return this.result(
      this.http
        .get<unknown>(`${this.origin}/api/editorial/suite-reviews`, {
          params: { page: String(page) },
        })
        .pipe(
          map((value) => {
            const result = parseSuiteReviewPage(value);
            if (result.page !== page) throw new Error('Unexpected review page');
            return result;
          })
        )
    );
  }
  change(command: SuitePublicationChange, key: string) {
    const review = command.action === 'approve' || command.action === 'reject';
    return this.result(
      defer(() =>
        this.http.post<unknown>(
          review
            ? `${this.origin}/api/editorial/suite-reviews/${suiteId(
                command.id
              )}/decision`
            : `${this.origin}/api/me/suites/${suiteId(command.id)}/${
                command.action
              }`,
          review
            ? { ...command.input, decision: command.action }
            : { expectedRevision: command.input.expectedRevision },
          { headers: { 'Idempotency-Key': key } }
        )
      ).pipe(
        map((value) => {
          const receipt = parseSuitePublicationReceipt(value);
          if (
            receipt.id !== command.id ||
            receipt.action !== command.action ||
            receipt.revision !== command.input.expectedRevision + 1 ||
            (review &&
              receipt.submittedRevision !== command.input.submittedRevision)
          )
            throw new Error('Unexpected suite publication receipt');
          return receipt;
        })
      ),
      true
    );
  }
  browse(query: PublicSuiteQuery) {
    return this.result(
      this.http
        .get<unknown>(`${this.origin}/api/catalog/suites`, {
          params: { q: query.q, page: String(query.page) },
        })
        .pipe(
          map((value) => {
            const result = parsePublicSuitePage(value);
            if (result.page !== query.page)
              throw new Error('Unexpected suite page');
            return result;
          })
        )
    );
  }
  find(id: string) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(
          `${this.origin}/api/catalog/suites/${suiteId(id)}`
        )
      ).pipe(
        map((value) => {
          const suite = parsePublicSuite(value);
          if (suite.id !== id) throw new Error('Unexpected suite');
          return suite;
        })
      )
    );
  }
  private result<T>(
    source: Observable<T>,
    mutation = false
  ): Observable<Result<T, Error>> {
    return source.pipe(
      map(ok),
      catchError((failure: unknown) => {
        const status =
          failure instanceof HttpErrorResponse ? failure.status : 0;
        const uncertain =
          mutation && ![400, 401, 403, 404, 409].includes(status);
        const message =
          status === 409
            ? 'This suite or submission changed. Reload before continuing.'
            : status === 404
            ? 'Suite not found or no longer available.'
            : status === 403
            ? 'You do not have permission to perform this action. Reviewers cannot review their own suites.'
            : status === 401
            ? 'Sign in to continue.'
            : status === 400
            ? 'Check your input. Submitted applications must be available, and rejection needs a reason.'
            : uncertain
            ? 'The change could not be confirmed. Retry the same request before making another change.'
            : 'Suite publication is unavailable or updating. Try again shortly.';
        return of(err(new SuiteRequestError(uncertain, message)));
      })
    );
  }
}
