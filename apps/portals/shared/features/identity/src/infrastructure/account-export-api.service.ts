import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, defer, map, of, switchMap, timeout } from 'rxjs';
import { err, ok } from '@sdk/kernel/standard';
import {
  ACCOUNT_EXPORT_LIMITS,
  accountExportId,
  accountExportObject,
  parseAccountExportJob,
  type AccountExportJob,
} from '@sdk/features/identity/core';
import {
  ACCOUNT_EXPORT_URL,
  AccountExportError,
  type AccountExportPort,
} from '../application/account-export.port';

@Injectable()
export class AccountExportApiService implements AccountExportPort {
  private readonly http = inject(HttpClient);
  private readonly url = inject(ACCOUNT_EXPORT_URL) + '/api/me/exports';
  private readonly document = inject(DOCUMENT);
  newKey(): string {
    return crypto.randomUUID();
  }
  latest() {
    return this.http.get<unknown>(this.url).pipe(
      timeout(15_000),
      map((value) => {
        const job = accountExportObject(value, ['job'])['job'];
        return ok(job === null ? null : parseAccountExportJob(job));
      }),
      catchError((error) => of(err(this.error(error))))
    );
  }
  request(key: string) {
    return this.http
      .post<unknown>(this.url, {}, { headers: { 'Idempotency-Key': key } })
      .pipe(
        timeout(15_000),
        map((value) => ok(parseAccountExportJob(value))),
        catchError((error) => of(err(this.error(error))))
      );
  }
  cancel(id: string) {
    return defer(() =>
      this.http.delete<unknown>(`${this.url}/${accountExportId(id)}`)
    ).pipe(
      timeout(15_000),
      map((value) => {
        const job = parseAccountExportJob(value);
        if (job.id !== id) throw new Error('Mismatched export');
        return ok(job);
      }),
      catchError((error) => of(err(this.error(error))))
    );
  }
  download(job: AccountExportJob) {
    return defer(() => {
      const current = parseAccountExportJob(job);
      if (current.status !== 'ready' || current.expiresAt <= Date.now())
        throw new AccountExportError(
          'conflict',
          'This archive is no longer ready. Refresh its status.'
        );
      return this.http.get(`${this.url}/${current.id}/download`, {
        observe: 'response',
        responseType: 'arraybuffer',
      });
    }).pipe(
      timeout(ACCOUNT_EXPORT_LIMITS.attemptMs),
      switchMap(async (response) => {
        const bytes = response.body;
        if (
          !bytes ||
          response.headers.get('content-type') !== 'application/gzip' ||
          bytes.byteLength !== job.bytes
        )
          throw new Error('Incomplete archive');
        const digest = Array.from(
          new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
        )
          .map((value) => value.toString(16).padStart(2, '0'))
          .join('');
        if (digest !== job.sha256) throw new Error('Archive checksum mismatch');
        return ok(new Blob([bytes], { type: 'application/gzip' }));
      }),
      catchError((error) => of(err(this.error(error))))
    );
  }
  save(blob: Blob, id: string): void {
    const name = `wapps-account-${accountExportId(id)}.ndjson.gz`;
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    try {
      anchor.href = url;
      anchor.download = name;
      this.document.body.appendChild(anchor);
      anchor.click();
    } finally {
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
  private error(error: unknown): AccountExportError {
    if (error instanceof AccountExportError) return error;
    if (error instanceof HttpErrorResponse) {
      if ([401, 403].includes(error.status))
        return new AccountExportError(
          'denied',
          'Account export access was denied. Check your sign-in and account status.'
        );
      if (error.status === 409)
        return new AccountExportError(
          'conflict',
          'The export changed or the request limit was reached. Refresh the current status before trying again.'
        );
      if (error.status === 400)
        return new AccountExportError(
          'invalid',
          'The export request was rejected. Refresh and try again.'
        );
    }
    return new AccountExportError(
      'unavailable',
      'The account export service is unavailable or returned an incomplete response.'
    );
  }
}
