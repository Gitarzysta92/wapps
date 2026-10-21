import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type {
  ProfileBadgeAdministration,
  ProfileBadgeChange,
  ProfileBadgeEvent,
  SharedProfileBadges,
} from '@domains/customer/profiles';
import type {
  PublicProfileError,
  PublicProfileSession,
} from './public-profile.port';

export interface ProfileBadgesPort {
  capabilities(): Observable<Result<void, PublicProfileError>>;
  administer(
    id: string,
    after: number | null
  ): Observable<Result<ProfileBadgeAdministration, PublicProfileError>>;
  change(
    id: string,
    command: ProfileBadgeChange,
    key: string
  ): Observable<Result<ProfileBadgeEvent, PublicProfileError>>;
  read(
    id: string | null
  ): Observable<Result<SharedProfileBadges, PublicProfileError>>;
}
export const PROFILE_BADGES_PORT = new InjectionToken<ProfileBadgesPort>(
  'PROFILE_BADGES_PORT'
);
export const PROFILE_BADGES_URL = new InjectionToken<string>(
  'PROFILE_BADGES_URL'
);
export const PROFILE_BADGES_SESSION = new InjectionToken<PublicProfileSession>(
  'PROFILE_BADGES_SESSION'
);
