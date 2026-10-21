import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  articlePreview,
  type PublishedArticle,
} from '@domains/publication/article';
import {
  PublicContentPreferencesService,
  type PublicContentChoice,
} from '@portals/shared/features/preferences';
import { ArticleCatalogService } from './application/article-catalog.service';
import {
  ARTICLE_CATALOG,
  type ArticleCatalogPort,
} from './application/article-workspace.port';

const article: PublishedArticle = {
  id: '10000000-0000-4000-8000-000000000001',
  title: 'Private-looking title',
  slug: 'article',
  excerpt: 'Summary',
  byline: 'Author',
  category: 'Guides',
  tags: [],
  sections: [{ heading: 'Heading', paragraphs: ['Article body'] }],
  revision: 1,
  submittedRevision: 1,
  publishedAt: 1,
  updatedAt: 1,
};

describe('article public content choices', () => {
  let choice: ReturnType<typeof signal<PublicContentChoice>>;
  let changed: BehaviorSubject<PublicContentChoice>;
  let port: jest.Mocked<ArticleCatalogPort>;
  let service: ArticleCatalogService;
  let retryPreferences: jest.Mock;
  function select(patch: Partial<PublicContentChoice>) {
    const next = { ...choice(), ...patch };
    choice.set(next);
    changed.next(next);
  }
  beforeEach(() => {
    choice = signal<PublicContentChoice>({
      status: 'ready',
      sessionKey: 'Alice',
      sessionVersion: 0,
      showMatureContent: false,
    });
    changed = new BehaviorSubject(choice());
    retryPreferences = jest.fn();
    port = { find: jest.fn(), browse: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        ArticleCatalogService,
        { provide: ARTICLE_CATALOG, useValue: port },
        {
          provide: PublicContentPreferencesService,
          useValue: {
            state: choice,
            changes$: changed,
            reload: retryPreferences,
          },
        },
      ],
    });
    service = TestBed.inject(ArticleCatalogService);
  });
  it('filters only the bounded page and retains source totals', () => {
    const general = { ...article, classification: 'general' as const };
    port.browse.mockReturnValue(
      of(
        ok({
          page: 2,
          total: 25,
          items: [
            articlePreview(general),
            articlePreview({ ...article, classification: 'mature' }),
            articlePreview(article),
          ],
        })
      )
    );
    service.open(null, { page: '2' });
    expect(service.items()).toEqual([articlePreview(general)]);
    expect(service.hiddenCount()).toBe(2);
    expect(service.total()).toBe(25);
    expect(port.browse).toHaveBeenCalledTimes(1);
  });
  it.each(['mature', undefined] as const)(
    'suppresses %s article details without retaining text or covers',
    (classification) => {
      port.find.mockReturnValue(
        of(ok({ ...article, ...(classification ? { classification } : {}) }))
      );
      service.open(article.slug, {});
      expect(service.hidden()).toBe(true);
      expect(service.article()).toBeNull();
      select({ showMatureContent: true });
      expect(service.article()?.title).toBe(article.title);
      expect(service.hidden()).toBe(false);
      select({ showMatureContent: false });
      expect(service.article()).toBeNull();
    }
  );
  it('cancels a pending body read when preferences change and waits through failures', () => {
    select({ showMatureContent: true });
    const pending = new Subject<Result<PublishedArticle, Error>>();
    port.find.mockReturnValueOnce(pending);
    service.open(article.slug, {});
    select({
      sessionKey: 'Bob',
      sessionVersion: 1,
      status: 'loading',
      showMatureContent: false,
    });
    pending.next(ok(article));
    expect(service.article()).toBeNull();
    expect(service.preferencesLoading()).toBe(true);
    expect(port.find).toHaveBeenCalledTimes(1);
    select({ status: 'unavailable' });
    expect(service.preferencesError()).toBe(true);
    expect(service.loading()).toBe(false);
    service.retry();
    expect(retryPreferences).toHaveBeenCalledTimes(1);
    port.find.mockReturnValue(
      of(ok({ ...article, classification: 'general' as const }))
    );
    select({ status: 'ready' });
    expect(service.article()?.classification).toBe('general');
  });
  it('clears previously visible content on a source failure', () => {
    port.find.mockReturnValueOnce(
      of(ok({ ...article, classification: 'general' as const }))
    );
    service.open(article.slug, {});
    port.find.mockReturnValueOnce(of(err(new Error('Unavailable'))));
    service.retry();
    expect(service.article()).toBeNull();
    expect(service.error()).toBe('Unavailable');
    expect(service.hidden()).toBe(false);
  });
});
