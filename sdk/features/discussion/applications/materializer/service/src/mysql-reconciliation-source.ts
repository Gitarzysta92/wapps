import { randomUUID } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { DISCUSSION_MAX_NODES } from '@apps/shared';
import {
  DiscussionProjectionAuthority,
  DiscussionReconciliationSource,
} from './reconciliation';

type AuthorityRow = RowDataPacket &
  Omit<DiscussionProjectionAuthority, 'revision' | 'nodeCount'> & {
    revision: number | string;
    nodeCount: number | string;
  };
const authoritySql = `SELECT a.id, a.tenantId, a.revision,
  (SELECT COUNT(*) FROM discussion_write_nodes n WHERE n.discussionId = a.id) nodeCount
  FROM discussion_write_aggregates a`;

function mapAuthority(row: AuthorityRow): DiscussionProjectionAuthority {
  const revision = Number(row.revision);
  const nodeCount = Number(row.nodeCount);
  if (
    !Number.isSafeInteger(revision) ||
    revision <= 0 ||
    !Number.isSafeInteger(nodeCount) ||
    nodeCount < 1 ||
    nodeCount > DISCUSSION_MAX_NODES
  )
    throw new Error('Invalid authoritative discussion revision or size');
  return { id: row.id, tenantId: row.tenantId, revision, nodeCount };
}

export class MysqlDiscussionReconciliationSource
  implements DiscussionReconciliationSource
{
  constructor(private readonly pool: Pool) {}

  async upperBound(): Promise<string> {
    const [rows] = await this.pool.query<
      Array<RowDataPacket & { id: string | null }>
    >('SELECT MAX(id) id FROM discussion_write_aggregates');
    return rows[0]?.id ?? '';
  }

  async page(
    afterId: string,
    throughId: string,
    limit: number
  ): Promise<DiscussionProjectionAuthority[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
      throw new Error('Invalid reconciliation batch size');
    const [rows] = await this.pool.query<AuthorityRow[]>(
      `${authoritySql} WHERE a.id > ? AND a.id <= ? ORDER BY a.id LIMIT ?`,
      [afterId, throughId, limit]
    );
    return rows.map(mapAuthority);
  }

  async current(id: string): Promise<DiscussionProjectionAuthority | null> {
    const [rows] = await this.pool.query<AuthorityRow[]>(
      `${authoritySql} WHERE a.id = ?`,
      [id]
    );
    return rows.length ? mapAuthority(rows[0]) : null;
  }

  async requeue(authority: DiscussionProjectionAuthority): Promise<boolean> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<
        Array<RowDataPacket & { revision: number | string; tenantId: string }>
      >(
        'SELECT revision, tenantId FROM discussion_write_aggregates WHERE id = ? FOR UPDATE',
        [authority.id]
      );
      if (
        !rows.length ||
        Number(rows[0].revision) !== authority.revision ||
        rows[0].tenantId !== authority.tenantId
      ) {
        await connection.commit();
        return false;
      }
      const now = Date.now();
      await connection.query(
        `INSERT INTO discussion_outbox (id, discussionId, revision, createdAt, availableAt) VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE deliveredAt = NULL, availableAt = ?, lastError = NULL`,
        [randomUUID(), authority.id, authority.revision, now, now, now]
      );
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
