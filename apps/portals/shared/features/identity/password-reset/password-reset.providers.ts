import { ApplicationConfig } from "@angular/core";
import { PASSWORD_RESET_HANDLER } from "../../../../../../libs/features/identity/password-reset/ports";
import { PasswordResetApiService } from "./password-reset-api.service";



export function provideIdentityPasswordResetFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: PASSWORD_RESET_HANDLER, useClass: PasswordResetApiService },
    ]
  }
}