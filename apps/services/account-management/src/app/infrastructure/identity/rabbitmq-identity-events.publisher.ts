import { randomUUID } from 'node:crypto';
import { toRabbitMqPublishOptions } from '@cross-cutting/events';
import {
  IDENTITY_EVENTS_QUEUE_NAME,
  IdentityCreatedEvent,
  IdentityDeletedEvent,
  IdentityUpdatedEvent,
} from '@apps/shared';
import { QueueChannel } from '@infrastructure/platform-queue';

export class RabbitMqIdentityEventsPublisher {
  constructor(
    private readonly queue: QueueChannel,
    private readonly queueName: string = IDENTITY_EVENTS_QUEUE_NAME
  ) {}

  publishCreated(args: {
    identityId: string;
    subjectId: string;
    correlationId?: string;
    actorUserId?: string;
    actorRoles?: string[];
  }): void {
    const evt: IdentityCreatedEvent = {
      meta: {
        id: randomUUID(),
        type: 'identity.created',
        version: 1,
        occurredAt: new Date().toISOString(),
        producer: { service: 'account-management' },
        correlation: { correlationId: args.correlationId ?? args.identityId },
        subject: { entityType: 'identity', entityId: args.identityId },
        actor: { userId: args.actorUserId, roles: args.actorRoles },
      },
      payload: { identityId: args.identityId, subjectId: args.subjectId, provider: 'firebase' },
    };

    this.queue.sendToQueue(this.queueName, Buffer.from(JSON.stringify(evt)), toRabbitMqPublishOptions(evt));
  }

  publishUpdated(args: {
    identityId: string;
    subjectId?: string;
    patch?: Record<string, unknown>;
    correlationId?: string;
    actorUserId?: string;
    actorRoles?: string[];
  }): void {
    const evt: IdentityUpdatedEvent = {
      meta: {
        id: randomUUID(),
        type: 'identity.updated',
        version: 1,
        occurredAt: new Date().toISOString(),
        producer: { service: 'account-management' },
        correlation: { correlationId: args.correlationId ?? args.identityId },
        subject: { entityType: 'identity', entityId: args.identityId },
        actor: { userId: args.actorUserId, roles: args.actorRoles },
      },
      payload: { identityId: args.identityId, subjectId: args.subjectId, patch: args.patch },
    };

    this.queue.sendToQueue(this.queueName, Buffer.from(JSON.stringify(evt)), toRabbitMqPublishOptions(evt));
  }

  publishDeleted(args: {
    identityId: string;
    subjectId?: string;
    correlationId?: string;
    actorUserId?: string;
    actorRoles?: string[];
  }): void {
    const evt: IdentityDeletedEvent = {
      meta: {
        id: randomUUID(),
        type: 'identity.deleted',
        version: 1,
        occurredAt: new Date().toISOString(),
        producer: { service: 'account-management' },
        correlation: { correlationId: args.correlationId ?? args.identityId },
        subject: { entityType: 'identity', entityId: args.identityId },
        actor: { userId: args.actorUserId, roles: args.actorRoles },
      },
      payload: { identityId: args.identityId, subjectId: args.subjectId, provider: 'firebase' },
    };

    this.queue.sendToQueue(this.queueName, Buffer.from(JSON.stringify(evt)), toRabbitMqPublishOptions(evt));
  }
}

