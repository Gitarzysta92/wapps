import { InjectionToken } from "@angular/core";

export const VALIDATION_MESSAGES = new InjectionToken<{ email: Array<{ type: string, message: string }>  }>('VALIDATION_MESSAGES');