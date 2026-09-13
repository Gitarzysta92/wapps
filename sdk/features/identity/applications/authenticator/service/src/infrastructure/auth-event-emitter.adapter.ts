import { IAuthenticationEventEmitter, AuthenticationAuthenticatedPayload } from '@sdk/features/identity/libs/authentication';
import { IdentityEventsPublisherHolder } from '../services/identity-events-publisher.holder';

export class AuthEventEmitterAdapter implements IAuthenticationEventEmitter {
  constructor(private readonly publisherHolder: IdentityEventsPublisherHolder) {}

  publishAuthenticated(payload: AuthenticationAuthenticatedPayload): void {
    const publisher = this.publisherHolder.get();
    if (publisher) {
      publisher.publishAuthenticated(payload);
    }
  }
}
