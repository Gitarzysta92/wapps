import type { DataSource, EntityManager } from 'typeorm';
import type { DiscussionPayloadReference } from '@apps/shared';
import {
  lockIdentityWrites,
  identityErasureBarrier,
} from '@wapps/account-mysql';
import {
  accountErasureRequest,
  type AccountErasureRequest,
  isCanonicalIdentityId,
} from '@sdk/features/identity/core';
import {
  DiscussionConflictError,
  type DiscussionPayloadScope,
} from '../application/discussion-write.port';
import {
  assertDiscussionPayloadReference,
  assertDiscussionPayloadScope,
  type DiscussionPayloadRegistry,
} from '../application/registered-discussion-payloads';

export interface RegisteredDiscussionPayload
  extends Omit<DiscussionPayloadScope, 'ownerIdentityId'> {
  ownerIdentityId: string | null;
  nodeId: string;
  reference: DiscussionPayloadReference;
  state:
    | 'reserved'
    | 'anonymizing'
    | 'uploaded'
    | 'committed'
    | 'retiring'
    | 'retired';
  registeredAt: number;
  retiredAt: number | null;
}

function integer(value: unknown): number {
  const number =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 1)
    throw new Error('Invalid discussion payload integer');
  return number;
}

export function registeredDiscussionPayload(
  row: Record<string, unknown>
): RegisteredDiscussionPayload {
  const state = row.state;
  if (
    typeof row.nodeId !== 'string' ||
    (row.ownerIdentityId !== null && typeof row.ownerIdentityId !== 'string') ||
    (row.actorIdentityId !== null && typeof row.actorIdentityId !== 'string') ||
    typeof row.tenantId !== 'string' ||
    typeof row.objectKey !== 'string' ||
    typeof row.sha256 !== 'string' ||
    (state !== 'reserved' &&
      state !== 'anonymizing' &&
      state !== 'uploaded' &&
      state !== 'committed' &&
      state !== 'retiring' &&
      state !== 'retired')
  )
    throw new Error('Invalid discussion payload registration');
  const scope = {
    ownerIdentityId: row.ownerIdentityId,
    actorIdentityId: row.actorIdentityId,
    tenantId: row.tenantId,
  };
  const reference = {
    key: row.objectKey,
    sha256: row.sha256,
    bytes: integer(row.bytes),
  };
  if (
    state === 'anonymizing' &&
    (scope.ownerIdentityId === null || scope.actorIdentityId !== null)
  )
    throw new Error('Invalid internal anonymity reservation');
  if (scope.ownerIdentityId === null) {
    if (
      scope.actorIdentityId !== null ||
      (state !== 'committed' && state !== 'retired') ||
      !isCanonicalIdentityId(scope.tenantId)
    )
      throw new Error('Invalid anonymous payload registration');
  } else {
    assertDiscussionPayloadScope({
      ...scope,
      ownerIdentityId: scope.ownerIdentityId,
    });
  }
  assertDiscussionPayloadReference(row.nodeId, reference);
  const registeredAt = integer(row.registeredAt);
  const retiredAt = row.retiredAt === null ? null : integer(row.retiredAt);
  if (
    (row.state === 'retired') !== (retiredAt !== null) ||
    (retiredAt !== null && retiredAt < registeredAt)
  )
    throw new Error('Inconsistent discussion payload retirement');
  return {
    ...scope,
    nodeId: row.nodeId,
    reference,
    state,
    registeredAt,
    retiredAt,
  };
}

async function advancePayload(
  manager: EntityManager,
  nodeId: string,
  reference: DiscussionPayloadReference,
  scope: DiscussionPayloadScope,
  expected: 'reserved' | 'uploaded',
  next: 'uploaded' | 'committed'
): Promise<void> {
  if (!manager.queryRunner?.isTransactionActive)
    throw new Error('Payload publication requires the canonical transaction');
  assertDiscussionPayloadScope(scope);
  assertDiscussionPayloadReference(nodeId, reference);
  const [row]: Record<string, unknown>[] = await manager.query(
    'SELECT * FROM discussion_payload_objects WHERE objectKey = ? FOR UPDATE',
    [reference.key]
  );
  if (!row)
    throw new DiscussionConflictError(
      'Discussion payload reservation is missing'
    );
  const stored = registeredDiscussionPayload(row);
  if (
    stored.state !== expected ||
    stored.nodeId !== nodeId ||
    stored.ownerIdentityId !== scope.ownerIdentityId ||
    stored.actorIdentityId !== scope.actorIdentityId ||
    stored.tenantId !== scope.tenantId ||
    stored.reference.sha256 !== reference.sha256 ||
    stored.reference.bytes !== reference.bytes
  )
    throw new DiscussionConflictError(
      'Discussion payload reservation differs or is retired'
    );
  await manager.query(
    'UPDATE discussion_payload_objects SET state = ? WHERE objectKey = ?',
    [next, reference.key]
  );
}

export function commitDiscussionPayload(
  manager: EntityManager,
  nodeId: string,
  reference: DiscussionPayloadReference,
  scope: DiscussionPayloadScope
): Promise<void> {
  return advancePayload(
    manager,
    nodeId,
    reference,
    scope,
    'uploaded',
    'committed'
  );
}

