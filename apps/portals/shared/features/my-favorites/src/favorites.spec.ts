import { TestBed } from '@angular/core/testing';
import { Injector, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import type { AccountFavorites } from '@domains/customer/favorites';
import type { CatalogApp } from '@domains/catalog/record';
import { defaultAccountPreferences } from '@domains/customer/preferences';
import {
  PreferencesService,
  PREFERENCES_SESSION,
  type PreferencesState,
} from '@portals/shared/features/preferences';
import { provideMyFavoritesFeature } from './my-favorites.providers';
import { MyFavoritesService } from './application/my-favorites.service';
import { FavoriteContentService } from './application/favorite-content.service';
import { FAVORITE_CONTENT } from './application/favorite-content.port';
import { FavoriteContentApiService } from './infrastructure/favorite-content-api.service';
import { LazyFavoriteContentService } from './infrastructure/lazy-favorite-content.service';
import { FAVORITES_MODE } from './application/favorites-session.port';
import { LazyMyFavoritesService } from './infrastructure/lazy-my-favorites.service';
import { MyFavoritesApiService } from './infrastructure/my-favorites-api.service';
import { MY_FAVORITES_PROVIDER } from './application/my-favorites-provider.token';
import { FavoriteToggleButtonComponent } from './presentation/favorite-toggle-button/favorite-toggle-button.component';

const url = '/api/me/favorites';
const id = '10000000-0000-4000-8000-000000000001';
const second = '10000000-0000-4000-8000-000000000002';
const app: CatalogApp = {
  id,
  revision: 4,
  slug: 'renamed-app',
  name: 'Current application',
  description: null,
  website: null,
  logoUrl: null,
  bannerUrl: null,
  isPwa: false,
  estimatedNumberOfUsers: null,
  createdAt: '2026-10-11T10:00:00.000Z',
  updatedAt: '2026-10-11T10:00:00.000Z',
  categories: [],
  tags: [],
  platforms: [],
  devices: [],
  monetizations: [],
  reviews: null,
};
function snapshot(
  identityId = 'Alice',
  revision = 2,
  ids: string[] = []
): AccountFavorites {
  return {
    identityId,
    revision,
    favorites: ids.map((id) => ({ kind: 'applications', id, addedAt: 10 })),
  };
}

describe('canonical portal favorites', () => {
  let http: HttpTestingController;
  let token: BehaviorSubject<string | null>;
  beforeEach(() => {
    localStorage.clear();
    token = new BehaviorSubject<string | null>('alice-token');
    const data = defaultAccountPreferences();
    data.content.showMatureContent = true;
    const state = signal<PreferencesState>({
      isLoading: false, isError: false, data, scope: 'account',
      sessionKey: 'alice-token', sessionVersion: 0,
      context: {
        sessionKey: 'alice-token', sessionVersion: 0,
        read: { data, account: { identityId: 'Alice', revision: 1, updatedAt: null, preferences: data } },
      },
    });
    const preferences$ = new BehaviorSubject(state());
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AUTHENTICATION_SESSION,
          useValue: { token$: token, getToken: () => token.value },
        },
        { provide: PREFERENCES_SESSION, useValue: { key$: token, currentKey: () => token.value } },
        { provide: PreferencesService, useValue: { state, preferences$, reload: jest.fn() } },
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
  function loaded(ids: string[] = []) {
    const service = TestBed.inject(MyFavoritesService);
    http.expectOne(url).flush(snapshot('Alice', 2, ids));
    return service;
  }
  it('loads the metadata adapter lazily without changing its canonical response', async () => {
    const service = TestBed.inject(LazyFavoriteContentService);
    const pending = firstValueFrom(
      service.resolve({
        applications: [],
        suites: [],
        articles: [],
        discussions: [],
      })
    );
    expect(await pending).toEqual({ ok: true, value: [] });
  });
  it('loads explicit demo metadata without contacting account or catalog APIs', async () => {
    const injector = Injector.create({
      parent: TestBed.inject(Injector),
      providers: [
        { provide: FAVORITES_MODE, useValue: 'demo' },
        LazyFavoriteContentService,
      ],
    });
    const service = injector.get(LazyFavoriteContentService);
    const result = await firstValueFrom(
      service.resolve({
        applications: [],
        suites: [],
        articles: ['demo-article'],
        discussions: [],
      })
    );
    expect(result).toEqual({
      ok: true,
      value: [
        {
          kind: 'articles',
          id: 'demo-article',
          slug: 'demo-article',
          name: 'Demo Article',
          status: 'available',
          image: undefined,
          appSlug: undefined,
        },
      ],
    });
  });
  it('fences a deferred favorite write when its account changes before adapter loading', async () => {
    const service = TestBed.inject(LazyMyFavoritesService);
    const pending = firstValueFrom(
      service.change({
        identityId: 'Alice',
        expectedRevision: 2,
        target: { kind: 'articles', id },
        saved: true,
      })
    );
    token.next('bob-token');
    await expect(pending).rejects.toThrow('account session changed');
    http.expectNone(url);
  });
  it('resolves canonical article IDs and keeps withdrawn favorites removable', () => {
    TestBed.inject(MyFavoritesService);
    http.expectOne(url).flush({
      ...snapshot(),
      favorites: [
        { kind: 'articles', id, addedAt: 10 },
        { kind: 'articles', id: second, addedAt: 10 },
      ],
    });
    let view: unknown;
    const subscription = TestBed.inject(FavoriteContentService).view$.subscribe(
      (value) => (view = value)
    );
    http
      .expectOne('/api/catalog/article-selection?ids=' + id + ',' + second)
      .flush({
        items: [
          {
            id,
            revision: 1,
            submittedRevision: 2,
            title: 'Reviewed article',
            slug: 'reviewed-article',
            excerpt: 'Summary.',
            byline: 'Public name',
            category: 'Guides',
            tags: [],
            publishedAt: 100,
            updatedAt: 100,
          },
        ],
      });
    expect(view).toMatchObject({
      contentError: false,
      items: [
        {
          kind: 'articles',
          id,
          name: 'Reviewed article',
          slug: 'reviewed-article',
          status: 'available',
        },
        {
          kind: 'articles',
          id: second,
          name: 'Unavailable article',
          slug: null,
          status: 'unavailable',
        },
      ],
    });
    subscription.unsubscribe();
  });
  it('joins discussion UUIDs to current parent slugs and retains deleted topic references without invented links', () => {
    loaded();
    const service = TestBed.inject(MyFavoritesService);
    service.reload();
    http.expectOne(url).flush({
      ...snapshot(),
      favorites: [
        { kind: 'discussions', id, addedAt: 10 },
        { kind: 'discussions', id: second, addedAt: 11 },
      ],
    });
    let view: unknown;
    const subscription = TestBed.inject(FavoriteContentService).view$.subscribe(
      (value) => (view = value)
    );
    http
      .expectOne(`/api/discussion-selection?ids=${id},${second}`)
      .flush({
        items: [
          {
            id,
            applicationId: app.id,
            revision: 3,
            title: 'Current topic',
            replyCount: 2,
          },
        ],
      });
    http
      .expectOne('/api/catalog/app-selection?ids=' + app.id)
      .flush({ items: [app] });
    expect(view).toMatchObject({
      contentError: false,
      items: [
        {
          kind: 'discussions',
          id,
          slug: id,
          appSlug: app.slug,
          name: 'Current topic',
          status: 'available',
        },
        {
          kind: 'discussions',
          id: second,
          slug: null,
          name: 'Unavailable discussion',
          status: 'unavailable',
        },
      ],
    });
    subscription.unsubscribe();
  });
  it('clears old discussion metadata when changing accounts and cancels the dependent parent lookup', () => {
    loaded();
    const service = TestBed.inject(MyFavoritesService);
    service.reload();
    http
      .expectOne(url)
      .flush({
        ...snapshot(),
        favorites: [{ kind: 'discussions', id, addedAt: 10 }],
      });
    let view: unknown;
    const subscription = TestBed.inject(FavoriteContentService).view$.subscribe(
      (value) => (view = value)
    );
    http
      .expectOne('/api/discussion-selection?ids=' + id)
      .flush({
        items: [
          {
            id,
            applicationId: app.id,
            revision: 3,
            title: 'Current topic',
            replyCount: 2,
          },
        ],
      });
    const parent = http.expectOne('/api/catalog/app-selection?ids=' + app.id);
    token.next('bob-token');
    expect(parent.cancelled).toBe(true);
    http.expectOne(url).flush(snapshot('Bob', 1));
    expect(view).toMatchObject({ contentError: false, items: [] });
    subscription.unsubscribe();
  });
  it('saves canonical discussion IDs through the existing account revision and exact retry protocol', async () => {
    const service = loaded();
    const pending = firstValueFrom(service.addToFavorites('discussions', id));
    const first = http.expectOne(url);
    expect(first.request.body).toEqual({
      expectedRevision: 2,
      target: { kind: 'discussions', id },
      saved: true,
    });
    const key = first.request.headers.get('Idempotency-Key');
    first.flush({}, { status: 503, statusText: 'Lost receipt' });
    expect((await pending).ok).toBe(false);
    const retry = firstValueFrom(service.addToFavorites('discussions', id));
    const second = http.expectOne(url);
    expect(second.request.body).toEqual(first.request.body);
    expect(second.request.headers.get('Idempotency-Key')).toBe(key);
    second.flush({ identityId: 'Alice', revision: 3 });
    expect((await retry).ok).toBe(true);
    http
      .expectOne(url)
      .flush({
        ...snapshot('Alice', 3),
        favorites: [{ kind: 'discussions', id, addedAt: 10 }],
      });
    expect(service.getState().data.discussions).toEqual([id]);
  });
  it('reads canonical IDs without importing browser favorites', () => {
    localStorage.setItem(
      'wapps.favorites.v1',
      JSON.stringify({ applications: ['wrong-slug'] })
    );
    const read = jest.spyOn(Storage.prototype, 'getItem');
    const service = loaded([id]);
    expect(read).not.toHaveBeenCalled();
    expect(service.getState().data.applications).toEqual([id]);
    expect(service.getState().context?.revision).toBe(2);
  });
  it.each([
    '<html>SPA</html>',
    { ...snapshot(), revision: 0 },
    { ...snapshot(), extra: true },
    {
      ...snapshot(),
      favorites: [{ kind: 'applications', id: 'slug', addedAt: 1 }],
    },
  ])(
    'fails malformed reads without fabricated empty success: %p',
    (response) => {
      const service = TestBed.inject(MyFavoritesService);
      http.expectOne(url).flush(response);
      expect(service.getState()).toMatchObject({
        isError: true,
        context: null,
      });
    }
  );
  it('does not read or write while signed out', async () => {
    token.next(null);
    const service = TestBed.inject(MyFavoritesService);
    expect(service.getState().signedIn).toBe(false);
    expect(
      (await firstValueFrom(service.addToFavorites('applications', id))).ok
    ).toBe(false);
    http.expectNone(url);
  });
  it('reloads a failed read explicitly and exposes loading', () => {
    const service = TestBed.inject(MyFavoritesService);
    expect(service.getState().isLoading).toBe(true);
    http.expectOne(url).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(service.getState().isError).toBe(true);
    service.reload();
    http.expectOne(url).flush(snapshot());
    expect(service.getState().isError).toBe(false);
  });
  it('sends only the desired state and loaded revision, then rereads canonical membership', async () => {
    const service = loaded();
    const pending = firstValueFrom(service.addToFavorites('applications', id));
    const request = http.expectOne(url);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      expectedRevision: 2,
      target: { kind: 'applications', id },
      saved: true,
    });
    expect(request.request.headers.get('Idempotency-Key')).toMatch(
      /^[a-f0-9-]{36}$/
    );
    expect(service.getState().data.applications).toEqual([]);
    request.flush({ identityId: 'Alice', revision: 3 });
    expect(await pending).toEqual({ ok: true, value: true });
    http.expectOne(url).flush(snapshot('Alice', 3, [id]));
    expect(service.getState().data.applications).toEqual([id]);
  });
  it('retains retry keys for unchanged uncertain intent and changes them for new intent or session', async () => {
    const service = loaded();
    const keys: (string | null)[] = [];
    for (const target of [id, id, second]) {
      const pending = firstValueFrom(
        service.addToFavorites('applications', target)
      );
      const request = http.expectOne(url);
      keys.push(request.request.headers.get('Idempotency-Key'));
      request.flush({}, { status: 503, statusText: 'Unavailable' });
      await pending;
    }
    token.next(null);
    token.next('alice-token');
    http.expectOne(url).flush(snapshot());
    const pending = firstValueFrom(
      service.addToFavorites('applications', second)
    );
    const request = http.expectOne(url);
    keys.push(request.request.headers.get('Idempotency-Key'));
    request.flush({}, { status: 503, statusText: 'Unavailable' });
    await pending;
    expect(keys[0]).toBe(keys[1]);
    expect(keys[1]).not.toBe(keys[2]);
    expect(keys[2]).not.toBe(keys[3]);
  });
  it.each([409, 401, 403, 400])(
    'retains state and exposes rejected writes (%i)',
    async (status) => {
      const service = loaded();
      const pending = firstValueFrom(
        service.addToFavorites('applications', id)
      );
      http.expectOne(url).flush({}, { status, statusText: 'Rejected' });
      expect((await pending).ok).toBe(false);
      expect(service.getState().data.applications).toEqual([]);
      http.expectNone(url);
    }
  );
  it.each([
    { identityId: 'Bob', revision: 3 },
    { identityId: 'Alice', revision: 4 },
    { accepted: true },
  ])('does not accept a mismatched receipt: %p', async (response) => {
    const service = loaded();
    const pending = firstValueFrom(service.addToFavorites('applications', id));
    http.expectOne(url).flush(response);
    expect((await pending).ok).toBe(false);
    http.expectNone(url);
  });
  it('cancels stale reads and clears membership on account change', () => {
    const service = loaded([id]);
    service.reload();
    const old = http.expectOne(url);
    token.next('bob-token');
    expect(old.cancelled).toBe(true);
    expect(service.getState().data.applications).toEqual([]);
    http.expectOne(url).flush(snapshot('Bob'));
    expect(service.getState().context?.identityId).toBe('Bob');
  });
  it('cancels a pending write on logout and does not reuse its key after immediate login', async () => {
    const service = loaded();
    const pending = firstValueFrom(service.addToFavorites('applications', id));
    const old = http.expectOne(url);
    token.next(null);
    token.next('alice-token');
    expect(old.cancelled).toBe(true);
    expect((await pending).ok).toBe(false);
    http.expectOne(url).flush(snapshot());
    const retry = firstValueFrom(service.addToFavorites('applications', id));
    const next = http.expectOne(url);
    expect(next.request.headers.get('Idempotency-Key')).not.toBe(
      old.request.headers.get('Idempotency-Key')
    );
    next.flush({}, { status: 503, statusText: 'Unavailable' });
    await retry;
  });
  it('blocks competing commands even while an explicit reload finishes', async () => {
    const service = loaded();
    const first = firstValueFrom(service.addToFavorites('applications', id));
    const request = http.expectOne(url);
    service.reload();
    http.expectOne(url).flush(snapshot());
    expect(service.getState().isSaving).toBe(true);
    expect(
      (await firstValueFrom(service.addToFavorites('applications', second))).ok
    ).toBe(false);
    http.expectNone(url);
    request.flush({}, { status: 503, statusText: 'Unavailable' });
    await first;
    expect(service.getState().isSaving).toBe(false);
  });
  it('rejects sample slugs before HTTP but permits canonical removals', async () => {
    const service = loaded();
    expect(
      (await firstValueFrom(service.addToFavorites('applications', 'old-slug')))
        .ok
    ).toBe(false);
    expect(
      (
        await firstValueFrom(
          service.addToFavorites('discussions', 'sample-topic')
        )
      ).ok
    ).toBe(false);
    http.expectNone(url);
    const pending = firstValueFrom(service.removeFromFavorites('suites', id));
    const request = http.expectOne(url);
    expect(request.request.body.saved).toBe(false);
    request.flush({ identityId: 'Alice', revision: 3 });
    await pending;
    http.expectOne(url).flush(snapshot('Alice', 3));
  });
  it('saves a canonical suite with a revision-bound command and shares membership with its button', async () => {
    const service = loaded();
    const fixture = TestBed.createComponent(FavoriteToggleButtonComponent);
    fixture.componentRef.setInput('type', 'suites');
    fixture.componentRef.setInput('targetId', id);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(false);
    const pending = firstValueFrom(service.addToFavorites('suites', id));
    const request = http.expectOne(url);
    expect(request.request.body).toEqual({
      expectedRevision: 2,
      target: { kind: 'suites', id },
      saved: true,
    });
    request.flush({ identityId: 'Alice', revision: 3 });
    expect((await pending).ok).toBe(true);
    http.expectOne(url).flush({
      ...snapshot('Alice', 3),
      favorites: [{ kind: 'suites', id, addedAt: 10 }],
    });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('button').getAttribute('aria-pressed')
    ).toBe('true');
  });
  it('resolves suite and application UUIDs separately and retains withdrawn suite references', () => {
    TestBed.inject(MyFavoritesService);
    http.expectOne(url).flush({
      ...snapshot('Alice', 2, [id]),
      favorites: [
        { kind: 'applications', id, addedAt: 10 },
        { kind: 'suites', id, addedAt: 10 },
        { kind: 'suites', id: second, addedAt: 10 },
      ],
    });
    let view: unknown;
    const subscription = TestBed.inject(FavoriteContentService).view$.subscribe(
      (value) => (view = value)
    );
    http
      .expectOne('/api/catalog/app-selection?ids=' + id)
      .flush({ items: [app] });
    http
      .expectOne('/api/catalog/suite-selection?ids=' + id + ',' + second)
      .flush({
        items: [
          {
            id,
            title: 'Approved suite',
            description: '',
            applicationIds: [id],
            revision: 1,
            submittedRevision: 1,
            publishedAt: 10,
          },
        ],
      });
    expect(view).toMatchObject({
      contentError: false,
      items: [
        { kind: 'applications', id, slug: app.slug },
        {
          kind: 'suites',
          id,
          name: 'Approved suite',
          slug: id,
          status: 'available',
        },
        {
          kind: 'suites',
          id: second,
          name: 'Unavailable suite',
          slug: null,
          status: 'unavailable',
        },
      ],
    });
    subscription.unsubscribe();
  });
  it('resolves renamed target IDs and preserves unavailable references without invented links', () => {
    loaded([id, second]);
    const views = TestBed.inject(FavoriteContentService);
    let view: unknown;
    const subscription = views.view$.subscribe((value) => (view = value));
    http
      .expectOne('/api/catalog/app-selection?ids=' + id + ',' + second)
      .flush({ items: [app] });
    expect(view).toMatchObject({
      contentError: false,
      items: [
        { id, name: app.name, slug: 'renamed-app', status: 'available' },
        { id: second, slug: null, status: 'unavailable' },
      ],
    });
    subscription.unsubscribe();
  });
  it.each(['applications', 'suites', 'articles', 'discussions'] as const)(
    'bounds %s resolution to batches of fifty with all-or-error metadata',
    (kind) => {
      const ids = Array.from(
        { length: 200 },
        (_, i) => `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
      );
      TestBed.inject(MyFavoritesService);
      http.expectOne(url).flush({
        ...snapshot(),
        favorites: ids.map((id) => ({ kind, id, addedAt: 10 })),
      });
      let value: unknown;
      const subscription = TestBed.inject(
        FavoriteContentService
      ).view$.subscribe((view) => (value = view));
      const requests = http.match(
        (r) =>
          r.url ===
          (kind === 'discussions'
            ? '/api/discussion-selection'
            : `/api/catalog/${
                kind === 'articles'
                  ? 'article-selection'
                  : kind === 'suites'
                  ? 'suite-selection'
                  : 'app-selection'
              }`)
      );
      expect(requests).toHaveLength(4);
      for (const [index, request] of requests.entries()) {
        expect(request.request.params.get('ids')?.split(',')).toHaveLength(50);
        if (index < 3) request.flush({ items: [] });
        else request.flush({}, { status: 503, statusText: 'Projection lag' });
      }
      expect(value).toMatchObject({
        contentError: true,
        items: expect.arrayContaining([
          {
            id: ids[0],
            kind,
            name: 'Details unavailable',
            slug: null,
            status: 'unknown',
          },
        ]),
      });
      subscription.unsubscribe();
    }
  );
  it('keeps removal independent of a metadata outage and refreshes afterward', async () => {
    const service = loaded([id]);
    const subscription = TestBed.inject(
      FavoriteContentService
    ).view$.subscribe();
    http
      .expectOne('/api/catalog/app-selection?ids=' + id)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    const pending = firstValueFrom(
      service.removeFromFavorites('applications', id)
    );
    http.expectOne(url).flush({ identityId: 'Alice', revision: 3 });
    await pending;
    http.expectOne(url).flush(snapshot('Alice', 3));
    http.expectNone((r) => r.url === '/api/catalog/app-selection');
    subscription.unsubscribe();
  });
  it('cancels target metadata on session change', () => {
    loaded([id]);
    const subscription = TestBed.inject(
      FavoriteContentService
    ).view$.subscribe();
    const old = http.expectOne('/api/catalog/app-selection?ids=' + id);
    token.next('bob-token');
    expect(old.cancelled).toBe(true);
    http.expectOne(url).flush(snapshot('Bob'));
    subscription.unsubscribe();
  });
  it('clears button feedback and ignores a pending result after target/session changes', () => {
    loaded();
    const fixture = TestBed.createComponent(FavoriteToggleButtonComponent);
    fixture.componentRef.setInput('type', 'applications');
    fixture.componentRef.setInput('targetId', id);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    const request = http.expectOne(url);
    token.next(null);
    token.next('alice-token');
    http.expectOne(url).flush(snapshot());
    fixture.detectChanges();
    expect(request.cancelled).toBe(true);
    expect(fixture.componentInstance.error()).toBe('');
    fixture.nativeElement.querySelector('button').click();
    const next = http.expectOne(url);
    fixture.componentRef.setInput('targetId', second);
    fixture.detectChanges();
    expect(next.cancelled).toBe(true);
    expect(fixture.componentInstance.saving()).toBe(false);
  });
  it('supports canonical discussion controls and retains saved-reference removal', () => {
    const service = loaded();
    const fixture = TestBed.createComponent(FavoriteToggleButtonComponent);
    fixture.componentRef.setInput('type', 'discussions');
    fixture.componentRef.setInput('targetId', id);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button').textContent).toContain(
      'Add'
    );
    service.reload();
    http.expectOne(url).flush({
      ...snapshot(),
      favorites: [{ kind: 'discussions', id, addedAt: 10 }],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button').textContent).toContain(
      'Remove'
    );
    fixture.componentRef.setInput('targetId', 'sample-topic');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});

describe('favorites composition configuration', () => {
  it.each([
    'ftp://server',
    'https://user:secret@server',
    'https://server/path',
    'https://server?query=yes',
  ])('rejects invalid service origins: %s', (apiBaseUrl) => {
    expect(() =>
      provideMyFavoritesFeature({ mode: 'api', apiBaseUrl })
    ).toThrow();
  });
});
