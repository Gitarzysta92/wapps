import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject, firstValueFrom, Subject } from 'rxjs';
import { defaultAccountPreferences } from '@domains/customer/preferences';
import { FAVORITE_KINDS } from '@domains/customer/favorites';
import type { ContentClassification } from '@domains/publication/classification';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import {
  PreferencesService,
  providePreferencesFeature,
} from '@portals/shared/features/preferences';
import { ok } from '@sdk/kernel/standard';
import { provideMyFavoritesFeature } from './my-favorites.providers';
import { FavoriteContentService } from './application/favorite-content.service';
import { MyFavoritesService } from './application/my-favorites.service';
import {
  FAVORITE_CONTENT,
  type FavoriteContent,
} from './application/favorite-content.port';
import { MY_FAVORITES_PROVIDER } from './application/my-favorites-provider.token';
import { FavoriteContentApiService } from './infrastructure/favorite-content-api.service';
import { MyFavoritesApiService } from './infrastructure/my-favorites-api.service';

const id = '10000000-0000-4000-8000-000000000001';
const favoritesUrl = '/api/me/favorites';
const preferencesUrl = '/api/me/preferences';
const appsUrl = '/api/catalog/app-selection?ids=' + id;

function favorites(identityId = 'Alice', revision = 1, empty = false) {
  return {
    identityId,
    revision,
    favorites: empty
      ? []
      : FAVORITE_KINDS.map((kind) => ({ kind, id, addedAt: 10 })),
  };
}
function preferences(
  showMatureContent: boolean,
  identityId = 'Alice',
  revision = 1
) {
  const data = defaultAccountPreferences();
  data.content.showMatureContent = showMatureContent;
  return { identityId, revision, updatedAt: null, preferences: data };
}
function application(classification?: ContentClassification) {
  return {
    id,
    revision: 1,
    slug: 'saved-application',
    name: 'Saved application',
    description: 'Public description',
    website: null,
    logoUrl: 'https://example.test/secret-logo.png',
    bannerUrl: null,
    isPwa: false,
    estimatedNumberOfUsers: null,
    createdAt: '2026-10-13T10:00:00.000Z',
    updatedAt: '2026-10-13T10:00:00.000Z',
    categories: [],
    tags: [],
    platforms: [],
    devices: [],
    monetizations: [],
    reviews: null,
    ...(classification === undefined ? {} : { classification }),
  };
}

