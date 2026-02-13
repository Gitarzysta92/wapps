import { EventEnvelope } from '@cross-cutting/events';

export type IdentityCreatedEvent = EventEnvelope<'identity.created', {
  identityId: string;
  subjectId: string;
  provider: string;
}>;