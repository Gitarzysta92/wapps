import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { createHash, webcrypto } from 'node:crypto';
import { firstValueFrom } from 'rxjs';
import type { AccountExportJob } from '@sdk/features/identity/core';
import { ACCOUNT_EXPORT_URL } from '../application/account-export.port';
import { AccountExportApiService } from './account-export-api.service';

describe('account export transport', () => {
  let service: AccountExportApiService, http: HttpTestingController;
  const bytes = new Uint8Array([31, 139, 8, 0]);
  const requestedAt = Date.now();
  const job: AccountExportJob = {
    id: '00000000-0000-4000-8000-000000000042',
    status: 'ready',
    requestedAt,
    expiresAt: requestedAt + 86_400_000,
    readyAt: requestedAt + 1,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    attempts: 1,
    failure: null,
  };
  beforeEach(() => {
    Object.defineProperty(crypto, 'subtle', {
      value: webcrypto.subtle,
      configurable: true,
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AccountExportApiService,
        { provide: ACCOUNT_EXPORT_URL, useValue: '' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AccountExportApiService);
  });
  afterEach(() => http.verify());
  it('sends an empty self-only request and its exact idempotency key', async () => {
    const result = firstValueFrom(service.request('same-intent'));
    const request = http.expectOne('/api/me/exports');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    expect(request.request.headers.get('Idempotency-Key')).toBe('same-intent');
    request.flush(job);
    expect(await result).toMatchObject({ ok: true, value: job });
  });
  it('rejects malformed latest state and cancellation receipts for another job', async () => {
    const latest = firstValueFrom(service.latest());
    http.expectOne('/api/me/exports').flush({ job, identityId: 'other' });
    expect(await latest).toMatchObject({ ok: false });
    const cancelled = firstValueFrom(service.cancel(job.id));
    http
      .expectOne(`/api/me/exports/${job.id}`)
      .flush({ ...job, id: '00000000-0000-4000-8000-000000000043' });
    expect(await cancelled).toMatchObject({ ok: false });
  });
  it('validates the entire attachment before exposing a download', async () => {
    const download = firstValueFrom(service.download(job));
    http
      .expectOne(`/api/me/exports/${job.id}/download`)
      .flush(bytes.buffer, { headers: { 'content-type': 'application/gzip' } });
    const result = await download;
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.size).toBe(bytes.length);
  });
  it('rejects wrong-size, wrong-type and corrupt attachments', async () => {
    for (const [body, type] of [
      [new ArrayBuffer(2), 'application/gzip'],
      [bytes.buffer, 'text/html'],
      [new ArrayBuffer(4), 'application/gzip'],
    ] as const) {
      const download = firstValueFrom(service.download(job));
      http
        .expectOne(`/api/me/exports/${job.id}/download`)
        .flush(body, { headers: { 'content-type': type } });
      expect(await download).toMatchObject({ ok: false });
    }
  });
  it('distinguishes denial, conflict and uncertain service failure without exposing diagnostic payloads', async () => {
    for (const [status, reason] of [
      [403, 'denied'],
      [409, 'conflict'],
      [503, 'unavailable'],
    ] as const) {
      const pending = firstValueFrom(service.request('key'));
      http
        .expectOne('/api/me/exports')
        .flush(
          { message: 'private diagnostic' },
          { status, statusText: 'Rejected' }
        );
      const result = await pending;
      expect(result).toMatchObject({ ok: false, error: { reason } });
      if (!result.ok)
        expect(result.error.message).not.toContain('private diagnostic');
    }
  });
});
