import type { Pool, RowDataPacket } from 'mysql2/promise';
import {
  DISCUSSION_MAX_NODES,
  DiscussionSnapshot,
  DiscussionSnapshotNode,
} from '@apps/shared';
import {
  DiscussionSnapshotReader,
  InvalidSnapshotError,
} from './materialization';

type SqlNumber = number | string;
type NodeRow = Omit<
  DiscussionSnapshotNode,
  'payload' | 'parentId' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'likeCount'
> & {
  foundId: string | null;
  createdAt: SqlNumber;
  updatedAt: SqlNumber | null;
  deletedAt: SqlNumber | null;
  payloadKey: string | null;
  payloadHash: string | null;
  payloadBytes: SqlNumber | null;
};

function integer(value: SqlNumber): number {
  const parsed =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isSafeInteger(parsed) || parsed < 0)
    throw new InvalidSnapshotError('Invalid authoritative integer');
  return parsed;
}

export class MysqlDiscussionSnapshotReader implements DiscussionSnapshotReader {
  constructor(private readonly pool: Pool) {}

  async read(discussionId: string): Promise<DiscussionSnapshot> {
    const connection = await this.pool.getConnection();
    try {
      await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      await connection.beginTransaction();
      const [aggregates] = await connection.query<
        Array<
          RowDataPacket & {
            tenantId: string;
            revision: SqlNumber;
            subjectId: string | null;
            subjectKind: string | null;
          }
        >
      >(
        'SELECT tenantId, revision, subjectId, subjectKind FROM discussion_write_aggregates WHERE id = ?',
        [discussionId]
      );
      if (aggregates.length !== 1)
        throw new InvalidSnapshotError(
          'Missing versioned discussion aggregate'
        );
      const aggregate = aggregates[0];
      if (
        aggregate.subjectKind !== null &&
        aggregate.subjectKind !== 'article' &&
        aggregate.subjectKind !== 'application'
      )
        throw new InvalidSnapshotError('Invalid discussion target kind');
      if (aggregate.subjectKind !== null && !aggregate.subjectId)
        throw new InvalidSnapshotError('Missing discussion target');
      const [rows] = await connection.query<Array<RowDataPacket & NodeRow>>(
        `SELECT m.nodeId id, n.id foundId,
        n.referenceKey, n.kind, n.state, n.visibility, n.createdAt, n.updatedAt, n.deletedAt,
        m.ownerIdentityId, m.payloadKey, m.payloadHash, m.payloadBytes
        FROM discussion_write_nodes m LEFT JOIN content_nodes n ON n.id = m.nodeId
        WHERE m.discussionId = ? ORDER BY m.nodeId LIMIT ?`,
        [discussionId, DISCUSSION_MAX_NODES + 1]
      );
      if (!rows.length || rows.length > DISCUSSION_MAX_NODES)
        throw new InvalidSnapshotError('Invalid discussion node count');
      const [relations] = await connection.query<
        Array<
          RowDataPacket & {
            fromContentId: string;
            toContentId: string;
            relationType: string;
          }
        >
      >(
        `
        SELECT r.fromContentId, r.toContentId, r.relationType FROM content_node_relations r
        JOIN discussion_write_nodes m ON m.nodeId = r.fromContentId
        WHERE m.discussionId = ? AND r.relationType IN ('replies', 'discusses') LIMIT ?`,
        [discussionId, DISCUSSION_MAX_NODES * 2 + 1]
      );
      if (relations.length > DISCUSSION_MAX_NODES * 2)
        throw new InvalidSnapshotError('Too many discussion relations');
      const [counts] = await connection.query<
        Array<RowDataPacket & { commentId: string; count: SqlNumber }>
      >(
        `
        SELECT l.commentId, COUNT(*) count FROM comment_likes l
        JOIN discussion_write_nodes m ON m.nodeId = l.commentId WHERE m.discussionId = ? GROUP BY l.commentId`,
        [discussionId]
      );
      const likes = new Map(
        counts.map((row) => [row.commentId, integer(row.count)])
      );
      const parents = new Map<string, string>();
      for (const relation of relations) {
        if (relation.relationType === 'replies') {
          if (parents.has(relation.fromContentId))
            throw new InvalidSnapshotError('Ambiguous discussion parent');
          parents.set(relation.fromContentId, relation.toContentId);
        } else if (
          relation.fromContentId !== discussionId ||
          relation.toContentId !== aggregate.subjectId
        ) {
          throw new InvalidSnapshotError('Inconsistent discussed subject');
        }
      }
      const subjects = relations.filter(
        (relation) => relation.relationType === 'discusses'
      );
      if (subjects.length !== (aggregate.subjectId ? 1 : 0))
        throw new InvalidSnapshotError(
          'Missing or ambiguous discussed subject'
        );
      const nodes: DiscussionSnapshotNode[] = rows.map((row) => {
        if (!row.foundId)
          throw new InvalidSnapshotError('Missing authoritative content node');
        const deletedAt =
          row.deletedAt === null ? null : integer(row.deletedAt);
        if (
          deletedAt === null &&
          (!row.payloadKey || !row.payloadHash || row.payloadBytes === null)
        )
          throw new InvalidSnapshotError('Missing immutable payload reference');
        return {
          id: row.id,
          referenceKey: row.referenceKey,
          kind: row.kind,
          parentId: parents.get(row.id) ?? null,
          ownerIdentityId: row.ownerIdentityId,
          state: row.state,
          visibility: row.visibility,
          createdAt: integer(row.createdAt),
          updatedAt: row.updatedAt === null ? null : integer(row.updatedAt),
          deletedAt,
          likeCount: likes.get(row.id) ?? 0,
          payload:
            row.payloadKey && row.payloadHash && row.payloadBytes !== null
              ? {
                  key: row.payloadKey,
                  sha256: row.payloadHash,
                  bytes: integer(row.payloadBytes),
                }
              : null,
        };
      });
      await connection.commit();
      // External subject metadata is not governed by this aggregate's revision.
      return {
        discussionId,
        tenantId: aggregate.tenantId,
        revision: integer(aggregate.revision),
        subjectId: aggregate.subjectId,
        ...(aggregate.subjectKind !== null
          ? { subjectKind: aggregate.subjectKind }
          : {}),
        subjectReferenceKey: null,
        nodes,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
