import { InjectionToken } from '@angular/core';
import { IPasswordResetRequestHandler } from '@domains/identity/authentication';

export const PASSWORD_RESET_REQUEST_HANDLER = new InjectionToken<IPasswordResetRequestHandler>('PASSWORD_RESET_REQUEST_HANDLER');
