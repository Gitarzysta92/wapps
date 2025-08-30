import { ApplicationConfig } from "@angular/core";
import { MyProfileService } from "../../../../../libs/features/my-profile/application";
import { MY_PROFILE_PROVIDER, MY_PROFILE_UPDATER } from "../../../../../libs/features/my-profile/application/ports";
import { MyProfileApiService } from "../../../../../libs/features/my-profile/infrastructure/my-profile-api.service";
import { AUTHENTICATION_PROVIDER } from "../../../../../libs/features/my-profile/application/ports/authentication-provider.port";
import { AuthenticationAdapter } from "../../../../../libs/features/my-profile/aspect/authentication.adapter";
import { MY_PROFILE_API_BASE_URL_PROVIDER } from "../../../../../libs/features/my-profile/infrastructure/ports/my-profile-api-base-url-provider.port";
import { MY_PROFILE_AVATAR_BASE_URL_PROVIDER } from "../../../../../libs/features/my-profile/infrastructure/ports/my-profile-avatar-base-url-provider.port";
import { GUEST_PROFILE_PROVIDER } from "../../../../../libs/features/my-profile/application/ports/guest-profile-provider.port";
import { of } from "rxjs";
import { GuestProfileDto } from "../../../../../libs/features/my-profile/application/models";

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