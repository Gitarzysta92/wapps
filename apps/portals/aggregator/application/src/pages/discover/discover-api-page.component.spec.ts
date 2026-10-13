import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BehaviorSubject, of } from 'rxjs';
import { TUI_DARK_MODE } from '@taiga-ui/core';
import { defaultAccountPreferences } from '@domains/customer/preferences';
import type { PublicDiscoveryQuery } from '@domains/discovery';
import {
  PreferencesService,
  type PreferencesState,
} from '@portals/shared/features/preferences';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { PUBLIC_DISCOVERY } from '@portals/shared/features/search';
import { ok } from '@sdk/kernel/standard';
import { DiscoverApiPageComponent } from './discover-api-page.component';
import { DISCOVER_REDIRECT_ROUTES } from './discover-redirect.routes';

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
  const search = jest.fn((q: PublicDiscoveryQuery) =>
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
              categories: [],
              tags: [],
            },
          ],
        })),
      })
    )
  );
  TestBed.configureTestingModule({
    providers: [
      provideNoopAnimations(),
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
  beforeEach(() => localStorage.clear());
  afterEach(() => TestBed.resetTestingModule());
  it('renders three real groups, durable destinations and saved display choices', async () => {
    setup();
    const h = await RouterTestingHarness.create('/discover');
    await settle(h);
    expect(
      h.routeNativeElement?.querySelectorAll('.discovery-group')
    ).toHaveLength(3);
    expect(
      h.routeNativeElement?.querySelectorAll('.discovery-grid--list')
    ).toHaveLength(3);
    expect(
      h.routeNativeElement?.querySelector('article a')?.getAttribute('href')
    ).toBe('/apps/application-result');
    expect(
      h.routeNativeElement
        ?.querySelector('#suite article a')
        ?.getAttribute('href')
    ).toBe('/suites/10000000-0000-4000-8000-000000000003');
  });
  it('restores legacy queries and submits current edits without the old q alias', async () => {
    const { search } = setup();
    const h = await RouterTestingHarness.create(
      '/search?q=guide&type=articles'
    );
    await settle(h);
    const input =
      h.routeNativeElement!.querySelector<HTMLInputElement>(
        'input[type=search]'
      )!;
    expect(input.value).toBe('guide');
    input.value = 'team';
    input.dispatchEvent(new Event('input'));
    h.routeNativeElement!.querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit')
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
    const select = h.routeNativeElement!.querySelectorAll('select')[1];
    select.value = 'newest';
    select.dispatchEvent(new Event('change'));
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
});
