import { InjectionToken } from "@angular/core";

export const VALIDATION_MESSAGES = new InjectionToken<IRegistrationValidationMessages>('VALIDATION_MESSAGES');

export interface IRegistrationValidationMessages {
  email: Array<{ type: string, message: string }>;
  nickname: Array<{ type: string, message: string }>;
  password: Array<{ type: string, message: string }>;
  passwordConfirmation: Array<{ type: string, message: string }>;
}