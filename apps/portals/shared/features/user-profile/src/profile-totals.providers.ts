import { inject, type Provider } from '@angular/core';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import {
  PROFILE_TOTALS_PORT,
  PROFILE_TOTALS_SESSION,
  PROFILE_TOTALS_URL,
} from './application/profile-totals.port';
import { ProfileTotalsApiService } from './infrastructure/profile-totals-api.service';

export function provideProfileTotals(apiUrl: string): Provider[] {
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
      throw new Error('Invalid totals API origin');
  }
  return [
    ProfileTotalsApiService,
    { provide: PROFILE_TOTALS_PORT, useExisting: ProfileTotalsApiService },
    { provide: PROFILE_TOTALS_URL, useValue: apiUrl.replace(/\/$/, '') },
    {
      provide: PROFILE_TOTALS_SESSION,
      useFactory: () => {
        const session = inject(AUTHENTICATION_SESSION);
        return { key$: session.token$, currentKey: () => session.getToken() };
      },
    },
  ];
}
