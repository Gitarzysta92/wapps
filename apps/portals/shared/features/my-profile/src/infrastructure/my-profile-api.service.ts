import { Injectable } from '@angular/core';
import { Result, ok, err } from '@foundation/standard';
import { defer, Observable, of } from 'rxjs';
import { IMyProfileProvider, IMyProfileUpdater, CustomerProfileDto } from '@domains/customer/profiles';
import { DEFAULT_PROFILE } from '@portals/shared/data';

export const PROFILE_STORAGE_KEY = 'wapps.my-profile.v1';

/** Stores the demo profile on this browser; does not update a remote account. */
@Injectable()
export class MyProfileApiService implements IMyProfileProvider, IMyProfileUpdater {
  getMyProfile(): Observable<Result<CustomerProfileDto, Error>> {
    return defer(() => {
      try {
        const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
        const profile: CustomerProfileDto = raw ? JSON.parse(raw) : structuredClone(DEFAULT_PROFILE);
        if (!profile || typeof profile.id !== 'string' || typeof profile.name !== 'string') {
          throw new Error('Invalid stored profile');
        }
        return of(ok(profile));
      } catch { return of(err(new Error('Could not read the profile from this browser.'))); }
    });
  }

  update(profile: CustomerProfileDto): Observable<Result<boolean, Error>> {
    return defer(() => {
      try {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
        return of(ok(true));
      } catch { return of(err(new Error('Could not save your profile. Browser storage may be unavailable or full.'))); }
    });
  }
}
