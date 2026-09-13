import { IAuthenticationStrategy } from '@sdk/features/identity/libs/authentication';
import { FirebaseGoogleCodeExchanger, FirebaseRestSessionGateway, FirebaseTokenGenerator, FirebaseUserProvisioner } from '@sdk/extras/identity-firebase';
import { GoogleAuthenticationStrategy } from "./google.strategy";

export class GoogleAuthenticationStrategyFactory {
  constructor(
    private readonly codeExchanger: FirebaseGoogleCodeExchanger,
    private readonly firebaseUserProvisioner: FirebaseUserProvisioner,
    private readonly firebaseTokenGenerator: FirebaseTokenGenerator,
    private readonly firebaseRestSessionGateway: FirebaseRestSessionGateway,
  ) {}

  create(code: string, redirectUri: string, codeVerifier: string): IAuthenticationStrategy {
    return new GoogleAuthenticationStrategy(
      code,
      redirectUri,
      codeVerifier,
      this.codeExchanger,
      this.firebaseUserProvisioner,
      this.firebaseTokenGenerator,
      this.firebaseRestSessionGateway
    );
  }
}