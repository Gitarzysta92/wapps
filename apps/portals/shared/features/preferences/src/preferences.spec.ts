import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import {
  defaultAccountPreferences,
  type AccountPreferences,
} from '@domains/customer/preferences';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import {
  THEME_PREFERENCES,
  THEME_PROVIDER_CFG_TOKEN,
  ThemingService,
} from '@portals/cross-cutting/theming';
import { providePreferencesFeature } from './preferences.providers';
import { PreferencesService } from './application/preferences.service';
import { PreferencesSaveError } from './application/preferences-session.port';
import { GUEST_DISPLAY_STORAGE_KEY } from './infrastructure/guest-preferences.service';
import { PREFERENCES_STORAGE_KEY } from './infrastructure/preferences-demo.service';

const url = '/api/me/preferences';
function snapshot(identityId = 'Alice', revision = 2): AccountPreferences {
  return {
    identityId,
    revision,
    updatedAt: null,
    preferences: defaultAccountPreferences(),
  };
}

describe('account preferences integration', () => {
  let http: HttpTestingController;
  let token: BehaviorSubject<string | null>;
  beforeEach(() => {
    localStorage.clear();
    token = new BehaviorSubject<string | null>('alice-token');
    TestBed.configureTestingModule({
      providers: [
        ThemingService,
        {
          provide: THEME_PROVIDER_CFG_TOKEN,
          useValue: {
            darkThemeName: 'dark',
            lightThemeName: 'light',
            attributeName: 'tuiTheme',
          },
        },
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AUTHENTICATION_SESSION,
          useValue: { token$: token, getToken: () => token.value },
        },
        ...providePreferencesFeature({ mode: 'api', apiBaseUrl: '' }).providers,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    jest.restoreAllMocks();
  });
  function loaded() {
    const service = TestBed.inject(PreferencesService);
    http.expectOne(url).flush(snapshot());
    return service;
  }
  it('reads only canonical account data, even with conflicting demo and guest records', () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      '{"display":{"theme":"dark"}}'
    );
    localStorage.setItem(
      GUEST_DISPLAY_STORAGE_KEY,
      JSON.stringify({ ...defaultAccountPreferences().display, theme: 'dark' })
    );
    const read = jest.spyOn(Storage.prototype, 'getItem');
    const service = loaded();
    expect(read).not.toHaveBeenCalled();
    expect(service.state()).toMatchObject({
      scope: 'account',
      isError: false,
      data: {
        display: { theme: 'auto' },
        privacy: { profileVisibility: 'private' },
      },
    });
  });
  it.each([
    '<html>SPA fallback</html>',
    { ...snapshot(), revision: 0 },
    { ...snapshot(), extra: true },
    {
      ...snapshot(),
      preferences: { ...defaultAccountPreferences(), privacy: {} },
    },
  ])('rejects malformed account reads without a demo fallback: %p', (value) => {
    const service = TestBed.inject(PreferencesService);
    http.expectOne(url).flush(value);
    expect(service.state()).toMatchObject({
      isError: true,
      isLoading: false,
      context: null,
    });
  });
  it('reports backend read failures and recovers on an explicit retry', () => {
    const service = TestBed.inject(PreferencesService);
    http.expectOne(url).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(service.isError()).toBe(true);
    service.reload();
    http.expectOne(url).flush(snapshot());
    expect(service.isError()).toBe(false);
  });
  it('sends a complete revision-bound command without accepting an identity from the form', async () => {
    const service = loaded();
    const result = firstValueFrom(
      service.updateDisplayPreferences({ theme: 'dark' })
    );
    const request = http.expectOne(url);
    expect(request.request.method).toBe('PUT');
    expect(Object.keys(request.request.body).sort()).toEqual([
      'expectedRevision',
      'preferences',
    ]);
    expect(request.request.body.expectedRevision).toBe(2);
    expect(request.request.body.preferences.display.theme).toBe('dark');
    expect(request.request.body.preferences.privacy.profileVisibility).toBe(
      'private'
    );
    expect(request.request.headers.get('Idempotency-Key')).toMatch(
      /^[a-f0-9-]{36}$/
    );
    expect(service.display().theme).toBe('auto');
    request.flush({ identityId: 'Alice', revision: 3 });
    expect(await result).toEqual({ ok: true, value: true });
    const saved = snapshot('Alice', 3);
    saved.preferences.display.theme = 'dark';
    http.expectOne(url).flush(saved);
    expect(service.display().theme).toBe('dark');
  });
  it('retains the key after an uncertain write, and replaces it for a changed intent or session', async () => {
    const service = loaded();
    const keys: (string | null)[] = [];
    for (const theme of ['dark', 'dark', 'light'] as const) {
      const pending = firstValueFrom(
        service.updateDisplayPreferences({ theme })
      );
      const request = http.expectOne(url);
      keys.push(request.request.headers.get('Idempotency-Key'));
      request.flush({}, { status: 503, statusText: 'Unavailable' });
      expect((await pending).ok).toBe(false);
    }
    token.next(null);
    token.next('alice-token');
    http.expectOne(url).flush(snapshot());
    const pending = firstValueFrom(
      service.updateDisplayPreferences({ theme: 'light' })
    );
    const request = http.expectOne(url);
    keys.push(request.request.headers.get('Idempotency-Key'));
    request.flush({}, { status: 409, statusText: 'Conflict' });
    await pending;
    expect(keys[0]).toBe(keys[1]);
    expect(new Set([keys[0], keys[2], keys[3]]).size).toBe(3);
  });
  it.each([
    {},
    { identityId: 'Bob', revision: 3 },
    { identityId: 'Alice', revision: 2 },
    { identityId: 'Alice', revision: 3, extra: true },
  ])(
    'does not claim a successful save for an invalid receipt: %p',
    (receipt) => {
      const service = loaded();
      let failure: Error | undefined;
      service
        .updateDisplayPreferences({ theme: 'dark' })
        .subscribe((result) => {
          if (!result.ok) failure = result.error;
        });
      http.expectOne(url).flush(receipt);
      expect(failure).toBeInstanceOf(PreferencesSaveError);
      expect((failure as PreferencesSaveError).reason).toBe('unavailable');
      expect(service.display().theme).toBe('auto');
      http.expectNone(url);
    }
  );
  it('does not update the shared theme after a denied or failed save', async () => {
    const theme = TestBed.inject(THEME_PREFERENCES);
    http.expectOne(url).flush(snapshot());
    const values: string[] = [];
    const subscription = theme.selection$.subscribe((value) =>
      values.push(value)
    );
    const pending = firstValueFrom(theme.save('dark'));
    http.expectOne(url).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(await pending).toBe(false);
    expect(values).not.toContain('dark');
    subscription.unsubscribe();
  });
  it('cancels an old account read and never exposes it to the next account', () => {
    const service = TestBed.inject(PreferencesService);
    const alice = http.expectOne(url);
    token.next('bob-token');
    expect(alice.cancelled).toBe(true);
    expect(service.state().context).toBeNull();
    http.expectOne(url).flush(snapshot('Bob', 5));
    expect(service.state().context?.read.account?.identityId).toBe('Bob');
  });
  it('never reapplies an old theme after a confirmed save followed by an account switch', async () => {
    const theme = TestBed.inject(ThemingService);
    http.expectOne(url).flush(snapshot());
    const pending = theme.toggle();
    http.expectOne(url).flush({ identityId: 'Alice', revision: 3 });
    const reload = http.expectOne(url);
    token.next('bob-token');
    expect(reload.cancelled).toBe(true);
    const bob = snapshot('Bob');
    bob.preferences.display.theme = 'light';
    http.expectOne(url).flush(bob);
    await pending;
    expect(theme.theme$.value).toBe('light');
  });
  it('cancels pending writes on account switch and rejects their old form context', async () => {
    const service = loaded();
    const context = service.state().context;
    const pending = firstValueFrom(
      service.updateDisplayPreferences({ theme: 'dark' })
    );
    const request = http.expectOne(url);
    token.next('bob-token');
    expect(request.cancelled).toBe(true);
    expect((await pending).ok).toBe(false);
    http.expectOne(url).flush(snapshot('Bob'));
    const stale = await firstValueFrom(
      service.updatePreferences({ display: { theme: 'dark' } }, context)
    );
    expect(stale.ok).toBe(false);
    if (!stale.ok)
      expect((stale.error as PreferencesSaveError).reason).toBe('session');
    http.expectNone(url);
  });
  it('rejects a form based on a snapshot that has since been reloaded', async () => {
    const service = loaded();
    const context = service.state().context;
    service.reload();
    http.expectOne(url).flush(snapshot('Alice', 3));
    const result = await firstValueFrom(
      service.updatePreferences({ display: { theme: 'dark' } }, context)
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect((result.error as PreferencesSaveError).reason).toBe('conflict');
    http.expectNone(url);
  });
  it('keeps guest display settings separate and never imports them on sign-in', async () => {
    token.next(null);
    const service = TestBed.inject(PreferencesService);
    expect(service.scope()).toBe('guest');
    expect(
      await firstValueFrom(service.updateDisplayPreferences({ theme: 'dark' }))
    ).toEqual({ ok: true, value: true });
    expect(
      JSON.parse(localStorage.getItem(GUEST_DISPLAY_STORAGE_KEY) ?? '{}').theme
    ).toBe('dark');
    expect(localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBeNull();
    expect(
      (
        await firstValueFrom(
          service.updatePrivacyPreferences({ showEmail: true })
        )
      ).ok
    ).toBe(false);
    token.next('alice-token');
    expect(service.display().theme).toBe('auto');
    http.expectOne(url).flush(snapshot());
    expect(service.display().theme).toBe('auto');
    token.next(null);
    expect(service.display().theme).toBe('dark');
    http.expectNone(url);
  });
  it('cancels saved-data export when the account changes', async () => {
    const service = loaded();
    const pending = firstValueFrom(service.readSavedPreferences());
    const request = http.expectOne(url);
    token.next('bob-token');
    expect(request.cancelled).toBe(true);
    expect((await pending).ok).toBe(false);
    http.expectOne(url).flush(snapshot('Bob'));
  });
  it('fails invalid guest storage truthfully and preserves its prior value on write failure', async () => {
    token.next(null);
    localStorage.setItem(GUEST_DISPLAY_STORAGE_KEY, '{broken');
    const service = TestBed.inject(PreferencesService);
    expect(service.isError()).toBe(true);
    localStorage.removeItem(GUEST_DISPLAY_STORAGE_KEY);
    service.reload();
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(
      (
        await firstValueFrom(
          service.updateDisplayPreferences({ theme: 'dark' })
        )
      ).ok
    ).toBe(false);
    expect(service.display().theme).toBe('auto');
    http.expectNone(url);
  });
});
