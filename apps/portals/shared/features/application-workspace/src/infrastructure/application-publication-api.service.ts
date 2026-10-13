import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, of, type Observable } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  parseApplicationPublicationReceipt,
  parseApplicationPublicationStatus,
  parseApplicationReviewPage,
  applicationDraftId,
} from '@domains/catalog/record';
import {
  APPLICATION_WORKSPACE_ORIGIN,
  ApplicationDraftRequestError,
} from '../application/application-drafts.port';
import type {
  ApplicationPublicationChange,
  ApplicationPublicationPort,
} from '../application/application-publication.port';

@Injectable({ providedIn: 'root' })
export class ApplicationPublicationApiService
  implements ApplicationPublicationPort
{
  private readonly http = inject(HttpClient);
  private readonly origin = inject(APPLICATION_WORKSPACE_ORIGIN);
  status(id: string, review: boolean) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(
          review
            ? `${
                this.origin
              }/api/editorial/application-reviews/${applicationDraftId(id)}`
            : `${this.origin}/api/me/application-drafts/${applicationDraftId(
                id
              )}/publication`
        )
      ).pipe(
        map((value) => {
          const status = parseApplicationPublicationStatus(value);
          if (status.id !== id)
            throw new Error('Unexpected application publication');
          return status;
        })
      )
    );
  }
  reviews(page: number) {
    return this.result(
      this.http
        .get<unknown>(`${this.origin}/api/editorial/application-reviews`, {
          params: { page: String(page) },
        })
        .pipe(
          map((value) => {
            const result = parseApplicationReviewPage(value);
            if (result.page !== page) throw new Error('Unexpected review page');
            return result;
          })
        )
    );
  }
  change(command: ApplicationPublicationChange, key: string) {
    const review = command.action === 'approve' || command.action === 'reject';
    return this.result(
      defer(() =>
        this.http.post<unknown>(
          review
            ? `${
                this.origin
              }/api/editorial/application-reviews/${applicationDraftId(
                command.id
              )}/decision`
            : `${this.origin}/api/me/application-drafts/${applicationDraftId(
                command.id
              )}/${command.action}`,
          review
            ? { ...command.input, decision: command.action }
            : { expectedRevision: command.input.expectedRevision },
          { headers: { 'Idempotency-Key': key } }
        )
      ).pipe(
        map((value) => {
          const receipt = parseApplicationPublicationReceipt(value);
          if (
            receipt.id !== command.id ||
            receipt.action !== command.action ||
            receipt.revision !== command.input.expectedRevision + 1 ||
            (review &&
              receipt.submittedRevision !== command.input.submittedRevision)
          )
            throw new Error('Unexpected application publication receipt');
          return receipt;
        })
      ),
      true
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
            ? 'The draft, submitted content or public application changed, or the public slug is in use. Reload before continuing.'
            : status === 404
            ? 'Application not found or no longer available.'
            : status === 403
            ? 'You do not have permission to perform this action. Reviewers cannot review their own applications.'
            : status === 401
            ? 'Sign in to continue.'
            : status === 400
            ? 'Check your input. Rejection requires a reason.'
            : uncertain
            ? 'The change could not be confirmed. Retry the same request before making another change.'
            : 'Application publication is unavailable or updating. Try again shortly.';
        return of(err(new ApplicationDraftRequestError(uncertain, message)));
      })
    );
  }
}
