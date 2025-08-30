import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { Result } from "@standard";
import { IdentityDto } from "../models";

export const IDENTITY_UPDATER = new InjectionToken<IIdentityUpdater>('IDENTITY_UPDATER_PORT');

export interface IIdentityUpdater {
  updateIdentity(i: IdentityDto): Observable<Result<boolean, Error>>
}