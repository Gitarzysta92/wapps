import type {
  IAuthenticationEventEmitter,
  AuthenticationAuthenticatedPayload,
} from '@sdk/features/identity/libs/authentication';
import type { CanonicalIdentityStore } from '@sdk/features/identity/core';

export class AuthEventEmitterAdapter implements IAuthenticationEventEmitter {
  constructor(private readonly identities: CanonicalIdentityStore) {}

  publishAuthenticated(
    payload: AuthenticationAuthenticatedPayload
  ): Promise<void> {
    return this.identities.recordAuthentication(
      payload.identityId,
      payload.provider
    );
  }
}
