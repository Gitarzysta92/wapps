import type * as amqp from 'amqplib';
import { EventEnvelope } from './event-envelope';

/**
 * Map envelope metadata to AMQP message properties/headers.
 *
 * Recommended usage:
 * - put the full `EventEnvelope` JSON in the body
 * - duplicate key metadata into headers/properties for observability and routing
 */
export function toRabbitMqPublishOptions(evt: EventEnvelope<string, unknown>): amqp.Options.Publish {
  return {
    contentType: 'application/json',
    messageId: evt.meta.id,
    type: evt.meta.type,
    correlationId: evt.meta.correlation.correlationId,
    persistent: true,
    headers: {
      'x-event-version': evt.meta.version,
      'x-occurred-at': evt.meta.occurredAt,
      'x-producer-service': evt.meta.producer.service,
      'x-producer-instance': evt.meta.producer.instanceId,
      'x-producer-environment': evt.meta.producer.environment,
      'x-causation-id': evt.meta.correlation.causationId,
      'x-tenant-id': evt.meta.tenant?.tenantId,
      traceparent: evt.meta.trace?.traceparent,
      tracestate: evt.meta.trace?.tracestate,
      'x-subject': evt.meta.subject ? `${evt.meta.subject.entityType}/${evt.meta.subject.entityId}` : undefined,
    },
  };
}

