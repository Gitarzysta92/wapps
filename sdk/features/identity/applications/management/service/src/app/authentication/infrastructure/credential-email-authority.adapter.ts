import { Injectable } from '@nestjs/common';
import {
  CredentialEmailAuthority,
  EmailVerificationAuthenticationRequired,
  IdentityAuthenticationUnavailable,
} from '@sdk/features/identity/libs/authentication';
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
    if (error instanceof IdentityAuthenticationUnavailable)
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
