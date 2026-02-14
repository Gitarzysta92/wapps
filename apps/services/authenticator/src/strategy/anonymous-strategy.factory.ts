import { IAuthenticationStrategy } from '@domains/identity/authentication';
import { FirebaseRestSessionGateway } from '@infrastructure/firebase-identity';
import { AnonymousAuthenticationStrategy } from './anonymous.strategy';

export class AnonymousAuthenticationStrategyFactory {
  constructor(
    private readonly firebaseRestSessionGateway: FirebaseRestSessionGateway
  ) {}

  create(): IAuthenticationStrategy {
    return new AnonymousAuthenticationStrategy(
      this.firebaseRestSessionGateway
    );
  }
}
