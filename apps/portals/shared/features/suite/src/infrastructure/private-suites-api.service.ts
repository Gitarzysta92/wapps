import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, of, type Observable } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  parsePrivateSuite,
  parseSuiteReceipt,
  SUITE_LIMITS,
  suiteId,
} from '@domains/publication/suite';
import {
  parseCatalogPage,
  parseCatalogSelection,
} from '@domains/catalog/record';
import {
  SUITE_API_ORIGIN,
  SuiteRequestError,
  type PrivateSuitesPort,
  type SuiteChange,
} from '../application/private-suites.port';

@Injectable()
export class PrivateSuitesApiService implements PrivateSuitesPort {
  private readonly http = inject(HttpClient);
  private readonly origin = inject(SUITE_API_ORIGIN);
  private readonly url = `${this.origin}/api/me/suites`;

  list() {
    return this.result(
      this.http.get<unknown>(this.url).pipe(
        map((value) => {
          if (!Array.isArray(value) || value.length > SUITE_LIMITS.perOwner)
            throw new Error('Invalid suite list');
          const items = value.map(parsePrivateSuite);
          if (new Set(items.map((item) => item.id)).size !== items.length)
            throw new Error('Duplicate suite');
          return items;
        })
      )
    );
  }
  read(id: string) {
    return this.result(
      defer(() => this.http.get<unknown>(`${this.url}/${suiteId(id)}`)).pipe(
        map((value) => {
          const suite = parsePrivateSuite(value);
          if (suite.id !== id) throw new Error('Unexpected suite identity');
          return suite;
        })
      )
    );
  }
  change(command: SuiteChange, key: string) {
    const body =
      command.type === 'create'
        ? command.fields
        : { ...command.fields, expectedRevision: command.expectedRevision };
    const url =
      command.type === 'create' ? this.url : `${this.url}/${command.id}`;
    return this.result(
      this.http
        .request<unknown>(
          command.type === 'create'
            ? 'POST'
            : command.type === 'update'
            ? 'PUT'
            : 'DELETE',
          url,
          {
            body,
            headers: { 'Idempotency-Key': key },
          }
        )
        .pipe(
          map((value) => {
            const receipt = parseSuiteReceipt(value);
            if (
              (command.id !== null && receipt.id !== command.id) ||
              receipt.revision !== (command.expectedRevision ?? 0) + 1 ||
              receipt.deleted !== (command.type === 'delete')
            )
              throw new Error('Unexpected suite receipt');
            return receipt;
          })
        ),
      true
    );
  }
  search(search: string, page: number) {
    return this.result(
      this.http
        .get<unknown>(`${this.origin}/api/catalog/apps`, {
          params: { search, page: String(page), pageSize: '20', sort: 'name' },
        })
        .pipe(map(parseCatalogPage))
    );
  }
  resolve(ids: string[]) {
    if (!ids.length) return of(ok([]));
    return this.result(
      this.http
        .get<unknown>(`${this.origin}/api/catalog/app-selection`, {
          params: { ids: ids.join(',') },
        })
        .pipe(map((value) => parseCatalogSelection(value, ids).items))
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
            ? 'This suite changed or its limit was reached. Reload before editing.'
            : status === 404
            ? 'Suite not found or no longer available to this account.'
            : [401, 403].includes(status)
            ? 'Sign in again to access your suites.'
            : status === 400
            ? 'Check the suite fields and selected applications.'
            : uncertain
            ? 'The change could not be confirmed. Retry the same request before making another change.'
            : 'Suites or application details could not be loaded. Try again.';
        return of(err(new SuiteRequestError(uncertain, message)));
      })
    );
  }
}
