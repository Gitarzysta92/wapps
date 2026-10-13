import { InjectionToken } from '@angular/core';
import type { IGuestProfileProvider } from '@domains/customer/profiles';

export const GUEST_PROFILE_PROVIDER = new InjectionToken<IGuestProfileProvider>(
  'GUEST_PROFILE_PROVIDER'
);
