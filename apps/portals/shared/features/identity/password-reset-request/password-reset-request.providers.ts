import { ApplicationConfig } from "@angular/core";
import { PasswordResetRequestApiService } from "../../../../../../libs/features/identity/password-reset-request/infrastructure";
import { PASSWORD_RESET_REQUEST_HANDLER } from "../../../../../../libs/features/identity/password-reset-request/application/ports";
import { VALIDATION_MESSAGES } from "../../../../../../libs/features/identity/password-reset-request/presentation/ports/validation-messages.port";


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