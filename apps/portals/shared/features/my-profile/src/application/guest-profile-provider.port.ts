import { InjectionToken } from '@angular/core';
import { CustomerProfileDto } from '@domains/customer/profiles';

export interface IGuestProfileProvider {
  getGuestProfile(): CustomerProfileDto;
}

export const GUEST_PROFILE_PROVIDER = new InjectionToken<IGuestProfileProvider>('GUEST_PROFILE_PROVIDER');