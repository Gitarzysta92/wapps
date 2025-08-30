import { ApplicationConfig } from "@angular/core";
import { AuthenticationAdapter } from "./login/authentication.adapter";
import { AUTHENTICATION_HANDLER } from "@domains/identity";


export function provideIdentityLoginFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: AUTHENTICATION_HANDLER, useClass: AuthenticationAdapter },
    ]
  }
}