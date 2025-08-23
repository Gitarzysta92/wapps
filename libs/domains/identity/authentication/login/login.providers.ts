import { ApplicationConfig } from "@angular/core";
import { AuthenticationAdapter } from "./aspect/authentication.adapter";
import { AUTHENTICATION_HANDLER } from "./application/ports";


export function provideIdentityLoginFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: AUTHENTICATION_HANDLER, useClass: AuthenticationAdapter },
    ]
  }
}