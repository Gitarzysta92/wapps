import { ApplicationConfig } from "@angular/core";
import { MY_PROFILE_PROVIDER, MY_PROFILE_UPDATER, GUEST_PROFILE_PROVIDER } from "@domains/customer/profiles";
import { MyProfileApiService } from "./infrastructure/my-profile-api.service";
import { of } from "rxjs";
import { GuestProfileDto } from "@domains/customer/profiles";
import { MyProfileService } from "./application/my-profile.service";
import { MY_PROFILE_API_BASE_URL_PROVIDER, MY_PROFILE_AVATAR_BASE_URL_PROVIDER } from "./application/infrastructure-providers.port";
import { MY_PROFILE_STATE_PROVIDER } from "./application/my-profile-state-provider.token";

export function provideMyProfileFeature(c: {
  apiBaseUrl: string
  avatarBaseUrl: string,
  guestProfile: GuestProfileDto
}): ApplicationConfig {
  return {
    providers: [
      { provide: MY_PROFILE_STATE_PROVIDER, useClass: MyProfileService },
      { provide: MY_PROFILE_PROVIDER, useClass: MyProfileApiService },
      { provide: MY_PROFILE_UPDATER, useClass: MyProfileApiService },
      { provide: MY_PROFILE_API_BASE_URL_PROVIDER, useValue: c.apiBaseUrl },
      { provide: MY_PROFILE_AVATAR_BASE_URL_PROVIDER, useValue: c.apiBaseUrl },
      { provide: GUEST_PROFILE_PROVIDER, useFactory: () => ({ getGuestProfile: () => of({ value: c.guestProfile }) }) }
    ]
  }
}