import type { DataSource } from 'typeorm';
import { discussionKey } from '@sdk/features/discussion/core';
import type {
  BoundDiscussionIndex,
  DiscussionActor,
  DiscussionOrder,
  DiscussionPageCursor,
} from '@sdk/features/discussion/libs/management';
import { safeSqlInteger } from './mysql-discussion-writes';

export class MysqlBoundDiscussionIndex implements BoundDiscussionIndex {
  constructor(private readonly source: DataSource) {}

  async list(
    tenantId: string,
    bindingKey: string,
    actor: DiscussionActor | null,
    cursor: DiscussionPageCursor | null,
    order: DiscussionOrder
  ) {
    const pinned = order === 'pinned';
    const rows = await this.source.query<
      Array<{ id: string; at: string | number; pinned: string | number }>
    >(
      `SELECT /*+ MAX_EXECUTION_TIME(3000) */ a.id, a.createdAt AS at, a.pinned
       FROM discussion_write_aggregates a
       JOIN content_nodes n ON n.id = a.id
       JOIN discussion_write_nodes owner ON owner.nodeId = a.id
       WHERE a.tenantId = ? AND a.bindingKey = ?
         AND n.kind = 'discussion' AND n.deletedAt IS NULL AND n.visibility <> 'unlisted'
         AND ((n.state = 'published' AND n.visibility = 'public') OR owner.ownerIdentityId = ? OR ? = 1)
         ${
           cursor
             ? pinned
               ? 'AND (a.pinned < ? OR (a.pinned = ? AND (a.createdAt < ? OR (a.createdAt = ? AND a.id > ?))))'
               : 'AND (a.createdAt < ? OR (a.createdAt = ? AND a.id > ?))'
             : ''
         }
       ORDER BY ${
         pinned ? 'a.pinned DESC,' : ''
       } a.createdAt DESC, a.id LIMIT 11`,
      [
        tenantId,
        discussionKey(bindingKey),
        actor?.identityId ?? null,
        actor?.roles.includes('admin') ? 1 : 0,
        ...(cursor
          ? [
              ...(pinned ? [cursor.pinned ? 1 : 0, cursor.pinned ? 1 : 0] : []),
              cursor.at,
              cursor.at,
              cursor.id,
            ]
          : []),
      ]
    );
    return rows.map((row) => {
      const pin = safeSqlInteger(row.pinned);
      if (pin > 1 || typeof row.id !== 'string')
        throw new Error('Invalid discussion index');
      return {
        id: row.id,
        at: safeSqlInteger(row.at),
        ...(pinned ? { pinned: pin === 1 } : {}),
      };
    });
  }
}
