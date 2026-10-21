import { err, ok, Result } from '@sdk/kernel/standard';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
  CanonicalIdentityStore,
  CredentialIdentityBindings,
} from '@sdk/features/identity/core';
import { AuthSessionDto } from './models/auth-session.dto';
import { RegistrationDto } from './models/registration.dto';
import { IdentityAuthenticationUnavailable } from './identity-authentication.service';

export interface RegistrationCredentials {
  /** Existing credentials must be verified before recovering an interrupted signup. */
  registerOrAuthenticate(
    email: string,
    password: string,
    key?: string
  ): Promise<Result<AuthSessionDto & { enrollmentEligible?: boolean }, Error>>;
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
    private readonly identities: CanonicalIdentityStore &
      CredentialIdentityBindings,
    private readonly enrollment: InitialAccountEnrollment,
    private readonly issuer: string
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
        input.password,
        key
      );
      if (!session.ok) return session;
      const state = await this.identities.enrollCredential(
        {
          issuer: this.issuer,
          subject: session.value.uid,
        },
        session.value.enrollmentEligible === true
      );
      if (!state.isActive || state.isSuspended || state.isDeleted)
        return err(
          new CanonicalIdentityAccessDenied('Identity is unavailable')
        );
      await this.enrollment.enrollAccount(
        state.identityId,
        input.nickname,
        key
      );
      // A credential session is returned only after the authority rechecks access and records it.
      await this.identities.recordAuthentication(
        state.identityId,
        'credentials'
      );
      return ok({
        token: session.value.token,
        refreshToken: session.value.refreshToken,
        expiresIn: session.value.expiresIn,
        uid: state.identityId,
      });
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
