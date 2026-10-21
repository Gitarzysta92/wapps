import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import {
  GUEST_PROFILE_PROVIDER,
  MY_PROFILE_API_BASE_URL_PROVIDER,
  MY_PROFILE_AVATAR_BASE_URL_PROVIDER,
  MY_PROFILE_PROVIDER,
  MY_PROFILE_UPDATER,
  provideMyProfileFeature,
} from '@portals/shared/features/my-profile';
import { userProfileResolver } from './user-profile.resolver';

describe('profile provider composition', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: provideMyProfileFeature({ mode: 'demo',
        apiBaseUrl: 'https://profiles.example.test',
        avatarBaseUrl: '/media/avatars',
        guestProfile: { id: 'guest', name: 'Guest' },
      }).providers,
    });
  });

  it('resolves a guest as a profile object rather than an Observable', () => {
    const route = new ActivatedRouteSnapshot();
    const state = { url: '/public-profile' } as RouterStateSnapshot;
    const profile = TestBed.runInInjectionContext(() =>
      userProfileResolver(route, state)
    );
    expect(profile).toEqual({ id: 'guest', name: 'Guest' });
  });

  it('keeps guest values independent across resolver callers', () => {
    const guest = TestBed.inject(GUEST_PROFILE_PROVIDER);
    guest.getGuestProfile().name = 'Changed';
    expect(guest.getGuestProfile().name).toBe('Guest');
  });

  it('binds both domain ports to one adapter and uses the configured avatar endpoint', () => {
    expect(TestBed.inject(MY_PROFILE_PROVIDER)).toBe(
      TestBed.inject(MY_PROFILE_UPDATER)
    );
    expect(TestBed.inject(MY_PROFILE_API_BASE_URL_PROVIDER)).toBe(
      'https://profiles.example.test'
    );
    expect(TestBed.inject(MY_PROFILE_AVATAR_BASE_URL_PROVIDER)).toBe(
      '/media/avatars'
    );
  });
});
