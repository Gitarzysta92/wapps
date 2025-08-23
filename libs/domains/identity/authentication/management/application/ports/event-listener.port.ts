import { InjectionToken } from "@angular/core";

export const EVENT_LISTENER = new InjectionToken<IIdentityManagementEventListener>('EVENT_LISTENER');

export interface IIdentityManagementEventListener {
  // getIdentity(): Observable<Result<IdentityDto, Error>>
}