import { setTimeout as delay } from 'node:timers/promises';
import {
  EDITORIAL_PROJECTION_FAILED_QUEUE,
  EDITORIAL_PROJECTION_QUEUE,
  EditorialProjectionRequestedEvent,
} from '@apps/shared';
import { isEventEnvelope } from '@sdk/kernel/aspects/events';
import type {
  IConfirmedQueueChannel,
  IQueuedMessage,
} from '@sdk/platform/queue';
import {
  assertEditorialSnapshot,
  EditorialProjectionStore,
  EditorialSnapshotReader,
  InvalidEditorialSnapshot,
  isEditorialResourceId,
  isEditorialScope,
  materializeEditorial,
} from './editorial-materialization';

export async function ensureEditorialProjectionQueues(
  queue: IConfirmedQueueChannel
): Promise<void> {
  await queue.assertQueue(EDITORIAL_PROJECTION_QUEUE, {
    durable: true,
    arguments: { 'x-queue-type': 'quorum', 'x-delivery-limit': -1 },
  });
  await queue.assertQueue(EDITORIAL_PROJECTION_FAILED_QUEUE, {
    durable: true,
    arguments: { 'x-queue-type': 'quorum', 'x-delivery-limit': -1 },
  });
}

export function parseEditorialProjectionRequest(
  body: Buffer
): EditorialProjectionRequestedEvent['payload'] {
  assertEditorialSnapshot(
    body.length <= 16 * 1024,
    'Oversized Editorial materialization request'
  );
  let value: unknown;
  try {
    value = JSON.parse(body.toString('utf8'));
  } catch {
    throw new InvalidEditorialSnapshot('Invalid materialization request JSON');
  }
  assertEditorialSnapshot(
    isEventEnvelope(value) &&
      value.meta.type === 'editorial.materialization.requested' &&
      value.meta.version === 1,
    'Invalid materialization event envelope'
  );
  const payload: unknown = value.payload;
  assertEditorialSnapshot(
    payload && typeof payload === 'object' && !Array.isArray(payload),
    'Invalid materialization request payload'
  );
  const fields = Object.fromEntries(Object.entries(payload));
  const { kind, resourceId, tenantId, revision } = fields;
  assertEditorialSnapshot(
    Object.keys(fields).length === 4 &&
      (kind === 'app' ||
        kind === 'category' ||
        kind === 'tag' ||
        kind === 'suite' ||
        kind === 'article' ||
        kind === 'release') &&
      isEditorialResourceId(resourceId) &&
      isEditorialScope(tenantId) &&
      typeof revision === 'number' &&
      Number.isSafeInteger(revision) &&
      revision > 0,
    'Invalid materialization resource scope'
  );
  assertEditorialSnapshot(
    value.meta.subject?.entityType === kind &&
      value.meta.subject?.entityId === resourceId,
    'Event subject does not match resource'
  );
  return { kind, resourceId, tenantId, revision };
}

/** Transfer failures remain unacknowledged; the host closes the channel for redelivery. */
export async function consumeEditorialProjection(
  message: IQueuedMessage,
  queue: IConfirmedQueueChannel,
  reader: EditorialSnapshotReader,
  store: EditorialProjectionStore,
  options: { signal?: AbortSignal; wait?: (ms: number) => Promise<void> } = {}
): Promise<'materialized' | 'dead-lettered'> {
  const deliveries = message.headers?.['x-delivery-count'] ?? 0;
  let attempt =
    typeof deliveries === 'number' &&
    Number.isSafeInteger(deliveries) &&
    deliveries >= 0
      ? deliveries
      : 4;
  let failure = 'MaterializationFailed';
  let complete = false;
  while (attempt <= 3) {
    if (options.signal?.aborted)
      throw new Error('Editorial materializer stopping');
    try {
      await materializeEditorial(
        parseEditorialProjectionRequest(message.content),
        reader,
        store
      );
      complete = true;
      break;
    } catch (error) {
      failure =
        error instanceof InvalidEditorialSnapshot
          ? 'InvalidSnapshot'
          : 'MaterializationFailed';
      if (options.signal?.aborted)
        throw new Error('Editorial materializer stopping');
      if (error instanceof InvalidEditorialSnapshot || attempt >= 3) break;
      const backoff = [1000, 5000, 30_000][attempt++];
      if (options.wait) await options.wait(backoff);
      else await delay(backoff, undefined, { signal: options.signal });
    }
  }
  if (complete) {
    // An acknowledgement failure must trigger redelivery, not reclassify a durable projection as poison.
    message.ack();
    return 'materialized';
  }
  if (options.signal?.aborted)
    throw new Error('Editorial materializer stopping');
  await queue.publishConfirmed(
    EDITORIAL_PROJECTION_FAILED_QUEUE,
    message.content,
    {
      headers: {
        'x-wapps-failure': failure,
        'x-wapps-attempts': Math.min(attempt + 1, 1_000_000),
      },
    }
  );
  message.ack();
  return 'dead-lettered';
}
