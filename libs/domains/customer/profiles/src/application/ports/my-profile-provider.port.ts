import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "@standard";
import { CustomerProfileDto } from "../models/profile.dto";

export const MY_PROFILE_PROVIDER = new InjectionToken<IMyProfileProvider>('MY_PROFILE_PROVIDER');

export interface IMyProfileProvider {
  getMyProfile(): Observable<Result<CustomerProfileDto>>
}

