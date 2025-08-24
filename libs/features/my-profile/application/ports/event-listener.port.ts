import { InjectionToken } from "@angular/core";
import { MyProfileDto } from "../models";

export const MY_PROFILE_EVENT_LISTENERS = new InjectionToken<IMyProfileEventListener[]>('MY_PROFILE_EVENT_LISTENERS');

export interface IMyProfileEventListener {
  profileUpdated(p: MyProfileDto): void
}