import { Observable } from "rxjs";
import { IdentityDto } from "../models";
import { InjectionToken } from "@angular/core";
import { Result } from "@standard";

export const IDENTITY_PROVIDER = new InjectionToken<IIdentityProvider>('IDENTITY_PROVIDER_PORT');

export interface IIdentityProvider {
  getIdentity(): Observable<Result<IdentityDto, Error>>
}