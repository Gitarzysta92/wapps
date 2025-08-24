import { Observable } from "rxjs";
import { IdentityDto } from "../models";
import { Result } from "@standard";
import { InjectionToken } from "@angular/core";

export const IDENTITY_PROVIDER = new InjectionToken<IIdentityProvider>('IDENTITY_PROVIDER_PORT');

export interface IIdentityProvider {
  getIdentity(): Observable<Result<IdentityDto, Error>>
}