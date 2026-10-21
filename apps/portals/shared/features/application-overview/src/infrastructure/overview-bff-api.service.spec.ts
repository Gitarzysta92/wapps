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
import { CatalogApp } from '@domains/catalog/record';
import { ApplicationOverviewService } from '../application/application-overview.service';
import { provideApplicationOverviewFeature } from '../application-overview.providers';

const app: CatalogApp = {
  id: '10000000-0000-4000-8000-000000000001',
  revision: 4,
  slug: 'remote-app',
  name: 'Remote app',
  description: null,
  website: 'https://example.test',
  logoUrl: null,
  bannerUrl: 'https://example.test/banner.png',
  isPwa: true,
  estimatedNumberOfUsers: null,
  createdAt: '2026-10-11T10:00:00.000Z',
  updatedAt: '2026-10-11T11:00:00.000Z',
  categories: [
    {
      id: '10000000-0000-4000-8000-000000000002',
      name: 'Service category',
      slug: 'service-category',
    },
  ],
  tags: [],
  platforms: [],
  devices: [],
  monetizations: [],
  reviews: null,
};

describe('application overview API contract', () => {
  let service: ApplicationOverviewService;
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
        ...provideApplicationOverviewFeature({
          useBff: true,
          apiUrl: 'https://gateway.test/',
        }).providers,
      ],
    });
    service = TestBed.inject(ApplicationOverviewService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it.each(['mature', undefined] as const)(
    'hides %s details until the saved choice permits them',
    async (classification) => {
      choice.set({ ...choice(), showMatureContent: false });
      const pending = firstValueFrom(service.getOverview(app.slug));
      const rejected = expect(pending).rejects.toMatchObject({
        reason: 'hidden',
      });
      http
        .expectOne((request) => request.url.endsWith('/' + app.slug))
        .flush({ ...app, ...(classification ? { classification } : {}) });
      await rejected;
    }
  );
  it('preserves approved General classification through the overview mapper', async () => {
    choice.set({ ...choice(), showMatureContent: false });
    const pending = firstValueFrom(service.getOverview(app.slug));
    http
      .expectOne((request) => request.url.endsWith('/' + app.slug))
      .flush({ ...app, classification: 'general' });
    expect(await pending).toMatchObject({
      classification: 'general',
      name: app.name,
    });
  });
  it('rejects a late detail response after the account changes', async () => {
    const pending = firstValueFrom(service.getOverview(app.slug));
    const rejected = expect(pending).rejects.toMatchObject({
      reason: 'loading',
    });
    choice.set({
      ...choice(),
      sessionKey: 'Bob',
      sessionVersion: 1,
      status: 'loading',
    });
    http
      .expectOne((request) => request.url.endsWith('/' + app.slug))
      .flush(app);
    await rejected;
  });

  it('maps only validated canonical values, without fixture taxonomy or invented aggregates', async () => {
    const result = firstValueFrom(service.getOverview(app.slug));
    http
      .expectOne('https://gateway.test/api/catalog/apps/remote-app')
      .flush(app);
    expect(await result).toMatchObject({
      id: app.id,
      revision: 4,
      banner: app.bannerUrl,
      logo: null,
      website: app.website,
      categories: app.categories,
      listingDate: app.createdAt,
      updateDate: app.updatedAt,
      reviews: null,
      includedSuites: null,
      estimatedUsers: null,
    });
  });

  it.each([404, 503])(
    'preserves HTTP %s for the page state',
    async (status) => {
      const result = firstValueFrom(service.getOverview(app.slug));
      const assertion = expect(result).rejects.toMatchObject({ status });
      http
        .expectOne('https://gateway.test/api/catalog/apps/remote-app')
        .flush({}, { status, statusText: 'Failed' });
      await assertion;
    }
  );

  it.each([
    { ...app, slug: 'another-app' },
    { ...app, id: 1 },
    { ...app, website: 'javascript:alert(1)' },
    { ...app, reviews: { total: 0, rating: 4.8 } },
    { ...app, updatedAt: 'not a date' },
  ])('rejects mismatched or malformed applications', async (response) => {
    const result = firstValueFrom(service.getOverview(app.slug));
    const assertion = expect(result).rejects.toThrow();
    http
      .expectOne('https://gateway.test/api/catalog/apps/remote-app')
      .flush(response);
    await assertion;
  });

  it('rejects invalid slugs before making a request', async () => {
    await expect(
      firstValueFrom(service.getOverview('../private'))
    ).rejects.toThrow();
    http.expectNone(() => true);
  });

  it('keeps a measured zero reviews aggregate distinct from unavailable reviews', async () => {
    const result = firstValueFrom(service.getOverview(app.slug));
    http.expectOne('https://gateway.test/api/catalog/apps/remote-app').flush({
      ...app,
      reviews: { total: 0, rating: null },
      estimatedNumberOfUsers: 0,
    });
    expect(await result).toMatchObject({
      reviews: { total: 0, rating: null },
      estimatedUsers: 0,
    });
  });
});
