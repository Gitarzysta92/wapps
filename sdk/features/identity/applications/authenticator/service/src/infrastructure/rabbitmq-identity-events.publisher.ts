import { randomUUID } from 'node:crypto';
import { toRabbitMqPublishOptions } from '@sdk/kernel/aspects/events';
import { IDENTITY_EVENTS_QUEUE_NAME, IdentityCreatedEvent, IdentityAuthenticatedEvent } from '@apps/shared';
import { IQueueChannel } from '@sdk/platform/queue';

export class RabbitMqIdentityEventsPublisher {
  constructor(
    private readonly queue: IQueueChannel,
    private readonly queueName: string = IDENTITY_EVENTS_QUEUE_NAME
  ) {}

  publishAuthenticated(payload: { identityId: string; provider: string }): void {
    const evt: IdentityAuthenticatedEvent = {
      meta: {
        id: randomUUID(), type: 'identity.authenticated', version: 1,
        occurredAt: new Date().toISOString(), producer: { service: 'authenticator' },
        correlation: { correlationId: payload.identityId },
        subject: { entityType: 'identity', entityId: payload.identityId },
      }, payload,
    };
    this.queue.sendToQueue(this.queueName, Buffer.from(JSON.stringify(evt)), toRabbitMqPublishOptions(evt));
  }

  publishCreated(args: { identityId: string; subjectId: string; correlationId?: string }): void {
    const evt: IdentityCreatedEvent = {
      meta: {
        id: randomUUID(),
        type: 'identity.created',
        version: 1,
        occurredAt: new Date().toISOString(),
        producer: { service: 'authenticator' },
        correlation: { correlationId: args.correlationId ?? args.identityId },
        subject: { entityType: 'identity', entityId: args.identityId },
      },
      payload: { identityId: args.identityId, subjectId: args.subjectId, provider: 'firebase' },
    };

    this.queue.sendToQueue(this.queueName, Buffer.from(JSON.stringify(evt)), toRabbitMqPublishOptions(evt));
  }
}

