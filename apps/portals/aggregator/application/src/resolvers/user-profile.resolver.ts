import { inject } from "@angular/core";
import { ResolveFn } from "@angular/router";
import { NAVIGATION, ROUTE_PARAMS } from "../navigation";
import { CustomerProfileDto, GUEST_PROFILE_PROVIDER } from '@domains/customer/profiles';
import { PROFILES_STATE_PROVIDER } from '@portals/shared/features/user-profile';
import { MY_PROFILE_STATE_PROVIDER } from '@portals/shared/features/my-profile';

export const userProfileResolver: ResolveFn<CustomerProfileDto> = (route, state) => {
  let profile: CustomerProfileDto | null = null;

  if (route.paramMap.has(ROUTE_PARAMS.profileId)) {
    const profileId = route.paramMap.get(ROUTE_PARAMS.profileId);
    if (profileId) {
      const profileService = inject(PROFILES_STATE_PROVIDER);
      profile = profileService.getProfile(profileId);
    }
  }
  else if (state.url.includes(NAVIGATION.myProfile.path)) {
    const myProfileService = inject(MY_PROFILE_STATE_PROVIDER);
    profile = myProfileService.getMyProfile();
  }

  if (profile === null) {
    const guestProfileService = inject(GUEST_PROFILE_PROVIDER);
    profile =  guestProfileService.getGuestProfile();
  }

  return profile;
};