import { inject, type Provider } from '@angular/core';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import {
  PUBLIC_PROFILE_API_URL,
  PUBLIC_PROFILE_PORT,
  PUBLIC_PROFILE_SESSION,
} from './application/public-profile.port';
import { PublicProfileService } from './application/public-profile.service';
import { PublicProfileApiService } from './infrastructure/public-profile-api.service';

/** Used by the lazy API profile page; the demo directory has its own explicit route. */
export function providePublicProfiles(apiUrl: string): Provider[] {
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
      throw new Error('Invalid profile API origin');
  }
  return [
    PublicProfileService,
    PublicProfileApiService,
    { provide: PUBLIC_PROFILE_PORT, useExisting: PublicProfileApiService },
    { provide: PUBLIC_PROFILE_API_URL, useValue: apiUrl.replace(/\/$/, '') },
    {
      provide: PUBLIC_PROFILE_SESSION,
      useFactory: () => {
        const session = inject(AUTHENTICATION_SESSION);
        return { key$: session.token$, currentKey: () => session.getToken() };
      },
    },
  ];
}
