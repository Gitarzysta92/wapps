import { setTimeout as delay } from 'node:timers/promises';
import {
  DISCUSSION_GENERATION_DEAD_LETTER_QUEUE,
  DISCUSSION_GENERATION_QUEUE_NAME,
} from '@apps/shared';
import { isEventEnvelope } from '@sdk/kernel/aspects/events';
import { IConfirmedQueueChannel, IQueuedMessage } from '@sdk/platform/queue';
import {
  DiscussionGenerationStore,
  DiscussionSnapshotReader,
  ImmutablePayloadReader,
  InvalidSnapshotError,
  materializeDiscussion,
} from './materialization';

export async function ensureGenerationQueues(
  queue: IConfirmedQueueChannel
): Promise<void> {
  await queue.assertQueue(DISCUSSION_GENERATION_QUEUE_NAME, {
    durable: true,
    arguments: { 'x-queue-type': 'quorum', 'x-delivery-limit': -1 },
  });
  await queue.assertQueue(DISCUSSION_GENERATION_DEAD_LETTER_QUEUE, {
    durable: true,
    arguments: { 'x-queue-type': 'quorum' },
  });
}

function request(content: Buffer): { discussionId: string; revision: number } {
  if (content.length > 16 * 1024)
    throw new InvalidSnapshotError('Oversized materialization request');
  let value: unknown;
  try {
    value = JSON.parse(content.toString('utf8'));
  } catch {
    throw new InvalidSnapshotError('Invalid event JSON');
  }
  if (
    !isEventEnvelope(value) ||
    value.meta.type !== 'discussion.materialization.requested' ||
    value.meta.version !== 2
  ) {
    throw new InvalidSnapshotError('Invalid materialization event');
  }
  const payload: unknown = value.payload;
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('discussionId' in payload) ||
    typeof payload.discussionId !== 'string' ||
    !/^[0-9a-f-]{36}$/.test(payload.discussionId) ||
    !('revision' in payload) ||
    typeof payload.revision !== 'number' ||
    !Number.isSafeInteger(payload.revision) ||
    payload.revision < 1
  )
    throw new InvalidSnapshotError('Invalid materialization payload');
  return { discussionId: payload.discussionId, revision: payload.revision };
}

/** A failed transfer is deliberately left unacknowledged; the host must reconnect. */
export async function consumeGeneration(
  message: IQueuedMessage,
  queue: IConfirmedQueueChannel,
  reader: DiscussionSnapshotReader,
  payloads: ImmutablePayloadReader,
  store: DiscussionGenerationStore,
  options: { signal?: AbortSignal; wait?: (ms: number) => Promise<void> } = {}
): Promise<'materialized' | 'dead-lettered'> {
  const deliveryCount = message.headers?.['x-delivery-count'] ?? 0;
  let attempt =
    typeof deliveryCount === 'number' &&
    Number.isSafeInteger(deliveryCount) &&
    deliveryCount >= 0
      ? deliveryCount
      : 4;
  let failure = 'MaterializationFailed';
  while (attempt <= 3) {
    if (options.signal?.aborted) throw new Error('Materializer stopping');
    try {
      const event = request(message.content);
      await materializeDiscussion(
        event.discussionId,
        {
          read: async (id) => {
            const snapshot = await reader.read(id);
            if (snapshot.revision < event.revision)
              throw new Error(
                'Write replica has not reached requested revision'
              );
            return snapshot;
          },
        },
        payloads,
        store
      );
      message.ack();
      return 'materialized';
    } catch (error) {
      failure =
        error instanceof InvalidSnapshotError
          ? 'InvalidSnapshot'
          : 'MaterializationFailed';
      if (error instanceof InvalidSnapshotError || attempt >= 3) break;
      const backoff = [1000, 5000, 30_000][attempt++];
      if (options.wait) await options.wait(backoff);
      else await delay(backoff, undefined, { signal: options.signal });
    }
  }
  await queue.publishConfirmed(
    DISCUSSION_GENERATION_DEAD_LETTER_QUEUE,
    message.content,
    {
      headers: { 'x-wapps-failure': failure, 'x-wapps-attempts': attempt + 1 },
    }
  );
  message.ack();
  return 'dead-lettered';
}
