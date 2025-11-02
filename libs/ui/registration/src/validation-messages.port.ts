import { InjectionToken } from "@angular/core";
import { ValidationMessagesVM } from "./validation-messages.vm";


export const VALIDATION_MESSAGES = new InjectionToken<ValidationMessagesVM>('VALIDATION_MESSAGES');