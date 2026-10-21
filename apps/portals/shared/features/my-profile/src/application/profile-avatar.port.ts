import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { ProfileUpdateReceipt } from '@domains/customer/profiles';

export interface ProfileAvatarPort {
  change(
    identityId: string,
    revision: number,
    file: Blob | null
  ): Observable<ProfileUpdateReceipt>;
  clear(): void;
}
export const PROFILE_AVATAR = new InjectionToken<ProfileAvatarPort>(
  'PROFILE_AVATAR'
);
