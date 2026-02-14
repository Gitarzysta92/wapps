import { err, isErr, ok, Result } from '@foundation/standard';
import { AuthSessionDto } from './models/auth-session.dto';
import { IAuthenticationStrategy } from './ports/authentication-strategy.port';
import { IdentityService } from './identity.service';
import { Identity } from '../core/identity';
import { IAuthenticationEventEmitter } from './ports/authentication-event-emitter.port';

export class IdentityAuthenticationService {

  constructor(
    private readonly identityService: IdentityService,
    private readonly eventsEmmiter: IAuthenticationEventEmitter,
  ) {}

  async authenticate(strategy: IAuthenticationStrategy): Promise<Result<AuthSessionDto, Error>> {
    const strategyResult = await strategy.execute();
    if (isErr(strategyResult)) {
      return err(strategyResult.error);
    }
    const session = strategyResult.value;

    let result = await this.identityService.obtainIdentity(session.uid);
    if (isErr(result)) {
      return err(result.error);
    }

    if (result.value) {
      return ok(this._toAuthSessionDto(result.value, session));
    }
    
    result = await this.identityService.createIdentity(session);
    if (isErr(result)) {
      return err(result.error);
    }

    this.eventsEmmiter.publishAuthenticated({
      identityId: result.value.identityId,
      subjectId: result.value.subjectId,
      provider: result.value.providerType,
    });

    return ok(this._toAuthSessionDto(result.value, session));
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

}