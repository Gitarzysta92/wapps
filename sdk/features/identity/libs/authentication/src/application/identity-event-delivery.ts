export interface IdentityEventWork {
  id: string;
  body: string;
  attempts: number;
  identityId: string;
  revision: number;
  eventType: string;
}

export interface IdentityEventOutbox {
  claim(at: number, token: string): Promise<IdentityEventWork | null>;
  delivered(id: string, token: string, at: number): Promise<boolean>;
  failed(
    id: string,
    token: string,
    attempts: number,
    availableAt: number,
    failedAt: number | null
  ): Promise<void>;
}

export interface IdentityEventPublisher {
  publish(body: string): Promise<void>;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function valid(work: IdentityEventWork): boolean {
  if (typeof work.body !== 'string' || work.body.length > 16 * 1024)
    return false;
  if (
    !Number.isSafeInteger(work.attempts) ||
    work.attempts < 0 ||
    work.attempts >= 12 ||
    !Number.isSafeInteger(work.revision) ||
    work.revision < 1 ||
    !isCanonicalIdentityId(work.identityId)
  )
    return false;
  try {
    const event: unknown = JSON.parse(work.body);
    if (!record(event) || !record(event['meta']) || !record(event['payload']))
      return false;
    const { meta, payload } = event;
    if (
      meta['id'] !== work.id ||
      meta['version'] !== 1 ||
      meta['type'] !== work.eventType ||
      ![
        'identity.created',
        'identity.authenticated',
        'identity.updated',
        'identity.deleted',
      ].includes(work.eventType) ||
      payload['identityId'] !== work.identityId ||
      payload['revision'] !== work.revision ||
      !record(meta['subject']) ||
      meta['subject']['entityType'] !== 'identity' ||
      meta['subject']['entityId'] !== work.identityId ||
      typeof meta['occurredAt'] !== 'string' ||
      new Date(meta['occurredAt']).toISOString() !== meta['occurredAt']
    )
      return false;
    if (work.eventType === 'identity.authenticated')
      return (
        typeof payload['provider'] === 'string' &&
        /^[a-z][a-z0-9_-]{0,63}$/.test(payload['provider'])
      );
    if (
      typeof payload['subjectId'] !== 'string' ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(
        payload['subjectId']
      ) ||
      !record(payload['state'])
    )
      return false;
    const state = payload['state'];
    return (
      typeof state['isActive'] === 'boolean' &&
      typeof state['isSuspended'] === 'boolean' &&
      typeof state['isDeleted'] === 'boolean' &&
      typeof state['deletedAt'] === 'number' &&
      Number.isSafeInteger(state['deletedAt']) &&
      (state['isDeleted']
        ? !state['isActive'] && state['deletedAt'] > 0
        : state['deletedAt'] === 0) &&
      (work.eventType === 'identity.deleted'
        ? state['isDeleted']
        : !state['isDeleted'])
    );
  } catch {
    return false;
  }
}

/** Confirmed sends can replay after a crash before marking; consumers must deduplicate event IDs. */
export class DispatchIdentityEvents {
  constructor(
    private readonly outbox: IdentityEventOutbox,
    private readonly publisher: IdentityEventPublisher,
    private readonly token: () => string,
    private readonly now: () => number = Date.now
  ) {}

  async once(): Promise<
    'idle' | 'delivered' | 'lease-lost' | 'retry' | 'failed'
  > {
    const token = this.token();
    const work = await this.outbox.claim(this.now(), token);
    if (!work) return 'idle';
    if (!valid(work)) {
      const at = this.now();
      await this.outbox.failed(
        work.id,
        token,
        Number.isSafeInteger(work.attempts) && work.attempts >= 0
          ? Math.min(work.attempts + 1, 1_000_000)
          : 12,
        at,
        at
      );
      return 'failed';
    }
    try {
      await this.publisher.publish(work.body);
      return (await this.outbox.delivered(work.id, token, this.now()))
        ? 'delivered'
        : 'lease-lost';
    } catch {
      const attempts = Math.min(work.attempts + 1, 1_000_000);
      const terminal = attempts >= 12;
      const at = this.now();
      await this.outbox.failed(
        work.id,
        token,
        attempts,
        at + Math.min(300_000, 1000 * 2 ** Math.min(attempts, 9)),
        terminal ? at : null
      );
      return terminal ? 'failed' : 'retry';
    }
  }
}
import { isCanonicalIdentityId } from '@sdk/features/identity/core';
