import { randomUUID } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import {
  DISCUSSION_MAX_GENERATION_BYTES,
  DISCUSSION_MAX_NODES,
  type DiscussionPayloadReference,
} from '@apps/shared';
import { publicCommentId } from '@sdk/features/discussion/core';
import {
  accountErasureRequest,
  isCanonicalIdentityId,
  type AccountErasureRequest,
} from '@sdk/features/identity/core';
import { identityErasureBarrier } from '@sdk/extras/identity-mysql';
import type {
  DiscussionContributionErasureRepository,
  DiscussionErasureNode,
} from '../application/anonymize-discussion-contributions';
import { assertDiscussionPayloadReference } from '../application/registered-discussion-payloads';
import { registeredDiscussionPayload } from './mysql-discussion-payloads';
import { discussionInventoryProgress } from './mysql-discussion-payload-inventory';

type Row = Record<string, unknown>;
function integer(value: unknown): number {
  const result =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof result !== 'number' || !Number.isSafeInteger(result) || result < 1)
    throw new Error('Invalid Discussion erasure integer');
  return result;
}
export async function lockDiscussionErasureState(
  tx: EntityManager,
  input: AccountErasureRequest
): Promise<{
  request: AccountErasureRequest;
  requestedAt: number;
  completedAt: number | null;
}> {
  const request = accountErasureRequest(input);
  if (!tx.queryRunner?.isTransactionActive)
    throw new Error('Discussion erasure requires a canonical transaction');
  const [row]: Row[] = await tx.query(
    'SELECT identityId,erasureRevision,requestedAt FROM identity_erasure_barriers WHERE identityId=? FOR UPDATE',
    [request.identityId]
  );
  const [receipt]: Row[] = await tx.query(
    'SELECT revision,requestedAt,completedAt FROM identity_erasure_requests WHERE identityId=? FOR UPDATE',
    [request.identityId]
  );
  if (!row || !receipt) throw new Error('Missing Discussion erasure request');
  const barrier = identityErasureBarrier(row);
  if (
    barrier.identityId !== request.identityId ||
    barrier.erasureRevision !== request.revision ||
    integer(receipt.revision) !== request.revision ||
    integer(receipt.requestedAt) !== barrier.requestedAt
  )
    throw new Error(
      'Discussion cleanup requires the exact pending erasure request'
    );
  const completedAt =
    receipt.completedAt === null ? null : integer(receipt.completedAt);
  if (completedAt !== null && completedAt < integer(receipt.requestedAt))
    throw new Error('Invalid Discussion erasure completion time');
  return { request, requestedAt: integer(receipt.requestedAt), completedAt };
}

export async function lockDiscussionErasure(
  tx: EntityManager,
  input: AccountErasureRequest
): Promise<AccountErasureRequest> {
  const { request, completedAt } = await lockDiscussionErasureState(tx, input);
  if (completedAt !== null)
    throw new Error('Discussion cleanup requires the exact pending erasure');
  const progress: Row[] = await tx.query(
    'SELECT * FROM discussion_payload_inventory'
  );
  if (
    progress.length !== 1 ||
    discussionInventoryProgress(progress[0]).completedAt === null
  )
    throw new Error(
      'Discussion payload inventory must complete before erasure cleanup'
    );
  return request;
}

