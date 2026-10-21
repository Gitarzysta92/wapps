import { randomUUID } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';

/** Rebuild requests come from authoritative revisions, including tombstones. */
export async function enqueueDiscussionRebuildPage(
  pool: Pool,
  afterId: string,
  limit = 200
): Promise<{ nextId: string; queued: number }> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
    throw new Error('Invalid rebuild batch size');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<
      Array<RowDataPacket & { id: string; revision: number | string }>
    >(
      'SELECT id, revision FROM discussion_write_aggregates WHERE id > ? ORDER BY id LIMIT ?',
      [afterId, limit]
    );
    for (const row of rows) {
      const now = Date.now();
      await connection.query(
        `INSERT INTO discussion_outbox (id, discussionId, revision, createdAt, availableAt) VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE deliveredAt = NULL, availableAt = ?, lastError = NULL`,
        [randomUUID(), row.id, row.revision, now, now, now]
      );
    }
    await connection.commit();
    return {
      nextId: rows[rows.length - 1]?.id ?? afterId,
      queued: rows.length,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
