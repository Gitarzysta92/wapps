import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { webcrypto, createHash } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { APPLICATION_WORKSPACE_ORIGIN } from './application/application-drafts.port';
import { ApplicationMediaApiService } from './infrastructure/application-media-api.service';
import {
  ApplicationMediaRecoveryService,
  parseApplicationMediaAttempt,
} from './infrastructure/application-media-recovery.service';
import type {
  ApplicationMediaAttempt,
  ApplicationMediaPreview,
} from './application/application-media.port';

const draftId = '019a0010-0000-7000-8000-000000000001',
  id = '019a0010-0000-7000-8000-000000000002';
const bytes = new Uint8Array([1, 2, 3]);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const asset = {
  id,
  purpose: 'logo' as const,
  contentType: 'image/webp' as const,
  bytes: 3,
  width: 1,
  height: 1,
  sha256,
};
const source = { contentType: 'image/png' as const, bytes: 3, sha256 };
const intent: ApplicationMediaAttempt = {
  key: 'exact-key',
  intent: {
    type: 'reserve',
    draftId,
    input: { draftId, purpose: 'logo', source },
  },
};

describe('application image HTTP adapter', () => {
  let api: ApplicationMediaApiService, http: HttpTestingController;
  beforeEach(() => {
    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: webcrypto.subtle,
      configurable: true,
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ApplicationMediaApiService,
        { provide: APPLICATION_WORKSPACE_ORIGIN, useValue: '' },
      ],
    });
    api = TestBed.inject(ApplicationMediaApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('sends immutable reservation metadata without a filename or storage path', async () => {
    const result = firstValueFrom(
      api.reserve(
        intent.intent.type === 'reserve'
          ? intent.intent.input
          : { draftId, purpose: 'logo', source },
        'exact-key'
      )
    );
    const request = http.expectOne('/api/me/application-images');
    expect(request.request.body).toEqual({ draftId, purpose: 'logo', source });
    expect(request.request.headers.get('Idempotency-Key')).toBe('exact-key');
    request.flush({ id, revision: 1, status: 'pending' });
    expect((await result).ok).toBe(true);
  });
  it('uses the binary upload contract and the quoted reserved revision', async () => {
    const file = new File([bytes], 'private.png', { type: 'image/png' });
    const result = firstValueFrom(api.upload(id, 1, file, 'upload-key'));
    const request = http.expectOne(
      '/api/me/application-images/' + id + '/content'
    );
    expect(request.request.body).toBe(file);
    expect(request.request.headers.get('Content-Type')).toBe(
      'application/octet-stream'
    );
    expect(request.request.headers.get('If-Match')).toBe('"1"');
    expect(request.request.headers.get('Idempotency-Key')).toBe('upload-key');
    request.flush({ id, revision: 2, status: 'ready' });
    expect((await result).ok).toBe(true);
  });
  it('rejects a response for another image as an unconfirmed mutation', async () => {
    const result = firstValueFrom(api.cancel(id, 2, 'cancel-key'));
    http
      .expectOne('/api/me/application-images/' + id)
      .flush({ id: draftId, revision: 3, status: 'cancelled' });
    expect(await result).toMatchObject({
      ok: false,
      error: { uncertain: true },
    });
  });
  it.each([400, 401, 403, 404, 409, 413, 415, 422, 429, 503])(
    'classifies HTTP %s without retrying with a new command key',
    async (status) => {
      const result = firstValueFrom(api.cancel(id, 2, 'cancel-key'));
      http
        .expectOne('/api/me/application-images/' + id)
        .flush({}, { status, statusText: 'test failure' });
      expect(await result).toMatchObject({
        ok: false,
        error: { uncertain: status === 503, status },
      });
    }
  );
  it('refuses cross-draft records and duplicate records in a retained list', async () => {
    const result = firstValueFrom(api.list(draftId));
    http
      .expectOne('/api/me/application-images?draftId=' + draftId)
      .flush([
        {
          id,
          draftId: id,
          purpose: 'logo',
          source,
          revision: 1,
          status: 'pending',
          createdAt: 1,
          expiresAt: 86400001,
          asset: null,
        },
      ]);
    expect((await result).ok).toBe(false);
  });
  it.each([
    [{ kind: 'upload', id }, '/api/me/application-images/' + id + '/content'],
    [
      { kind: 'draft', id: draftId, purpose: 'logo' },
      '/api/me/application-drafts/' + draftId + '/images/logo/content',
    ],
    [
      { kind: 'canonical', id: draftId, purpose: 'logo' },
      '/api/me/application-drafts/canonical/' +
        draftId +
        '/images/logo/content',
    ],
    [
      {
        kind: 'submission',
        id: draftId,
        purpose: 'logo',
        revision: 3,
        review: true,
      },
      '/api/editorial/application-reviews/' +
        draftId +
        '/submissions/3/images/logo/content',
    ],
    [
      {
        kind: 'submission',
        id: draftId,
        purpose: 'logo',
        revision: 3,
        review: false,
      },
      '/api/me/application-drafts/' +
        draftId +
        '/submissions/3/images/logo/content',
    ],
  ] as [ApplicationMediaPreview, string][])(
    'loads a verified preview only through its explicit authority route %#',
    async (target, url) => {
      const blob = new Blob([bytes], { type: 'image/webp' });
      Object.defineProperty(blob, 'arrayBuffer', {
        value: async () => bytes.buffer,
      });
      const result = firstValueFrom(api.preview(target, asset));
      http.expectOne(url).flush(blob);
      const preview = await result;
      expect(preview.ok).toBe(true);
      if (preview.ok) expect(preview.value).toBe(blob);
    }
  );
  it('rejects preview bytes that do not match the loaded immutable reference', async () => {
    const blob = new Blob([bytes], { type: 'image/webp' });
    Object.defineProperty(blob, 'arrayBuffer', {
      value: async () => bytes.buffer,
    });
    const result = firstValueFrom(
      api.preview({ kind: 'upload', id }, { ...asset, sha256: 'f'.repeat(64) })
    );
    http.expectOne('/api/me/application-images/' + id + '/content').flush(blob);
    expect((await result).ok).toBe(false);
  });
});

