import { ApplicationConfig } from "@angular/core";
import { PasswordResetApiService } from "../../../../../../libs/features/identity/password-reset/infrastructure";
import { PASSWORD_RESET_HANDLER } from "../../../../../../libs/features/identity/password-reset/ports";


export function provideIdentityPasswordResetFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: PASSWORD_RESET_HANDLER, useClass: PasswordResetApiService },
    ]
  }
}