import type { DataSource, EntityManager, QueryRunner } from 'typeorm';
import type { DiscussionPayloadReference } from '@apps/shared';
import {
  identityErasureBarrier,
  lockIdentityWrites,
} from '@wapps/account-mysql';
import { isCanonicalIdentityId } from '@sdk/features/identity/core';
import {
  discussionInventoryKey,
  type DiscussionInventoryDecision,
  type DiscussionInventoryItem,
  type DiscussionInventoryProgress,
  type DiscussionPayloadInventoryRepository,
} from '../application/discussion-payload-inventory';
import { assertDiscussionPayloadReference } from '../application/registered-discussion-payloads';
import { registeredDiscussionPayload } from './mysql-discussion-payloads';

type Row = Record<string, unknown>;
function integer(value: unknown): number {
  const result =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof result !== 'number' || !Number.isSafeInteger(result) || result < 1)
    throw new Error('Invalid payload inventory integer');
  return result;
}
export function discussionInventoryProgress(
  row: Row
): DiscussionInventoryProgress {
  const after = row.afterKey;
  if (
    integer(row.id) !== 1 ||
    typeof after !== 'string' ||
    (after !== '' && !discussionInventoryKey(after)) ||
    (row.lastPlanHash !== null &&
      (typeof row.lastPlanHash !== 'string' ||
        !/^[a-f0-9]{64}$/.test(row.lastPlanHash)))
  )
    throw new Error('Invalid payload inventory checkpoint');
  const completedAt =
    row.completedAt === null ? null : integer(row.completedAt);
  const legacyWritersStoppedAt =
    row.legacyWritersStoppedAt === null
      ? null
      : integer(row.legacyWritersStoppedAt);
  if (
    completedAt !== null &&
    (legacyWritersStoppedAt === null ||
      completedAt < legacyWritersStoppedAt ||
      row.lastPlanHash === null)
  )
    throw new Error('Invalid payload inventory completion');
  return {
    revision: integer(row.revision),
    after,
    completedAt,
    legacyWritersStoppedAt,
    lastPlanHash: row.lastPlanHash,
  };
}

