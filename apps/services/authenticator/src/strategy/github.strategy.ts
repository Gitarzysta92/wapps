import {
  AuthSessionDto,
  IAuthenticationStrategy,
  IdentityCreationDto,
} from '@domains/identity/authentication';
import { err, isErr, ok, Result } from '@foundation/standard';
import {
  FirebaseUserProvisioner,
  FirebaseGithubCodeExchanger,
  FirebaseTokenGenerator,
  FirebaseRestSessionGateway,
} from '@infrastructure/firebase-identity';

export class GithubAuthenticationStrategy implements IAuthenticationStrategy {
  static readonly provider = 'github';

  static appliesTo(provider: string): boolean {
    return provider.toLowerCase() === this.provider;
  }

  constructor(
    private readonly code: string,
    private readonly redirectUri: string,
    private readonly codeExchanger: FirebaseGithubCodeExchanger,
    private readonly firebaseUserProvisioner: FirebaseUserProvisioner,
    private readonly firebaseTokenGenerator: FirebaseTokenGenerator,
    private readonly firebaseRestSessionGateway: FirebaseRestSessionGateway
  ) {}

  async execute(): Promise<Result<IdentityCreationDto & AuthSessionDto, Error>> {
    const userInfoResult = await this.codeExchanger.exchangeCode(
      this.code,
      this.redirectUri
    );
    if (isErr(userInfoResult)) {
      return err(userInfoResult.error);
    }

    const githubUser = userInfoResult.value;

    const createdUserResult = await this.firebaseUserProvisioner.createUser({
      email: githubUser.email,
      displayName: githubUser.name,
      photoURL: githubUser.picture,
      emailVerified: githubUser.emailVerified,
    });
    if (isErr(createdUserResult)) {
      return err(createdUserResult.error);
    }

    const tokenResult = await this.firebaseTokenGenerator.generateToken(
      createdUserResult.value.uid
    );
    if (isErr(tokenResult)) {
      return err(tokenResult.error);
    }

    const sessionResult =
      await this.firebaseRestSessionGateway.signInWithCustomToken(tokenResult.value);
    if (isErr(sessionResult)) {
      return err(sessionResult.error);
    }

    return ok({
      token: sessionResult.value.token,
      uid: createdUserResult.value.uid,
      email: githubUser.email,
      provider: GithubAuthenticationStrategy.provider,
      claim: githubUser.email,
      identityType: 'email',
      identityId: createdUserResult.value.uid,
      kind: 'user',
      expiresIn: sessionResult.value.expiresIn,
      refreshToken: sessionResult.value.refreshToken,
    });
  }
}
