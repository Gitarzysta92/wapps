import { InjectionToken } from '@angular/core';
import { IPasswordResetRequestHandler } from '@sdk/features/identity/libs/authentication';

export const PASSWORD_RESET_REQUEST_HANDLER =
  new InjectionToken<IPasswordResetRequestHandler>(
    'PASSWORD_RESET_REQUEST_HANDLER'
  );
