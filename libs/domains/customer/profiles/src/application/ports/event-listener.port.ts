import { InjectionToken } from "@angular/core";
import { CustomerProfileDto } from "../models/profile.dto";

export const MY_PROFILE_EVENT_LISTENERS = new InjectionToken<IMyProfileEventListener[]>('MY_PROFILE_EVENT_LISTENERS');

export interface IMyProfileEventListener {
  profileUpdated(profile: CustomerProfileDto): void;
}