describe('browser image retry persistence', () => {
  let store: ApplicationMediaRecoveryService;
  beforeEach(() => {
    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: webcrypto.subtle,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'TextEncoder', {
      value: TextEncoder,
      configurable: true,
    });
    sessionStorage.clear();
    store = new ApplicationMediaRecoveryService();
  });
  it('survives reload with the same exact intent, without writing credentials or image bytes', async () => {
    await firstValueFrom(store.restore('private-token'));
    await firstValueFrom(store.remember('private-token', intent));
    const raw = sessionStorage.getItem('wapps.application-media.intent.v1');
    expect(raw).not.toContain('private-token');
    expect(raw).not.toContain('private.png');
    const reopened = new ApplicationMediaRecoveryService();
    expect(await firstValueFrom(reopened.restore('private-token'))).toEqual({
      ok: true,
      value: intent,
    });
  });
  it('never restores another account or session retry and clears it at logout', async () => {
    await firstValueFrom(store.restore('alice'));
    await firstValueFrom(store.remember('alice', intent));
    expect(await firstValueFrom(store.restore('bob'))).toEqual({
      ok: true,
      value: null,
    });
    expect(sessionStorage.length).toBe(0);
    await firstValueFrom(store.remember('bob', intent));
    store.clear();
    expect(sessionStorage.length).toBe(0);
  });
  it('fences a delayed local write after a session change', async () => {
    await firstValueFrom(store.restore('alice'));
    const pending = firstValueFrom(store.remember('alice', intent));
    store.clear();
    await firstValueFrom(store.restore('bob'));
    expect((await pending).ok).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });
  it('reports corrupted metadata rather than interpreting it as a successful recovery', async () => {
    sessionStorage.setItem('wapps.application-media.intent.v1', '{');
    expect(await firstValueFrom(store.restore('alice'))).toMatchObject({
      ok: false,
    });
    expect(sessionStorage.length).toBe(0);
  });
  it.each([
    { ...intent, key: '' },
    { ...intent, intent: { ...intent.intent, draftId: id } },
    { ...intent, intent: { ...intent.intent, ownerIdentityId: 'other' } },
    {
      ...intent,
      intent: { type: 'upload', draftId, id, expectedRevision: 2, source },
    },
  ])('refuses invalid or authority-overriding saved intent %#', (value) => {
    expect(() => parseApplicationMediaAttempt(value)).toThrow();
  });
});
