import { Provider } from '@angular/core';
import { EMAIL_VERIFICATION } from './application/email-verification.port';
import { EmailVerificationApiService } from './infrastructure/email-verification-api.service';

export function provideEmailVerification(): Provider[] {
  return [
    { provide: EMAIL_VERIFICATION, useClass: EmailVerificationApiService },
  ];
}
