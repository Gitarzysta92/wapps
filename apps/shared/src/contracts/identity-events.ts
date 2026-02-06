import { EventEnvelope } from '@cross-cutting/events';

export const IDENTITY_EVENTS_QUEUE_NAME = 'identity-events';

export type IdentityCreatedEvent = EventEnvelope<
  'identity.created',
  { identityId: string; subjectId: string; provider: 'firebase' }
>;

export type IdentityUpdatedEvent = EventEnvelope<
  'identity.updated',
  { identityId: string; subjectId?: string; provider?: 'firebase'; patch?: Record<string, unknown> }
>;

export type IdentityDeletedEvent = EventEnvelope<
  'identity.deleted',
  { identityId: string; subjectId?: string; provider?: 'firebase' }
>;

