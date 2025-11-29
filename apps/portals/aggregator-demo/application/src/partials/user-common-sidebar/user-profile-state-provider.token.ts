import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { ProfileDto } from "@domains/customer/profiles";

export interface IUserProfileStateProvider {
  getProfile(profileId: string): Observable<ProfileDto>;
}

export const USER_PROFILE_COMMON_SIDEBAR_PROVIDER = new InjectionToken<IUserProfileStateProvider>('USER_PROFILE_COMMON_SIDEBAR_PROVIDER');