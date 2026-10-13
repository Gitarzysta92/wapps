import type { DataSource } from 'typeorm';
import { publicCommentId } from '@sdk/features/discussion/core';
import {
  PROFILE_TOTAL_PARENT_LIMIT,
  type ProfileDiscussionTotalsIndex,
  type ProfileDiscussionTotalGroup,
} from '../application/profile-totals';
import { safeSqlInteger } from './mysql-discussion-writes';

export class MysqlProfileDiscussionTotals
  implements ProfileDiscussionTotalsIndex
{
  constructor(private readonly source: DataSource) {}
  async read(
    owner: string,
    tenant: string
  ): Promise<ProfileDiscussionTotalGroup[]> {
    const rows = await this.source.query<
      { targetId: string; targetKind: string; total: number | string }[]
    >(
      `SELECT /*+ MAX_EXECUTION_TIME(3000) */ a.subjectKind AS targetKind, a.subjectId AS targetId, COUNT(DISTINCT a.id) AS total
       FROM discussion_write_nodes m
       JOIN content_nodes contribution ON contribution.id=m.nodeId
       JOIN discussion_write_aggregates a ON a.id=m.discussionId
       JOIN content_nodes root ON root.id=a.id
       WHERE m.ownerIdentityId=? AND a.tenantId=? AND a.subjectKind IN ('application','article')
         AND contribution.deletedAt IS NULL AND contribution.state='published' AND contribution.visibility='public'
         AND root.kind='discussion' AND root.deletedAt IS NULL AND root.state='published' AND root.visibility='public'
       GROUP BY a.subjectKind, a.subjectId ORDER BY a.subjectKind, a.subjectId LIMIT ?`,
      [owner, tenant, PROFILE_TOTAL_PARENT_LIMIT + 1]
    );
    return rows.map((row) => {
      if (row.targetKind !== 'application' && row.targetKind !== 'article')
        throw new Error('Invalid profile total parent');
      return {
        target: { kind: row.targetKind, id: publicCommentId(row.targetId) },
        total: safeSqlInteger(row.total),
      };
    });
  }
}