export class MysqlDiscussionContributionErasure
  implements DiscussionContributionErasureRepository
{
  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now
  ) {}

  next(input: AccountErasureRequest): Promise<DiscussionErasureNode | null> {
    return this.source.transaction('REPEATABLE READ', async (tx) => {
      const request = await lockDiscussionErasure(tx, input);
      const [row]: Row[] = await tx.query(
        'SELECT nodeId FROM discussion_write_nodes WHERE ownerIdentityId=? ORDER BY discussionId,nodeId LIMIT 1',
        [request.identityId]
      );
      return row
        ? this.read(tx, publicCommentId(row.nodeId), request.identityId)
        : null;
    });
  }

  reserve(
    input: AccountErasureRequest,
    node: DiscussionErasureNode,
    reference: DiscussionPayloadReference
  ): Promise<boolean> {
    if (!node.retain)
      throw new Error('Private contribution cannot reserve a public copy');
    assertDiscussionPayloadReference(node.id, reference);
    return this.mutate(input, node, async (tx, request) => {
      const [row]: Row[] = await tx.query(
        'SELECT * FROM discussion_payload_objects WHERE objectKey=? FOR UPDATE',
        [reference.key]
      );
      if (row) {
        this.requireReservation(row, request, node, reference);
        return;
      }
      await tx.query(
        `INSERT INTO discussion_payload_objects (objectKey,nodeId,ownerIdentityId,actorIdentityId,tenantId,sha256,bytes,state,registeredAt,retiredAt) VALUES (?,?,?,NULL,?,?,?,'anonymizing',?,NULL)`,
        [
          reference.key,
          node.id,
          request.identityId,
          node.tenantId,
          reference.sha256,
          reference.bytes,
          integer(this.now()),
        ]
      );
    });
  }

  async commit(
    input: AccountErasureRequest,
    node: DiscussionErasureNode,
    reference: DiscussionPayloadReference | null
  ): Promise<void> {
    if (node.retain !== (reference !== null))
      throw new Error('Invalid Discussion retention decision');
    if (reference) assertDiscussionPayloadReference(node.id, reference);
    await this.mutate(input, node, async (tx, request, revision) => {
      if (reference) {
        if (reference.bytes > (node.payload?.bytes ?? 0)) {
          // Noncanonical legacy JSON can grow when serialized; never publish an unmaterializable aggregate.
          const sizes: Row[] = await tx.query(
            'SELECT payloadBytes FROM discussion_write_nodes WHERE discussionId=? LIMIT ? FOR UPDATE',
            [node.discussionId, DISCUSSION_MAX_NODES + 1]
          );
          const total = sizes.reduce(
            (sum, row) =>
              sum + (row.payloadBytes === null ? 0 : integer(row.payloadBytes)),
            0
          );
          if (
            sizes.length > DISCUSSION_MAX_NODES ||
            total + reference.bytes - (node.payload?.bytes ?? 0) >
              DISCUSSION_MAX_GENERATION_BYTES
          )
            throw new Error(
              'Anonymous Discussion copy exceeds the aggregate payload limit'
            );
        }
        const [row]: Row[] = await tx.query(
          'SELECT * FROM discussion_payload_objects WHERE objectKey=? FOR UPDATE',
          [reference.key]
        );
        if (!row)
          throw new Error(
            'Anonymous contribution copy has no durable reservation'
          );
        this.requireReservation(row, request, node, reference);
        await tx.query(
          "UPDATE discussion_payload_objects SET ownerIdentityId=NULL, state='committed' WHERE objectKey=?",
          [reference.key]
        );
      }
      const at = integer(this.now());
      await tx.query(
        'UPDATE discussion_write_nodes SET ownerIdentityId=NULL,payloadKey=?,payloadHash=?,payloadBytes=? WHERE nodeId=?',
        [
          reference?.key ?? null,
          reference?.sha256 ?? null,
          reference?.bytes ?? null,
          node.id,
        ]
      );
      await tx.query(
        'UPDATE content_nodes SET updatedAt=GREATEST(createdAt,COALESCE(updatedAt,createdAt),?), deletedAt=? WHERE id=?',
        [at, node.retain ? null : node.deletedAt ?? at, node.id]
      );
      await tx.query(
        'UPDATE discussion_write_aggregates SET revision=? WHERE id=?',
        [revision + 1, node.discussionId]
      );
      await tx.query(
        'INSERT INTO discussion_erasure_nodes (identityId,erasureRevision,nodeId,discussionId,projectionRevision) VALUES (?,?,?,?,?)',
        [
          request.identityId,
          request.revision,
          node.id,
          node.discussionId,
          revision + 1,
        ]
      );
      await tx.query(
        'INSERT INTO discussion_outbox (id,discussionId,revision,createdAt,availableAt) VALUES (?,?,?,?,?)',
        [randomUUID(), node.discussionId, revision + 1, at, at]
      );
    });
  }

  private mutate(
    input: AccountErasureRequest,
    node: DiscussionErasureNode,
    work: (
      tx: EntityManager,
      request: AccountErasureRequest,
      revision: number
    ) => Promise<void>
  ): Promise<boolean> {
    return this.source.transaction('REPEATABLE READ', async (tx) => {
      const request = await lockDiscussionErasure(tx, input);
      const [aggregate]: Row[] = await tx.query(
        'SELECT revision FROM discussion_write_aggregates WHERE id=? FOR UPDATE',
        [node.discussionId]
      );
      if (!aggregate) throw new Error('Missing Discussion erasure aggregate');
      const revision = integer(aggregate.revision);
      if (revision >= Number.MAX_SAFE_INTEGER)
        throw new Error('Discussion revision limit reached');
      // The inventory read may have established an older repeatable-read snapshot.
      // Revalidate using current reads after the aggregate lock, including moderation.
      const current = await this.read(tx, node.id, request.identityId, true);
      if (current === null) {
        const [finished]: Row[] = await tx.query(
          'SELECT erasureRevision,discussionId FROM discussion_erasure_nodes WHERE identityId=? AND nodeId=? FOR UPDATE',
          [request.identityId, node.id]
        );
        if (
          !finished ||
          integer(finished.erasureRevision) !== request.revision ||
          finished.discussionId !== node.discussionId
        )
          throw new Error('Discussion erasure lost its canonical contribution');
        return false;
      }
      if (JSON.stringify(current) !== JSON.stringify(node))
        throw new Error(
          'Discussion contribution changed during erasure; retry from authority'
        );
      await work(tx, request, revision);
      return true;
    });
  }

  private requireReservation(
    row: Row,
    request: AccountErasureRequest,
    node: DiscussionErasureNode,
    reference: DiscussionPayloadReference
  ): void {
    const stored = registeredDiscussionPayload(row);
    if (
      stored.ownerIdentityId !== request.identityId ||
      stored.actorIdentityId !== null ||
      stored.nodeId !== node.id ||
      stored.tenantId !== node.tenantId ||
      stored.state !== 'anonymizing' ||
      stored.reference.key !== reference.key ||
      stored.reference.sha256 !== reference.sha256 ||
      stored.reference.bytes !== reference.bytes
    )
      throw new Error('Anonymous contribution differs from its reservation');
  }

  private async read(
    tx: EntityManager,
    id: string,
    owner: string,
    lock = false
  ): Promise<DiscussionErasureNode | null> {
    const [row]: Row[] = await tx.query(
      `SELECT m.nodeId,m.discussionId,m.ownerIdentityId,m.payloadKey,m.payloadHash,m.payloadBytes,a.tenantId,a.subjectId,a.subjectKind,n.kind,n.state,n.visibility,n.deletedAt,root.kind rootKind,root.state rootState,root.visibility rootVisibility,root.deletedAt rootDeletedAt
      FROM discussion_write_nodes m JOIN discussion_write_aggregates a ON a.id=m.discussionId JOIN content_nodes n ON n.id=m.nodeId JOIN content_nodes root ON root.id=m.discussionId JOIN discussion_write_nodes rootMap ON rootMap.nodeId=a.id AND rootMap.discussionId=a.id WHERE m.nodeId=?${
        lock ? ' FOR UPDATE' : ''
      }`,
      [id]
    );
    if (!row) throw new Error('Incomplete canonical Discussion erasure graph');
    if (row.ownerIdentityId !== owner) {
      if (row.ownerIdentityId === null) return null;
      throw new Error('Discussion erasure owner changed');
    }
    if (
      !isCanonicalIdentityId(row.tenantId) ||
      row.rootKind !== 'discussion' ||
      (row.nodeId === row.discussionId
        ? row.kind !== 'discussion'
        : row.kind !== 'comment') ||
      !['discussion', 'comment'].includes(String(row.kind)) ||
      !['draft', 'published', 'archived'].includes(String(row.state)) ||
      !['draft', 'published', 'archived'].includes(String(row.rootState)) ||
      !['public', 'private', 'unlisted'].includes(String(row.visibility)) ||
      !['public', 'private', 'unlisted'].includes(String(row.rootVisibility)) ||
      (row.subjectKind !== null &&
        row.subjectKind !== 'article' &&
        row.subjectKind !== 'application')
    )
      throw new Error('Invalid canonical Discussion erasure scope');
    const payload =
      row.payloadKey === null
        ? null
        : {
            key: String(row.payloadKey),
            sha256: String(row.payloadHash),
            bytes: integer(row.payloadBytes),
          };
    if (payload) assertDiscussionPayloadReference(id, payload);
    else if (row.payloadHash !== null || row.payloadBytes !== null)
      throw new Error('Incomplete Discussion payload reference');
    const deletedAt = row.deletedAt === null ? null : integer(row.deletedAt);
    const rootDeletedAt =
      row.rootDeletedAt === null ? null : integer(row.rootDeletedAt);
    const retain =
      deletedAt === null &&
      rootDeletedAt === null &&
      row.state === 'published' &&
      row.rootState === 'published' &&
      row.visibility !== 'private' &&
      row.rootVisibility !== 'private';
    if (retain && !payload)
      throw new Error('Missing public Discussion payload');
    return {
      id: publicCommentId(row.nodeId),
      discussionId: publicCommentId(row.discussionId),
      tenantId: row.tenantId,
      target:
        row.subjectKind === null
          ? null
          : { kind: row.subjectKind, id: publicCommentId(row.subjectId) },
      kind: row.kind === 'discussion' ? 'discussion' : 'comment',
      state: String(row.state),
      visibility: String(row.visibility),
      deletedAt,
      rootState: String(row.rootState),
      rootVisibility: String(row.rootVisibility),
      rootDeletedAt,
      payload,
      retain,
    };
  }
}
