import { randomUUID } from 'node:crypto';
import { toRabbitMqPublishOptions } from '@cross-cutting/events';
import { IDENTITY_EVENTS_QUEUE_NAME, IdentityCreatedEvent } from '@apps/shared';
import { QueueChannel } from '@infrastructure/platform-queue';

export class RabbitMqIdentityEventsPublisher {
  constructor(
    private readonly queue: QueueChannel,
    private readonly queueName: string = IDENTITY_EVENTS_QUEUE_NAME
  ) {}

  publishCreated(args: { identityId: string; subjectId: string; correlationId?: string }): void {
    const evt: IdentityCreatedEvent = {
      meta: {
        id: randomUUID(),
        type: 'identity.created',
        version: 1,
        occurredAt: new Date().toISOString(),
        producer: { service: 'firebase-auth-validator' },
        correlation: { correlationId: args.correlationId ?? args.identityId },
        subject: { entityType: 'identity', entityId: args.identityId },
      },
      payload: { identityId: args.identityId, subjectId: args.subjectId, provider: 'firebase' },
    };

    this.queue.sendToQueue(this.queueName, Buffer.from(JSON.stringify(evt)), toRabbitMqPublishOptions(evt));
  }
}

