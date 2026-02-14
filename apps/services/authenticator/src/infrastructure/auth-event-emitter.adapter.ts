import { IAuthenticationEventEmitter, AuthenticationAuthenticatedPayload } from '@domains/identity/authentication';
import { IdentityEventsPublisherHolder } from '../services/identity-events-publisher.holder';

export class AuthEventEmitterAdapter implements IAuthenticationEventEmitter {
  constructor(private readonly publisherHolder: IdentityEventsPublisherHolder) {}

  publishAuthenticated(payload: AuthenticationAuthenticatedPayload): void {
    const publisher = this.publisherHolder.get();
    if (publisher) {
      publisher.publishCreated({
        identityId: payload.identityId,
        subjectId: payload.identityId,
        correlationId: payload.identityId,
      });
    }
  }
}