describe('favorites saved content preferences', () => {
  let http: HttpTestingController;
  let token: BehaviorSubject<string | null>;
  beforeEach(() => {
    localStorage.clear();
    token = new BehaviorSubject<string | null>('alice-token');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AUTHENTICATION_SESSION,
          useValue: { token$: token, getToken: () => token.value },
        },
        ...providePreferencesFeature({ mode: 'api', apiBaseUrl: '' }).providers,
        ...provideMyFavoritesFeature({ mode: 'api', apiBaseUrl: '' }).providers,
        { provide: FAVORITE_CONTENT, useExisting: FavoriteContentApiService },
        { provide: MY_FAVORITES_PROVIDER, useExisting: MyFavoritesApiService },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    jest.restoreAllMocks();
  });

  function load(enabled = false) {
    const service = TestBed.inject(FavoriteContentService);
    http.expectOne(favoritesUrl).flush(favorites());
    http.expectOne(preferencesUrl).flush(preferences(enabled));
    return service;
  }
  function metadata(
    classification?: ContentClassification,
    parent = classification
  ) {
    const fields = classification === undefined ? {} : { classification };
    http.expectOne('/api/catalog/article-selection?ids=' + id).flush({
      items: [
        {
          id,
          revision: 1,
          submittedRevision: 1,
          title: 'Saved article',
          slug: 'saved-article',
          excerpt: 'Excerpt',
          byline: 'Author',
          category: 'Guides',
          tags: [],
          publishedAt: 10,
          updatedAt: 10,
          ...fields,
        },
      ],
    });
    http.expectOne('/api/catalog/suite-selection?ids=' + id).flush({
      items: [
        {
          id,
          revision: 1,
          submittedRevision: 1,
          title: 'Saved suite',
          description: '',
          applicationIds: [id],
          publishedAt: 10,
          ...fields,
        },
      ],
    });
    http.expectOne(appsUrl).flush({ items: [application(classification)] });
    http.expectOne('/api/discussion-selection?ids=' + id).flush({
      items: [
        {
          id,
          revision: 1,
          applicationId: id,
          title: 'Saved discussion',
          replyCount: 0,
        },
      ],
    });
    http.expectOne(appsUrl).flush({ items: [application(parent)] });
  }

  it.each([
    [false, 'general', false],
    [false, 'mature', true],
    [false, undefined, true],
    [true, 'general', false],
    [true, 'mature', false],
    [true, undefined, false],
  ] as const)(
    'uses saved enabled=%s classification=%s for every favorite kind',
    (enabled, classification, hidden) => {
      const service = load(enabled);
      metadata(classification);
      expect(service.view().hidden).toBe(hidden ? 4 : 0);
      expect(service.view().items).toHaveLength(4);
      for (const item of service.view().items) {
        if (hidden)
          expect(item).toEqual({
            kind: item.kind,
            id,
            name: 'Hidden by content preferences',
            slug: null,
            status: 'hidden',
          });
        else
          expect(item).toMatchObject({
            status: 'available',
            ...(classification ? { classification } : {}),
          });
      }
    }
  );

  it('uses the current application classification for discussions independently of suite classification', () => {
    const service = load();
    metadata('general', 'mature');
    expect(service.view().hidden).toBe(1);
    expect(
      service.view().items.find((item) => item.kind === 'suites')?.status
    ).toBe('available');
    expect(
      service.view().items.find((item) => item.kind === 'discussions')
    ).toEqual({
      kind: 'discussions',
      id,
      name: 'Hidden by content preferences',
      slug: null,
      status: 'hidden',
    });
  });

  it('waits for completed preferences and keeps references removable during a read failure', async () => {
    const service = TestBed.inject(FavoriteContentService);
    http.expectOne(favoritesUrl).flush(favorites());
    expect(service.view()).toMatchObject({
      preferencesLoading: true,
      hidden: 0,
    });
    http.expectNone((request) => request.url.includes('selection'));
    http
      .expectOne(preferencesUrl)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(service.view()).toMatchObject({
      preferencesError: true,
      preferencesLoading: false,
      contentError: false,
    });
    expect(
      service
        .view()
        .items.every(
          (item) => item.slug === null && !item.image && !item.appSlug
        )
    ).toBe(true);
    const pending = firstValueFrom(
      TestBed.inject(MyFavoritesService).removeFromFavorites('applications', id)
    );
    const remove = http.expectOne(favoritesUrl);
    expect(remove.request.body).toMatchObject({
      target: { kind: 'applications', id },
      saved: false,
    });
    remove.flush({ identityId: 'Alice', revision: 2 });
    expect(await pending).toEqual(ok(true));
    http.expectOne(favoritesUrl).flush(favorites('Alice', 2, true));
    expect(service.view().items).toEqual([]);
    http.expectNone((request) => request.url.includes('selection'));
  });

  it('retries failed preferences and reloads metadata under the resulting choice', () => {
    const service = TestBed.inject(FavoriteContentService);
    http.expectOne(favoritesUrl).flush(favorites());
    http
      .expectOne(preferencesUrl)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    service.reload();
    http.expectOne(favoritesUrl).flush(favorites());
    http.expectOne(preferencesUrl).flush(preferences(false));
    metadata('mature');
    expect(service.view()).toMatchObject({
      preferencesError: false,
      hidden: 4,
    });
  });

  it('clears visible metadata synchronously before dependent preference streams run', () => {
    const saved = TestBed.inject(PreferencesService);
    http.expectOne(preferencesUrl).flush(preferences(true));
    const checked: boolean[] = [];
    const subscription = saved.preferences$.subscribe((state) => {
      if (state.isLoading && service) {
        checked.push(true);
        expect(
          service
            .view()
            .items.every((item) => item.slug === null && !item.image)
        ).toBe(true);
      }
    });
    const service = TestBed.inject(FavoriteContentService);
    http.expectOne(favoritesUrl).flush(favorites());
    metadata('mature');
    expect(service.view().items[0].status).toBe('available');
    saved.reload();
    expect(checked).toEqual([true]);
    http.expectOne(preferencesUrl).flush(preferences(false));
    metadata('mature');
    expect(service.view().hidden).toBe(4);
    subscription.unsubscribe();
  });

  it('applies a same-document saved choice, cancels pending metadata and preserves hidden removal', async () => {
    const service = load(true);
    const pendingRequests = http.match((request) =>
      request.url.includes('selection')
    );
    expect(pendingRequests).toHaveLength(4);
    const pending = firstValueFrom(
      TestBed.inject(PreferencesService).updateContentPreferences({
        showMatureContent: false,
      })
    );
    http.expectOne(preferencesUrl).flush({ identityId: 'Alice', revision: 2 });
    expect(await pending).toEqual(ok(true));
    expect(pendingRequests.every((request) => request.cancelled)).toBe(true);
    expect(service.view().preferencesLoading).toBe(true);
    http.expectOne(preferencesUrl).flush(preferences(false, 'Alice', 2));
    metadata('mature');
    expect(service.view().hidden).toBe(4);
    const removed = firstValueFrom(
      TestBed.inject(MyFavoritesService).removeFromFavorites('suites', id)
    );
    http.expectOne(favoritesUrl).flush({ identityId: 'Alice', revision: 2 });
    await removed;
    http.expectOne(favoritesUrl).flush(favorites('Alice', 2, true));
    expect(service.view().hidden).toBe(0);
  });

  it('clears references on account change and never resolves Bob using Alice preferences', () => {
    const service = load(true);
    metadata('mature');
    token.next('bob-token');
    expect(service.view().items).toEqual([]);
    http.expectOne(favoritesUrl).flush(favorites('Bob'));
    expect(service.view().preferencesLoading).toBe(true);
    http.expectNone((request) => request.url.includes('selection'));
    http.expectOne(preferencesUrl).flush(preferences(false, 'Bob'));
    metadata('mature');
    expect(service.view().hidden).toBe(4);
    token.next(null);
    expect(service.view()).toMatchObject({
      signedIn: false,
      items: [],
      hidden: 0,
    });
  });

  it('rejects removal during a session transition before favorites clears the old account', () => {
    let result: unknown;
    const subscription = token.subscribe((key) => {
      if (key === 'bob-token')
        favoritesService
          .removeFromFavorites('applications', id)
          .subscribe((value) => {
            result = value;
          });
    });
    const favoritesService = TestBed.inject(MyFavoritesService);
    http.expectOne(favoritesUrl).flush(favorites());
    token.next('bob-token');
    expect(result).toEqual({
      ok: false,
      error: new Error('Sign in and load favorites before changing them.'),
    });
    http.expectNone((request) => request.method === 'PUT');
    http.expectOne(favoritesUrl).flush(favorites('Bob', 1, true));
    subscription.unsubscribe();
  });

  it('does not compare independent session counters and rejects a mismatched canonical account', () => {
    const saved = TestBed.inject(PreferencesService);
    http.expectOne(preferencesUrl).flush(preferences(true));
    token.next(null);
    token.next('alice-again');
    http.expectOne(preferencesUrl).flush(preferences(false));
    const service = TestBed.inject(FavoriteContentService);
    http.expectOne(favoritesUrl).flush(favorites());
    expect(saved.state().sessionVersion).not.toBe(
      TestBed.inject(MyFavoritesService).getState().sessionVersion
    );
    metadata('general');
    expect(
      service.view().items.every((item) => item.status === 'available')
    ).toBe(true);
    saved.reload();
    http.expectOne(preferencesUrl).flush(preferences(true, 'Bob'));
    expect(service.view().preferencesError).toBe(true);
    expect(service.view().items.every((item) => item.slug === null)).toBe(true);
    http.expectNone((request) => request.url.includes('selection'));
  });

  it('rejects malformed classification instead of presenting success or an empty collection', () => {
    const service = load(true);
    const requests = http.match((request) => request.url.includes('selection'));
    const apps = requests.find(
      (request) => request.request.url === '/api/catalog/app-selection'
    );
    expect(apps).toBeDefined();
    apps?.flush({ items: [{ ...application(), classification: 'safe' }] });
    expect(service.view()).toMatchObject({ contentError: true, hidden: 0 });
    expect(service.view().items).toHaveLength(4);
    expect(
      requests
        .filter((request) => request !== apps)
        .every((request) => request.cancelled)
    ).toBe(true);
  });

  it('ignores late metadata after switching to a new saved choice', () => {
    const replies: Subject<ReturnType<typeof ok<FavoriteContent[]>>>[] = [];
    const adapter = TestBed.inject(FavoriteContentApiService);
    jest.spyOn(adapter, 'resolve').mockImplementation(() => {
      const response = new Subject<ReturnType<typeof ok<FavoriteContent[]>>>();
      replies.push(response);
      return response;
    });
    const service = load(true);
    TestBed.inject(PreferencesService).reload();
    http.expectOne(preferencesUrl).flush(preferences(false));
    expect(replies).toHaveLength(2);
    replies[0].next(
      ok([
        {
          kind: 'applications',
          id,
          slug: 'late',
          name: 'Old secret',
          image: '/old.png',
          status: 'available',
        },
      ])
    );
    expect(service.view().items.every((item) => item.slug === null)).toBe(true);
    replies[1].next(
      ok([
        {
          kind: 'applications',
          id,
          slug: 'current',
          name: 'Current secret',
          status: 'available',
          classification: 'mature',
        },
      ])
    );
    expect(service.view().items[0].status).toBe('hidden');
  });
});
