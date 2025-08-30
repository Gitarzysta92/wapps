import { ApplicationConfig } from "@angular/core";
import { MyProfileService } from "@domains/customer/my-profile";
import { MY_PROFILE_PROVIDER, MY_PROFILE_UPDATER, AUTHENTICATION_PROVIDER, GUEST_PROFILE_PROVIDER, AuthenticationAdapter, MY_PROFILE_API_BASE_URL_PROVIDER, MY_PROFILE_AVATAR_BASE_URL_PROVIDER } from "@domains/customer/my-profile";
import { MyProfileApiService } from "./infrastructure/my-profile-api.service";
import { of } from "rxjs";
import { GuestProfileDto } from "@domains/customer/my-profile";

export function provideMyProfileFeature(c: {
  apiBaseUrl: string
  avatarBaseUrl: string,
  guestProfile: GuestProfileDto
}): ApplicationConfig {
  return {
    providers: [
      MyProfileService,
      { provide: MY_PROFILE_PROVIDER, useClass: MyProfileApiService },
      { provide: MY_PROFILE_UPDATER, useClass: MyProfileApiService },
      { provide: AUTHENTICATION_PROVIDER, useClass: AuthenticationAdapter },
      { provide: MY_PROFILE_API_BASE_URL_PROVIDER, useValue: c.apiBaseUrl },
      { provide: MY_PROFILE_AVATAR_BASE_URL_PROVIDER, useValue: c.apiBaseUrl },
      { provide: GUEST_PROFILE_PROVIDER, useFactory: () => ({ getGuestProfile: () => of({ value: c.guestProfile }) }) }
    ]
  }
}