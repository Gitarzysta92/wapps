import { ApplicationConfig } from "@angular/core";
import { PASSWORD_RESET_HANDLER } from "./application/password-reset-handler.token";
import { PasswordResetApiService } from "./infrastructure/password-reset-api.service";



export function provideIdentityPasswordResetFeature(): ApplicationConfig {
  return {
    providers: [
      { provide: PASSWORD_RESET_HANDLER, useClass: PasswordResetApiService },
    ]
  }
}