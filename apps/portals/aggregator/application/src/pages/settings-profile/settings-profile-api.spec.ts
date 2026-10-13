import { provideIdentityLoginFeature } from '@portals/shared/features/identity';
import { LOGIN_VALIDATION_MESSAGES } from '@portals/shared/data';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { randomUUID } from 'node:crypto';
import { BehaviorSubject } from 'rxjs';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { provideMyProfileFeature } from '@portals/shared/features/my-profile';
import { SettingsProfilePageComponent } from './settings-profile.component';
import { MyProfilePageComponent } from '../my-profile-page/my-profile-page.component';
import { providePreferencesFeature } from '@portals/shared/features/preferences';

const url = '/api/me/profile';
const snapshot = {
  identityId: 'AliceUid',
  revision: 2,
  registeredAt: 100,
  updatedAt: 100,
  profile: {
    name: 'Alice',
    bio: 'Saved bio',
    location: null,
    avatarUri: null,
    socialLinks: {},
  },
};

describe('API profile settings', () => {
  let http: HttpTestingController;
  let token: BehaviorSubject<string | null>;
  beforeEach(() => {
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      value: randomUUID,
      configurable: true,
    });
    token = new BehaviorSubject<string | null>('alice-token');
    TestBed.configureTestingModule({
      providers: [
        ...provideIdentityLoginFeature({
          mode: 'demo',
          authBffUrl: '',
          accountApiUrl: '',
          validationMessages: LOGIN_VALIDATION_MESSAGES,
        }).providers,
        ...providePreferencesFeature({ mode: 'demo', apiBaseUrl: '' })
          .providers,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        {
          provide: AUTHENTICATION_SESSION,
          useValue: { token$: token, getToken: () => token.value },
        },
        ...provideMyProfileFeature({
          mode: 'api',
          apiBaseUrl: '',
          avatarBaseUrl: '',
          guestProfile: { id: 'guest', name: 'Guest' },
        }).providers,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  async function loaded() {
    const fixture = TestBed.createComponent(SettingsProfilePageComponent);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[aria-busy="true"]')
    ).not.toBeNull();
    http.expectOne(url).flush(snapshot);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  it('loads account fields and offers the separate private photo editor', async () => {
    const fixture = await loaded();
    expect(
      fixture.nativeElement.querySelector('input[name="name"]').value
    ).toBe('Alice');
    expect(
      fixture.nativeElement.querySelector(
        'profile-avatar-editor input[type="file"]'
      )
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Changes are saved to your account'
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'only on this browser'
    );
  });
  it('offers initial profile setup for an unregistered canonical account', async () => {
    const fixture = TestBed.createComponent(MyProfilePageComponent);
    fixture.detectChanges();
    http.expectOne(url).flush({
      ...snapshot,
      registeredAt: null,
      profile: { ...snapshot.profile, name: null, bio: null },
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Complete your profile'
    );
    expect(fixture.nativeElement.querySelector('profile-details')).toBeNull();
  });
  it('keeps user edits after a conflict until explicit discard and reload', async () => {
    const fixture = await loaded();
    const name: HTMLInputElement =
      fixture.nativeElement.querySelector('input[name="name"]');
    name.value = 'My unsaved edit';
    name.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const save: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.settings-actions button:last-child'
    );
    save.click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = http.expectOne(url);
    expect(request.request.body.expectedRevision).toBe(2);
    request.flush({}, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(name.value).toBe('My unsaved edit');
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent
    ).toContain('changed in another session');
    const reload = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button: unknown) =>
        (button as HTMLButtonElement).textContent?.includes('Discard edits')
    ) as HTMLButtonElement;
    reload.click();
    fixture.detectChanges();
    http.expectOne(url).flush({
      ...snapshot,
      revision: 3,
      profile: { ...snapshot.profile, name: 'Saved elsewhere' },
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // The lazy response recreates the form; let its new ngModel bindings settle.
    await fixture.whenStable();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('input[name="name"]').value
    ).toBe('Saved elsewhere');
  });
  it('confirms a durable save, then shows the authoritative reread', async () => {
    const fixture = await loaded();
    fixture.nativeElement
      .querySelector('.settings-actions button:last-child')
      .click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne(url).flush({ identityId: 'AliceUid', revision: 3 });
    http.expectOne(url).flush({ ...snapshot, revision: 3 });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Profile saved to your account.'
    );
  });
  it('clears the old form on account switch and shows a failed new read honestly', async () => {
    const fixture = await loaded();
    token.next('bob-token');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('input[name="name"]')
    ).toBeNull();
    http.expectOne(url).flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Could not load settings'
    );
    expect(fixture.nativeElement.textContent).not.toContain('Alice');
  });
});
