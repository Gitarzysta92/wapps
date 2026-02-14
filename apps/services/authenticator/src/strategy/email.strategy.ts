import {
  AuthSessionDto,
  IAuthenticationStrategy,
  IdentityCreationDto,
} from '@domains/identity/authentication';
import { err, isErr, ok, Result } from '@foundation/standard';
import { FirebaseRestSessionGateway } from '@infrastructure/firebase-identity';

export class EmailAuthenticationStrategy implements IAuthenticationStrategy {
  static readonly provider = 'email';

  static appliesTo(provider: string): boolean {
    return provider.toLowerCase() === this.provider;
  }

  constructor(
    private readonly email: string,
    private readonly password: string,
    private readonly firebaseRestSessionGateway: FirebaseRestSessionGateway
  ) {}

  async execute(): Promise<Result<IdentityCreationDto & AuthSessionDto, Error>> {
    const sessionResult =
      await this.firebaseRestSessionGateway.signInWithPassword(
        this.email,
        this.password
      );
    if (isErr(sessionResult)) {
      return err(sessionResult.error);
    }

    const session = sessionResult.value;
    return ok({
      ...session,
      provider: EmailAuthenticationStrategy.provider,
      claim: this.email,
      identityType: 'email',
      identityId: session.uid,
      kind: 'user',
    });
  }
}