export class MysqlDiscussionPayloadInventory
  implements DiscussionPayloadInventoryRepository
{
  private lease: QueryRunner | null = null;
  private running = false;
  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now
  ) {}

  async exclusive<T>(work: () => Promise<T>): Promise<T> {
    if (this.running) throw new Error('Payload inventory is already running');
    this.running = true;
    const runner = this.source.createQueryRunner();
    // Advisory ownership and every mutation use the same connection; losing it cannot leave a live worker.
    const name = `discussion-inventory:${this.source.options.database}`.slice(
      0,
      64
    );
    let acquired = false;
    try {
      await runner.connect();
      const [row]: Row[] = await runner.query(
        'SELECT GET_LOCK(?, 0) AS acquired',
        [name]
      );
      if (Number(row?.acquired) !== 1)
        throw new Error('Payload inventory is already running');
      acquired = true;
      this.lease = runner;
      return await work();
    } finally {
      this.lease = null;
      this.running = false;
      try {
        if (acquired) await runner.query('SELECT RELEASE_LOCK(?)', [name]);
      } finally {
        await runner.release();
      }
    }
  }

  async progress(): Promise<DiscussionInventoryProgress> {
    return this.readProgress(this.lease?.manager ?? this.source.manager, false);
  }
  classify(key: string): Promise<DiscussionInventoryDecision> {
    return (this.lease?.manager ?? this.source.manager).transaction(
      'REPEATABLE READ',
      (tx) => this.classifyIn(tx, key, false)
    );
  }

  adopt(
    item: DiscussionInventoryItem,
    reference: DiscussionPayloadReference
  ): Promise<void> {
    if (item.decision.kind !== 'adopt' || reference.key !== item.key)
      throw new Error('Invalid historical payload adoption');
    return this.mutate(item, (tx) =>
      this.register(tx, item, reference, 'uploaded')
    );
  }
  prepareCopy(
    item: DiscussionInventoryItem,
    reference: DiscussionPayloadReference
  ): Promise<void> {
    if (item.decision.kind !== 'copy-legacy')
      throw new Error('Invalid legacy copy');
    return this.mutate(item, (tx) =>
      this.register(tx, item, reference, 'reserved')
    );
  }
  confirmCopy(
    item: DiscussionInventoryItem,
    reference: DiscussionPayloadReference
  ): Promise<void> {
    if (item.decision.kind !== 'copy-legacy')
      throw new Error('Invalid legacy copy');
    return this.mutate(item, async (tx) => {
      await this.exactCopy(tx, item, reference, ['reserved', 'uploaded']);
      await tx.query(
        "UPDATE discussion_payload_objects SET state='uploaded' WHERE objectKey=?",
        [reference.key]
      );
    });
  }
  retire(
    item: DiscussionInventoryItem,
    writeMarker: () => Promise<void>,
    preserved?: DiscussionPayloadReference
  ): Promise<void> {
    if (
      !['copy-legacy', 'retire-orphan', 'retire-erased'].includes(
        item.decision.kind
      )
    )
      throw new Error('Invalid historical payload retirement');
    return this.mutate(item, async (tx) => {
      if (item.decision.kind === 'copy-legacy') {
        if (!preserved)
          throw new Error(
            'Legacy retirement requires a confirmed immutable copy'
          );
        await this.exactCopy(tx, item, preserved, ['uploaded']);
      }
      // Keep current-reference and registry gap locks until the conditional marker is durable.
      await writeMarker();
    });
  }

  advance(
    previous: DiscussionInventoryProgress,
    key: string
  ): Promise<DiscussionInventoryProgress> {
    if (
      !discussionInventoryKey(key) ||
      Buffer.compare(Buffer.from(key), Buffer.from(previous.after)) <= 0
    )
      throw new Error('Invalid payload inventory cursor');
    return this.changeProgress(previous, { ...previous, after: key });
  }
  finish(
    previous: DiscussionInventoryProgress,
    fingerprint: string,
    complete: boolean
  ): Promise<DiscussionInventoryProgress> {
    if (!/^[a-f0-9]{64}$/.test(fingerprint))
      throw new Error('Invalid payload inventory fingerprint');
    const at = Math.max(
      integer(this.now()),
      previous.legacyWritersStoppedAt ?? 1
    );
    return this.changeProgress(previous, {
      ...previous,
      completedAt: complete ? at : null,
      legacyWritersStoppedAt: previous.legacyWritersStoppedAt ?? at,
      lastPlanHash: fingerprint,
    });
  }

  private transaction<T>(work: (tx: EntityManager) => Promise<T>): Promise<T> {
    if (!this.lease)
      throw new Error(
        'Payload inventory mutation requires exclusive ownership'
      );
    return this.lease.manager.transaction('REPEATABLE READ', work);
  }
  private mutate(
    item: DiscussionInventoryItem,
    work: (tx: EntityManager) => Promise<void>
  ): Promise<void> {
    return this.transaction(async (tx) => {
      const owner = item.decision.ownerIdentityId;
      if (owner !== null) {
        if (item.decision.erasureRevision === null)
          await lockIdentityWrites(tx, [owner]);
        else if (
          (await this.erasureRevision(tx, owner, true)) !==
          item.decision.erasureRevision
        )
          throw new Error('Payload inventory erasure authority changed');
      }
      const current = await this.classifyIn(tx, item.key, true);
      if (JSON.stringify(current) !== JSON.stringify(item.decision))
        throw new Error(
          'Payload inventory authority changed; review a new plan'
        );
      await work(tx);
    });
  }
  private async erasureRevision(
    tx: EntityManager,
    owner: string,
    lock: boolean
  ): Promise<number | null> {
    const suffix = lock ? ' FOR UPDATE' : '';
    const [row]: Row[] = await tx.query(
      `SELECT identityId, erasureRevision, requestedAt FROM identity_erasure_barriers WHERE identityId=?${suffix}`,
      [owner]
    );
    if (!row) return null;
    const barrier = identityErasureBarrier(row);
    if (barrier.erasureRevision === null) return null;
    const [request]: Row[] = await tx.query(
      `SELECT revision, requestedAt, completedAt FROM identity_erasure_requests WHERE identityId=?${suffix}`,
      [owner]
    );
    if (
      !request ||
      integer(request.revision) !== barrier.erasureRevision ||
      integer(request.requestedAt) !== barrier.requestedAt ||
      request.completedAt !== null
    )
      throw new Error(
        'Historical retirement requires the exact pending erasure request'
      );
    return barrier.erasureRevision;
  }

  private async classifyIn(
    tx: EntityManager,
    key: string,
    lock: boolean
  ): Promise<DiscussionInventoryDecision> {
    const parsed = discussionInventoryKey(key);
    const decision: DiscussionInventoryDecision = {
      kind: 'blocked',
      nodeId: parsed?.nodeId ?? null,
      ownerIdentityId: null,
      tenantId: null,
      erasureRevision: null,
      reason: null,
    };
    if (!parsed)
      return {
        ...decision,
        reason: 'Unrecognized object key requires operator investigation',
      };
    const suffix = lock ? ' FOR UPDATE' : '';
    // Discover the immutable root, then acquire locks in the writer's aggregate-before-node order.
    const [hint]: Row[] = await tx.query(
      'SELECT discussionId FROM discussion_write_nodes WHERE nodeId=?',
      [parsed.nodeId]
    );
    const [aggregate]: Row[] = await tx.query(
      `SELECT id, tenantId FROM discussion_write_aggregates WHERE id=?${suffix}`,
      [hint?.discussionId ?? parsed.nodeId]
    );
    const [node]: Row[] = await tx.query(
      `SELECT * FROM discussion_write_nodes WHERE nodeId=?${suffix}`,
      [parsed.nodeId]
    );
    const [content]: Row[] = await tx.query(
      `SELECT id, kind FROM content_nodes WHERE id=?${suffix}`,
      [parsed.nodeId]
    );
    const [record]: Row[] = await tx.query(
      `SELECT * FROM discussion_payload_objects WHERE objectKey=?${suffix}`,
      [key]
    );
    const references: Row[] = await tx.query(
      `SELECT nodeId, ownerIdentityId, payloadHash, payloadBytes FROM discussion_write_nodes WHERE payloadKey=? LIMIT 2${suffix}`,
      [key]
    );
    if (record) {
      const stored = registeredDiscussionPayload(record);
      if (
        stored.nodeId !== parsed.nodeId ||
        parsed.legacy ||
        (references.length &&
          (references.length !== 1 ||
            references[0].nodeId !== stored.nodeId ||
            stored.state !== 'committed' ||
            references[0].ownerIdentityId !== stored.ownerIdentityId ||
            references[0].payloadHash !== stored.reference.sha256 ||
            integer(references[0].payloadBytes) !== stored.reference.bytes))
      )
        throw new Error('Registered payload disagrees with current authority');
      if (
        node &&
        (!content ||
          !aggregate ||
          node.nodeId !== parsed.nodeId ||
          content.id !== parsed.nodeId ||
          aggregate.id !== node.discussionId ||
          node.discussionId !== hint?.discussionId ||
          node.ownerIdentityId !== stored.ownerIdentityId ||
          aggregate.tenantId !== stored.tenantId)
      )
        throw new Error(
          'Registered payload ownership disagrees with authority'
        );
      return {
        ...decision,
        kind: 'tracked',
        ownerIdentityId: stored.ownerIdentityId,
        tenantId: stored.tenantId,
      };
    }
    if (references.length)
      throw new Error('Current payload has no valid registration');
    if (node) {
      if (
        !content ||
        !aggregate ||
        node.nodeId !== parsed.nodeId ||
        content.id !== parsed.nodeId ||
        aggregate.id !== node.discussionId ||
        node.discussionId !== hint?.discussionId ||
        !isCanonicalIdentityId(node.ownerIdentityId) ||
        !isCanonicalIdentityId(aggregate.tenantId) ||
        !['discussion', 'comment'].includes(String(content.kind))
      )
        throw new Error(
          'Historical payload has inconsistent canonical ownership'
        );
      const erasureRevision = await this.erasureRevision(
        tx,
        node.ownerIdentityId,
        false
      );
      return {
        ...decision,
        kind:
          erasureRevision === null
            ? parsed.legacy
              ? 'copy-legacy'
              : 'adopt'
            : 'retire-erased',
        ownerIdentityId: node.ownerIdentityId,
        tenantId: aggregate.tenantId,
        erasureRevision,
      };
    }
    if (content)
      return {
        ...decision,
        reason: 'Legacy content requires reviewed ownership backfill',
      };
    if (aggregate)
      return { ...decision, reason: 'Canonical aggregate has no content node' };
    for (const column of ['fromContentId', 'toContentId']) {
      const relations: Row[] = await tx.query(
        `SELECT id FROM content_node_relations WHERE ${column}=? LIMIT 1${suffix}`,
        [parsed.nodeId]
      );
      if (relations.length)
        return {
          ...decision,
          reason: 'Canonical relation has no content node',
        };
    }
    // The node index range lock excludes registrations for a not-yet-published node while retiring an orphan.
    const related: Row[] = await tx.query(
      `SELECT objectKey FROM discussion_payload_objects WHERE nodeId=? LIMIT 1${suffix}`,
      [parsed.nodeId]
    );
    if (related.length)
      return {
        ...decision,
        reason:
          'Unpublished node has registered payloads; ownership must be resolved',
      };
    return { ...decision, kind: 'retire-orphan' };
  }

  private async register(
    tx: EntityManager,
    item: DiscussionInventoryItem,
    reference: DiscussionPayloadReference,
    state: 'reserved' | 'uploaded'
  ): Promise<void> {
    const { nodeId, ownerIdentityId, tenantId } = item.decision;
    if (nodeId === null || ownerIdentityId === null || tenantId === null)
      throw new Error('Missing historical payload owner');
    assertDiscussionPayloadReference(nodeId, reference);
    const [existing]: Row[] = await tx.query(
      'SELECT * FROM discussion_payload_objects WHERE objectKey=? FOR UPDATE',
      [reference.key]
    );
    if (existing) {
      await this.exactCopy(tx, item, reference, ['reserved', 'uploaded']);
      return;
    }
    await tx.query(
      `INSERT INTO discussion_payload_objects (objectKey, nodeId, ownerIdentityId, actorIdentityId, tenantId, sha256, bytes, state, registeredAt, retiredAt) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL)`,
      [
        reference.key,
        nodeId,
        ownerIdentityId,
        tenantId,
        reference.sha256,
        reference.bytes,
        state,
        integer(this.now()),
      ]
    );
  }
  private async exactCopy(
    tx: EntityManager,
    item: DiscussionInventoryItem,
    reference: DiscussionPayloadReference,
    states: string[]
  ): Promise<void> {
    if (item.decision.nodeId === null) throw new Error('Missing legacy node');
    assertDiscussionPayloadReference(item.decision.nodeId, reference);
    const [row]: Row[] = await tx.query(
      'SELECT * FROM discussion_payload_objects WHERE objectKey=? FOR UPDATE',
      [reference.key]
    );
    if (!row) throw new Error('Historical copy has no reservation');
    const record = registeredDiscussionPayload(row);
    if (
      !states.includes(record.state) ||
      record.nodeId !== item.decision.nodeId ||
      record.ownerIdentityId !== item.decision.ownerIdentityId ||
      record.tenantId !== item.decision.tenantId ||
      record.actorIdentityId !== null ||
      record.reference.sha256 !== reference.sha256 ||
      record.reference.bytes !== reference.bytes
    )
      throw new Error('Historical copy differs from its reservation');
  }
  private async readProgress(
    tx: EntityManager,
    lock: boolean
  ): Promise<DiscussionInventoryProgress> {
    const rows: Row[] = await tx.query(
      `SELECT * FROM discussion_payload_inventory${lock ? ' FOR UPDATE' : ''}`
    );
    if (rows.length !== 1)
      throw new Error('Missing or inconsistent payload inventory checkpoint');
    return discussionInventoryProgress(rows[0]);
  }
  private changeProgress(
    previous: DiscussionInventoryProgress,
    next: DiscussionInventoryProgress
  ): Promise<DiscussionInventoryProgress> {
    return this.transaction(async (tx) => {
      const current = await this.readProgress(tx, true);
      if (
        current.completedAt !== null ||
        JSON.stringify(current) !== JSON.stringify(previous) ||
        current.revision >= Number.MAX_SAFE_INTEGER
      )
        throw new Error('Payload inventory checkpoint changed');
      const result = { ...next, revision: current.revision + 1 };
      await tx.query(
        'UPDATE discussion_payload_inventory SET revision=?, afterKey=?, completedAt=?, legacyWritersStoppedAt=?, lastPlanHash=? WHERE id=1',
        [
          result.revision,
          result.after,
          result.completedAt,
          result.legacyWritersStoppedAt,
          result.lastPlanHash,
        ]
      );
      return result;
    });
  }
}
