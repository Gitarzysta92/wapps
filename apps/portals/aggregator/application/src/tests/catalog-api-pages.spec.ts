import { provideMyFavoritesFeature } from '@portals/shared/features/my-favorites';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TUI_DARK_MODE } from '@taiga-ui/core';
import { CatalogApp } from '@domains/catalog/record';
import { provideListingFeature } from '@portals/shared/features/listing';
import { providePublicDiscovery } from '@portals/shared/features/search';
import { providePreferencesFeature } from '@portals/shared/features/preferences';
import { provideApplicationOverviewFeature } from '@portals/shared/features/application-overview';
import { provideQuickDiscussions } from '@portals/shared/features/discussion';
import { DiscoverPageComponent } from '../pages/discover/discover-page.component';
import { DISCOVER_REDIRECT_ROUTES } from '../pages/discover/discover-redirect.routes';
import { CategoryResultsPageComponent } from '../pages/category-results-page/category-results-page.component';
import { ApplicationOverviewPageComponent } from '../pages/application-overview-page/application-overview-page.component';

const category = {
  id: '10000000-0000-4000-8000-000000000002',
  name: 'API category',
  slug: 'api-category',
  parentId: null,
};
const tag = {
  id: '10000000-0000-4000-8000-000000000003',
  name: 'API topic',
  slug: 'api-topic',
};
const app: CatalogApp = {
  classification: 'general',
  id: '10000000-0000-4000-8000-000000000001',
  revision: 4,
  slug: 'api-app',
  name: 'API application',
  description: 'A real catalog record.',
  website: 'https://example.test',
  logoUrl: null,
  bannerUrl: null,
  isPwa: false,
  estimatedNumberOfUsers: null,
  createdAt: '2026-10-11T10:00:00.000Z',
  updatedAt: '2026-10-11T10:00:00.000Z',
  categories: [category],
  tags: [tag],
  platforms: [],
  devices: [],
  monetizations: [],
  reviews: null,
};
const facets = {
  categories: [category],
  tags: [tag],
  platforms: [],
  devices: [],
  monetizations: [],
};
const page = {
  items: [app],
  total: 1,
  page: 1,
  pageSize: 20,
  totalPages: 1,
  facets,
};
const discoveryPage = {
  groups: [
    {
      kind: 'application',
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      items: [
        {
          id: app.id,
          revision: app.revision,
          slug: app.slug,
          title: app.name,
          summary: app.description,
          classification: 'general',
          at: Date.parse(app.createdAt),
          categories: [category.id, category.slug],
          tags: [tag.id, tag.slug],
        },
      ],
    },
  ],
};

async function settle(harness: RouterTestingHarness) {
  harness.detectChanges();
  await harness.fixture.whenStable();
  harness.detectChanges();
}

