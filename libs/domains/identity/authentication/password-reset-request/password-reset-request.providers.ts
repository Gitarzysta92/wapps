import { ApplicationConfig } from "@angular/core";
import { PasswordResetRequestApiService } from "./infrastructure";
import { PASSWORD_RESET_REQUEST_HANDLER } from "./application/ports";
import { VALIDATION_MESSAGES } from "./presentation/ports/validation-messages.port";


export function providePasswordResetRequestFeature(c: {
  validationMessages: { email: Array<{ type: string, message: string }> }
}): ApplicationConfig {
  return {
    providers: [
      { provide: PASSWORD_RESET_REQUEST_HANDLER, useClass: PasswordResetRequestApiService },
      { provide: VALIDATION_MESSAGES, useValue: c.validationMessages }
    ]
  }
}