import { ApplicationConfig } from "@angular/core";
import { PasswordResetApiService } from "./infrastructure";
import { PASSWORD_RESET_HANDLER } from "./application/ports";


export function provideIdentityPasswordResetFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: PASSWORD_RESET_HANDLER, useClass: PasswordResetApiService },
    ]
  }
}