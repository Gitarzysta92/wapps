import { IDiscussionProjectionService } from '@domains/discussion';
import {
  DISCUSSION_PROJECTION_QUEUE_NAME,
  DiscussionMaterializationRequestedEvent,
} from '@apps/shared';
import { QueueChannel } from '@infrastructure/platform-queue';
import { toRabbitMqPublishOptions } from '@cross-cutting/events';
import { randomUUID } from 'node:crypto';

export class RabbitMqDiscussionProjectionService implements IDiscussionProjectionService {
  constructor(
    private readonly queue: QueueChannel,
    private readonly queueName: string = DISCUSSION_PROJECTION_QUEUE_NAME
  ) {}

  requestMaterialization(discussionId: string): void {
    const evt: DiscussionMaterializationRequestedEvent = {
      meta: {
        id: randomUUID(),
        type: 'discussion.materialization.requested',
        version: 1,
        occurredAt: new Date().toISOString(),
        producer: { service: 'discussion-service' },
        correlation: { correlationId: discussionId },
        subject: { entityType: 'discussion', entityId: discussionId },
      },
      payload: { discussionId },
    };

    const message = Buffer.from(JSON.stringify(evt));
    this.queue.sendToQueue(this.queueName, message, toRabbitMqPublishOptions(evt));
  }
}

