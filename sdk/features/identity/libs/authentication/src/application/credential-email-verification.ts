import { CanonicalIdentityInputError } from '@sdk/features/identity/core';
import { err, ok, Result } from '@sdk/kernel/standard';
import { IdentityAuthenticationUnavailable } from './identity-authentication.service';

export interface CredentialEmailStatus {
  email: string | null;
  verified: boolean;
}

export interface CredentialEmailSession {
  uid: string;
  token: string;
}

export interface CredentialEmailAuthority {
  authorize(token: string): Promise<Result<{ uid: string }, Error>>;
}

export type CredentialEmailRequest = 'requested' | 'already-verified';

export interface CredentialEmailVerification {
  status(session: CredentialEmailSession): Promise<CredentialEmailStatus>;
  request(session: CredentialEmailSession): Promise<CredentialEmailRequest>;
  verify(code: string): Promise<void>;
  complete(code: string): Promise<void>;
}

export class EmailVerificationRejected extends Error {}
export class EmailVerificationThrottled extends Error {}
export class EmailVerificationAuthenticationRequired extends Error {}

/** Credential actions do not activate identities or grant application permissions. */
export class CredentialEmailVerificationService {
  constructor(
    private readonly authority: CredentialEmailAuthority,
    private readonly provider: CredentialEmailVerification
  ) {}

  status(token: string): Promise<Result<CredentialEmailStatus, Error>> {
    return this.self(token, (session) => this.provider.status(session));
  }

  request(token: string): Promise<Result<CredentialEmailRequest, Error>> {
    return this.self(token, (session) => this.provider.request(session));
  }

  verify(code: string): Promise<Result<void, Error>> {
    return this.action(code, () => this.provider.verify(code));
  }

  complete(code: string): Promise<Result<void, Error>> {
    return this.action(code, () => this.provider.complete(code));
  }

  private self<T>(
    token: string,
    run: (session: CredentialEmailSession) => Promise<T>
  ): Promise<Result<T, Error>> {
    return this.execute(async () => {
      if (typeof token !== 'string' || !/^\S{1,16384}$/.test(token))
        throw new EmailVerificationAuthenticationRequired(
          'Sign in again to verify your email.'
        );
      const principal = await this.authority.authorize(token);
      if (!principal.ok) throw principal.error;
      return run({ uid: principal.value.uid, token });
    });
  }

  private action(
    code: string,
    run: () => Promise<void>
  ): Promise<Result<void, Error>> {
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{1,2048}$/.test(code))
      return Promise.resolve(
        err(new CanonicalIdentityInputError('Invalid email verification code'))
      );
    return this.execute(run);
  }

  private async execute<T>(run: () => Promise<T>): Promise<Result<T, Error>> {
    try {
      return ok(await run());
    } catch (error) {
      return err(
        error instanceof EmailVerificationRejected ||
          error instanceof EmailVerificationThrottled ||
          error instanceof EmailVerificationAuthenticationRequired
          ? error
          : new IdentityAuthenticationUnavailable(
              'Email verification unavailable'
            )
      );
    }
  }
}
