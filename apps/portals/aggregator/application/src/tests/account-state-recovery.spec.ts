import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { DEFAULT_PROFILE } from '@portals/shared/data';
import { provideMyProfileFeature } from '@portals/shared/features/my-profile';
import { providePreferencesFeature } from '@portals/shared/features/preferences';
import { provideMyFavoritesFeature } from '@portals/shared/features/my-favorites';
import { MyProfilePageComponent } from '../pages/my-profile-page/my-profile-page.component';
import { SettingsProfilePageComponent } from '../pages/settings-profile/settings-profile.component';
import { SettingsPreferencesPageComponent } from '../pages/settings-preferences/settings-preferences.component';
import { SettingsNotificationsPageComponent } from '../pages/settings-notifications/settings-notifications.component';
import { SettingsPrivacyPageComponent } from '../pages/settings-privacy/settings-privacy.component';
import { FavoritesPageComponent } from '../pages/favorites/favorites.component';

describe('account state recovery', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [
      provideRouter([]), provideHttpClient(), provideNoopAnimations(),
      ...providePreferencesFeature({ apiBaseUrl: '' }).providers,
      ...provideMyProfileFeature({ apiBaseUrl: '', avatarBaseUrl: '', guestProfile: DEFAULT_PROFILE }).providers,
      ...provideMyFavoritesFeature({ apiBaseUrl: '' }).providers,
    ] });
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([
    MyProfilePageComponent, SettingsProfilePageComponent, SettingsPreferencesPageComponent,
    SettingsNotificationsPageComponent, SettingsPrivacyPageComponent,
  ])('retries a failed storage read in %p without replacing data', async component => {
    const read = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    const retry = fixture.nativeElement.querySelector('ui-content-state button');
    expect(retry.textContent).toContain('Retry');
    read.mockRestore();
    const write = jest.spyOn(Storage.prototype, 'setItem');
    retry.click(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ui-content-state')).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });

  it('does not call failed favorites empty, and restores saved entries on retry', async () => {
    localStorage.setItem('wapps.favorites.v1', JSON.stringify({ articles: ['tech-trends-2024'] }));
    const read = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    const fixture = TestBed.createComponent(FavoritesPageComponent);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Favorites could not be loaded');
    expect(fixture.nativeElement.textContent).not.toContain('No favorites yet');
    expect(fixture.nativeElement.querySelector('.favorites-page__card')).toBeNull();
    read.mockRestore();
    fixture.nativeElement.querySelector('ui-content-state button').click();
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/articles/tech-trends-2024"]')).not.toBeNull();
  });

  it('shows one useful empty favorites state instead of four empty sections', async () => {
    localStorage.setItem('wapps.favorites.v1', JSON.stringify({ applications: [], articles: [], suites: [], discussions: [] }));
    const fixture = TestBed.createComponent(FavoritesPageComponent);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('ui-content-state')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('No favorites yet');
    expect(fixture.nativeElement.querySelector('ui-content-state a[href="/discover"]')).not.toBeNull();
  });
});
