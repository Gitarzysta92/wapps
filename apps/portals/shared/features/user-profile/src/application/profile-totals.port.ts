import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type { ProfileTotals } from '@domains/customer/profiles';
import type {
  PublicProfileError,
  PublicProfileSession,
} from './public-profile.port';
export interface ProfileTotalsPort {
  read(
    id: string | null
  ): Observable<Result<ProfileTotals, PublicProfileError>>;
}
export const PROFILE_TOTALS_PORT = new InjectionToken<ProfileTotalsPort>(
  'PROFILE_TOTALS_PORT'
);
export const PROFILE_TOTALS_URL = new InjectionToken<string>(
  'PROFILE_TOTALS_URL'
);
export const PROFILE_TOTALS_SESSION = new InjectionToken<PublicProfileSession>(
  'PROFILE_TOTALS_SESSION'
);
