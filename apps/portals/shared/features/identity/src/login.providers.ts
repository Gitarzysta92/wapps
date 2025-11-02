import { ApplicationConfig } from "@angular/core";
import { AUTHENTICATION_HANDLER } from "./application/authentication-handler.token";
import { AuthenticationApiService } from "./infrastructure/authentication-api.service";
import { IDENTITY_PROVIDER } from "./application/identity-provider.token";
import { IdentityApiService } from "./infrastructure/identity-api.service";
import { AuthenticationService } from ".";
import { AuthenticationStorage } from "./infrastructure/authentication.storage";
import { ValidationMessages as LoginValidationMessages, VALIDATION_MESSAGES } from "@ui/login";



export function provideIdentityLoginFeature(c: {
  validationMessages: LoginValidationMessages
}): ApplicationConfig {
  return {
    providers: [
      AuthenticationStorage,
      AuthenticationService,
      { provide: VALIDATION_MESSAGES, useValue: c.validationMessages },
      { provide: AUTHENTICATION_HANDLER, useClass: AuthenticationApiService },
      { provide: IDENTITY_PROVIDER, useClass: IdentityApiService },
  ]
}
}