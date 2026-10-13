import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, of, type Observable } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  applicationDraftId,
  parseApplicationDraft,
  parseApplicationDraftList,
  parseApplicationDraftReceipt,
} from '@domains/catalog/record';
import {
  APPLICATION_WORKSPACE_ORIGIN,
  ApplicationDraftRequestError,
  type ApplicationDraftChange,
  type ApplicationDraftsPort,
} from '../application/application-drafts.port';

@Injectable({ providedIn: 'root' })
export class ApplicationDraftsApiService implements ApplicationDraftsPort {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(
    APPLICATION_WORKSPACE_ORIGIN
  )}/api/me/application-drafts`;
  list() {
    return this.result(
      this.http.get<unknown>(this.url).pipe(map(parseApplicationDraftList))
    );
  }
  read(id: string) {
    return this.result(
      defer(() =>
        this.http.get<unknown>(`${this.url}/${applicationDraftId(id)}`)
      ).pipe(
        map((value) => {
          const draft = parseApplicationDraft(value);
          if (draft.id !== id) throw new Error('Unexpected draft identity');
          return draft;
        })
      )
    );
  }
  change(command: ApplicationDraftChange, key: string) {
    return this.result(
      defer(() => {
        const url =
          command.type === 'create'
            ? this.url
            : `${this.url}/${applicationDraftId(command.id)}`;
        return this.http.request<unknown>(
          command.type === 'create'
            ? 'POST'
            : command.type === 'update'
            ? 'PUT'
            : 'DELETE',
          url,
          {
            body:
              command.type === 'create'
                ? command.fields
                : {
                    ...command.fields,
                    expectedRevision: command.expectedRevision,
                  },
            headers: { 'Idempotency-Key': key },
          }
        );
      }).pipe(
        map((value) => {
          const receipt = parseApplicationDraftReceipt(value);
          if (
            (command.id && receipt.id !== command.id) ||
            receipt.revision !== (command.expectedRevision ?? 0) + 1 ||
            receipt.deleted !== (command.type === 'delete')
          )
            throw new Error('Unexpected draft receipt');
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
      catchError((error: unknown) => {
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        const uncertain =
          mutation && ![400, 401, 403, 404, 409].includes(status);
        const message =
          status === 409
            ? 'This draft changed, its slug is already in your workspace, or your draft limit was reached. Reload before editing.'
            : status === 404
            ? 'Application draft not found or no longer available to this account.'
            : [401, 403].includes(status)
            ? 'Sign in again to access your application drafts.'
            : status === 400
            ? 'Check the application name, slug, website and description.'
            : uncertain
            ? 'The change could not be confirmed. Retry the same request before making another change.'
            : 'Application drafts could not be loaded. Try again.';
        return of(err(new ApplicationDraftRequestError(uncertain, message)));
      })
    );
  }
}
