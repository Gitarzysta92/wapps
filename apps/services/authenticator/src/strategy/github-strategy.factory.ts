import { IAuthenticationStrategy } from '@domains/identity/authentication';
import {
  FirebaseGithubCodeExchanger,
  FirebaseRestSessionGateway,
  FirebaseTokenGenerator,
  FirebaseUserProvisioner,
} from '@infrastructure/firebase-identity';
import { GithubAuthenticationStrategy } from './github.strategy';

export class GithubAuthenticationStrategyFactory {
  constructor(
    private readonly codeExchanger: FirebaseGithubCodeExchanger,
    private readonly firebaseUserProvisioner: FirebaseUserProvisioner,
    private readonly firebaseTokenGenerator: FirebaseTokenGenerator,
    private readonly firebaseRestSessionGateway: FirebaseRestSessionGateway
  ) {}

  create(code: string, redirectUri: string): IAuthenticationStrategy {
    return new GithubAuthenticationStrategy(
      code,
      redirectUri,
      this.codeExchanger,
      this.firebaseUserProvisioner,
      this.firebaseTokenGenerator,
      this.firebaseRestSessionGateway
    );
  }
}
