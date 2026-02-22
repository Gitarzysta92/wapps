import { Result } from '@sdk/kernel/standard';
import { AuthSessionDto, IAuthenticationRefreshToken } from '@sdk/features/identity/libs/authentication';
import { FirebaseRestSessionGateway } from '@infrastructure/firebase-identity';

export class FirebaseRefreshTokenAdapter implements IAuthenticationRefreshToken {
  constructor(private readonly sessionGateway: FirebaseRestSessionGateway) {}

  async refresh(refreshToken: string): Promise<Result<AuthSessionDto, Error>> {
    return this.sessionGateway.refresh(refreshToken);
  }
}
