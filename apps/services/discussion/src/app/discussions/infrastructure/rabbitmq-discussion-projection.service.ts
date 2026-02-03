import { IDiscussionProjectionService } from '@domains/discussion';
import {
  DISCUSSION_PROJECTION_QUEUE_NAME,
  DiscussionMaterializationRequestedEvent,
} from '@apps/shared';
import { QueueChannel } from '../../infrastructure/queue-client';

export class RabbitMqDiscussionProjectionService implements IDiscussionProjectionService {
  constructor(
    private readonly queue: QueueChannel,
    private readonly queueName: string = DISCUSSION_PROJECTION_QUEUE_NAME
  ) {}

  requestMaterialization(discussionId: string): void {
    const evt: DiscussionMaterializationRequestedEvent = {
      type: 'discussion.materialization.requested',
      discussionId,
      timestamp: Date.now(),
    };

    const message = JSON.stringify(evt);
    this.queue.sendToQueue(this.queueName, Buffer.from(message));
  }
}

