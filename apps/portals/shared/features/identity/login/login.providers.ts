import { ApplicationConfig } from "@angular/core";
import { AuthenticationAdapter } from "./authentication.adapter";
import { AUTHENTICATION_HANDLER } from "@features/identity";


export function provideIdentityLoginFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: AUTHENTICATION_HANDLER, useClass: AuthenticationAdapter },
    ]
  }
}