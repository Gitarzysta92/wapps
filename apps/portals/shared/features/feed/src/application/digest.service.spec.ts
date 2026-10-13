import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Observable, of, Subject, throwError } from 'rxjs';
import { defaultAccountPreferences } from '@domains/customer/preferences';
import {
  PreferencesService,
  PREFERENCES_SESSION,
  type PreferencesState,
} from '@portals/shared/features/preferences';
import {
  MyFavoritesService,
  emptyFavorites,
  type MyFavoritesState,
} from '@portals/shared/features/my-favorites';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type { DigestContent, ExploreItem } from '@domains/feed';
import { DIGEST_PORT } from './digest.port';
import { DigestService } from './digest.service';

const entries: ExploreItem[] = [1, 2, 3, 4].map((n) => ({
  kind: 'discussion',
  classification: 'general',
  id: `topic-${n}`,
  title: `Topic ${n}`,
  at: 10000 - n,
  target: {
    kind: 'discussion',
    id: `topic-${n}`,
    applicationId: 'app',
    applicationSlug: 'app',
  },
  categories: ['category'],
  tags: [],
  engagement: n,
}));
const content: DigestContent = {
  latest: { items: entries, more: false },
  discussions: { items: entries, more: false },
  applications: { items: [], more: false },
  articles: { items: [], more: false },
};
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
  const favorites$ = new BehaviorSubject<MyFavoritesState>({
    isLoading: false,
    isError: false,
    isSaving: false,
    signedIn: false,
    sessionKey: null,
    sessionVersion: 0,
    context: null,
    data: emptyFavorites(),
  });
  const port = {
    read: jest
      .fn<Observable<Result<DigestContent, Error>>, []>()
      .mockReturnValue(of(ok(content))),
  };
  const preferenceReload = jest.fn(),
    favoriteReload = jest.fn();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: PREFERENCES_SESSION,
        useValue: { key$: tokens, currentKey: () => tokens.value },
      },
      DigestService,
      { provide: DIGEST_PORT, useValue: port },
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
          reload: preferenceReload,
        },
      },
      {
        provide: MyFavoritesService,
        useValue: {
          myFavorites$: favorites$,
          getState: () => favorites$.value,
          reload: favoriteReload,
        },
      },
    ],
  });
  const update = (next: Partial<PreferencesState>) => {
    state.set({ ...state(), ...next });
    preferences$.next(state());
  };
  const member = () => {
    tokens.next('member-token');
    const data = defaultAccountPreferences();
    data.content.feedSortOrder = 'recommended';
    data.privacy.allowPersonalization = true;
    update({
      data,
      sessionKey: 'member-token',
      scope: 'account',
      sessionVersion: 1,
      context: {
        sessionKey: 'member-token',
        sessionVersion: 1,
        read: {
          data,
          account: {
            identityId: 'member',
            revision: 1,
            updatedAt: 1000,
            preferences: data,
          },
        },
      },
    });
  };
  return {
    port,
    state,
    favorites$,
    tokens,
    update,
    member,
    preferenceReload,
    favoriteReload,
    service: TestBed.inject(DigestService),
  };
}
describe('Digest saved choices and sessions', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('filters each selection using current classification and clears both content and hidden counts on a preference failure', () => {
    const h = setup();
    const mixed = entries.map((entry, index) => ({
      ...entry,
      classification:
        index === 0
          ? ('general' as const)
          : index === 1
          ? ('mature' as const)
          : undefined,
    }));
    h.port.read.mockReturnValue(
      of(
        ok({
          ...content,
          latest: { items: mixed, more: true },
          discussions: { items: mixed, more: false },
        })
      )
    );
    h.service.reload();
    expect(h.service.content()?.latest.items).toHaveLength(1);
    expect(h.service.content()?.latest.hidden).toBe(3);
    expect(h.service.content()?.latest.more).toBe(true);
    const data = defaultAccountPreferences();
    data.content.showMatureContent = true;
    h.update({ data });
    expect(h.service.content()?.latest.items).toHaveLength(3);
    expect(h.service.content()?.latest.hidden).toBe(0);
    h.update({ isError: true });
    expect(h.service.content()).toBeNull();
  });
  it('loads a compact guest selection and applies exclusions before display', () => {
    const h = setup();
    expect(h.service.content()?.latest.items).toHaveLength(3);
    expect(h.service.content()?.discussions.items).toHaveLength(1);
    const data = defaultAccountPreferences();
    data.content.contentFilters.excludedCategories = ['category'];
    h.update({ data });
    expect(h.service.content()?.latest.items).toEqual([]);
    expect(h.service.content()?.discussions.items).toEqual([]);
  });
  it('cancels held responses and clears visible content on session and preference changes', () => {
    const h = setup(),
      pending = new Subject<Result<DigestContent, Error>>();
    h.port.read.mockReturnValue(pending);
    h.service.reload();
    expect(pending.observed).toBe(true);
    h.tokens.next('member-token');
    expect(pending.observed).toBe(false);
    expect(h.service.content()).toBeNull();
    expect(h.service.loading()).toBe(true);
    h.port.read.mockReturnValue(of(ok(content)));
    h.update({ sessionKey: 'member-token', scope: 'account' });
    expect(h.service.content()).not.toBeNull();
    h.port.read.mockReturnValue(pending);
    h.service.reload();
    h.update({ isLoading: true });
    expect(pending.observed).toBe(false);
    pending.next(ok(content));
    expect(h.service.content()).toBeNull();
  });
  it('waits for matching favorite identity before using recommendations and discards a former account', () => {
    const h = setup();
    h.member();
    expect(h.service.loading()).toBe(true);
    const data = { ...emptyFavorites(), discussions: ['topic-3'] };
    h.favorites$.next({
      ...h.favorites$.value,
      data,
      context: { identityId: 'other', revision: 1, data },
    });
    expect(h.service.content()).toBeNull();
    h.favorites$.next({
      ...h.favorites$.value,
      data,
      context: { identityId: 'member', revision: 1, data },
    });
    expect(h.service.content()?.latest.items[0].id).toBe('topic-3');
    h.tokens.next('another-token');
    expect(h.service.content()).toBeNull();
    expect(h.service.loading()).toBe(true);
  });
  it('fails saved choices truthfully, retries them, and ignores favorite failures when opted out', () => {
    const h = setup();
    h.update({ isError: true });
    expect(h.service.error()).toContain('saved choices');
    expect(h.service.content()).toBeNull();
    h.service.retry();
    expect(h.preferenceReload).toHaveBeenCalled();
    h.update({ isError: false });
    h.member();
    h.favorites$.next({ ...h.favorites$.value, isError: true });
    expect(h.service.error()).toContain('saved choices');
    h.service.retry();
    expect(h.favoriteReload).toHaveBeenCalled();
    const data = defaultAccountPreferences();
    data.content.feedSortOrder = 'recommended';
    data.privacy.allowPersonalization = false;
    h.update({ data });
    expect(h.service.error()).toBe('');
    expect(h.service.content()?.latest.items[0].id).toBe('topic-1');
    expect(h.service.personalizationDisabled()).toBe(true);
  });
  it('clears stale sections on source errors and recovers on explicit retry', () => {
    const h = setup();
    h.port.read.mockReturnValue(of(err(new Error('offline'))));
    h.service.reload();
    expect(h.service.content()).toBeNull();
    expect(h.service.error()).toBe('offline');
    h.port.read.mockReturnValue(throwError(() => new Error('transport')));
    h.service.retry();
    expect(h.service.error()).toContain('Digest could not be loaded');
    h.port.read.mockReturnValue(of(ok(content)));
    h.service.retry();
    expect(h.service.content()).not.toBeNull();
    expect(h.service.error()).toBe('');
  });
});
