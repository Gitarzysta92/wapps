import { InjectionToken } from '@angular/core';
import { IRegistrationHandler } from '@sdk/features/identity/libs/authentication';

export const REGISTRATION_HANDLER = new InjectionToken<IRegistrationHandler>(
  'REGISTRATION_HANDLER'
);
