import { ResolveFn } from '@angular/router';
import { inject } from '@angular/core';
import { EXAMPLE_PROFILES } from '@portals/shared/data';
import { MY_PROFILE_VIEW_STATE_PROVIDER } from '@portals/shared/features/my-profile';
import { USE_CATALOG_BFF } from '../environment';

export const profileAvatarResolver: () => ResolveFn<string | null> = () => route => {
  if (USE_CATALOG_BFF) return null;
  const id = route.paramMap.get('profileId');
  const ownProfile = inject(MY_PROFILE_VIEW_STATE_PROVIDER).state().data;
  const profile = ownProfile?.id === id ? ownProfile : EXAMPLE_PROFILES.find(item => item.id === id);
  return profile?.avatar?.uri ?? null;
};