describe('catalog API page composition', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideQuickDiscussions(''),
        {
          provide: AUTHENTICATION_SESSION,
          useValue: { token$: of(null), getToken: () => null },
        },
        ...provideMyFavoritesFeature({ mode: 'api', apiBaseUrl: '' }).providers,
        { provide: TUI_DARK_MODE, useValue: signal(false) },
        ...provideListingFeature({ mode: 'api' }).providers,
        ...providePublicDiscovery(''),
        ...providePreferencesFeature({ mode: 'api', apiBaseUrl: '' }).providers,
        ...provideApplicationOverviewFeature({ useBff: true }).providers,
        provideRouter(
          [
            { path: 'discover', component: DiscoverPageComponent },
            ...DISCOVER_REDIRECT_ROUTES,
            { path: 'categories', component: CategoryResultsPageComponent },
            {
              path: 'apps/:appSlug/overview',
              component: ApplicationOverviewPageComponent,
            },
          ],
          withComponentInputBinding()
        ),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('renders service search cards, retries outages and treats only successful empty pages as empty', async () => {
    const harness = await RouterTestingHarness.create('/app?search=API');
    expect(harness.routeNativeElement!.textContent).not.toContain(
      'No results found'
    );
    http
      .expectOne((request) => request.url === '/api/catalog/discover')
      .flush(discoveryPage);
    await settle(harness);
    const root = () => harness.routeNativeElement!;
    expect(
      root().querySelector('.discovery-card a')!.getAttribute('href')
    ).toBe('/apps/api-app');
    expect(root().textContent).toContain('A real catalog record.');
    expect(root().textContent).not.toContain('Photo Snap');
    expect(root().textContent).not.toContain('0 rating');
    await harness.navigateByUrl('/app?search=new');
    http
      .expectOne((request) => request.url === '/api/catalog/discover')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await settle(harness);
    expect(root().textContent).toContain('Discover unavailable');
    expect(root().textContent).not.toContain('No results found');
    expect(root().querySelector('.discovery-card')).toBeNull();
    root().querySelector<HTMLButtonElement>('ui-content-state button')!.click();
    harness.detectChanges();
    http
      .expectOne((request) => request.url === '/api/catalog/discover')
      .flush({ groups: [{ ...discoveryPage.groups[0], items: [], total: 0 }] });
    await settle(harness);
    expect(root().textContent).toContain('No matching results on this page');
  });

  it('renders the service directory without invented app counts, and retries taxonomy failure', async () => {
    const harness = await RouterTestingHarness.create('/categories');
    expect(harness.routeNativeElement!.textContent).toContain(
      'Loading categories'
    );
    http
      .expectOne('/api/catalog/facets')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await settle(harness);
    expect(harness.routeNativeElement!.textContent).toContain(
      'Could not load the directory'
    );
    expect(harness.routeNativeElement!.textContent).not.toContain(
      'No categories found'
    );
    harness
      .routeNativeElement!.querySelector<HTMLButtonElement>(
        'ui-content-state button'
      )!
      .click();
    harness.detectChanges();
    http.expectOne('/api/catalog/facets').flush(facets);
    await settle(harness);
    const card = harness.routeNativeElement!.querySelector('.directory-card')!;
    expect(card.querySelector('.directory-link')!.getAttribute('href')).toBe(
      '/categories/api-category'
    );
    expect(card.querySelector('.app-count')).toBeNull();
    expect(card.querySelector('.featured-apps')).toBeNull();
    expect(card.textContent).not.toContain('No apps listed yet');
  });

  it('uses resolved detail labels, exposes a real website, and keeps unknown metrics and community separate from zero', async () => {
    const harness = await RouterTestingHarness.create('/apps/api-app/overview');
    http.expectOne('/api/catalog/apps/api-app').flush(app);
    await settle(harness);
    http
      .expectOne(`/api/application-discussions/${app.id}`)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    http
      .expectOne(`/api/application-reviews/${app.id}/summary`)
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await settle(harness);
    const root = harness.routeNativeElement!;
    expect(root.querySelector('h1')!.textContent).toContain(app.name);
    expect(
      root.querySelector('a[href="/categories/api-category"]')
    ).not.toBeNull();
    expect(root.querySelector('a[href="/tags/api-topic"]')).not.toBeNull();
    expect(
      root.querySelector('a[href="https://example.test"]')!.getAttribute('rel')
    ).toBe('noopener noreferrer');
    expect(root.textContent).toContain('Member ratings unavailable');
    expect(root.textContent).toContain('Discussion previews unavailable');
    expect(root.textContent).not.toContain('0 reviews');
    expect(root.textContent).not.toContain('No discussions yet');
    expect(
      root.querySelector<HTMLButtonElement>('favorite-toggle-button button')
        ?.disabled
    ).toBe(true);
    expect(root.querySelector('.suite-card')).toBeNull();
    root
      .querySelector<HTMLButtonElement>('application-review-summary button')
      ?.click();
    harness.detectChanges();
    http.expectOne(`/api/application-reviews/${app.id}/summary`).flush({
      total: 2,
      average: 4.5,
      distribution: [0, 0, 0, 1, 1],
    });
    await settle(harness);
    expect(
      root.querySelector('application-review-summary')?.textContent
    ).toContain('4.5/5 from members');
    expect(
      root.querySelector('application-review-summary a')?.getAttribute('href')
    ).toBe('/apps/api-app/reviews');
  });

  it('distinguishes missing authoritative records from projection lag or outage', async () => {
    const harness = await RouterTestingHarness.create('/apps/api-app/overview');
    http
      .expectOne('/api/catalog/apps/api-app')
      .flush({}, { status: 503, statusText: 'Projection pending' });
    await settle(harness);
    expect(harness.routeNativeElement!.textContent).toContain(
      'Unable to load application'
    );
    expect(harness.routeNativeElement!.textContent).not.toContain(
      'Application not found'
    );
    harness
      .routeNativeElement!.querySelector<HTMLButtonElement>(
        'ui-content-state button'
      )!
      .click();
    harness.detectChanges();
    http
      .expectOne('/api/catalog/apps/api-app')
      .flush({}, { status: 404, statusText: 'Not found' });
    await settle(harness);
    expect(harness.routeNativeElement!.textContent).toContain(
      'Application not found'
    );
  });

  it('does not silently ignore unsupported filters in bookmarked URLs', async () => {
    const harness = await RouterTestingHarness.create(
      '/discover?social=github'
    );
    await settle(harness);
    http.expectNone(() => true);
    expect(harness.routeNativeElement!.textContent).toContain(
      'Adjust your search'
    );
    expect(harness.routeNativeElement!.textContent).not.toContain(
      'No results found'
    );
    const clear = [...harness.routeNativeElement!.querySelectorAll('a')].find(
      (link) => link.textContent?.trim() === 'Start a new search'
    );
    if (!clear) throw new Error('Unsupported filters need a clear action');
    clear.click();
    await settle(harness);
    http
      .expectOne((request) => request.url === '/api/catalog/discover')
      .flush({
        groups: [
          ...discoveryPage.groups,
          ...['article', 'suite'].map((kind) => ({
            kind,
            total: 0,
            page: 1,
            pageSize: 20,
            totalPages: 1,
            items: [],
          })),
        ],
      });
    await settle(harness);
    expect(
      harness.routeNativeElement!.querySelector('.discovery-card a')
        ?.textContent
    ).toContain(app.name);
  });
});
