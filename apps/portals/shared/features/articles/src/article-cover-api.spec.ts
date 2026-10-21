import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import {
  ARTICLE_ORIGIN,
  ARTICLE_SESSION,
} from './application/article-workspace.port';
import { ArticleCoverApiService } from './infrastructure/article-cover-api.service';
import {
  ArticleCoverRecoveryService,
  parseArticleCoverAttempt,
} from './infrastructure/article-cover-recovery.service';
import type {
  ArticleCoverAttempt,
  ArticleCoverPreview,
} from './application/article-cover.port';
const articleId = '019a0010-0000-7000-8000-000000000001',
  id = '019a0010-0000-7000-8000-000000000002';
const source = {
  contentType: 'image/png' as const,
  bytes: 1,
  sha256: 'a'.repeat(64),
};
const attempt: ArticleCoverAttempt = {
  key: 'exact-key',
  intent: { type: 'reserve', articleId, input: { articleId, source } },
};
describe('article cover HTTP boundary', () => {
  let api: ArticleCoverApiService,
    http: HttpTestingController,
    session: BehaviorSubject<string | null>;
  beforeEach(() => {
    session = new BehaviorSubject<string | null>('alice');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ArticleCoverApiService,
        { provide: ARTICLE_ORIGIN, useValue: '' },
        {
          provide: ARTICLE_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
      ],
    });
    api = TestBed.inject(ArticleCoverApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('reserves article-owned sources without application slots or filenames', async () => {
    const value = firstValueFrom(
      api.reserve({ articleId, source }, 'reserved')
    );
    const request = http.expectOne('/api/me/article-covers');
    expect(request.request.body).toEqual({ articleId, source });
    expect(request.request.headers.get('Idempotency-Key')).toBe('reserved');
    request.flush({ id, revision: 1, status: 'pending' });
    expect((await value).ok).toBe(true);
  });
  it('uses exact binary upload bytes, revision and idempotency headers', async () => {
    const file = new File(['a'], 'private.png', { type: 'image/png' });
    const value = firstValueFrom(api.upload(id, 1, file, 'upload'));
    const request = http.expectOne(`/api/me/article-covers/${id}/content`);
    expect(request.request.body).toBe(file);
    expect(request.request.headers.get('If-Match')).toBe('"1"');
    expect(request.request.headers.get('Content-Type')).toBe(
      'application/octet-stream'
    );
    request.flush({ id, revision: 2, status: 'ready' });
    expect((await value).ok).toBe(true);
  });
  it('rejects a delayed private request after session switching', async () => {
    const request = api.reserve({ articleId, source }, 'reserved');
    session.next('bob');
    const result = await firstValueFrom(request);
    expect(result.ok).toBe(false);
    http.expectNone('/api/me/article-covers');
  });
  it.each([
    [{ kind: 'upload', id }, `/api/me/article-covers/${id}/content`],
    [
      { kind: 'submission', id: articleId, revision: 3, review: true },
      `/api/editorial/article-reviews/${articleId}/submissions/3/cover`,
    ],
    [
      { kind: 'submission', id: articleId, revision: 3, review: false },
      `/api/me/articles/${articleId}/submissions/3/cover`,
    ],
    [
      { kind: 'published', id: articleId, imageId: id },
      `/api/media/articles/${articleId}/${id}`,
    ],
  ] as [ArticleCoverPreview, string][])(
    'resolves the exact canonical cover route (%j)',
    async (target, route) => {
      if (target.kind === 'published') session.next(null);
      const value = firstValueFrom(api.preview(target));
      const request = http.expectOne(route);
      request.flush(new Blob(['a'], { type: 'image/webp' }));
      expect((await value).ok).toBe(true);
    }
  );
  it('rejects mismatched list parents and malformed mutation receipts', async () => {
    const list = firstValueFrom(api.list(articleId));
    http
      .expectOne(`/api/me/article-covers?articleId=${articleId}`)
      .flush([
        {
          id,
          articleId: id,
          source,
          revision: 1,
          status: 'pending',
          createdAt: 1,
          expiresAt: 86400001,
          asset: null,
        },
      ]);
    expect((await list).ok).toBe(false);
    const changed = firstValueFrom(api.cancel(id, 1, 'cancel'));
    http
      .expectOne('/api/me/article-covers/' + id)
      .flush({ id: articleId, revision: 2, status: 'cancelled' });
    const result = await changed;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ uncertain: true });
  });
});
describe('article cover retry recovery', () => {
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
  });
  afterEach(() => sessionStorage.clear());
  it('restores the exact intent in the same session without persisting credentials or bytes', async () => {
    const first = new ArticleCoverRecoveryService();
    await firstValueFrom(first.restore('private-token'));
    await firstValueFrom(first.remember('private-token', attempt));
    const stored =
      sessionStorage.getItem('wapps.article-cover.intent.v1') ?? '';
    expect(stored).not.toContain('private-token');
    expect(stored).not.toContain('private.png');
    const next = new ArticleCoverRecoveryService();
    expect(await firstValueFrom(next.restore('private-token'))).toEqual({
      ok: true,
      value: attempt,
    });
    expect(await firstValueFrom(next.restore('another-token'))).toEqual({
      ok: true,
      value: null,
    });
  });
  it('rejects stored authority overrides, mismatched parents and application-specific intents', () => {
    expect(() =>
      parseArticleCoverAttempt({ ...attempt, owner: 'caller' })
    ).toThrow();
    expect(() =>
      parseArticleCoverAttempt({
        ...attempt,
        intent: { ...attempt.intent, articleId: id },
      })
    ).toThrow();
    expect(() =>
      parseArticleCoverAttempt({
        ...attempt,
        intent: { type: 'attach', articleId, input: {} },
      })
    ).toThrow();
  });
});
