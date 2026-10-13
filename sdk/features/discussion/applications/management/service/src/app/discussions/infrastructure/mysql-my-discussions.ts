import type { DataSource } from 'typeorm';
import {
  publicCommentId,
  type MyDiscussionCursor,
} from '@sdk/features/discussion/core';
import type { DiscussionActor } from '../application/discussion-write.port';
import type {
  MyDiscussionCandidate,
  MyDiscussionIndex,
} from '../application/my-discussions';
import { safeSqlInteger } from './mysql-discussion-writes';

export class MysqlMyDiscussions implements MyDiscussionIndex {
  constructor(private readonly source: DataSource) {}

  list(actor: DiscussionActor, cursor: MyDiscussionCursor | null) {
    return this.select(
      actor,
      cursor ? 'AND (a.createdAt < ? OR (a.createdAt = ? AND a.id > ?))' : '',
      cursor ? [cursor.at, cursor.at, cursor.id] : []
    );
  }

  current(actor: DiscussionActor, ids: string[]) {
    if (ids.length > 10)
      throw new Error('Discussion membership check exceeds bounds');
    if (!ids.length) return Promise.resolve([]);
    return this.select(
      actor,
      `AND a.id IN (${ids.map(() => '?').join(',')})`,
      ids.map(publicCommentId)
    );
  }

  private async select(
    actor: DiscussionActor,
    filter: string,
    values: (string | number)[]
  ): Promise<MyDiscussionCandidate[]> {
    const rows = await this.source.query<
      Array<{
        id: string;
        applicationId: string;
        revision: number | string;
        at: number | string;
        authored: number | string;
      }>
    >(
      `SELECT /*+ MAX_EXECUTION_TIME(3000) */ a.id, a.subjectId AS applicationId,
        a.revision, a.createdAt AS at, MAX(m.nodeId = a.id) AS authored
       FROM discussion_write_nodes m
       JOIN content_nodes contribution ON contribution.id = m.nodeId
       JOIN discussion_write_aggregates a ON a.id = m.discussionId
       JOIN content_nodes root ON root.id = a.id
       WHERE m.ownerIdentityId = ? AND a.tenantId = ? AND a.subjectKind = 'application'
         AND contribution.deletedAt IS NULL AND contribution.state = 'published' AND contribution.visibility = 'public'
         AND root.kind = 'discussion' AND root.deletedAt IS NULL AND root.state = 'published' AND root.visibility = 'public'
         ${filter}
       GROUP BY a.id, a.subjectId, a.revision, a.createdAt
       ORDER BY a.createdAt DESC, a.id LIMIT 11`,
      [actor.identityId, actor.tenantId, ...values]
    );
    return rows.map((row) => {
      const authored = safeSqlInteger(row.authored),
        revision = safeSqlInteger(row.revision);
      if (authored > 1 || revision < 1)
        throw new Error('Invalid discussion membership authority');
      return {
        id: publicCommentId(row.id),
        applicationId: publicCommentId(row.applicationId),
        revision,
        at: safeSqlInteger(row.at),
        participation: authored === 1 ? 'author' : 'participant',
      };
    });
  }
}
