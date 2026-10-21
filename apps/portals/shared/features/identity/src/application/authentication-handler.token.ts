import { InjectionToken } from '@angular/core';
import { IAuthenticationHandler } from '@sdk/features/identity/libs/authentication';

export const AUTHENTICATION_HANDLER =
  new InjectionToken<IAuthenticationHandler>('AUTHENTICATION_HANDLER_PORT');
