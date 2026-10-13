import { InjectionToken } from '@angular/core';
import { IPasswordResetHandler } from '@sdk/features/identity/libs/authentication';

export const PASSWORD_RESET_HANDLER = new InjectionToken<IPasswordResetHandler>(
  'PASSWORD_RESET_HANDLER'
);
