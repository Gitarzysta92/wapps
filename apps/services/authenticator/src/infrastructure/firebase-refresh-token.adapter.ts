import { Result } from '@foundation/standard';
import { AuthSessionDto, IAuthenticationRefreshToken } from '@domains/identity/authentication';
import { FirebaseRestSessionGateway } from '@infrastructure/firebase-identity';

export class FirebaseRefreshTokenAdapter implements IAuthenticationRefreshToken {
  constructor(private readonly sessionGateway: FirebaseRestSessionGateway) {}

  async refresh(refreshToken: string): Promise<Result<AuthSessionDto, Error>> {
    return this.sessionGateway.refresh(refreshToken);
  }
}
