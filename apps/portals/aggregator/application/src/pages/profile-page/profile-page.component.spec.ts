import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_PROFILE } from '@portals/shared/data';
import { MyProfileService, provideMyProfileFeature } from '@portals/shared/features/my-profile';
import { PreferencesService, providePreferencesFeature } from '@portals/shared/features/preferences';
import { MyProfilePageComponent } from '../my-profile-page/my-profile-page.component';
import { SettingsProfilePageComponent } from '../settings-profile/settings-profile.component';
import { ProfilePageComponent } from './profile-page.component';

describe('local public profiles', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [
      provideRouter([{ path: 'profiles/:profileId', component: ProfilePageComponent }, { path: 'me/profile', component: MyProfilePageComponent }, { path: 'me/settings/profile', component: SettingsProfilePageComponent }]),
      provideHttpClient(), provideNoopAnimations(),
      ...providePreferencesFeature({ apiBaseUrl: '' }).providers,
      ...provideMyProfileFeature({ apiBaseUrl: '', avatarBaseUrl: '', guestProfile: DEFAULT_PROFILE }).providers
    ] });
  });
  afterEach(() => TestBed.resetTestingModule());

  it('selects the actual route member, reacts to another ID, and does not invent activity', async () => {
    const harness = await RouterTestingHarness.create('/profiles/user-2');
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Bob Smith');
    expect(harness.routeNativeElement?.textContent).toContain('Activity totals are not available');
    await harness.navigateByUrl('/profiles/user-3');
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Carol Williams');
  });

  it('shows a useful not-found state and working links to known members', async () => {
    const harness = await RouterTestingHarness.create('/profiles/missing');
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('This profile is not in the local directory');
    expect(harness.routeNativeElement?.querySelector('a.profile-member')?.getAttribute('href')).toBe('/profiles/user-1');
  });

  it('uses saved local profile changes, safe social links, preferred dates and layout', async () => {
    const harness = await RouterTestingHarness.create('/profiles/user-1');
    await firstValueFrom(TestBed.inject(MyProfileService).updateProfile({
      ...DEFAULT_PROFILE, name: 'Saved local name', bio: 'Local biography',
      joinedAt: new Date(2024, 0, 15, 12),
      socialLinks: { website: 'javascript:alert(1)', twitter: '@local_user', github: 'local-user' }
    }));
    await firstValueFrom(TestBed.inject(PreferencesService).updateDisplayPreferences({ dateFormat: 'YYYY-MM-DD', defaultView: 'list' }));
    harness.detectChanges(); await harness.fixture.whenStable(); harness.detectChanges();
    const root = harness.routeNativeElement;
    expect(root?.querySelector('h1')?.textContent).toContain('Saved local name');
    expect(root?.textContent).toContain('Local biography');
    expect(root?.textContent).toContain('2024-01-15');
    expect(root?.querySelector('.profile-directory--list')).not.toBe(null);
    expect(root?.querySelector('a[href^="javascript:"]')).toBe(null);
    expect(root?.querySelector('a[href="https://x.com/local_user"]')).not.toBe(null);
    await firstValueFrom(TestBed.inject(PreferencesService).updateDisplayPreferences({ dateFormat: 'MM/DD/YYYY' }));
    harness.detectChanges();
    expect(root?.textContent).toContain('01/15/2024');
  });
  it('shows edited settings end to end in My Profile and the public preview', async () => {
    const harness = await RouterTestingHarness.create('/me/settings/profile');
    await harness.fixture.whenStable(); harness.detectChanges();
    const name = harness.routeNativeElement?.querySelector<HTMLInputElement>('input[name="name"]');
    const bio = harness.routeNativeElement?.querySelector<HTMLTextAreaElement>('textarea[name="bio"]');
    if (!name || !bio) throw new Error('Profile form missing');
    name.value = 'Edited profile'; name.dispatchEvent(new Event('input'));
    bio.value = 'Shared details from settings'; bio.dispatchEvent(new Event('input'));
    harness.detectChanges();
    const save = Array.from(harness.routeNativeElement?.querySelectorAll('button') ?? []).find(button => button.textContent?.includes('Save Changes'));
    if (!save) throw new Error('Save control missing');
    save.click(); await harness.fixture.whenStable(); harness.detectChanges();
    await harness.navigateByUrl('/me/profile'); harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Edited profile');
    expect(harness.routeNativeElement?.textContent).toContain('Shared details from settings');
    expect(harness.routeNativeElement?.querySelector('a[href="/me/settings/privacy"]')).not.toBe(null);
    const preview = harness.routeNativeElement?.querySelector<HTMLAnchorElement>('a[href="/profiles/user-1"]');
    if (!preview) throw new Error('Public preview link missing');
    preview.click(); await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Edited profile');
    expect(harness.routeNativeElement?.textContent).toContain('Shared details from settings');
  });

});
