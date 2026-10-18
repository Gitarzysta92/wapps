import { PublicContentPreferencesService } from '@portals/shared/features/preferences';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject, firstValueFrom, of, Subject } from 'rxjs';
import { ok, type Result } from '@sdk/kernel/standard';
import {
  articlePreview,
  type PublishedArticle,
} from '@domains/publication/article';
import { ArticleApiService } from './infrastructure/article-api.service';
import { LazyArticleApiService } from './infrastructure/lazy-article-api.service';
import { ArticleCatalogService } from './application/article-catalog.service';
import {
  ARTICLE_CATALOG,
  ARTICLE_ORIGIN,
  ARTICLE_SESSION,
  ArticleRequestError,
  type ArticleChange,
} from './application/article-workspace.port';

const id = '10000000-0000-4000-8000-000000000001';
const fields = {
  title: 'Article',
  slug: 'article',
  excerpt: 'Summary.',
  byline: 'Byline',
  category: 'Guides',
  tags: ['offline'],
  sections: [{ heading: '', paragraphs: ['Content.'] }],
};
const published: PublishedArticle = {
  ...fields,
  id,
  revision: 1,
  submittedRevision: 2,
  publishedAt: 100,
  updatedAt: 100,
};
const command: ArticleChange = {
  kind: 'draft',
  type: 'update',
  id,
  input: { ...fields, expectedRevision: 2 },
};
describe('article HTTP contract', () => {
  let api: ArticleApiService,
    http: HttpTestingController,
    session: BehaviorSubject<string | null>;
  beforeEach(() => {
    session = new BehaviorSubject<string | null>('alice');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ArticleApiService,
        LazyArticleApiService,
        { provide: ARTICLE_ORIGIN, useValue: '' },
        {
          provide: ARTICLE_SESSION,
          useValue: { key$: session, currentKey: () => session.value },
        },
      ],
    });
    api = TestBed.inject(ArticleApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('preserves the exact idempotency key and validates saved revision receipts', async () => {
    const pending = firstValueFrom(api.change(command, 'fixed'));
    const request = http.expectOne('/api/me/articles/' + id);
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('Idempotency-Key')).toBe('fixed');
    expect(request.request.body).toEqual(command.input);
    request.flush({ id, revision: 3, deleted: false });
    expect((await pending).ok).toBe(true);
  });
  it.each([400, 401, 403, 404, 409, 500, 503])(
    'classifies HTTP %s without inventing success',
    async (status) => {
      const pending = firstValueFrom(api.change(command, 'fixed'));
      http
        .expectOne('/api/me/articles/' + id)
        .flush({}, { status, statusText: 'Failure' });
      const result = await pending;
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.error).toMatchObject({
          uncertain: status >= 500,
          status,
        });
    }
  );
  it('treats corrupt successful receipts as uncertain, permitting safe replay', async () => {
    const pending = firstValueFrom(api.change(command, 'fixed'));
    http
      .expectOne('/api/me/articles/' + id)
      .flush({ id, revision: 7, deleted: false });
    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ArticleRequestError);
    if (!result.ok)
      expect((result.error as ArticleRequestError).uncertain).toBe(true);
  });
  it('fences deferred HTTP and lazy-loaded writes when the account changes', async () => {
    const direct = api.change(command, 'direct');
    session.next('bob');
    expect((await firstValueFrom(direct)).ok).toBe(false);
    const lazy = TestBed.inject(LazyArticleApiService).change(command, 'lazy');
    session.next('carol');
    expect((await firstValueFrom(lazy)).ok).toBe(false);
    http.expectNone('/api/me/articles/' + id);
  });
  it('sends owner publication commands without reviewer-only fields', async () => {
    const pending = firstValueFrom(
      api.change(
        {
          kind: 'publication',
          id,
          action: 'submit',
          input: {
            expectedRevision: 2,
            expectedPublicationRevision: null,
            submittedRevision: null,
            reason: '',
          },
        },
        'submit'
      )
    );
    const request = http.expectOne('/api/me/articles/' + id + '/submit');
    expect(request.request.body).toEqual({
      expectedRevision: 2,
      expectedPublicationRevision: null,
    });
    request.flush({
      id,
      revision: 3,
      action: 'submit',
      submittedRevision: 2,
      publicationRevision: null,
    });
    expect((await pending).ok).toBe(true);
  });
  it('rejects mismatched detail identity and category/tag page responses', async () => {
    const detail = firstValueFrom(api.find('article'));
    http
      .expectOne('/api/catalog/articles/article')
      .flush({ ...published, slug: 'different' });
    expect((await detail).ok).toBe(false);
    const page = firstValueFrom(
      api.browse({ q: '', category: 'Other', tag: '', page: 1 })
    );
    http
      .expectOne((r) => r.url === '/api/catalog/articles')
      .flush({ items: [articlePreview(published)], page: 1, total: 1 });
    expect((await page).ok).toBe(false);
  });
  it('sends every selected tag to BFF and rejects partial tag matches', async () => {
    for (const tags of [['offline', 'web'], ['offline']]) {
      const pending = firstValueFrom(api.browse({ q: '', category: '', tag: '', tags: ['offline', 'web'], page: 1 }));
      const request = http.expectOne(r => r.url === '/api/catalog/articles');
      expect(request.request.params.get('tags')).toBe('offline,web');
      request.flush({ items: [articlePreview({ ...published, tags })], page: 1, total: 1 });
      expect((await pending).ok).toBe(tags.length === 2);
    }
  });
});
describe('article catalog navigation state', () => {
  it('prevents late detail reads from replacing a different route and surfaces real errors', () => {
    const late = new Subject<Result<PublishedArticle, Error>>();
    const port = {
      find: jest.fn().mockReturnValue(late),
      browse: jest
        .fn()
        .mockReturnValue(of(ok({ items: [], page: 1, total: 0 }))),
    };
    TestBed.configureTestingModule({
      providers: [
        ArticleCatalogService,
        {
          provide: PublicContentPreferencesService,
          useValue: {
            state: () => ({
              status: 'ready',
              sessionKey: null,
              sessionVersion: 0,
              showMatureContent: true,
            }),
            changes$: of(null),
            reload: jest.fn(),
          },
        },
        { provide: ARTICLE_CATALOG, useValue: port },
      ],
    });
    const service = TestBed.inject(ArticleCatalogService);
    service.open('article', {});
    service.open(null, { page: '1' });
    late.next(ok(published));
    late.complete();
    expect(service.article()).toBeNull();
    expect(service.items()).toEqual([]);
    expect(service.loading()).toBe(false);
    service.open(null, { page: '10001' });
    expect(service.error()).toContain('could not be loaded');
    expect(port.browse).toHaveBeenCalledTimes(1);
  });
});
