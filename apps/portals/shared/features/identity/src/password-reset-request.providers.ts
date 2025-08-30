import { ApplicationConfig } from "@angular/core";

import { PasswordResetRequestApiService } from "./infrastructure/password-reset-request-api.service";
import { PASSWORD_RESET_REQUEST_HANDLER, VALIDATION_MESSAGES } from "@ui/password-reset";


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