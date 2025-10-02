import { ApplicationConfig } from "@angular/core";
import { AUTHENTICATION_HANDLER } from "./application/authentication-handler.token";
import { AuthenticationApiService } from "./infrastructure/authentication-api.service";
import { IDENTITY_PROVIDER } from "./application/identity-provider.token";
import { IdentityApiService } from "./infrastructure/identity-api.service";



export function provideIdentityLoginFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: AUTHENTICATION_HANDLER, useClass: AuthenticationApiService },
      { provide: IDENTITY_PROVIDER, useClass: IdentityApiService },
    ]
  }
}