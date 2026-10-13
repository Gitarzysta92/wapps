import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { defaultAccountPreferences } from '@domains/customer/preferences';
import {
  PreferencesService,
  PREFERENCES_SESSION,
  type PreferencesState,
} from '@portals/shared/features/preferences';
import { MyFavoritesService } from '@portals/shared/features/my-favorites';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type { ExplorePage } from '@domains/feed';
import { EXPLORE_PORT } from './explore.port';
import { ExploreService } from './explore.service';

function setup() {
  const tokens = new BehaviorSubject<string | null>(null);
  const data = defaultAccountPreferences();
  const state = signal<PreferencesState>({
    isLoading: false,
    isError: false,
    data,
    scope: 'guest',
    sessionKey: null,
    sessionVersion: 0,
    context: {
      sessionKey: null,
      sessionVersion: 0,
      read: { data, account: null },
    },
  });
  const preferences$ = new BehaviorSubject(state());
  const favorites$ = new BehaviorSubject({
    isLoading: false,
    isError: false,
    context: null,
    data: { applications: [], suites: [], articles: [], discussions: [] },
  });
  const port = {
    read: jest
      .fn<Observable<Result<ExplorePage, Error>>, [string | null]>()
      .mockReturnValue(of(ok({ items: [], after: null }))),
  };
  TestBed.configureTestingModule({
    providers: [
      {
        provide: PREFERENCES_SESSION,
        useValue: { key$: tokens, currentKey: () => tokens.value },
      },
      ExploreService,
      { provide: EXPLORE_PORT, useValue: port },
      {
        provide: AUTHENTICATION_SESSION,
        useValue: { token$: tokens, getToken: () => tokens.value },
      },
      {
        provide: PreferencesService,
        useValue: {
          state,
          preferences$: preferences$,
          isError: () => state().isError,
          reload: jest.fn(),
        },
      },
      {
        provide: MyFavoritesService,
        useValue: {
          myFavorites$: favorites$,
          getState: () => favorites$.value,
          reload: jest.fn(),
        },
      },
    ],
  });
  const update = (next: Partial<PreferencesState>) => {
    state.set({ ...state(), ...next });
    preferences$.next(state());
  };
  return {
    port,
    state,
    preferences$,
    favorites$,
    tokens,
    update,
    service: TestBed.inject(ExploreService),
  };
}
describe('Explore state', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('filters mature and unclassified entries while keeping the original continuation and hidden count', () => {
    const h = setup();
    const page: ExplorePage = {
      items: [
        {
          kind: 'suite',
          id: 'general',
          at: 3,
          title: 'General',
          target: { kind: 'suite', id: 'general' },
          categories: [],
          tags: [],
          engagement: null,
          classification: 'general',
        },
        {
          kind: 'suite',
          id: 'mature',
          at: 2,
          title: 'Mature',
          target: { kind: 'suite', id: 'mature' },
          categories: [],
          tags: [],
          engagement: null,
          classification: 'mature',
        },
        {
          kind: 'suite',
          id: 'legacy',
          at: 1,
          title: 'Legacy',
          target: { kind: 'suite', id: 'legacy' },
          categories: [],
          tags: [],
          engagement: null,
        },
      ],
      after: 'next-page',
    };
    h.port.read.mockReturnValue(of(ok(page)));
    h.service.reload();
    expect(h.service.items().map((item) => item.id)).toEqual(['general']);
    expect(h.service.excluded()).toBe(2);
    expect(h.service.after()).toBe('next-page');
    const data = defaultAccountPreferences();
    data.content.showMatureContent = true;
    h.port.read.mockClear();
    h.update({ data });
    expect(h.port.read).toHaveBeenCalledTimes(1);
    expect(h.service.items()).toHaveLength(3);
    data.content.showMatureContent = false;
    h.port.read.mockReturnValue(
      of(ok({ ...page, items: page.items.slice(1) }))
    );
    h.update({ data: { ...data, content: { ...data.content } } });
    expect(h.service.items()).toEqual([]);
    expect(h.service.after()).toBe('next-page');
    h.service.older();
    expect(h.port.read).toHaveBeenLastCalledWith('next-page');
  });
  it('masks visible results synchronously and rejects a held response before preference notifications catch up', () => {
    const h = setup();
    const page: ExplorePage = {
      items: [
        {
          kind: 'suite',
          id: 'mature',
          at: 1,
          title: 'Mature',
          target: { kind: 'suite', id: 'mature' },
          categories: [],
          tags: [],
          engagement: null,
          classification: 'mature',
        },
      ],
      after: null,
    };
    const data = defaultAccountPreferences();
    data.content.showMatureContent = true;
    h.port.read.mockReturnValue(of(ok(page)));
    h.update({ data });
    expect(h.service.items()).toHaveLength(1);
    const hidden = {
      ...data,
      content: { ...data.content, showMatureContent: false },
    };
    h.state.set({ ...h.state(), data: hidden });
    expect(h.service.items()).toEqual([]);
    expect(h.service.loading()).toBe(true);
    h.preferences$.next(h.state());
    const pending = new Subject<Result<ExplorePage, Error>>();
    h.port.read.mockReturnValue(pending);
    h.update({ data });
    h.state.set({ ...h.state(), data: hidden });
    pending.next(ok(page));
    expect(h.service.items()).toEqual([]);
    h.preferences$.next(h.state());
    h.update({ context: null });
    expect(h.service.error()).toContain('saved choices');
    expect(h.service.loaded()).toBe(false);
  });
  it('loads guest pages, replaces older pages and resets to latest on refresh', () => {
    const h = setup();
    expect(h.service.loaded()).toBe(true);
    const cursor = 'e1.' + 'a'.repeat(80);
    h.port.read.mockReturnValue(of(ok({ items: [], after: cursor })));
    h.service.reload();
    h.service.older();
    expect(h.port.read).toHaveBeenLastCalledWith(cursor);
    h.service.reload(true);
    expect(h.port.read).toHaveBeenLastCalledWith(null);
  });
  it('cancels pending activity on a session switch and waits for the matching saved preferences', () => {
    const h = setup(),
      pending = new Subject<Result<ExplorePage, Error>>();
    h.port.read.mockReturnValue(pending);
    h.service.reload();
    expect(pending.observed).toBe(true);
    h.tokens.next('member-token');
    expect(pending.observed).toBe(false);
    expect(h.service.items()).toEqual([]);
    expect(h.service.loading()).toBe(true);
    h.port.read.mockReturnValue(of(ok({ items: [], after: null })));
    h.update({
      sessionKey: 'member-token',
      scope: 'account',
      sessionVersion: 1,
    });
    expect(h.service.loaded()).toBe(true);
    h.tokens.next(null);
    h.update({ sessionKey: null, scope: 'guest', sessionVersion: 2 });
    expect(h.service.loaded()).toBe(true);
  });
  it('does not display default choices when saved preferences are unavailable', () => {
    const h = setup();
    h.port.read.mockClear();
    h.update({ isError: true });
    expect(h.port.read).not.toHaveBeenCalled();
    expect(h.service.error()).toContain('saved choices');
    expect(h.service.items()).toEqual([]);
  });
  it('treats dependency failures as unavailable and preserves explicit retries', () => {
    const h = setup();
    h.port.read.mockReturnValue(of(err(new Error('offline'))));
    h.service.reload();
    expect(h.service.error()).toBe('offline');
    expect(h.service.loaded()).toBe(false);
    h.port.read.mockReturnValue(of(ok({ items: [], after: null })));
    h.service.retry();
    expect(h.service.error()).toBe('');
    expect(h.service.loaded()).toBe(true);
  });
  it('does not depend on favorites when personalization is disabled', () => {
    const h = setup();
    const data = defaultAccountPreferences();
    data.content.feedSortOrder = 'recommended';
    data.privacy.allowPersonalization = false;
    h.favorites$.next({ ...h.favorites$.value, isError: true });
    h.update({ data });
    expect(h.service.error()).toBe('');
    expect(h.service.loaded()).toBe(true);
    expect(h.service.personalizationDisabled()).toBe(true);
  });
});
