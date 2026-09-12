import { ResolveFn } from '@angular/router';
import { inject } from '@angular/core';
import { EXAMPLE_PROFILES } from '@portals/shared/data';
import { MY_PROFILE_VIEW_STATE_PROVIDER } from '@portals/shared/features/my-profile';

export const profileAvatarResolver: () => ResolveFn<string | null> = () => route => {
  const id = route.paramMap.get('profileId');
  const ownProfile = inject(MY_PROFILE_VIEW_STATE_PROVIDER).state().data;
  const profile = ownProfile.id === id ? ownProfile : EXAMPLE_PROFILES.find(item => item.id === id);
  return profile?.avatar?.uri ?? null;
};
