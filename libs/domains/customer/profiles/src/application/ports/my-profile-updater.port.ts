import { InjectionToken } from "@angular/core";

import { Observable } from "rxjs";
import { Result } from "@standard";
import { CustomerProfileDto } from "../models/profile.dto";

export const MY_PROFILE_UPDATER = new InjectionToken<IMyProfileUpdater>('MY_PROFILE_UPDATER');

export interface IMyProfileUpdater {
  update(p: CustomerProfileDto): Observable<Result<boolean, Error>>
}
