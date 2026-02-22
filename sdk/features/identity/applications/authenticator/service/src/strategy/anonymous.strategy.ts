import {
  AuthSessionDto,
  IAuthenticationStrategy,
  IdentityCreationDto,
} from '@sdk/features/identity/libs/authentication';
import { err, isErr, ok, Result } from '@sdk/kernel/standard';
import { FirebaseRestSessionGateway } from '@infrastructure/firebase-identity';

export class AnonymousAuthenticationStrategy implements IAuthenticationStrategy {
  static readonly provider = 'anonymous';

  static appliesTo(provider: string): boolean {
    return provider.toLowerCase() === this.provider;
  }

  constructor(
    private readonly firebaseRestSessionGateway: FirebaseRestSessionGateway
  ) {}

  async execute(): Promise<Result<IdentityCreationDto & AuthSessionDto, Error>> {
    const sessionResult =
      await this.firebaseRestSessionGateway.signUpAnonymous();
    if (isErr(sessionResult)) {
      return err(sessionResult.error);
    }

    const session = sessionResult.value;
    return ok({
      ...session,
      provider: AnonymousAuthenticationStrategy.provider,
      claim: session.uid,
      identityType: 'anonymous',
      identityId: session.uid,
      kind: 'user',
    });
  }
}
