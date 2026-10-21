import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, of, type Observable } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  ownershipId,
  parseOwnershipClaim,
  parseOwnershipPage,
  parseOwnershipReceipt,
} from '@domains/catalog/ownership';
import {
  applicationDraftId,
  catalogSlug,
  parseApplicationDraftReceipt,
  parseApplicationEditingSource,
  parseCatalogApp,
} from '@domains/catalog/record';
import {
  APPLICATION_WORKSPACE_ORIGIN,
  ApplicationDraftRequestError,
} from '../application/application-drafts.port';
import type {
  ApplicationOwnershipPort,
  ApplicationEditingPort,
  ApplicationEditingCommand,
  OwnershipApplication,
  OwnershipCommand,
} from '../application/application-ownership.port';

@Injectable({ providedIn: 'root' })
export class ApplicationOwnershipApiService
  implements ApplicationOwnershipPort, ApplicationEditingPort
{
  private readonly http = inject(HttpClient);
  private readonly origin = inject(APPLICATION_WORKSPACE_ORIGIN);
  application(slug: string) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(
          `${this.origin}/api/catalog/apps/${encodeURIComponent(
            catalogSlug(slug)
          )}`
        )
      ).pipe(
        map((value): OwnershipApplication => {
          const app = parseCatalogApp(value);
          if (app.slug !== slug) throw new Error('Unexpected application');
          return {
            id: app.id,
            name: app.name,
            slug: app.slug,
            website: app.website,
          };
        })
      )
    );
  }
  list(review: boolean, page: number, grants = false) {
    return this.result(
      defer(() => {
        if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
          throw new Error('Invalid page');
        return this.http.get<unknown>(this.base(review), {
          params: {
            page: String(page),
            ...(review ? { view: grants ? 'grants' : 'pending' } : {}),
          },
        });
      }).pipe(
        map((value) => {
          const result = parseOwnershipPage(value);
          if (result.page !== page)
            throw new Error('Unexpected ownership page');
          return result;
        })
      )
    );
  }
  read(id: string, review: boolean) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(`${this.base(review)}/${ownershipId(id)}`)
      ).pipe(
        map((value) => {
          const claim = parseOwnershipClaim(value);
          if (claim.id !== id) throw new Error('Unexpected ownership claim');
          return claim;
        })
      )
    );
  }
  change(command: OwnershipCommand, key: string) {
    return this.result(
      defer(() => {
        const review = ['approve', 'reject', 'revoke'].includes(command.action);
        const route =
          command.action === 'create'
            ? this.base(false)
            : `${this.base(review)}/${ownershipId(command.id)}/${
                review ? 'decision' : command.action
              }`;
        const input =
          command.action === 'create'
            ? command.input
            : {
                expectedRevision: command.input.expectedRevision,
                ...(['approve', 'reject', 'revoke', 'release'].includes(
                  command.action
                )
                  ? { reason: command.input.reason }
                  : {}),
              };
        return this.http.post<unknown>(
          route,
          review ? { ...input, decision: command.action } : input,
          { headers: { 'Idempotency-Key': key } }
        );
      }).pipe(
        map((value) => {
          const receipt = parseOwnershipReceipt(value);
          if (
            receipt.action !== command.action ||
            (command.action === 'create'
              ? receipt.revision !== 1
              : receipt.id !== command.id ||
                receipt.revision !== command.input.expectedRevision + 1)
          )
            throw new Error('Unexpected ownership receipt');
          return receipt;
        })
      ),
      true
    );
  }
  source(id: string) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(
          `${
            this.origin
          }/api/me/application-drafts/canonical/${applicationDraftId(id)}`
        )
      ).pipe(
        map((value) => {
          const source = parseApplicationEditingSource(value);
          if (source.applicationId !== id)
            throw new Error('Unexpected canonical application');
          return source;
        })
      )
    );
  }
  edit(command: ApplicationEditingCommand, key: string) {
    return this.result(
      defer(() =>
        this.http.post<unknown>(
          `${this.origin}/api/me/application-drafts/${
            command.type === 'open'
              ? 'from-application'
              : applicationDraftId(command.id) + '/rebase'
          }`,
          {
            editing: command.editing,
            fields: command.fields,
            ...(command.type === 'rebase'
              ? {
                  expectedRevision: command.expectedRevision,
                  ...(command.imageChoices
                    ? { imageChoices: command.imageChoices }
                    : {}),
                }
              : {}),
          },
          { headers: { 'Idempotency-Key': key } }
        )
      ).pipe(
        map((value) => {
          const receipt = parseApplicationDraftReceipt(value);
          if (
            receipt.deleted ||
            (command.type === 'open'
              ? receipt.revision !== 1
              : receipt.id !== command.id ||
                receipt.revision !== Number(command.expectedRevision) + 1)
          )
            throw new Error('Unexpected editing receipt');
          return receipt;
        })
      ),
      true
    );
  }
  private base(review: boolean) {
    return (
      this.origin +
      (review ? '/api/editorial/ownership-reviews' : '/api/me/ownership-claims')
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
          mutation && ![400, 401, 403, 404, 409, 429].includes(status);
        const message =
          status === 401
            ? 'Sign in to continue.'
            : status === 403
            ? 'You do not have permission for this action. Ownership review requires a separate reviewer, and editing requires the current grant.'
            : status === 404
            ? 'The application, claim or current ownership grant was not found.'
            : status === 409
            ? 'The application or claim changed, the proof expired, or an active claim or draft already exists. Reload the current state before continuing.'
            : status === 429
            ? 'Too many ownership requests. Wait at least 30 seconds between DNS checks; pending or newly created claims are limited to 20 per day.'
            : status === 400
            ? 'Check the application, evidence URL, notes and decision reason.'
            : uncertain
            ? 'The change could not be confirmed. Retry the same request before making another change.'
            : 'Ownership or canonical application content is unavailable. Try again shortly.';
        return of(err(new ApplicationDraftRequestError(uncertain, message)));
      })
    );
  }
}
