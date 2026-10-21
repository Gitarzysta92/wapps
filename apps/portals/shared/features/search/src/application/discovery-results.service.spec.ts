import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { defaultAccountPreferences } from '@domains/customer/preferences';
import type {
  PublicDiscoveryQuery,
  PublicDiscoveryResult,
} from '@domains/discovery';
import {
  PreferencesService,
  type PreferencesState,
} from '@portals/shared/features/preferences';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { err, ok, type Result } from '@sdk/kernel/standard';
import { PUBLIC_DISCOVERY } from './public-discovery.port';
import { DiscoveryResultsService } from './discovery-results.service';

function setup() {
  const token = new BehaviorSubject<string | null>(null);
  const state = signal<PreferencesState>({
    isLoading: false,
    isError: false,
    data: defaultAccountPreferences(),
    scope: 'guest',
    sessionKey: null,
    sessionVersion: 0,
    context: null,
  });
  const preferences$ = new BehaviorSubject(state());
  const port = {
    search: jest
      .fn<
        Observable<Result<PublicDiscoveryResult, Error>>,
        [PublicDiscoveryQuery]
      >()
      .mockImplementation((query) =>
        of(
          ok<PublicDiscoveryResult>({
            groups: query.kinds.map((kind) => ({
              kind,
              items: [],
              total: 0,
              page: 1,
              pageSize: query.pageSize,
              totalPages: 1,
            })),
          })
        )
      ),
  };
  const reload = jest.fn();
  TestBed.configureTestingModule({
    providers: [
      DiscoveryResultsService,
      { provide: PUBLIC_DISCOVERY, useValue: port },
      {
        provide: AUTHENTICATION_SESSION,
        useValue: { token$: token, getToken: () => token.value },
      },
      {
        provide: PreferencesService,
        useValue: {
          state,
          preferences$,
          isError: () => state().isError,
          reload,
        },
      },
    ],
  });
  const update = (patch: Partial<PreferencesState>) => {
    state.set({ ...state(), ...patch });
    preferences$.next(state());
  };
  return {
    state,
    token,
    port,
    reload,
    update,
    service: TestBed.inject(DiscoveryResultsService),
  };
}
describe('API discovery state', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => TestBed.resetTestingModule());
  it('waits for saved choices, applies saved size/view, and honors explicit URL choices', () => {
    const h = setup();
    h.update({ isLoading: true });
    h.service.search({ q: 'work' });
    expect(h.service.loading()).toBe(true);
    expect(h.port.search).not.toHaveBeenCalled();
    const data = defaultAccountPreferences();
    data.display.defaultView = 'list';
    data.display.itemsPerPage = 100;
    h.update({ isLoading: false, data });
    expect(h.service.view()).toBe('list');
    expect(h.service.query()?.pageSize).toBe(100);
    h.service.search({ search: 'work', pageSize: '10', view: 'grid' });
    expect(h.service.view()).toBe('grid');
    expect(h.service.query()?.pageSize).toBe(10);
  });
  it('clears previous results on invalid filters, preferences failure and source outage', () => {
    const h = setup();
    h.service.search({});
    expect(h.service.groups()).toHaveLength(3);
    h.service.search({ type: 'suite', category: 'private' });
    expect(h.service.invalid()).toBe(true);
    expect(h.service.groups()).toBeNull();
    h.service.search({});
    h.update({ isError: true });
    expect(h.service.groups()).toBeNull();
    expect(h.service.error()).toContain('saved choices');
    h.service.retry();
    expect(h.reload).toHaveBeenCalled();
    h.port.search.mockReturnValue(of(err(new Error('Source offline'))));
    h.update({ isError: false });
    expect(h.service.error()).toBe('Source offline');
    expect(h.service.groups()).toBeNull();
  });
  it('cancels older queries and prevents late session responses from becoming visible', () => {
    const h = setup();
    const old = new Subject<Result<PublicDiscoveryResult, Error>>(),
      cancelled = jest.fn();
    h.port.search.mockReturnValueOnce(
      new Observable((subscriber) => {
        const subscription = old.subscribe(subscriber);
        return () => {
          subscription.unsubscribe();
          cancelled();
        };
      })
    );
    h.service.search({ search: 'old' });
    h.service.search({ search: 'new' });
    expect(cancelled).toHaveBeenCalledTimes(1);
    old.next(err(new Error('stale')));
    expect(h.service.error()).toBe('');
    h.token.next('other-account');
    expect(h.service.groups()).toBeNull();
    expect(h.service.loading()).toBe(true);
    h.update({ sessionKey: 'other-account', scope: 'account' });
    expect(h.service.groups()).toHaveLength(3);
  });
  it('applies category exclusions without changing the source total and never personalizes order', () => {
    const h = setup();
    const data = defaultAccountPreferences();
    data.privacy.allowPersonalization = false;
    data.content.feedSortOrder = 'recommended';
    data.content.contentFilters.excludedCategories = ['work'];
    h.update({ data });
    h.port.search.mockReturnValue(
      of(
        ok<PublicDiscoveryResult>({
          groups: [
            {
              kind: 'article' as const,
              page: 1,
              pageSize: 20,
              total: 1,
              totalPages: 1,
              items: [
                {
                  id: 'article',
                  revision: 1,
                  slug: 'guide',
                  title: 'Guide',
                  classification: 'general',
                  summary: '',
                  at: 0,
                  categories: ['Work'],
                  tags: [],
                },
              ],
            },
          ],
        })
      )
    );
    h.service.search({ type: 'article' });
    expect(h.service.groups()?.[0]).toMatchObject({
      hidden: 1,
      total: 1,
      items: [],
    });
    expect(h.service.query()?.sort).toBe('name');
  });
  it('reloads on mature-choice changes and clears mature results while preferences load', () => {
    const h = setup();
    h.port.search.mockReturnValue(
      of(
        ok<PublicDiscoveryResult>({
          groups: [
            {
              kind: 'article',
              page: 1,
              pageSize: 20,
              total: 3,
              totalPages: 1,
              items: ([undefined, 'general', 'mature'] as const).map(
                (classification, index) => ({
                  id: String(index),
                  revision: 1,
                  slug: `article-${index}`,
                  title: 'Article',
                  summary: '',
                  at: 0,
                  categories: [],
                  tags: ['offline', 'web'],
                  ...(classification === 'general' ||
                  classification === 'mature'
                    ? { classification }
                    : {}),
                })
              ),
            },
          ],
        })
      )
    );
    h.service.search({ type: 'article', tags: 'web,offline' });
    expect(h.port.search).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ['offline', 'web'] }));
    expect(h.service.groups()?.[0].items.map((item) => item.id)).toEqual(['1']);
    expect(h.service.groups()?.[0].hidden).toBe(2);
    const data = defaultAccountPreferences();
    data.content.showMatureContent = true;
    h.update({ data });
    expect(h.service.groups()?.[0].items).toHaveLength(3);
    h.update({ isLoading: true });
    expect(h.service.groups()).toBeNull();
    h.update({ isLoading: false, data: defaultAccountPreferences() });
    expect(h.service.groups()?.[0].items.map((item) => item.id)).toEqual(['1']);
    expect(h.port.search).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ['offline', 'web'] }));
  });
});
