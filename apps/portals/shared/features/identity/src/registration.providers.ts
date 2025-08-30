import { ApplicationConfig } from "@angular/core";
import { IdentityRegistrationApiService } from "../../../../../../libs/features/identity/registration/infrastructure";
import { REGISTRATION_HANDLER } from "../../../../../../libs/features/identity/registration/application/ports";
import { IRegistrationValidationMessages, VALIDATION_MESSAGES } from "../../../../../../libs/features/identity/registration/presentation/ports/validation-messages.port";


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