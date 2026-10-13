import type { DataSource } from 'typeorm';
import {
  publicCommentId,
  type DiscussionTarget,
} from '@sdk/features/discussion/core';
import type {
  PublicDiscussionCursor,
  PublicDiscussionIndex,
} from '../application/public-discussions';
import { safeSqlInteger } from './mysql-discussion-writes';

export class MysqlPublicDiscussionThreads implements PublicDiscussionIndex {
  constructor(
    private readonly source: DataSource,
    private readonly kind: DiscussionTarget['kind']
  ) {}
  async list(
    tenantId: string,
    targetId: string,
    cursor: PublicDiscussionCursor | null
  ) {
    const application = this.kind === 'application';
    const rows = await this.source.query<
      Array<{ id: string; at: number | string; pinned: number | string }>
    >(
      `SELECT /*+ MAX_EXECUTION_TIME(3000) */ a.id, a.createdAt AS at, a.pinned
       FROM discussion_write_aggregates a JOIN content_nodes n ON n.id = a.id
       WHERE a.tenantId = ? AND a.subjectKind = ? AND a.subjectId = ?
         AND n.kind = 'discussion' AND n.deletedAt IS NULL AND n.state = 'published' AND n.visibility = 'public'
         ${
           cursor
             ? application
               ? 'AND (a.pinned < ? OR (a.pinned = ? AND (a.createdAt < ? OR (a.createdAt = ? AND a.id > ?))))'
               : 'AND (a.createdAt < ? OR (a.createdAt = ? AND a.id > ?))'
             : ''
         }
       ORDER BY ${
         application ? 'a.pinned DESC,' : ''
       } a.createdAt DESC, a.id LIMIT 11`,
      [
        tenantId,
        this.kind,
        targetId,
        ...(cursor
          ? [
              ...(application
                ? [cursor.pinned ? 1 : 0, cursor.pinned ? 1 : 0]
                : []),
              cursor.at,
              cursor.at,
              cursor.id,
            ]
          : []),
      ]
    );
    return rows.map((row) => {
      const pinned = safeSqlInteger(row.pinned);
      if (pinned > 1 || (!application && pinned !== 0))
        throw new Error('Invalid canonical discussion pin state');
      return {
        id: publicCommentId(row.id),
        at: safeSqlInteger(row.at),
        ...(application ? { pinned: pinned === 1 } : {}),
      };
    });
  }
}
