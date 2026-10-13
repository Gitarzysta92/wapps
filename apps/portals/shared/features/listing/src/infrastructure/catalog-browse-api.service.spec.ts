import { signal } from '@angular/core';
import { of } from 'rxjs';
import {
  PublicContentPreferencesService,
  type PublicContentChoice,
} from '@portals/shared/features/preferences';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CatalogApp, CatalogPage } from '@domains/catalog/record';
import { CatalogBrowserService } from '../application/catalog-browser.service';
import { CatalogQuery } from '../application/catalog-listing';
import { provideListingFeature } from '../listing.providers';

const app: CatalogApp = {
  id: '10000000-0000-4000-8000-000000000001',
  revision: 7,
  slug: 'remote-app',
  name: 'Remote app',
  description: 'Real service description',
  website: 'https://example.test',
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
const query: CatalogQuery = {
  kind: 'applications',
  search: '',
  category: '',
  tags: [],
  sort: 'name',
  page: 1,
  pageSize: 20,
};
const page: CatalogPage = {
  items: [app],
  total: 1,
  page: 1,
  pageSize: 20,
  totalPages: 1,
  facets: {
    categories: [],
    tags: [],
    platforms: [],
    devices: [],
    monetizations: [],
  },
};

describe('catalog API provider', () => {
  let service: CatalogBrowserService;
  let http: HttpTestingController;
  const choice = signal<PublicContentChoice>({
    status: 'ready',
    sessionKey: null,
    sessionVersion: 0,
    showMatureContent: true,
  });
  beforeEach(() => {
    choice.set({
      status: 'ready',
      sessionKey: null,
      sessionVersion: 0,
      showMatureContent: true,
    });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PublicContentPreferencesService,
          useValue: {
            state: choice,
            changes$: of(null),
            reload: jest.fn(),
          },
        },
        provideHttpClient(),
        provideHttpClientTesting(),
        ...provideListingFeature({
          mode: 'api',
          apiUrl: 'https://gateway.test/',
        }).providers,
      ],
    });
    service = TestBed.inject(CatalogBrowserService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('preserves reviewed classification, hides mature/unclassified entries, and keeps source pagination', async () => {
    choice.set({ ...choice(), showMatureContent: false });
    const pending = firstValueFrom(service.browse(query));
    http
      .expectOne((request) => request.url.endsWith('/apps'))
      .flush({
        ...page,
        total: 3,
        items: [
          { ...app, classification: 'general' },
          {
            ...app,
            id: '10000000-0000-4000-8000-000000000004',
            slug: 'mature-app',
            classification: 'mature',
          },
          {
            ...app,
            id: '10000000-0000-4000-8000-000000000005',
            slug: 'legacy-app',
          },
        ],
      });
    const result = await pending;
    expect(result.items).toHaveLength(1);
    expect(result.items[0].classification).toBe('general');
    expect(result).toMatchObject({
      total: 3,
      hiddenCount: 2,
      page: 1,
      pageSize: 20,
    });
  });
  it('rejects a late response after the current account choice changes', async () => {
    const pending = firstValueFrom(service.browse(query));
    const rejected = expect(pending).rejects.toMatchObject({
      reason: 'loading',
    });
    choice.set({
      ...choice(),
      sessionVersion: 1,
      sessionKey: 'Bob',
      status: 'loading',
    });
    http.expectOne((request) => request.url.endsWith('/apps')).flush(page);
    await rejected;
  });

  it('uses the configured origin, preserves UUIDs/revisions and keeps unknown ratings unknown', async () => {
    const result = firstValueFrom(
      service.browse({
        ...query,
        search: ' Remote   app ',
        tags: ['topic', 'topic'],
        category: 'tools,design',
      })
    );
    const request = http.expectOne(
      (request) => request.url === 'https://gateway.test/api/catalog/apps'
    );
    expect(request.request.params.get('search')).toBe('Remote app');
    expect(request.request.params.get('tags')).toBe('topic');
    expect(request.request.params.get('category')).toBe('design,tools');
    request.flush(page);
    expect((await result).items).toEqual([
      expect.objectContaining({
        id: app.id,
        revision: 7,
        name: app.name,
        rating: undefined,
        date: new Date(app.createdAt),
      }),
    ]);
    expect(service.kinds).toEqual(['applications']);
  });

  it.each([
    { ...page, items: [{ ...app, id: 1 }] },
    { ...page, items: [{ ...app, logoUrl: 'javascript:alert(1)' }] },
    { ...page, pageSize: 10 },
    { ...page, total: 99 },
    { data: [app], meta: { total: 1 } },
  ])(
    'rejects invalid or incompatible responses instead of rendering them',
    async (response) => {
      const result = firstValueFrom(service.browse(query));
      const assertion = expect(result).rejects.toThrow();
      http
        .expectOne((request) => request.url.endsWith('/apps'))
        .flush(response);
      await assertion;
    }
  );

  it.each([400, 404, 503])(
    'propagates HTTP %s without demo or empty fallback',
    async (status) => {
      const result = firstValueFrom(service.browse(query));
      const assertion = expect(result).rejects.toMatchObject({ status });
      http
        .expectOne((request) => request.url.endsWith('/apps'))
        .flush({}, { status, statusText: 'Unavailable' });
      await assertion;
    }
  );

  it.each([
    { ...query, kind: 'articles' as const },
    { ...query, page: -1 },
    { ...query, unsupportedFilters: ['social'] },
    { ...query, tags: ['../private'] },
  ])('rejects unsupported queries before HTTP', async (input) => {
    await expect(firstValueFrom(service.browse(input))).rejects.toThrow();
    http.expectNone(() => true);
  });

  it('accepts an authoritative empty page and a server-clamped last page', async () => {
    const empty = firstValueFrom(service.browse({ ...query, page: 999 }));
    http
      .expectOne((request) => request.url.endsWith('/apps'))
      .flush({ ...page, items: [], total: 0 });
    expect((await empty).total).toBe(0);
    const last = firstValueFrom(service.browse({ ...query, page: 999 }));
    http.expectOne((request) => request.url.endsWith('/apps')).flush(page);
    expect((await last).page).toBe(1);
  });

  it('uses service taxonomy and does not invent directory counts or featured apps', async () => {
    const root = {
      id: '10000000-0000-4000-8000-000000000010',
      slug: 'remote-root',
      name: 'Remote root',
      parentId: null,
    };
    const child = {
      id: '10000000-0000-4000-8000-000000000011',
      slug: 'remote-child',
      name: 'Remote child',
      parentId: root.id,
    };
    const result = firstValueFrom(service.directory('category'));
    http
      .expectOne('https://gateway.test/api/catalog/facets')
      .flush({ ...page.facets, categories: [root, child] });
    expect(await result).toEqual([
      expect.objectContaining({
        slug: child.slug,
        parentName: root.name,
        appCount: null,
        featuredApps: null,
      }),
      expect.objectContaining({
        slug: root.slug,
        parentName: undefined,
        appCount: null,
        featuredApps: null,
      }),
    ]);
  });

  it('rejects a broken taxonomy graph and surfaces directory outages', async () => {
    const result = firstValueFrom(service.directory('tag'));
    const assertion = expect(result).rejects.toThrow();
    http.expectOne('https://gateway.test/api/catalog/facets').flush({
      ...page.facets,
      categories: [
        { id: app.id, slug: app.slug, name: app.name, parentId: app.id },
      ],
    });
    await assertion;
    const retry = firstValueFrom(service.directory('tag'));
    const failure = expect(retry).rejects.toMatchObject({ status: 503 });
    http
      .expectOne('https://gateway.test/api/catalog/facets')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await failure;
  });
});

it('requires explicit demo selection to expose bundled content', async () => {
  TestBed.configureTestingModule({
    providers: provideListingFeature({ mode: 'demo' }).providers,
  });
  const service = TestBed.inject(CatalogBrowserService);
  expect(
    (await firstValueFrom(service.browse({ ...query, search: 'Photo Snap' })))
      .items[0].slug
  ).toBe('photo-snap');
});
