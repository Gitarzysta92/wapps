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
import { TimelineMissingError, type TimelinePage } from '@domains/feed';
import { TIMELINE_PORT } from './timeline.port';
import { ApplicationTimelineService } from './application-timeline.service';

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
      .fn<Observable<Result<TimelinePage, Error>>, [string, string | null]>()
      .mockReturnValue(of(ok(page('first')))),
  };
  TestBed.configureTestingModule({
    providers: [
      {
        provide: PREFERENCES_SESSION,
        useValue: { key$: tokens, currentKey: () => tokens.value },
      },
      ApplicationTimelineService,
      { provide: TIMELINE_PORT, useValue: port },
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
    service: TestBed.inject(ApplicationTimelineService),
  };
}

function page(slug: string): TimelinePage {
  return {
    application: {
      id: '10000000-0000-4000-8000-000000000001',
      slug,
      name: slug,
    },
    items: [],
    after: null,
  };
}
describe('Application timeline state', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('filters suites by their own classification within an allowed parent timeline', () => {
    const h = setup();
    const result: TimelinePage = {
      ...page('first'),
      items: [
        {
          kind: 'suite',
          id: 'general',
          at: 2,
          title: 'General suite',
          target: { kind: 'suite', id: 'general' },
          categories: [],
          tags: [],
          engagement: null,
          classification: 'general',
        },
        {
          kind: 'suite',
          id: 'mature',
          at: 1,
          title: 'Mature suite',
          target: { kind: 'suite', id: 'mature' },
          categories: [],
          tags: [],
          engagement: null,
          classification: 'mature',
        },
      ],
      after: 'next-page',
    };
    h.port.read.mockReturnValue(of(ok(result)));
    h.service.open('first', null);
    expect(h.service.items().map((item) => item.id)).toEqual(['general']);
    expect(h.service.excluded()).toBe(1);
    expect(h.service.after()).toBe('next-page');
    const data = defaultAccountPreferences();
    data.content.showMatureContent = true;
    h.update({ data });
    expect(h.service.items()).toHaveLength(2);
    h.update({ context: null });
    expect(h.service.items()).toEqual([]);
    expect(h.service.application()).toBeNull();
  });
  it('does not read without a route and cancels a held response when the application changes', () => {
    const h = setup(),
      pending = new Subject<Result<TimelinePage, Error>>();
    expect(h.port.read).not.toHaveBeenCalled();
    h.port.read.mockReturnValue(pending);
    h.service.open('first', null);
    expect(pending.observed).toBe(true);
    h.port.read.mockReturnValue(of(ok(page('second'))));
    h.service.open('second', null);
    expect(pending.observed).toBe(false);
    pending.next(ok(page('first')));
    expect(h.service.application()?.slug).toBe('second');
    expect(h.port.read).toHaveBeenLastCalledWith('second', null);
  });
  it('clears application content on account changes and waits for matching saved preferences', () => {
    const h = setup();
    h.service.open('first', null);
    expect(h.service.loaded()).toBe(true);
    h.tokens.next('member-token');
    expect(h.service.application()).toBeNull();
    expect(h.service.loading()).toBe(true);
    h.update({ sessionKey: 'member-token', scope: 'account' });
    expect(h.service.application()?.slug).toBe('first');
    h.update({ isError: true });
    expect(h.service.application()).toBeNull();
    expect(h.service.error()).toContain('saved choices');
  });
  it('distinguishes missing content, unavailable sources and explicit recovery', () => {
    const h = setup();
    h.port.read.mockReturnValue(of(err(new TimelineMissingError('missing'))));
    h.service.open('first', null);
    expect(h.service.notFound()).toBe(true);
    h.port.read.mockReturnValue(of(err(new Error('offline'))));
    h.service.retry();
    expect(h.service.notFound()).toBe(false);
    expect(h.service.error()).toBe('offline');
    h.port.read.mockReturnValue(of(ok(page('first'))));
    h.service.retry();
    expect(h.service.loaded()).toBe(true);
  });
  it('replaces bounded pages, and refresh starts from the newest page', () => {
    const h = setup(),
      cursor = 'e1.' + 'a'.repeat(80);
    h.port.read.mockReturnValue(of(ok({ ...page('first'), after: cursor })));
    h.service.open('first', null);
    h.service.older();
    expect(h.port.read).toHaveBeenLastCalledWith('first', cursor);
    h.service.reload(true);
    expect(h.port.read).toHaveBeenLastCalledWith('first', null);
  });
});
