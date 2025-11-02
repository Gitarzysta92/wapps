import { ApplicationConfig } from "@angular/core";
import { VALIDATION_MESSAGES } from "@ui/registration";
import { REGISTRATION_HANDLER } from "./application/registration-handler.token";
import { IdentityRegistrationApiService } from "./infrastructure/identity-registration-api.service";
import { ValidationMessagesVM as RegistrationValidationMessages } from "@ui/registration";



export function provideIdentityRegistrationFeature(c: {
  validationMessages: RegistrationValidationMessages
}): ApplicationConfig {
  return {
    providers: [
      { provide: REGISTRATION_HANDLER, useClass: IdentityRegistrationApiService },
      { provide: VALIDATION_MESSAGES, useValue: c.validationMessages }
    ]
  }
}