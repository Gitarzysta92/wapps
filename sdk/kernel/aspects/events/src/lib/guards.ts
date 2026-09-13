import { EventEnvelope } from './event-envelope';

export function isEventEnvelope(value: unknown): value is EventEnvelope<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return (
    typeof v.meta?.id === 'string' &&
    typeof v.meta?.type === 'string' &&
    typeof v.meta?.version === 'number' &&
    typeof v.meta?.occurredAt === 'string' &&
    typeof v.meta?.producer?.service === 'string' &&
    typeof v.meta?.correlation?.correlationId === 'string' &&
    'payload' in v
  );
}

