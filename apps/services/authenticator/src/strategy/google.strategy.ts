import {
  IAuthenticationStrategy,
  AuthenticationStrategyResult,
} from '@domains/identity/authentication';
import { err, isErr, ok, Result } from '@foundation/standard';
import { FirebaseUserProvisioner, FirebaseGoogleCodeExchanger, FirebaseTokenGenerator, FirebaseRestSessionGateway } from '@infrastructure/firebase-identity';

export class GoogleAuthenticationStrategy implements IAuthenticationStrategy {
  constructor(
    private readonly codeExchanger: FirebaseGoogleCodeExchanger,
    private readonly firebaseUserProvisioner: FirebaseUserProvisioner,
    private readonly firebaseTokenGenerator: FirebaseTokenGenerator,
    private readonly firebaseRestSessionGateway: FirebaseRestSessionGateway,
    private readonly code: string,
    private readonly redirectUri: string,
    private readonly codeVerifier?: string
  ) {}

  async execute(): Promise<Result<AuthenticationStrategyResult, Error>> {
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
    });
  }
}