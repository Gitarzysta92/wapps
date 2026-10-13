import type { DataSource } from 'typeorm';
import {
  publicCommentId,
  PROFILE_DISCUSSIONS_PAGE_SIZE,
  type MyDiscussionCursor,
} from '@sdk/features/discussion/core';
import type {
  ProfileDiscussionCandidate,
  ProfileDiscussionIndex,
} from '../application/profile-discussions';
import { safeSqlInteger } from './mysql-discussion-writes';

export class MysqlProfileDiscussions implements ProfileDiscussionIndex {
  constructor(private readonly source: DataSource) {}
  list(owner: string, tenant: string, after: MyDiscussionCursor | null) {
    return this.select(
      owner,
      tenant,
      after ? 'AND (a.createdAt < ? OR (a.createdAt = ? AND a.id > ?))' : '',
      after ? [after.at, after.at, after.id] : []
    );
  }
  current(owner: string, tenant: string, ids: string[]) {
    if (ids.length > PROFILE_DISCUSSIONS_PAGE_SIZE)
      throw new Error('Profile membership check exceeds bounds');
    if (!ids.length) return Promise.resolve([]);
    return this.select(
      owner,
      tenant,
      `AND a.id IN (${ids.map(() => '?').join(',')})`,
      ids.map(publicCommentId)
    );
  }
  private async select(
    owner: string,
    tenant: string,
    filter: string,
    values: (string | number)[]
  ): Promise<ProfileDiscussionCandidate[]> {
    const rows = await this.source.query<
      {
        id: string;
        targetId: string;
        targetKind: string;
        revision: number | string;
        at: number | string;
        authored: number | string;
      }[]
    >(
      `SELECT /*+ MAX_EXECUTION_TIME(3000) */ a.id, a.subjectKind AS targetKind, a.subjectId AS targetId,
        a.revision, a.createdAt AS at, MAX(m.nodeId = a.id) AS authored
       FROM discussion_write_nodes m
       JOIN content_nodes contribution ON contribution.id = m.nodeId
       JOIN discussion_write_aggregates a ON a.id = m.discussionId
       JOIN content_nodes root ON root.id = a.id
       WHERE m.ownerIdentityId = ? AND a.tenantId = ? AND a.subjectKind IN ('application', 'article')
         AND contribution.deletedAt IS NULL AND contribution.state = 'published' AND contribution.visibility = 'public'
         AND root.kind = 'discussion' AND root.deletedAt IS NULL AND root.state = 'published' AND root.visibility = 'public'
         ${filter}
       GROUP BY a.id, a.subjectKind, a.subjectId, a.revision, a.createdAt
       ORDER BY a.createdAt DESC, a.id LIMIT ?`,
      [owner, tenant, ...values, PROFILE_DISCUSSIONS_PAGE_SIZE + 1]
    );
    return rows.map((row) => {
      const authored = safeSqlInteger(row.authored),
        revision = safeSqlInteger(row.revision);
      if (
        authored > 1 ||
        revision < 1 ||
        (row.targetKind !== 'application' && row.targetKind !== 'article')
      )
        throw new Error('Invalid profile participation authority');
      return {
        id: publicCommentId(row.id),
        target: { kind: row.targetKind, id: publicCommentId(row.targetId) },
        revision,
        at: safeSqlInteger(row.at),
        participation: authored === 1 ? 'author' : 'participant',
      };
    });
  }
}
