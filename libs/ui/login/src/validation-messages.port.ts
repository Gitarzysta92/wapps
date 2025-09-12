import { InjectionToken } from "@angular/core";
import { ValidationMessages } from "./validation-messages";


export const VALIDATION_MESSAGES = new InjectionToken<ValidationMessages>('VALIDATION_MESSAGES');