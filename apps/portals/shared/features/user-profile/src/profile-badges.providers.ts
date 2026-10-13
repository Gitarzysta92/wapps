import { inject, type Provider } from '@angular/core';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import {
  PROFILE_BADGES_PORT,
  PROFILE_BADGES_SESSION,
  PROFILE_BADGES_URL,
} from './application/profile-badges.port';
import { ProfileBadgesApiService } from './infrastructure/profile-badges-api.service';

export function provideProfileBadges(apiUrl: string): Provider[] {
  if (apiUrl) {
    const url = new URL(apiUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error('Invalid badge API origin');
  }
  return [
    ProfileBadgesApiService,
    { provide: PROFILE_BADGES_PORT, useExisting: ProfileBadgesApiService },
    { provide: PROFILE_BADGES_URL, useValue: apiUrl.replace(/\/$/, '') },
    {
      provide: PROFILE_BADGES_SESSION,
      useFactory: () => {
        const session = inject(AUTHENTICATION_SESSION);
        return { key$: session.token$, currentKey: () => session.getToken() };
      },
    },
  ];
}
