import { InjectionToken } from "@angular/core";
import { GuestProfileDto } from "../models/guest-profile.dto";


export const GUEST_PROFILE_PROVIDER = new InjectionToken<IGuestProfileProvider>('GUEST_PROFILE_PROVIDER');

export interface IGuestProfileProvider {
  getGuestProfile(): GuestProfileDto;
}

