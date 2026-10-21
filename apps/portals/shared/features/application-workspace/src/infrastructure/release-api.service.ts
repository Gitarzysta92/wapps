import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, of, type Observable } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  RELEASE_DRAFT_LIMIT,
  parseReleaseBrowseFilter,
  type ReleaseBrowseFilter,
  parsePublishedRelease,
  parseReleaseDraft,
  parseReleasePage,
  parseReleasePublicationReceipt,
  parseReleasePublicationStatus,
  parseReleaseReceipt,
  parseReleaseReviewPage,
  parseReleaseSource,
  releaseId,
} from '@domains/catalog/versioning';
import {
  APPLICATION_WORKSPACE_ORIGIN,
  APPLICATION_WORKSPACE_SESSION,
} from '../application/application-drafts.port';
import {
  ReleaseRequestError,
  type ReleaseCatalogPort,
  type ReleaseChange,
  type ReleaseWorkspacePort,
} from '../application/release-workspace.port';

@Injectable({ providedIn: 'root' })
export class ReleaseApiService
  implements ReleaseWorkspacePort, ReleaseCatalogPort
{
  private readonly http = inject(HttpClient);
  private readonly origin = inject(APPLICATION_WORKSPACE_ORIGIN);
  private readonly session = inject(APPLICATION_WORKSPACE_SESSION);
  private readonly workspace = `${this.origin}/api/me/releases`;
  private readonly review = `${this.origin}/api/editorial/release-reviews`;
  list() {
    return this.result(
      this.http.get<unknown>(this.workspace).pipe(
        map((value) => {
          if (!Array.isArray(value) || value.length > RELEASE_DRAFT_LIMIT)
            throw new Error('Invalid release workspace');
          const result = value.map(parseReleaseDraft);
          if (new Set(result.map((item) => item.id)).size !== result.length)
            throw new Error('Duplicate release drafts');
          return result;
        })
      )
    );
  }
  read(id: string) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(`${this.workspace}/${releaseId(id)}`)
      ).pipe(
        map((value) => {
          const result = parseReleaseDraft(value);
          if (result.id !== id) throw new Error('Unexpected release draft');
          return result;
        })
      )
    );
  }
  source(applicationId: string, id: string | null) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(
          `${this.workspace}/source/${releaseId(applicationId)}`,
          {
            params: id ? { releaseId: releaseId(id) } : {},
          }
        )
      ).pipe(
        map((value) => {
          const result = parseReleaseSource(value);
          if (
            result.applicationId !== applicationId ||
            (result.release?.id ?? null) !== id
          )
            throw new Error('Unexpected release source');
          return result;
        })
      )
    );
  }
  status(id: string, review: boolean) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(
          review
            ? `${this.review}/${releaseId(id)}`
            : `${this.workspace}/${releaseId(id)}/publication`
        )
      ).pipe(
        map((value) => {
          const result = parseReleasePublicationStatus(value);
          if (result.id !== id) throw new Error('Unexpected release status');
          return result;
        })
      )
    );
  }
  reviews(page: number) {
    return this.result(
      this.http
        .get<unknown>(this.review, { params: { page: String(page) } })
        .pipe(
          map((value) => {
            const result = parseReleaseReviewPage(value);
            if (result.page !== page)
              throw new Error('Unexpected release review page');
            return result;
          })
        )
    );
  }
  change(command: ReleaseChange, key: string) {
    const session = this.session.currentKey();
    return this.result(
      defer(() => {
        if (!session || session !== this.session.currentKey())
          throw new ReleaseRequestError(
            'The account session changed. Reload before continuing.',
            false,
            401
          );
        let method = 'POST',
          url: string,
          body: unknown;
        if (command.kind === 'publication') {
          const review =
            command.action === 'approve' || command.action === 'reject';
          url = review
            ? `${this.review}/${releaseId(command.id)}/decision`
            : `${this.workspace}/${releaseId(command.id)}/${command.action}`;
          body = review
            ? { decision: command.action, ...command.input }
            : {
                expectedRevision: command.input.expectedRevision,
                expectedPublicationRevision:
                  command.input.expectedPublicationRevision,
              };
        } else {
          method =
            command.type === 'delete'
              ? 'DELETE'
              : command.type === 'update'
              ? 'PUT'
              : 'POST';
          url =
            command.type === 'create'
              ? this.workspace
              : command.type === 'open'
              ? `${this.workspace}/open`
              : `${this.workspace}/${releaseId(command.id)}${
                  command.type === 'rebase' ? '/rebase' : ''
                }`;
          body = command.input;
        }
        return this.http.request<unknown>(method, url, {
          body,
          headers: { 'Idempotency-Key': key },
        });
      }).pipe(
        map((value) => {
          const receipt =
            command.kind === 'publication'
              ? parseReleasePublicationReceipt(value)
              : parseReleaseReceipt(value);
          const expectedRevision =
            'expectedRevision' in command.input
              ? command.input.expectedRevision
              : 0;
          if (
            receipt.revision !== expectedRevision + 1 ||
            ('id' in command && receipt.id !== command.id)
          )
            throw new Error('Unexpected release receipt');
          if (
            command.kind === 'publication' &&
            (!('action' in receipt) ||
              receipt.action !== command.action ||
              ((command.action === 'approve' || command.action === 'reject') &&
                receipt.submittedRevision !== command.input.submittedRevision))
          )
            throw new Error('Unexpected release publication receipt');
          if (
            command.kind === 'draft' &&
            (!('deleted' in receipt) ||
              receipt.deleted !== (command.type === 'delete'))
          )
            throw new Error('Unexpected release deletion receipt');
          return receipt;
        })
      ),
      true
    );
  }
  browse(slug: string, page: number, filter: ReleaseBrowseFilter = {}) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(
          `${this.origin}/api/catalog/releases/${encodeURIComponent(slug)}`,
          {
            params: { page: String(page), ...parseReleaseBrowseFilter(filter) },
          }
        )
      ).pipe(
        map((value) => {
          const result = parseReleasePage(value);
          if (
            result.page !== page ||
            result.items.some(
              (item) =>
                item.applicationSlug !== slug ||
                (filter.channel && item.channel !== filter.channel) ||
                (filter.before && item.releasedOn >= filter.before)
            )
          )
            throw new Error('Unexpected release page');
          return result;
        })
      )
    );
  }
  find(slug: string, version: string) {
    return this.result(
      this.http
        .get<unknown>(
          `${this.origin}/api/catalog/releases/${encodeURIComponent(
            slug
          )}/${encodeURIComponent(version)}`
        )
        .pipe(
          map((value) => {
            const result = parsePublishedRelease(value);
            if (result.applicationSlug !== slug || result.version !== version)
              throw new Error('Unexpected release');
            return result;
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
        if (failure instanceof ReleaseRequestError) return of(err(failure));
        const status =
          failure instanceof HttpErrorResponse ? failure.status : 0;
        const uncertain =
          mutation && ![400, 401, 403, 404, 409].includes(status);
        const message =
          status === 409
            ? 'The draft or public version changed, this version already exists, or your draft limit was reached. Reload and compare before continuing.'
            : status === 404
            ? 'Release or application not found, or no longer available.'
            : status === 403
            ? 'Your current ownership grant or review permission does not allow this action. Reviewers cannot review their own notes.'
            : status === 401
            ? 'Sign in again to continue.'
            : status === 400
            ? 'Check the release fields, date and review reason.'
            : uncertain
            ? 'The change could not be confirmed. Retry the same request before making another change.'
            : 'Release notes are unavailable or updating. Try again shortly.';
        return of(err(new ReleaseRequestError(message, uncertain, status)));
      })
    );
  }
}
