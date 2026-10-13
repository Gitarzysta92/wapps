import { err, ok, Result } from '@sdk/kernel/standard';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
  CanonicalIdentityStore,
} from '@sdk/features/identity/core';
import { AuthSessionDto } from './models/auth-session.dto';
import { RegistrationDto } from './models/registration.dto';
import { IdentityAuthenticationUnavailable } from './identity-authentication.service';

export interface RegistrationCredentials {
  /** Existing credentials must be verified before recovering an interrupted signup. */
  registerOrAuthenticate(
    email: string,
    password: string
  ): Promise<Result<AuthSessionDto, Error>>;
}

export interface InitialAccountEnrollment {
  /** Initial enrollment only; replay must preserve subsequent profile edits. */
  enrollAccount(
    uid: string,
    name: string,
    key: string
  ): Promise<{
    identityId: string;
    revision: number;
    registered: true;
  }>;
}

export class CredentialRegistrationRejected extends Error {}

export class CredentialRegistrationService {
  constructor(
    private readonly credentials: RegistrationCredentials,
    private readonly identities: CanonicalIdentityStore,
    private readonly enrollment: InitialAccountEnrollment
  ) {}

  async register(
    input: RegistrationDto,
    key: string
  ): Promise<Result<AuthSessionDto, Error>> {
    if (
      !input ||
      typeof input.email !== 'string' ||
      input.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
      typeof input.nickname !== 'string' ||
      input.nickname.trim() !== input.nickname ||
      input.nickname.length < 1 ||
      input.nickname.length > 120 ||
      typeof input.password !== 'string' ||
      input.password.length < 6 ||
      input.password.length > 128 ||
      input.passwordConfirmation !== input.password ||
      typeof key !== 'string' ||
      !/^[\x21-\x7e]{1,128}$/.test(key)
    )
      return err(
        new CanonicalIdentityInputError(
          'Invalid registration details or Idempotency-Key'
        )
      );

    try {
      const session = await this.credentials.registerOrAuthenticate(
        input.email,
        input.password
      );
      if (!session.ok) return session;
      const { state } = await this.identities.ensure({
        uid: session.value.uid,
        provider: 'email',
        kind: 'user',
        activate: true,
      });
      if (!state.isActive || state.isSuspended || state.isDeleted)
        return err(
          new CanonicalIdentityAccessDenied('Identity is unavailable')
        );
      await this.enrollment.enrollAccount(
        session.value.uid,
        input.nickname,
        key
      );
      // A credential session is returned only after the authority rechecks access and records it.
      await this.identities.recordAuthentication(session.value.uid, 'email');
      return ok(session.value);
    } catch (error) {
      return err(
        error instanceof CanonicalIdentityAccessDenied ||
          error instanceof CanonicalIdentityConflict ||
          error instanceof CanonicalIdentityInputError
          ? error
          : new IdentityAuthenticationUnavailable(
              'Registration service unavailable'
            )
      );
    }
  }
}
