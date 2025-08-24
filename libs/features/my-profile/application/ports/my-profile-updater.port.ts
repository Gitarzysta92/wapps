import { InjectionToken } from "@angular/core";
import { MyProfileDto } from "../models";
import { Observable } from "rxjs";
import { Result } from "@standard";

export const MY_PROFILE_UPDATER = new InjectionToken<IMyProfileUpdater>('MY_PROFILE_UPDATER');

export interface IMyProfileUpdater {
  update(p: MyProfileDto): Observable<Result<boolean, Error>>
}
