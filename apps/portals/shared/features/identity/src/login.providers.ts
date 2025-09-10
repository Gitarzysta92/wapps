import { ApplicationConfig } from "@angular/core";
import { AUTHENTICATION_HANDLER } from "./application/authentication-handler.token";
import { AuthenticationApiService } from "./infrastructure/authentication-api.service";



export function provideIdentityLoginFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: AUTHENTICATION_HANDLER, useClass: AuthenticationApiService },
    ]
  }
}