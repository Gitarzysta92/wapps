import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_CUSTOMER_PREFERENCES } from '@domains/customer/preferences';
import { DEFAULT_PROFILE } from '@portals/shared/data';
import {
  PreferencesApiService, PreferencesService, PREFERENCES_STORAGE_KEY,
  providePreferencesFeature
} from '@portals/shared/features/preferences';
import {
  MyProfileApiService, MyProfileService, MY_PROFILE_VIEW_STATE_PROVIDER,
  PROFILE_STORAGE_KEY, provideMyProfileFeature
} from '@portals/shared/features/my-profile';
import { SettingsProfilePageComponent } from './settings-profile.component';
import { SettingsPreferencesPageComponent } from '../settings-preferences/settings-preferences.component';
import { SettingsNotificationsPageComponent } from '../settings-notifications/settings-notifications.component';
import { SettingsPrivacyPageComponent } from '../settings-privacy/settings-privacy.component';

describe('Local account settings', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [
      provideRouter([]), provideHttpClient(), provideNoopAnimations(),
      ...providePreferencesFeature({ apiBaseUrl: '' }).providers,
      ...provideMyProfileFeature({ apiBaseUrl: '', avatarBaseUrl: '', guestProfile: DEFAULT_PROFILE }).providers
    ] });
  });
  afterEach(() => { jest.restoreAllMocks(); TestBed.resetTestingModule(); });

  it('persists preferences across service instances without replacing unrelated sections', async () => {
    const api = new PreferencesApiService();
    await firstValueFrom(api.updatePrivacyPreferences({ showEmail: true }));
    await firstValueFrom(api.updateDisplayPreferences({ theme: 'dark' }));
    await firstValueFrom(api.updateDisplayPreferences({ itemsPerPage: 50 }));
    const result = await firstValueFrom(new PreferencesApiService().getPreferences());
    expect(result).toEqual({ ok: true, value: {
      ...DEFAULT_CUSTOMER_PREFERENCES,
      display: { ...DEFAULT_CUSTOMER_PREFERENCES.display, theme: 'dark', itemsPerPage: 50 },
      privacy: { ...DEFAULT_CUSTOMER_PREFERENCES.privacy, showEmail: true }
    } });
  });

  it('restores missing nested fields and does not mutate defaults', async () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({ notifications: { email: { enabled: false } } }));
    const result = await firstValueFrom(new PreferencesApiService().getPreferences());
    if (!result.ok) throw result.error;
    expect(result.value.notifications.email.enabled).toBe(false);
    expect(result.value.notifications.email.frequency).toBe('daily');
    result.value.content.contentFilters.preferredTags.push('draft');
    expect(DEFAULT_CUSTOMER_PREFERENCES.content.contentFilters.preferredTags).toEqual([]);
  });

  it('reports corrupt data and unavailable storage without overwriting records', async () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, '{broken');
    expect((await firstValueFrom(new PreferencesApiService().getPreferences())).ok).toBe(false);
    expect((await firstValueFrom(new PreferencesApiService().updateDisplayPreferences({ theme: 'dark' }))).ok).toBe(false);
    expect(localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBe('{broken');
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect((await firstValueFrom(new MyProfileApiService().getMyProfile())).ok).toBe(false);
  });

  it('publishes successful profile changes globally, including avatar removal and reload', async () => {
    const view = TestBed.inject(MY_PROFILE_VIEW_STATE_PROVIDER);
    const service = TestBed.inject(MyProfileService);
    const profile = { ...DEFAULT_PROFILE, name: 'Local Name', avatar: { uri: 'data:image/png;base64,local', alt: 'Local Name' } };
    await firstValueFrom(service.updateProfile(profile));
    expect(view.name()).toBe('Local Name');
    expect(view.avatar()).toBe(profile.avatar.uri);
    await firstValueFrom(service.updateProfile({ ...profile, avatar: undefined }));
    expect(view.avatar()).toBe(null);
    expect(await firstValueFrom(new MyProfileApiService().getMyProfile())).toEqual({ ok: true, value: { ...profile, avatar: undefined } });
  });

  it('keeps shared profile and preferences unchanged when storage is full', async () => {
    const view = TestBed.inject(MY_PROFILE_VIEW_STATE_PROVIDER);
    const preferences = TestBed.inject(PreferencesService);
    const before = view.name();
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect((await firstValueFrom(TestBed.inject(MyProfileService).updateProfile({ ...DEFAULT_PROFILE, name: 'Lost' }))).ok).toBe(false);
    expect((await firstValueFrom(preferences.updateDisplayPreferences({ theme: 'dark' }))).ok).toBe(false);
    expect(view.name()).toBe(before);
    expect(preferences.state().data.display.theme).toBe('auto');
  });

  it('initializes profile fields, resets drafts, validates, and saves all editable fields', async () => {
    const page = TestBed.runInInjectionContext(() => new SettingsProfilePageComponent());
    TestBed.flushEffects();
    expect(page['formData']().name).toBe(DEFAULT_PROFILE.name);
    page['onFieldChange']('name', 'Unsaved');
    expect(TestBed.inject(MY_PROFILE_VIEW_STATE_PROVIDER).name()).toBe(DEFAULT_PROFILE.name);
    page['onCancel']();
    expect(page['formData']().name).toBe(DEFAULT_PROFILE.name);
    page['onFieldChange']('name', '   ');
    await page['onSave']();
    expect(page['saveError']()).toBe(true);
    expect(localStorage.getItem(PROFILE_STORAGE_KEY)).toBe(null);
    page['onFieldChange']('name', ' Saved Name ');
    page['onFieldChange']('bio', 'A bio');
    page['onFieldChange']('website', 'https://example.com');
    page['onRemoveAvatar']();
    await page['onSave']();
    expect(page['saveError']()).toBe(false);
    const saved = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) ?? '{}');
    expect(saved.name).toBe('Saved Name');
    expect(saved.bio).toBe('A bio');
    expect(saved.socialLinks.website).toBe('https://example.com');
    expect(saved.avatar).toBeUndefined();
  });

  it('retains a failed profile draft with error feedback', async () => {
    const page = TestBed.runInInjectionContext(() => new SettingsProfilePageComponent());
    TestBed.flushEffects();
    page['onFieldChange']('name', 'Keep this draft');
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await page['onSave']();
    expect(page['formData']().name).toBe('Keep this draft');
    expect(page['saveError']()).toBe(true);
    expect(page['isSaving']()).toBe(false);
  });

  it('loads and resets saved preferences, then saves display/content atomically', async () => {
    const service = TestBed.inject(PreferencesService);
    await firstValueFrom(service.updateDisplayPreferences({ theme: 'dark' }));
    const page = TestBed.runInInjectionContext(() => new SettingsPreferencesPageComponent());
    TestBed.flushEffects();
    expect(page['displayPreferences']().theme).toBe('dark');
    page['onThemeChange']('light');
    page['onCancel']();
    expect(page['displayPreferences']().theme).toBe('dark');
    page['onThemeChange']('light');
    page['onFeedSortChange']('popular');
    const write = jest.spyOn(Storage.prototype, 'setItem');
    await page['onSave']();
    expect(write).toHaveBeenCalledTimes(1);
    expect(service.state().data.content.feedSortOrder).toBe('popular');
    expect(service.state().data.display.theme).toBe('light');
  });

  it('preserves notification subchoices when the master switch is disabled', async () => {
    const page = TestBed.runInInjectionContext(() => new SettingsNotificationsPageComponent());
    TestBed.flushEffects();
    page['onEmailFrequencyChange']('weekly');
    page['onEmailPreferenceToggle']('discussionReplies', false);
    page['onEmailEnabledToggle'](false);
    await page['onSave']();
    TestBed.flushEffects();
    page['onEmailFrequencyChange']('instant');
    page['onCancel']();
    expect(page['emailPreferences']().frequency).toBe('weekly');
    expect(page['emailPreferences']().enabled).toBe(false);
    expect(page['emailPreferences']().discussionReplies).toBe(false);
  });

  it('exports only saved profile/preferences and excludes credentials and unsaved privacy edits', async () => {
    localStorage.setItem('auth-token', 'secret');
    const page = TestBed.runInInjectionContext(() => new SettingsPrivacyPageComponent());
    TestBed.flushEffects();
    page['onVisibilityChange']('private');
    await page['onSave']();
    TestBed.flushEffects();
    page['onPrivacyToggle']('showEmail', true);
    const blobs: Blob[] = [];
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn((blob: Blob) => { blobs.push(blob); return 'blob:export'; }) });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await page['onExport']();
    expect(click).toHaveBeenCalledTimes(1);
    const contents = await new Promise<string>(resolve => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.readAsText(blobs[0]);
    });
    const exported = JSON.parse(contents);
    expect(exported.preferences.privacy.profileVisibility).toBe('private');
    expect(exported.preferences.privacy.showEmail).toBe(false);
    expect(exported.profile.id).toBe(DEFAULT_PROFILE.id);
    expect(contents).not.toContain('secret');
    expect(document.querySelector('a[download]')).toBe(null);
    page['onCancel']();
    expect(page['privacyPreferences']().showEmail).toBe(false);
  });
  it('rejects oversized or unsupported avatar files without changing the draft', () => {
    const page = TestBed.runInInjectionContext(() => new SettingsProfilePageComponent());
    TestBed.flushEffects();
    const before = page['avatarUri']();
    for (const file of [new File(['svg'], 'photo.svg', { type: 'image/svg+xml' }), new File([new Uint8Array(1024 * 1024 + 1)], 'large.png', { type: 'image/png' })]) {
      page['onAvatarSelected']({ target: { files: [file], value: 'file' } } as unknown as Event);
      expect(page['saveError']()).toBe(true);
      expect(page['avatarUri']()).toBe(before);
      expect(page['isReadingAvatar']()).toBe(false);
    }
  });

  it('reads an avatar upload, previews it, persists it, and restores it after reload', async () => {
    const page = TestBed.runInInjectionContext(() => new SettingsProfilePageComponent());
    TestBed.flushEffects();
    // jsdom has no image decoder; simulate successful decoding after FileReader completes.
    const decoded = new Promise<void>(resolve => {
      jest.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (this: HTMLImageElement) {
        this.dispatchEvent(new Event('load'));
        resolve();
      });
    });
    const file = new File(['local-image'], 'avatar.png', { type: 'image/png' });
    page['onAvatarSelected']({ target: { files: [file], value: 'file' } } as unknown as Event);
    expect(page['isReadingAvatar']()).toBe(true);
    await decoded;
    expect(page['avatarUri']()).toMatch(/^data:image\/png;base64,/);
    expect(page['isReadingAvatar']()).toBe(false);
    expect(localStorage.getItem(PROFILE_STORAGE_KEY)).toBe(null);
    await page['onSave']();
    const result = await firstValueFrom(new MyProfileApiService().getMyProfile());
    if (!result.ok) throw result.error;
    expect(result.value.avatar?.uri).toBe(page['avatarUri']());
    expect(TestBed.inject(MY_PROFILE_VIEW_STATE_PROVIDER).avatar()).toBe(page['avatarUri']());
  });

  it.each([
    SettingsProfilePageComponent, SettingsPreferencesPageComponent,
    SettingsNotificationsPageComponent, SettingsPrivacyPageComponent
  ])('renders settings template %p with working save controls', async component => {
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const save = Array.from(root.querySelectorAll('button')).find(button => button.textContent?.includes('Save Changes'));
    expect(save).toBeDefined();
    if (!save) throw new Error('Save control missing');
    save.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.textContent?.toLowerCase()).toContain('saved on this browser');
    if (component === SettingsPrivacyPageComponent) {
      const deletion = Array.from(root.querySelectorAll('button')).find(button => button.textContent?.includes('Deletion Unavailable'));
      expect(deletion?.disabled).toBe(true);
    }
  });

});
