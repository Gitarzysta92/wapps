import { IAuthenticationStrategy } from '@sdk/features/identity/libs/authentication';
import { PasswordSignIn } from '@sdk/features/identity/libs/authentication';
import { EmailAuthenticationStrategy } from './email.strategy';

export class EmailAuthenticationStrategyFactory {
  constructor(private readonly credentials: PasswordSignIn) {}

  create(email: string, password: string): IAuthenticationStrategy {
    return new EmailAuthenticationStrategy(email, password, this.credentials);
  }
}