export class MysqlDiscussionPayloads implements DiscussionPayloadRegistry {
  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now
  ) {}

  async reserve(
    nodeId: string,
    reference: DiscussionPayloadReference,
    scope: DiscussionPayloadScope
  ): Promise<void> {
    assertDiscussionPayloadScope(scope);
    assertDiscussionPayloadReference(nodeId, reference);
    await this.source.transaction('READ COMMITTED', async (manager) => {
      await lockIdentityWrites(manager, [
        scope.ownerIdentityId,
        ...(scope.actorIdentityId === null ? [] : [scope.actorIdentityId]),
      ]);
      await manager.query(
        `INSERT INTO discussion_payload_objects
        (objectKey, nodeId, ownerIdentityId, actorIdentityId, tenantId, sha256, bytes, state, registeredAt, retiredAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'reserved', ?, NULL)`,
        [
          reference.key,
          nodeId,
          scope.ownerIdentityId,
          scope.actorIdentityId,
          scope.tenantId,
          reference.sha256,
          reference.bytes,
          integer(this.now()),
        ]
      );
    });
  }

  async uploaded(
    nodeId: string,
    reference: DiscussionPayloadReference,
    scope: DiscussionPayloadScope
  ): Promise<void> {
    assertDiscussionPayloadScope(scope);
    await this.source.transaction('READ COMMITTED', async (manager) => {
      await lockIdentityWrites(manager, [
        scope.ownerIdentityId,
        ...(scope.actorIdentityId === null ? [] : [scope.actorIdentityId]),
      ]);
      await advancePayload(
        manager,
        nodeId,
        reference,
        scope,
        'reserved',
        'uploaded'
      );
    });
  }

  async retiring(
    input: AccountErasureRequest
  ): Promise<DiscussionPayloadReference[]> {
    const request = accountErasureRequest(input);
    return this.source.transaction('READ COMMITTED', async (manager) => {
      await this.lockErasure(manager, request);
      // The erased owner lock excludes every writer of that owner's payloads, including staff/importers.
      const rows: Record<string, unknown>[] = await manager.query(
        `SELECT o.* FROM discussion_payload_objects o
        WHERE o.ownerIdentityId = ? AND o.state <> 'retired'
          AND NOT EXISTS (SELECT 1 FROM discussion_write_nodes n WHERE n.payloadKey = o.objectKey)
          AND NOT (o.state = 'anonymizing' AND EXISTS (
            SELECT 1 FROM discussion_write_nodes n WHERE n.nodeId=o.nodeId AND n.ownerIdentityId=o.ownerIdentityId))
        ORDER BY o.objectKey LIMIT 32 FOR UPDATE`,
        [request.identityId]
      );
      const records = rows.map(registeredDiscussionPayload);
      for (const record of records)
        await manager.query(
          "UPDATE discussion_payload_objects SET state = 'retiring' WHERE objectKey = ?",
          [record.reference.key]
        );
      return records.map((record) => record.reference);
    });
  }

  async retired(input: AccountErasureRequest, key: string): Promise<void> {
    const request = accountErasureRequest(input);
    await this.source.transaction('READ COMMITTED', async (manager) => {
      await this.lockErasure(manager, request);
      const [row]: Record<string, unknown>[] = await manager.query(
        'SELECT * FROM discussion_payload_objects WHERE objectKey = ? FOR UPDATE',
        [key]
      );
      if (!row) throw new Error('Missing discussion payload retirement');
      const stored = registeredDiscussionPayload(row);
      // A delayed confirmation may arrive after another worker removed private attribution.
      if (
        stored.ownerIdentityId !== request.identityId &&
        !(stored.ownerIdentityId === null && stored.state === 'retired')
      )
        throw new Error('Discussion payload retirement owner differs');
      const referenced: unknown[] = await manager.query(
        'SELECT 1 FROM discussion_write_nodes WHERE payloadKey = ? LIMIT 1',
        [key]
      );
      if (referenced.length || !['retiring', 'retired'].includes(stored.state))
        throw new Error('Discussion payload is not safely retired');
      if (stored.state === 'retired') return;
      await manager.query(
        "UPDATE discussion_payload_objects SET state = 'retired', retiredAt = ? WHERE objectKey = ?",
        [Math.max(stored.registeredAt, integer(this.now())), key]
      );
    });
  }

  private async lockErasure(
    manager: EntityManager,
    request: AccountErasureRequest
  ): Promise<void> {
    const [row]: Record<string, unknown>[] = await manager.query(
      'SELECT identityId, erasureRevision, requestedAt FROM identity_erasure_barriers WHERE identityId = ? FOR UPDATE',
      [request.identityId]
    );
    if (!row)
      throw new Error(
        'Discussion payload retirement requires an erasure barrier'
      );
    const barrier = identityErasureBarrier(row);
    const [receipt]: Record<string, unknown>[] = await manager.query(
      'SELECT revision, requestedAt, completedAt FROM identity_erasure_requests WHERE identityId = ? FOR UPDATE',
      [request.identityId]
    );
    if (
      barrier.erasureRevision !== request.revision ||
      !receipt ||
      integer(receipt.revision) !== request.revision ||
      integer(receipt.requestedAt) !== barrier.requestedAt ||
      receipt.completedAt !== null
    )
      throw new Error(
        'Discussion payload retirement requires the exact pending erasure request'
      );
  }
}
