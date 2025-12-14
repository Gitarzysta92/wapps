import { ResolveFn } from '@angular/router';
import { CustomerProfileDto } from '@domains/customer/profiles';
import { ROUTE_PARAMS } from '../navigation';
import { inject } from '@angular/core';
import { PROFILES_STATE_PROVIDER } from '@portals/shared/features/user-profile';

export const profileAvatarResolver: ResolveFn<CustomerProfileDto["avatar"] | null> = (route) => {
  let avatar: CustomerProfileDto["avatar"] | null = null;

  
  const profileService = inject(PROFILES_STATE_PROVIDER);
  if (route.paramMap.has(ROUTE_PARAMS.profileId)) {
    const profileId = route.paramMap.get(ROUTE_PARAMS.profileId);
    if (profileId) {
      avatar = profileService.getProfile(profileId).avatar;
    }
  }
  if (avatar === null) {
    avatar = {
      uri: 'https://cdn.prod.website-files.com/600b6ab92506fd10a1ca3f8a/600f57b7dbe235c7d536e9c3_Drawer%20Avatar%20Library%20example%201.png',
      alt: 'Guest Profile'
    }
  }
  
  return avatar;
};