import {
  AuthSessionDto,
  IAuthenticationStrategy,
  IdentityCreationDto,
} from '@sdk/features/identity/libs/authentication';
import { err, isErr, ok, Result } from '@sdk/kernel/standard';
import { PasswordSignIn } from '@sdk/features/identity/libs/authentication';

export class EmailAuthenticationStrategy implements IAuthenticationStrategy {
  static readonly provider = 'email';

  static appliesTo(provider: string): boolean {
    return provider.toLowerCase() === this.provider;
  }

  constructor(
    private readonly email: string,
    private readonly password: string,
    private readonly credentials: PasswordSignIn
  ) {}

  async execute(): Promise<
    Result<IdentityCreationDto & AuthSessionDto, Error>
  > {
    const sessionResult = await this.credentials.signInWithPassword(
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
      claim: session.uid,
      identityType: 'email',
      identityId: session.uid,
      kind: 'user',
    });
  }
}
