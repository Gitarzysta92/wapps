import { CatalogBrowserService } from '@portals/shared/features/listing';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { TUI_DARK_MODE } from '@taiga-ui/core';
import { defaultAccountPreferences } from '@domains/customer/preferences';
import type { PublicDiscoveryQuery } from '@domains/discovery';
import {
  PreferencesService,
  type PreferencesState,
} from '@portals/shared/features/preferences';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { PUBLIC_DISCOVERY, type PublicDiscoveryPort } from '@portals/shared/features/search';
import { MyFavoritesService } from '@portals/shared/features/my-favorites';
import { err, ok } from '@sdk/kernel/standard';
import { DiscoverApiPageComponent } from './discover-api-page.component';
import { DISCOVER_REDIRECT_ROUTES } from './discover-redirect.routes';
import { GlobalStateService } from '../../state/global-state.service';

function setup() {
  const data = defaultAccountPreferences();
  data.display.defaultView = 'list';
  data.display.itemsPerPage = 10;
  const state = signal<PreferencesState>({
    data,
    scope: 'guest',
    isLoading: false,
    isError: false,
    sessionKey: null,
    sessionVersion: 0,
    context: null,
  });
  const preferences$ = new BehaviorSubject(state());
  const search = jest.fn((q: PublicDiscoveryQuery): ReturnType<PublicDiscoveryPort['search']> =>
    of(
      ok({
        groups: q.kinds.map((kind) => ({
          kind,
          total: 21,
          page: q.pages[kind],
          pageSize: q.pageSize,
          totalPages: Math.ceil(21 / q.pageSize),
          items: [
            {
              id: `10000000-0000-4000-8000-00000000000${
                kind === 'application' ? 1 : kind === 'article' ? 2 : 3
              }`,
              title: `${kind} ${q.search || 'result'}`,
              slug: kind === 'suite' ? null : `${kind}-result`,
              summary: 'Public approved content',
              classification: 'general' as const,
              revision: 1,
              at: Date.UTC(2026, 9, 13),
              categories: ['design'],
              tags: ['tag-id', 'work'],
              displayTags: [{ slug: 'work', name: 'Work tools' }],
              details: kind === 'application' ? { kind: 'application' as const, logoUrl: 'https://example.test/logo.png',
                reviews: { total: 1, rating: 4, preview: { id: '10000000-0000-4000-8000-000000000004', byline: 'Reviewer', rating: 4, text: 'A useful tool', publishedAt: 1000 } },
              } : kind === 'article' ? { kind: 'article' as const, byline: 'Article writer', cover: null } : {
                kind: 'suite' as const, applicationCount: 1, applications: [{ id: '10000000-0000-4000-8000-000000000005', slug: 'member-app', name: 'Member app', logoUrl: null, classification: 'general' as const }],
              },
            },
          ],
        })),
      })
    )
  );
  TestBed.configureTestingModule({
    providers: [
      GlobalStateService,
      { provide: MyFavoritesService, useValue: { mode: 'api', myFavorites$: of({ sessionVersion: 0 }), supports: () => true, isFavorite$: () => of(false) } },
      provideNoopAnimations(),
      { provide: CatalogBrowserService, useValue: { contentChoice: signal({ status: 'ready' }), browse: () => of({ facets: { categories: [], tags: [], platforms: [], devices: [], monetizations: [] } }) } },
      { provide: TUI_DARK_MODE, useValue: signal(false) },
      provideRouter([
        { path: 'discover', component: DiscoverApiPageComponent },
        ...DISCOVER_REDIRECT_ROUTES,
      ]),
      { provide: PUBLIC_DISCOVERY, useValue: { search } },
      {
        provide: AUTHENTICATION_SESSION,
        useValue: { token$: of(null), getToken: () => null },
      },
      {
        provide: PreferencesService,
        useValue: {
          state,
          preferences$,
          isError: () => false,
          reload: jest.fn(),
          dateFormat: computed(() =>
            state().data.display.dateFormat === 'YYYY-MM-DD'
              ? 'yyyy-MM-dd'
              : 'dd/MM/yyyy'
          ),
        },
      },
    ],
  });
  return { search, state, preferences$ };
}
async function settle(harness: RouterTestingHarness) {
  harness.detectChanges();
  await harness.fixture.whenStable();
  harness.detectChanges();
}
describe('real-provider Discover page', () => {
  const observer = globalThis.IntersectionObserver;
  beforeEach(() => {
    localStorage.clear();
    globalThis.IntersectionObserver = jest.fn(() => ({ observe: jest.fn(), disconnect: jest.fn() })) as unknown as typeof IntersectionObserver;
  });
  afterAll(() => { globalThis.IntersectionObserver = observer; });
  afterEach(() => TestBed.resetTestingModule());
  it('renders three real groups, durable destinations and saved display choices', async () => {
    setup();
    const h = await RouterTestingHarness.create('/discover');
    await settle(h);
    expect(
      h.routeNativeElement?.querySelectorAll('.discovery-group')
    ).toHaveLength(3);
    expect(
      h.routeNativeElement?.querySelectorAll('.results-list--list')
    ).toHaveLength(3);
    expect(
      h.routeNativeElement?.querySelector('.result-link')?.getAttribute('href')
    ).toBe('/apps/application-result/overview');
    expect(
      h.routeNativeElement
        ?.querySelector('#suite .result-link')
        ?.getAttribute('href')
    ).toBe('/suites/10000000-0000-4000-8000-000000000003');
    expect(h.routeNativeElement?.querySelectorAll('#application ui-tags a')).toHaveLength(1);
    expect(h.routeNativeElement?.querySelector('#application ui-tags a')?.getAttribute('href')).toBe('/tags/work');
    expect(h.routeNativeElement?.querySelector('#application top-review-card')?.textContent).toContain('A useful tool');
    expect(h.routeNativeElement?.querySelector('#article article-author-info')?.textContent).toContain('Article writer');
    expect(h.routeNativeElement?.querySelector('#article .card-actions-toggle')).toBeNull();
    expect(h.routeNativeElement?.querySelector('#suite suite-app-avatars')).not.toBeNull();
    expect(h.routeNativeElement?.querySelector('#application app-avatar img')?.getAttribute('src')).toBe('https://example.test/logo.png');
    expect(h.routeNativeElement?.querySelector('#article ui-tags a')?.getAttribute('href')).toBe('/tags/work');
    expect(h.routeNativeElement?.querySelector('#application top-review-card a')?.getAttribute('href')).toBe('/apps/application-result/review/10000000-0000-4000-8000-000000000004');
    expect(h.routeNativeElement?.querySelector('.results-summary')?.textContent).toContain('63 results');
    expect(h.routeNativeElement?.querySelector('#suite app-rating')?.textContent).toContain('Rating unavailable');
    expect(h.routeNativeElement?.querySelectorAll('app-voting-chip')).toHaveLength(2);
    expect(h.routeNativeElement?.querySelector('app-voting-chip')?.textContent).toContain('Votes unavailable');
    expect(h.routeNativeElement?.querySelector('discussion-chip')?.textContent).toContain('Comments count unavailable');
    expect(h.routeNativeElement?.querySelector('profile-badges')).toBeNull();
  });
  it('restores legacy queries and submits current edits without the old q alias', async () => {
    const { search } = setup();
    const h = await RouterTestingHarness.create(
      '/search?q=guide&type=articles'
    );
    await settle(h);
    expect(h.routeDebugElement!.componentInstance.filterSelections().type).toEqual(['article']);
    const input =
      h.routeNativeElement!.querySelector<HTMLInputElement>(
        'search-bar input'
      )!;
    expect(input.value).toBe('guide');
    input.value = 'team';
    input.dispatchEvent(new Event('input'));
    h.routeNativeElement!.querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );
    await settle(h);
    expect(TestBed.inject(Router).url).toContain('search=team');
    expect(TestBed.inject(Router).url).not.toContain('q=');
    expect(search.mock.calls.at(-1)?.[0].kinds).toEqual(['article']);
    await h.navigateByUrl('/discover?q=restored');
    await settle(h);
    expect(input.value).toBe('restored');
  });
  it('preserves other group positions on paging and resets pages after sort changes', async () => {
    const { search } = setup();
    const h = await RouterTestingHarness.create('/discover?articlePage=2');
    await settle(h);
    h.routeNativeElement!.querySelector<HTMLButtonElement>(
      'button[aria-label="Next Applications page"]'
    )!.click();
    await settle(h);
    expect(search.mock.calls.at(-1)?.[0].pages).toEqual({
      application: 2,
      article: 2,
      suite: 1,
    });
    const component = h.routeDebugElement!.componentInstance as DiscoverApiPageComponent;
    component.change({ sort: 'newest' });
    await settle(h);
    expect(search.mock.calls.at(-1)?.[0].pages).toEqual({
      application: 1,
      article: 1,
      suite: 1,
    });
  });
  it('clears results for invalid legacy filters and exposes a recovery link', async () => {
    setup();
    const h = await RouterTestingHarness.create('/discover');
    await h.navigateByUrl('/discover?social=github');
    await settle(h);
    expect(h.routeNativeElement?.textContent).toContain('Adjust your search');
    expect(h.routeNativeElement?.querySelector('article')).toBeNull();
    expect(h.routeNativeElement?.textContent).toContain('Start a new search');
  });

  it('restores the accepted loading skeletons, reports dependency failure and retries the same query', async () => {
    const { search } = setup();
    const pending = new Subject<never>();
    search.mockReturnValueOnce(pending);
    const h = await RouterTestingHarness.create('/discover?search=team');
    await settle(h);
    expect(h.routeNativeElement?.querySelectorAll('ui-elevated-card-skeleton')).toHaveLength(6);
    expect(h.routeNativeElement?.querySelector('article-author-info-skeleton')).not.toBeNull();
    search.mockReturnValueOnce(of(err(new Error('Search backend unavailable'))));
    pending.error(new Error('offline'));
    await settle(h);
    const component = h.routeDebugElement!.componentInstance as DiscoverApiPageComponent;
    component.results.retry();
    await settle(h);
    expect(h.routeNativeElement?.textContent).toContain('Search backend unavailable');
    expect(h.routeNativeElement?.querySelector('.item-card')).toBeNull();
    [...h.routeNativeElement!.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Retry search')!.click();
    await settle(h);
    expect(search.mock.calls.at(-1)?.[0].search).toBe('team');
    expect(h.routeNativeElement?.querySelectorAll('.item-card')).toHaveLength(3);
  });

  it('retains pagination when saved choices hide every item on the current page', async () => {
    const { state, preferences$ } = setup();
    const h = await RouterTestingHarness.create('/discover');
    await settle(h);
    state.set({ ...state(), data: { ...state().data, content: { ...state().data.content,
      contentFilters: { ...state().data.content.contentFilters, excludedCategories: ['design'] },
    } } });
    preferences$.next(state());
    await settle(h);
    expect(h.routeNativeElement?.textContent).toContain('No visible results on this page');
    expect(h.routeNativeElement!.querySelector<HTMLButtonElement>('button[aria-label="Next Applications page"]')!.disabled).toBe(false);
  });

  it('allows the supported article multi-tag filter and resets paging on changes', async () => {
    const { search } = setup();
    const h = await RouterTestingHarness.create('/discover?type=article&articlePage=2');
    await settle(h);
    const component = h.routeDebugElement!.componentInstance as DiscoverApiPageComponent;
    expect(component.filterDefinitions().find(filter => filter.key === 'tag')?.singleSelection).not.toBe(true);
    component.change({ tag: 'work,design' });
    await settle(h);
    expect(search.mock.calls.at(-1)?.[0].tags).toEqual(['design', 'work']);
    expect(search.mock.calls.at(-1)?.[0].pages.article).toBe(1);
  });
});
