import { ApplicationConfig } from "@angular/core";
import { IdentityRegistrationApiService } from "./infrastructure";
import { REGISTRATION_HANDLER } from "./application/ports";
import { IRegistrationValidationMessages, VALIDATION_MESSAGES } from "./presentation/ports/validation-messages.port";


export function provideIdentityRegistrationFeature(c: {
  validationMessages: IRegistrationValidationMessages
}): ApplicationConfig {
  return {
    providers: [
      { provide: REGISTRATION_HANDLER, useClass: IdentityRegistrationApiService },
      { provide: VALIDATION_MESSAGES, useValue: c.validationMessages }
    ]
  }
}