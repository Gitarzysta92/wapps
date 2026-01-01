import { ApplicationConfig, Type } from "@angular/core";
import { AUTHENTICATION_HANDLER } from "./application/authentication-handler.token";
import { AuthenticationApiService } from "./infrastructure/authentication-api.service";
import { IDENTITY_PROVIDER } from "./application/identity-provider.token";
import { IdentityApiService } from "./infrastructure/identity-api.service";
import { AuthenticationService } from ".";
import { AuthenticationStorage } from "./infrastructure/authentication.storage";
import { ValidationMessages as LoginValidationMessages, VALIDATION_MESSAGES } from "@ui/login";
import { BffAuthenticationService } from "./infrastructure/bff/bff-authentication.service";
import { AUTH_BFF_URL } from "./infrastructure/bff/auth-bff-url.token";
import { IAuthenticationHandler } from "@domains/identity/authentication";


export interface IdentityLoginFeatureConfig {
  validationMessages: LoginValidationMessages;
  /** URL to the authentication BFF service. When provided, uses BFF for authentication. */
  authBffUrl?: string;
  /** Custom authentication handler class. Takes precedence over authBffUrl if both are provided. */
  authenticationHandler?: Type<IAuthenticationHandler>;
}

export function provideIdentityLoginFeature(c: IdentityLoginFeatureConfig): ApplicationConfig {
  const providers: any[] = [
    AuthenticationStorage,
    AuthenticationService,
    { provide: VALIDATION_MESSAGES, useValue: c.validationMessages },
    { provide: IDENTITY_PROVIDER, useClass: IdentityApiService },
  ];

  // Determine which authentication handler to use
  if (c.authenticationHandler) {
    // Custom handler takes precedence
    providers.push({ provide: AUTHENTICATION_HANDLER, useClass: c.authenticationHandler });
  } else if (c.authBffUrl) {
    // Use BFF authentication
    providers.push(
      { provide: AUTH_BFF_URL, useValue: c.authBffUrl },
      { provide: AUTHENTICATION_HANDLER, useClass: BffAuthenticationService }
    );
  } else {
    // Fallback to mock API service for development
    providers.push({ provide: AUTHENTICATION_HANDLER, useClass: AuthenticationApiService });
  }

  return { providers };
}