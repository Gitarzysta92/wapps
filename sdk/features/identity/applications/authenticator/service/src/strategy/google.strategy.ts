import {
  AuthSessionDto,
  IAuthenticationStrategy,
  IdentityCreationDto,
} from '@sdk/features/identity/libs/authentication';
import { err, isErr, ok, Result } from '@sdk/kernel/standard';
import { FirebaseUserProvisioner, FirebaseGoogleCodeExchanger, FirebaseTokenGenerator, FirebaseRestSessionGateway } from '@infrastructure/firebase-identity';

export class GoogleAuthenticationStrategy implements IAuthenticationStrategy {


  static readonly provider = 'google';
  static appliesTo(provider: string): boolean {
    return provider.toLowerCase() === this.provider;
  }

  constructor(
    private readonly code: string,
    private readonly redirectUri: string,
    private readonly codeVerifier: string,
    private readonly codeExchanger: FirebaseGoogleCodeExchanger,
    private readonly firebaseUserProvisioner: FirebaseUserProvisioner,
    private readonly firebaseTokenGenerator: FirebaseTokenGenerator,
    private readonly firebaseRestSessionGateway: FirebaseRestSessionGateway,
  ) {}

  async execute(): Promise<Result<IdentityCreationDto & AuthSessionDto, Error>> {
    const userInfoResult = await this.codeExchanger.exchangeCode(
      this.code,
      this.redirectUri,
      this.codeVerifier
    );
    if (isErr(userInfoResult)) {
      return err(userInfoResult.error);
    }

    const googleUser = userInfoResult.value;

    //TODO: idempotent user creation + should return if user confirmed email
    const createdUserResult = await this.firebaseUserProvisioner.createUser(googleUser);
    if (isErr(createdUserResult)) {
      return err(createdUserResult.error);
    }

    const tokenResult = await this.firebaseTokenGenerator.generateToken(createdUserResult.value.uid);
    if (isErr(tokenResult)) {
      return err(tokenResult.error);
    }

    const sessionResult = await this.firebaseRestSessionGateway.signInWithCustomToken(tokenResult.value);
    if (isErr(sessionResult)) {
      return err(sessionResult.error);
    }

    return ok({
      token: sessionResult.value.token,
      uid: createdUserResult.value.uid,
      email: googleUser.email,
      provider: GoogleAuthenticationStrategy.provider,
      claim: googleUser.email,
      identityType: 'email',
      identityId: createdUserResult.value.uid,
      kind: 'user',
      expiresIn: sessionResult.value.expiresIn,
      refreshToken: sessionResult.value.refreshToken,
    });
  }
}