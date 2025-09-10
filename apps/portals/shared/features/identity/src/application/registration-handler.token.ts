import { InjectionToken } from "@angular/core";
import { IRegistrationHandler } from "@domains/identity/authentication";

export const REGISTRATION_HANDLER = new InjectionToken<IRegistrationHandler>('REGISTRATION_HANDLER');