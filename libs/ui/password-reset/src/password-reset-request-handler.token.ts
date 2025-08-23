import { InjectionToken } from '@angular/core';
import { PasswordResetRequestHandlerPort } from './password-reset-request-handler.port';

export const PASSWORD_RESET_REQUEST_HANDLER = new InjectionToken<PasswordResetRequestHandlerPort>('PASSWORD_RESET_REQUEST_HANDLER');
