import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { MyProfileDto } from "../models";
import { Result } from "../../../../utils/utility-types";


export const MY_PROFILE_PROVIDER = new InjectionToken<IMyProfileProvider>('MY_PROFILE_PROVIDER');

export interface IMyProfileProvider {
  getMyProfile(): Observable<Result<MyProfileDto>>
}

