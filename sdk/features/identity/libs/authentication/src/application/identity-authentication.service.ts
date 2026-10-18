import { err, isErr, ok, Result } from '@sdk/kernel/standard';
import { AuthSessionDto } from './models/auth-session.dto';
import { IAuthenticationStrategy } from './ports/authentication-strategy.port';
import { IIdentityProvider } from './ports/identity-provider.port';
import {
  Identity,
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
} from '@sdk/features/identity/core';
import { IAuthenticationEventEmitter } from './ports/authentication-event-emitter.port';
import { IAuthenticationRefreshToken } from './ports/authentication-refresh-token.port';

export class IdentityAuthenticationUnavailable extends Error {}

export class IdentityAuthenticationService {
  constructor(
    private readonly identityProvider: IIdentityProvider,
    private readonly eventsEmmiter: IAuthenticationEventEmitter,
    private readonly authenticationRefreshToken: IAuthenticationRefreshToken
  ) {}

  async authenticate(
    strategy: IAuthenticationStrategy
  ): Promise<Result<AuthSessionDto, Error>> {
    const strategyResult = await strategy.execute();
    if (isErr(strategyResult)) {
      return err(strategyResult.error);
    }
    const session = strategyResult.value;

    const result = await this.identityProvider.obtainIdentity(session.uid);
    if (isErr(result)) {
      return err(result.error);
    }

    if (!result.value || !result.value.canBeObtained()) {
      return err(new Error('Identity is inactive, suspended, or deleted'));
    }

    try {
      await this.eventsEmmiter.publishAuthenticated({
        identityId: result.value.identityId,
        provider: result.value.providerType,
      });
    } catch (error) {
      return err(
        error instanceof CanonicalIdentityConflict ||
          error instanceof CanonicalIdentityAccessDenied
          ? new Error('Identity is unavailable')
          : new IdentityAuthenticationUnavailable(
              'Identity authentication could not be recorded'
            )
      );
    }

    return ok(this._toAuthSessionDto(result.value, session));
  }

  async refresh(refreshToken: string): Promise<Result<AuthSessionDto, Error>> {
    const refreshed = await this.authenticationRefreshToken.refresh(
      refreshToken
    );
    if (!refreshed.ok) return refreshed;
    const identity = await this.identityProvider.obtainIdentity(
      refreshed.value.uid
    );
    if (!identity.ok) return err(identity.error);
    if (!identity.value?.canBeObtained())
      return err(new Error('Identity is unavailable'));
    return ok(this._toAuthSessionDto(identity.value, refreshed.value));
  }

  private _toAuthSessionDto(
    identity: Identity,
    session: AuthSessionDto
  ): AuthSessionDto {
    return {
      token: session.token,
      refreshToken: session.refreshToken,
      expiresIn: session.expiresIn,
      uid: identity.identityId,
    };
  }
}
