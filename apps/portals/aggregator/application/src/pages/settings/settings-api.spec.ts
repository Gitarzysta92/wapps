import { type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { randomUUID } from 'node:crypto';
import { BehaviorSubject } from 'rxjs';
import {
  defaultAccountPreferences,
  type AccountPreferences,
} from '@domains/customer/preferences';
import {
  AUTHENTICATION_SESSION,
  provideAccountErasure,
} from '@portals/shared/features/identity';
import {
  MY_PROFILE_PROVIDER,
  provideMyProfileFeature,
} from '@portals/shared/features/my-profile';
import {
  PreferencesService,
  providePreferencesFeature,
} from '@portals/shared/features/preferences';
import { SettingsPreferencesPageComponent } from '../settings-preferences/settings-preferences.component';
import { SettingsNotificationsPageComponent } from '../settings-notifications/settings-notifications.component';
import { SettingsPrivacyPageComponent } from '../settings-privacy/settings-privacy.component';

const url = '/api/me/preferences';
const pages = [
  SettingsPreferencesPageComponent,
  SettingsNotificationsPageComponent,
  SettingsPrivacyPageComponent,
] as const;
const snapshot = (): AccountPreferences => ({
  identityId: 'Alice',
  revision: 2,
  updatedAt: null,
  preferences: defaultAccountPreferences(),
});

describe('account settings screens', () => {
  let http: HttpTestingController;
  let token: BehaviorSubject<string | null>;
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(crypto, 'randomUUID', {
      value: randomUUID,
      configurable: true,
    });
    token = new BehaviorSubject<string | null>('alice-token');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        ...provideAccountErasure(''),
        {
          provide: AUTHENTICATION_SESSION,
          useValue: {
            token$: token,
            getToken: () => token.value,
            clear: () => token.next(null),
          },
        },
        ...providePreferencesFeature({ mode: 'api', apiBaseUrl: '' }).providers,
        // A deliberately mixed composition verifies account exports cannot pull demo profiles.
        ...provideMyProfileFeature({
          mode: 'demo',
          apiBaseUrl: '',
          avatarBaseUrl: '',
          guestProfile: { id: 'guest', name: 'Guest' },
        }).providers,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    jest.restoreAllMocks();
  });
  async function settle<T>(fixture: ComponentFixture<T>) {
    fixture.detectChanges();
    for (const request of http.match('/api/me/exports')) {
      expect(request.request.method).toBe('GET');
      if (!request.cancelled) request.flush({ job: null });
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }
  async function loaded<T>(page: Type<T>) {
    const fixture = TestBed.createComponent(page);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[aria-busy="true"]')
    ).not.toBeNull();
    http.expectOne(url).flush(snapshot());
    await settle(fixture);
    return fixture;
  }
  function button<T>(
    fixture: ComponentFixture<T>,
    label: string
  ): HTMLButtonElement {
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll(
      'button'
    );
    const value = Array.from(buttons).find((item) =>
      item.textContent?.includes(label)
    );
    if (!value) throw new Error(`Missing button ${label}`);
    return value;
  }
  function change<T>(fixture: ComponentFixture<T>, page: Type<unknown>) {
    if (page === SettingsPreferencesPageComponent)
      button(fixture, 'Dark').click();
    else
      fixture.nativeElement
        .querySelector(
          page === SettingsNotificationsPageComponent
            ? 'input[aria-label="Enable Email Notifications"]'
            : 'input[aria-label="Show Email Address"]'
        )
        .click();
    fixture.detectChanges();
  }
  it.each(pages)(
    'renders saved account values and confirms a durable save: %p',
    async (page) => {
      const fixture = await loaded<unknown>(page);
      expect(fixture.nativeElement.textContent).toContain('to your account');
      change(fixture, page);
      button(fixture, 'Save Changes').click();
      const request = http.expectOne(url);
      expect(request.request.body.expectedRevision).toBe(2);
      const preferences = request.request.body.preferences;
      if (page === SettingsPreferencesPageComponent)
        expect(preferences.display.theme).toBe('dark');
      if (page === SettingsNotificationsPageComponent)
        expect(preferences.notifications.email.enabled).toBe(true);
      if (page === SettingsPrivacyPageComponent)
        expect(preferences.privacy.showEmail).toBe(true);
      request.flush({ identityId: 'Alice', revision: 3 });
      http.expectOne(url).flush({ ...snapshot(), revision: 3, preferences });
      await settle(fixture);
      expect(fixture.nativeElement.textContent).toContain(
        'Preferences saved to your account.'
      );
      expect(TestBed.inject(PreferencesService).state().data).toEqual(
        preferences
      );
    }
  );
  it.each(pages)(
    'retains edits on conflict until explicit discard: %p',
    async (page) => {
      const fixture = await loaded<unknown>(page);
      change(fixture, page);
      button(fixture, 'Save Changes').click();
      http.expectOne(url).flush({}, { status: 409, statusText: 'Conflict' });
      await settle(fixture);
      expect(
        fixture.nativeElement.querySelector('[role="alert"]').textContent
      ).toContain('changed in another session');
      if (page === SettingsPreferencesPageComponent)
        expect(button(fixture, 'Dark').getAttribute('aria-pressed')).toBe(
          'true'
        );
      else
        expect(
          fixture.nativeElement.querySelector(
            page === SettingsNotificationsPageComponent
              ? 'input[aria-label="Enable Email Notifications"]'
              : 'input[aria-label="Show Email Address"]'
          ).checked
        ).toBe(true);
      button(fixture, 'Discard edits').click();
      http.expectOne(url).flush({ ...snapshot(), revision: 3 });
      await settle(fixture);
      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
      button(fixture, 'Save Changes').click();
      const request = http.expectOne(url);
      expect(request.request.body).toEqual({
        expectedRevision: 3,
        preferences: snapshot().preferences,
      });
      request.flush({}, { status: 503, statusText: 'Unavailable' });
      await settle(fixture);
    }
  );
  it.each(pages)(
    'hides forms during a failed new-account read and recovers: %p',
    async (page) => {
      const fixture = await loaded<unknown>(page);
      change(fixture, page);
      token.next('bob-token');
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('.settings-actions')
      ).toBeNull();
      http.expectOne(url).flush({}, { status: 503, statusText: 'Unavailable' });
      await settle(fixture);
      expect(fixture.nativeElement.textContent).toContain(
        'Could not load settings'
      );
      button(fixture, 'Retry').click();
      http
        .expectOne(url)
        .flush({ ...snapshot(), identityId: 'Bob', revision: 8 });
      await settle(fixture);
      button(fixture, 'Save Changes').click();
      const request = http.expectOne(url);
      expect(request.request.body).toEqual({
        expectedRevision: 8,
        preferences: snapshot().preferences,
      });
      request.flush({}, { status: 503, statusText: 'Unavailable' });
      await settle(fixture);
    }
  );
  it.each(pages)('requires sign-in for account forms: %p', async (page) => {
    token.next(null);
    const fixture = TestBed.createComponent<unknown>(page);
    await settle(fixture);
    expect(fixture.nativeElement.textContent).toContain(
      'Sign in to manage account settings'
    );
    expect(fixture.nativeElement.querySelector('.settings-actions')).toBeNull();
    http.expectNone(url);
  });
  it('keeps the accepted erasure notice visible after settings switch to the guest branch', async () => {
    const fixture = await loaded(SettingsPrivacyPageComponent);
    button(fixture, 'Delete Account').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne('/api/me').flush({
      identityId: 'Alice',
      account: { status: 'ACTIVE' },
      profile: { name: 'Alice' },
    });
    await settle(fixture);
    const panel: HTMLElement = fixture.nativeElement.querySelector(
      'account-erasure-panel'
    );
    (panel.querySelector('input[type=checkbox]') as HTMLInputElement).click();
    const confirmation = panel.querySelector(
      'input[type=text]'
    ) as HTMLInputElement;
    confirmation.value = 'DELETE';
    confirmation.dispatchEvent(new Event('input'));
    await settle(fixture);
    button(fixture, 'Permanently Delete Account').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = http.expectOne('/api/me');
    expect(request.request.method).toBe('DELETE');
    request.flush(
      {
        identityId: 'Alice',
        revision: 3,
        status: 'accepted',
        cleanup: 'pending',
      },
      { status: 202, statusText: 'Accepted' }
    );
    await settle(fixture);
    expect(fixture.nativeElement.textContent).toContain(
      'Sign in to manage account settings'
    );
    expect(panel.textContent).toContain('Deletion accepted.');
    fixture.destroy();
    const revisited = TestBed.createComponent(SettingsPrivacyPageComponent);
    await settle(revisited);
    expect(revisited.nativeElement.textContent).toContain('Deletion accepted.');
  });
  it('keeps a dirty draft on same-account reload and blocks overwriting a newer snapshot', async () => {
    const fixture = await loaded(SettingsPreferencesPageComponent);
    button(fixture, 'Dark').click();
    TestBed.inject(PreferencesService).reload();
    const newer = snapshot();
    newer.revision = 3;
    newer.preferences.display.theme = 'light';
    http.expectOne(url).flush(newer);
    await settle(fixture);
    expect(button(fixture, 'Dark').getAttribute('aria-pressed')).toBe('true');
    button(fixture, 'Save Changes').click();
    await settle(fixture);
    http.expectNone(url);
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent
    ).toContain('reloaded or changed');
    button(fixture, 'Reset to Saved').click();
    await settle(fixture);
    expect(button(fixture, 'Light').getAttribute('aria-pressed')).toBe('true');
  });
  it('clears drafts and late save feedback even when the same token signs in again immediately', async () => {
    const fixture = await loaded(SettingsPreferencesPageComponent);
    button(fixture, 'Dark').click();
    button(fixture, 'Save Changes').click();
    const request = http.expectOne(url);
    token.next(null);
    token.next('alice-token');
    expect(request.cancelled).toBe(true);
    http.expectOne(url).flush(snapshot());
    await settle(fixture);
    expect(
      fixture.nativeElement.querySelector('.settings-feedback')
    ).toBeNull();
    expect(button(fixture, 'Dark').getAttribute('aria-pressed')).toBe('false');
    expect(button(fixture, 'Save Changes').disabled).toBe(false);
  });
  it('preserves edits made while an earlier save is still awaiting confirmation', async () => {
    const fixture = await loaded(SettingsPreferencesPageComponent);
    button(fixture, 'Dark').click();
    button(fixture, 'Save Changes').click();
    const request = http.expectOne(url);
    expect(request.request.body.preferences.display.theme).toBe('dark');
    button(fixture, 'Light').click();
    request.flush({ identityId: 'Alice', revision: 3 });
    http.expectOne(url).flush({
      ...snapshot(),
      revision: 3,
      preferences: request.request.body.preferences,
    });
    await settle(fixture);
    expect(button(fixture, 'Light').getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain(
      'Newer edits remain in this form'
    );
    expect(TestBed.inject(PreferencesService).display().theme).toBe('dark');
    button(fixture, 'Save Changes').click();
    await settle(fixture);
    http.expectNone(url);
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent
    ).toContain('reloaded or changed');
  });
  it('exports only authoritative saved preferences even when a demo profile is provided', async () => {
    const fixture = await loaded(SettingsPrivacyPageComponent);
    const profile = jest.spyOn(
      TestBed.inject(MY_PROFILE_PROVIDER),
      'getMyProfile'
    );
    localStorage.setItem('secret-test', 'private-credential');
    fixture.nativeElement
      .querySelector('input[aria-label="Show Email Address"]')
      .click();
    const blobs: Blob[] = [];
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn((blob: Blob) => {
        blobs.push(blob);
        return 'blob:preferences';
      }),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    button(fixture, 'Export Saved Preferences').click();
    http.expectOne(url).flush(snapshot());
    await settle(fixture);
    expect(profile).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
    const contents = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(blobs[0]);
    });
    const exported = JSON.parse(contents);
    expect(exported.source).toBe('account');
    expect(exported.preferences.privacy.showEmail).toBe(false);
    expect(exported.profile).toBeUndefined();
    expect(contents).not.toContain('private-credential');
    expect(fixture.nativeElement.textContent).toContain(
      'Saved account preferences export downloaded'
    );
  });
  it('does not download old-account data or show stale export feedback after sign-out/in', async () => {
    const fixture = await loaded(SettingsPrivacyPageComponent);
    const create = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: create,
    });
    button(fixture, 'Export Saved Preferences').click();
    const request = http.expectOne(url);
    token.next(null);
    token.next('alice-token');
    expect(request.cancelled).toBe(true);
    http.expectOne(url).flush(snapshot());
    await settle(fixture);
    expect(create).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('.settings-feedback')
    ).toBeNull();
  });
});
