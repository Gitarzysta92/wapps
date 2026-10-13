import { CanonicalIdentityInputError } from '@sdk/features/identity/core';
import { err, ok, Result } from '@sdk/kernel/standard';
import { IdentityAuthenticationUnavailable } from './identity-authentication.service';

export interface ResetPasswordInput {
  code: string;
  password: string;
  passwordConfirmation: string;
}

export interface CredentialPasswordReset {
  verify(code: string): Promise<void>;
  complete(code: string, password: string): Promise<void>;
}

export class PasswordResetRejected extends Error {}

/** Provider action codes authorize credential changes; this grants no application lifecycle access. */
export class CredentialPasswordResetService {
  constructor(private readonly provider: CredentialPasswordReset) {}

  verify(code: string): Promise<Result<void, Error>> {
    return this.execute(code, () => this.provider.verify(code));
  }

  complete(input: ResetPasswordInput): Promise<Result<void, Error>> {
    if (
      !input ||
      typeof input.password !== 'string' ||
      input.password.length < 6 ||
      input.password.length > 128 ||
      input.password !== input.passwordConfirmation
    )
      return Promise.resolve(
        err(
          new CanonicalIdentityInputError(
            'Passwords must match and contain 6 to 128 characters'
          )
        )
      );
    return this.execute(input.code, () =>
      this.provider.complete(input.code, input.password)
    );
  }

  private async execute(
    code: string,
    run: () => Promise<void>
  ): Promise<Result<void, Error>> {
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{1,2048}$/.test(code))
      return err(
        new CanonicalIdentityInputError('Invalid password reset code')
      );
    try {
      await run();
      return ok(undefined);
    } catch (error) {
      return err(
        error instanceof PasswordResetRejected
          ? error
          : new IdentityAuthenticationUnavailable(
              'Password reset service unavailable'
            )
      );
    }
  }
}
