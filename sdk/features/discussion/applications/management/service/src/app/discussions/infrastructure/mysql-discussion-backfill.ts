import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { DISCUSSION_MAX_DEPTH, DISCUSSION_MAX_NODES } from '@apps/shared';
import {
  DiscussionBackfillReceipt,
  LegacyDiscussionNode,
  LegacyDiscussionRelation,
  LegacyDiscussionRepository,
  LegacyDiscussionSnapshot,
  PreparedDiscussionBackfill,
  legacyDiscussionFingerprint,
} from '../application/legacy-discussion-backfill';
import {
  DiscussionConflictError,
  DiscussionValidationError,
} from '../application/discussion-write.port';
import { safeSqlInteger } from './mysql-discussion-writes';
import { lockIdentityWrites } from '@sdk/extras/identity-mysql';
import { commitDiscussionPayload } from './mysql-discussion-payloads';

type Numeric = string | number;
type NodeRow = Omit<
  LegacyDiscussionNode,
  'createdAt' | 'updatedAt' | 'deletedAt' | 'likeCount'
> & {
  createdAt: Numeric;
  updatedAt: Numeric | null;
  deletedAt: Numeric | null;
};

export class MysqlDiscussionBackfill implements LegacyDiscussionRepository {
  constructor(private readonly db: DataSource) {}

  read(discussionId: string): Promise<LegacyDiscussionSnapshot> {
    return this.db.transaction('REPEATABLE READ', (tx) =>
      this.readSnapshot(tx, discussionId, false)
    );
  }

  receipt(discussionId: string): Promise<DiscussionBackfillReceipt | null> {
    return this.readReceipt(this.db.manager, discussionId);
  }

  async commit(
    prepared: PreparedDiscussionBackfill
  ): Promise<DiscussionBackfillReceipt> {
    return this.db.transaction('REPEATABLE READ', async (tx) => {
      const ownersToLock = [
        ...new Set(prepared.manifest.owners.map((owner) => owner.identityId)),
      ].sort();
      for (let start = 0; start < ownersToLock.length; start += 8)
        await lockIdentityWrites(tx, ownersToLock.slice(start, start + 8));
      // Every importer locks the existing root before checking the receipt.
      const root = await tx.query<Array<{ id: string }>>(
        'SELECT id FROM content_nodes WHERE id = ? FOR UPDATE',
        [prepared.manifest.discussionId]
      );
      if (!root.length)
        throw new DiscussionConflictError('Legacy root disappeared');
      const receipt = await this.readReceipt(
        tx,
        prepared.manifest.discussionId
      );
      if (receipt) {
        if (
          receipt.fingerprint !== prepared.fingerprint ||
          receipt.manifestFingerprint !== prepared.manifestFingerprint
        )
          throw new DiscussionConflictError(
            'Discussion was backfilled with another plan'
          );
        return receipt;
      }
      const current = await this.readSnapshot(
        tx,
        prepared.manifest.discussionId,
        true
      );
      if (legacyDiscussionFingerprint(current) !== prepared.sourceFingerprint)
        throw new DiscussionConflictError(
          'Legacy graph changed during backfill'
        );
      const rootNode = current.nodes.find(
        (node) => node.id === current.discussionId
      );
      if (!rootNode)
        throw new DiscussionConflictError('Legacy root disappeared');
      await tx.query(
        'INSERT INTO discussion_write_aggregates (id, tenantId, revision, subjectId, createdAt) VALUES (?, ?, 1, ?, ?)',
        [
          current.discussionId,
          prepared.manifest.tenantId,
          prepared.subjectId,
          rootNode.createdAt,
        ]
      );
      const owners = new Map(
        prepared.manifest.owners.map((owner) => [
          owner.nodeId,
          owner.identityId,
        ])
      );
      for (const { nodeId, reference } of prepared.payloads) {
        const owner = owners.get(nodeId);
        if (!owner)
          throw new DiscussionValidationError('Missing verified owner');
        if (reference)
          await commitDiscussionPayload(tx, nodeId, reference, {
            tenantId: prepared.manifest.tenantId,
            ownerIdentityId: owner,
            actorIdentityId: null,
          });
        await tx.query(
          'INSERT INTO discussion_write_nodes (nodeId, discussionId, ownerIdentityId, payloadKey, payloadHash, payloadBytes) VALUES (?, ?, ?, ?, ?, ?)',
          [
            nodeId,
            current.discussionId,
            owner,
            reference?.key ?? null,
            reference?.sha256 ?? null,
            reference?.bytes ?? null,
          ]
        );
      }
      const committedAt = Date.now();
      await tx.query(
        'INSERT INTO discussion_outbox (id, discussionId, revision, createdAt, availableAt) VALUES (?, ?, 1, ?, ?)',
        [randomUUID(), current.discussionId, committedAt, committedAt]
      );
      await tx.query(
        'INSERT INTO discussion_backfills (discussionId, manifestFingerprint, fingerprint, revision, committedAt) VALUES (?, ?, ?, 1, ?)',
        [
          current.discussionId,
          prepared.manifestFingerprint,
          prepared.fingerprint,
          committedAt,
        ]
      );
      return {
        discussionId: current.discussionId,
        manifestFingerprint: prepared.manifestFingerprint,
        fingerprint: prepared.fingerprint,
        revision: 1,
        committedAt,
      };
    });
  }

