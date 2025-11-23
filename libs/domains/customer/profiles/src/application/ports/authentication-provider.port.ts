import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";

export const AUTHENTICATION_PROVIDER = new InjectionToken<IAuthenticationProvider>('AUTHENTICATION_PROVIDER');

export interface IAuthenticationProvider {
  isAuthenticated$: Observable<boolean>;
}

