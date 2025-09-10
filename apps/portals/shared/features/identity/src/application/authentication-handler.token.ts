import { InjectionToken } from "@angular/core";
import { IAuthenticationHandler } from "@domains/identity/authentication";

export const AUTHENTICATION_HANDLER = new InjectionToken<IAuthenticationHandler>('AUTHENTICATION_HANDLER_PORT');
