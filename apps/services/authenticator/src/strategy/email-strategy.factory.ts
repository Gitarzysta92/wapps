import { IAuthenticationStrategy } from '@domains/identity/authentication';
import { FirebaseRestSessionGateway } from '@infrastructure/firebase-identity';
import { EmailAuthenticationStrategy } from './email.strategy';

export class EmailAuthenticationStrategyFactory {
  constructor(
    private readonly firebaseRestSessionGateway: FirebaseRestSessionGateway
  ) {}

  create(email: string, password: string): IAuthenticationStrategy {
    return new EmailAuthenticationStrategy(
      email,
      password,
      this.firebaseRestSessionGateway
    );
  }
}
