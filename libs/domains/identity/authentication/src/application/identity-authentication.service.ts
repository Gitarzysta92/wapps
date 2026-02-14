import { err, isErr, ok, Result } from '@foundation/standard';
import { AuthSessionDto } from './models/auth-session.dto';
import { IAuthenticationStrategy } from './ports/authentication-strategy.port';
import { IIdentityProvider } from './ports/identity-provider.port';
import { Identity } from '../core/identity';
import { IAuthenticationEventEmitter } from './ports/authentication-event-emitter.port';
import { IAuthenticationRefreshToken } from './ports/authentication-refresh-token.port';
import { IdentityCreationDto } from './models/identity-creation.dto';

export class IdentityAuthenticationService {

  constructor(
    private readonly identityProvider: IIdentityProvider,
    private readonly eventsEmmiter: IAuthenticationEventEmitter,
    private readonly authenticationRefreshToken: IAuthenticationRefreshToken,
  ) {}

  async authenticate(strategy: IAuthenticationStrategy): Promise<Result<AuthSessionDto, Error>> {
    const strategyResult = await strategy.execute();
    if (isErr(strategyResult)) {
      return err(strategyResult.error);
    }
    const session = strategyResult.value;

    let result = await this.identityProvider.obtainIdentity(session.uid);
    if (isErr(result)) {
      return err(result.error);
    }

    if (result.value) {
      return ok(this._toAuthSessionDto(result.value, session));
    }
    
    const creationDto = this._sessionToIdentityCreationDto(session);
    result = await this.identityProvider.createIdentity(creationDto);
    if (isErr(result)) {
      return err(result.error);
    }

    this.eventsEmmiter.publishAuthenticated({
      identityId: result.value.identityId,
      provider: result.value.providerType,
    });

    return ok(this._toAuthSessionDto(result.value, session));
  }

  async refresh(refreshToken: string): Promise<Result<AuthSessionDto, Error>> {
    return this.authenticationRefreshToken.refresh(refreshToken);
  }


  private _toAuthSessionDto(
    identity: Identity,
    session: AuthSessionDto
  ): AuthSessionDto { 
    return {
      token: session.token,
      refreshToken: session.refreshToken,
      expiresIn: session.expiresIn,
      uid: session.uid,
    };
  }

  private _sessionToIdentityCreationDto(session: AuthSessionDto): IdentityCreationDto {
    return {
      provider: 'firebase',
      claim: session.uid,
      identityType: 'user',
      identityId: '',
      kind: 'primary',
    };
  }

}