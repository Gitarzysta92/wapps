import { Injectable } from '@nestjs/common';
import {
  CredentialEmailAuthority,
  EmailVerificationAuthenticationRequired,
  IdentityAuthenticationUnavailable,
} from '@sdk/features/identity/libs/authentication';
import { TokenValidationError } from '@sdk/extras/identity-firebase';
import { err, ok, Result } from '@sdk/kernel/standard';
import { TokenValidationService } from '../services/token-validation.service';

@Injectable()
export class CredentialEmailAuthorityAdapter
  implements CredentialEmailAuthority
{
  constructor(private readonly validation: TokenValidationService) {}

  async authorize(token: string): Promise<Result<{ uid: string }, Error>> {
    const result = await this.validation.validateRequired(`Bearer ${token}`);
    if (result.ok) return ok({ uid: result.value.uid });
    const error = result.error;
    if (
      error instanceof IdentityAuthenticationUnavailable ||
      (error instanceof TokenValidationError &&
        error.code !== undefined &&
        ![
          'auth/id-token-expired',
          'auth/id-token-revoked',
          'auth/invalid-id-token',
          'auth/argument-error',
          'auth/user-disabled',
          'auth/user-not-found',
        ].includes(error.code))
    )
      return err(
        new IdentityAuthenticationUnavailable('Identity validation unavailable')
      );
    return err(
      new EmailVerificationAuthenticationRequired(
        'Sign in again to verify your email.'
      )
    );
  }
}