  private async readReceipt(
    tx: EntityManager,
    discussionId: string
  ): Promise<DiscussionBackfillReceipt | null> {
    const rows = await tx.query<
      Array<
        Omit<DiscussionBackfillReceipt, 'revision' | 'committedAt'> & {
          revision: Numeric;
          committedAt: Numeric;
        }
      >
    >(
      'SELECT discussionId, manifestFingerprint, fingerprint, revision, committedAt FROM discussion_backfills WHERE discussionId = ?',
      [discussionId]
    );
    if (!rows.length) return null;
    if (safeSqlInteger(rows[0].revision) !== 1)
      throw new Error('Invalid backfill receipt revision');
    return {
      ...rows[0],
      revision: 1,
      committedAt: safeSqlInteger(rows[0].committedAt),
    };
  }

  private async readSnapshot(
    tx: EntityManager,
    discussionId: string,
    lock: boolean
  ): Promise<LegacyDiscussionSnapshot> {
    const suffix = lock ? ' FOR UPDATE' : '';
    const nodes: LegacyDiscussionNode[] = [];
    const seen = new Set<string>();
    let frontier = [discussionId];
    let depth = 0;
    while (frontier.length) {
      if (depth++ > DISCUSSION_MAX_DEPTH)
        throw new DiscussionValidationError('Legacy reply depth exceeds limit');
      const placeholders = frontier.map(() => '?').join(',');
      const rows = await tx.query<NodeRow[]>(
        `SELECT id, referenceKey, kind, state, visibility, createdAt, updatedAt, deletedAt FROM content_nodes WHERE id IN (${placeholders})${suffix}`,
        frontier
      );
      if (rows.length !== frontier.length)
        throw new DiscussionValidationError('Missing legacy node');
      for (const row of rows) {
        seen.add(row.id);
        nodes.push({
          ...row,
          createdAt: safeSqlInteger(row.createdAt),
          updatedAt:
            row.updatedAt === null ? null : safeSqlInteger(row.updatedAt),
          deletedAt:
            row.deletedAt === null ? null : safeSqlInteger(row.deletedAt),
          likeCount: 0,
        });
      }
      const children = await tx.query<Array<{ fromContentId: string }>>(
        `SELECT fromContentId FROM content_node_relations WHERE relationType = 'replies' AND toContentId IN (${placeholders}) LIMIT ?${suffix}`,
        [...frontier, DISCUSSION_MAX_NODES + 1]
      );
      if (children.length > DISCUSSION_MAX_NODES)
        throw new DiscussionValidationError('Too many legacy relations');
      frontier = [
        ...new Set(
          children
            .map((child) => child.fromContentId)
            .filter((id) => !seen.has(id))
        ),
      ];
      if (seen.size + frontier.length > DISCUSSION_MAX_NODES)
        throw new DiscussionValidationError(
          'Legacy discussion exceeds node limit'
        );
    }
    const ids = nodes.map((node) => node.id);
    const placeholders = ids.map(() => '?').join(',');
    const versioned = await tx.query<Array<{ nodeId: string }>>(
      `SELECT nodeId FROM discussion_write_nodes WHERE nodeId IN (${placeholders}) LIMIT 1${suffix}`,
      ids
    );
    const aggregate = await tx.query<Array<{ id: string }>>(
      `SELECT id FROM discussion_write_aggregates WHERE id = ?${suffix}`,
      [discussionId]
    );
    if (versioned.length || aggregate.length)
      throw new DiscussionConflictError(
        'Legacy graph is already or partially versioned'
      );
    const relations = await tx.query<
      Array<
        Omit<LegacyDiscussionRelation, 'createdAt'> & { createdAt: Numeric }
      >
    >(
      `SELECT id, fromContentId, toContentId, relationType, createdAt FROM content_node_relations WHERE fromContentId IN (${placeholders}) LIMIT ?${suffix}`,
      [...ids, DISCUSSION_MAX_NODES + 1]
    );
    if (relations.length > DISCUSSION_MAX_NODES)
      throw new DiscussionValidationError('Too many legacy relations');
    const likes = await tx.query<Array<{ commentId: string; count: Numeric }>>(
      `SELECT commentId, COUNT(*) count FROM comment_likes WHERE commentId IN (${placeholders}) GROUP BY commentId`,
      ids
    );
    const counts = new Map(
      likes.map((like) => [like.commentId, safeSqlInteger(like.count)])
    );
    return {
      discussionId,
      nodes: nodes.map((node) => ({
        ...node,
        likeCount: counts.get(node.id) ?? 0,
      })),
      relations: relations.map((relation) => ({
        ...relation,
        createdAt: safeSqlInteger(relation.createdAt),
      })),
    };
  }
}
