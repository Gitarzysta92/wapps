import { EventEnvelope } from '@sdk/kernel/aspects/events';

export type IdentityCreatedEvent = EventEnvelope<'identity.created', {
  identityId: string;
  subjectId: string;
  provider: string;
}>;