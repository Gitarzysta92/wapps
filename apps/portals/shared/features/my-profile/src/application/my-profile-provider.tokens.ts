import { InjectionToken } from '@angular/core';
import type {
  IMyProfileProvider,
  IMyProfileUpdater,
} from '@domains/customer/profiles';

export const MY_PROFILE_PROVIDER = new InjectionToken<IMyProfileProvider>(
  'MY_PROFILE_PROVIDER'
);
export const MY_PROFILE_UPDATER = new InjectionToken<IMyProfileUpdater>(
  'MY_PROFILE_UPDATER'
);
