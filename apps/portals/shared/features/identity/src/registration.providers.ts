import { ApplicationConfig } from "@angular/core";
import { VALIDATION_MESSAGES } from "@ui/registration";



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