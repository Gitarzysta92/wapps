import type { DataSource } from 'typeorm';
import { discussionKey } from '@sdk/features/discussion/core';
import type {
  DiscussionActor,
  DiscussionPageCursor,
  DiscussionParticipation,
  DiscussionParticipationIndex,
} from '@sdk/features/discussion/libs/management';
import { safeSqlInteger } from './mysql-discussion-writes';

export class MysqlBoundDiscussionParticipation
  implements DiscussionParticipationIndex
{
  constructor(private readonly source: DataSource) {}

  list(
    actor: DiscussionActor,
    prefix: string,
    cursor: DiscussionPageCursor | null
  ) {
    return this.select(
      actor,
      prefix,
      cursor ? 'AND (a.createdAt < ? OR (a.createdAt = ? AND a.id > ?))' : '',
      cursor ? [cursor.at, cursor.at, cursor.id] : []
    );
  }

  current(actor: DiscussionActor, prefix: string, ids: string[]) {
    if (ids.length > 10)
      throw new Error('Discussion membership check exceeds bounds');
    if (!ids.length) return Promise.resolve([]);
    return this.select(
      actor,
      prefix,
      `AND a.id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
  }

  private async select(
    actor: DiscussionActor,
    prefix: string,
    filter: string,
    values: (string | number)[]
  ): Promise<DiscussionParticipation[]> {
    discussionKey(prefix);
    const rows = await this.source.query<
      Array<{
        id: string;
        bindingKey: string;
        revision: string | number;
        at: string | number;
        authored: string | number;
      }>
    >(
      `SELECT /*+ MAX_EXECUTION_TIME(3000) */ a.id, a.bindingKey, a.revision, a.createdAt AS at, MAX(m.nodeId = a.id) AS authored
       FROM discussion_write_nodes m
       JOIN content_nodes contribution ON contribution.id = m.nodeId
       JOIN discussion_write_aggregates a ON a.id = m.discussionId
       JOIN content_nodes root ON root.id = a.id
       WHERE m.ownerIdentityId = ? AND a.tenantId = ?
         AND a.bindingKey >= ? AND a.bindingKey < CONCAT(?, CHAR(127))
         AND contribution.deletedAt IS NULL AND contribution.state = 'published' AND contribution.visibility = 'public'
         AND root.kind = 'discussion' AND root.deletedAt IS NULL AND root.state = 'published' AND root.visibility = 'public'
         ${filter}
       GROUP BY a.id, a.bindingKey, a.revision, a.createdAt
       ORDER BY a.createdAt DESC, a.id LIMIT 11`,
      [actor.identityId, actor.tenantId, prefix, prefix, ...values]
    );
    return rows.map((row) => {
      const authored = safeSqlInteger(row.authored),
        revision = safeSqlInteger(row.revision);
      if (
        authored > 1 ||
        revision < 1 ||
        typeof row.id !== 'string' ||
        !discussionKey(row.bindingKey).startsWith(prefix)
      )
        throw new Error('Invalid discussion membership authority');
      return {
        id: row.id,
        bindingKey: row.bindingKey,
        revision,
        at: safeSqlInteger(row.at),
        participation: authored === 1 ? 'author' : 'participant',
      };
    });
  }
}
