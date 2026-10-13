import type { EditorialProjectionRequestedEvent } from '@apps/shared';

export interface EditorialOutboxItem {
  id: string;
  attempts: number;
  kind: unknown;
  resourceId: unknown;
  tenantId: unknown;
  revision: unknown;
  createdAt: unknown;
}

export interface EditorialOutbox {
  claim(now: number, token: string): Promise<EditorialOutboxItem | null>;
  delivered(id: string, token: string, at: number): Promise<boolean>;
  failed(
    id: string,
    token: string,
    attempts: number,
    availableAt: number,
    failedAt: number | null
  ): Promise<void>;
}

export interface EditorialProjectionPublisher {
  publish(event: EditorialProjectionRequestedEvent): Promise<void>;
}

class InvalidOutboxItem extends Error {}

function eventFor(
  item: EditorialOutboxItem
): EditorialProjectionRequestedEvent {
  const { kind, resourceId, tenantId } = item;
  const revision = Number(item.revision);
  const createdAt = Number(item.createdAt);
  if (
    !['app', 'category', 'tag', 'suite', 'release', 'article'].some(
      (value) => value === kind
    ) ||
    typeof resourceId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      resourceId
    ) ||
    typeof tenantId !== 'string' ||
    !tenantId ||
    tenantId.length > 128 ||
    tenantId.trim() !== tenantId ||
    !Number.isSafeInteger(revision) ||
    revision < 1 ||
    !Number.isSafeInteger(createdAt) ||
    createdAt < 0 ||
    createdAt > 8640000000000000 ||
    !['string', 'number'].includes(typeof item.revision) ||
    !['string', 'number'].includes(typeof item.createdAt)
  )
    throw new InvalidOutboxItem('Invalid committed materialization request');
  // Narrow each value after validating the stored row, including legacy/corrupt inputs.
  if (
    kind !== 'app' &&
    kind !== 'category' &&
    kind !== 'tag' &&
    kind !== 'suite' &&
    kind !== 'article' &&
    kind !== 'release'
  )
    throw new InvalidOutboxItem();
  return {
    meta: {
      id: `editorial-outbox:${item.id}`,
      type: 'editorial.materialization.requested',
      version: 1,
      occurredAt: new Date(createdAt).toISOString(),
      producer: { service: 'editorial' },
      correlation: { correlationId: resourceId },
      subject: { entityType: kind, entityId: resourceId },
    },
    payload: { kind, resourceId, tenantId, revision },
  };
}

export class DispatchEditorialOutbox {
  constructor(
    private readonly outbox: EditorialOutbox,
    private readonly publisher: EditorialProjectionPublisher,
    private readonly token: () => string,
    private readonly now: () => number = Date.now
  ) {}

  async once(): Promise<
    'idle' | 'delivered' | 'lease-lost' | 'retry' | 'failed'
  > {
    const token = this.token();
    const item = await this.outbox.claim(this.now(), token);
    if (!item) return 'idle';
    try {
      await this.publisher.publish(eventFor(item));
      return (await this.outbox.delivered(item.id, token, this.now()))
        ? 'delivered'
        : 'lease-lost';
    } catch (error) {
      const attempts = Math.min(item.attempts + 1, 1_000_000);
      const terminal = error instanceof InvalidOutboxItem || attempts >= 12;
      const at = this.now();
      await this.outbox.failed(
        item.id,
        token,
        attempts,
        at + Math.min(300_000, 1000 * 2 ** Math.min(attempts, 9)),
        terminal ? at : null
      );
      return terminal ? 'failed' : 'retry';
    }
  }
}
