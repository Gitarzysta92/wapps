import { InjectionToken } from '@angular/core';
import { CustomerProfileDto } from '@domains/customer/profiles';

export interface IProfilesStateProvider {
  getProfile(id: string): CustomerProfileDto;
}

export const PROFILES_STATE_PROVIDER =
  new InjectionToken<IProfilesStateProvider>('PROFILES_STATE_PROVIDER');
