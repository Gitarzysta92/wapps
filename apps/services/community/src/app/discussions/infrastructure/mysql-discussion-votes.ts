import type { DataSource } from 'typeorm';
import { DISCUSSION_MAX_NODES } from '@apps/shared';
import { discussionVoteState } from '@domains/community';
import type { DiscussionVotesReader } from '../application/discussion-votes.port';
import { DiscussionProjectionPendingError } from '../application/discussion-queries';
import { safeSqlInteger } from './mysql-discussion-writes';

export class MysqlDiscussionVotes implements DiscussionVotesReader {
  constructor(private readonly source: DataSource) {}

  read(discussionId: string, revision: number, identityId: string | null) {
    return this.source.transaction('REPEATABLE READ', async (tx) => {
      const aggregates: Array<{
        revision: string | number;
        bindingKey: string | null;
      }> = await tx.query(
        'SELECT revision, bindingKey FROM discussion_write_aggregates WHERE id = ?',
        [discussionId]
      );
      if (
        aggregates.length !== 1 ||
        !aggregates[0].bindingKey ||
        safeSqlInteger(aggregates[0].revision) !== revision
      )
        throw new DiscussionProjectionPendingError(
          'Discussion votes changed while loading'
        );
      const rows: Array<{
        id: string;
        upvotes: string | number;
        downvotes: string | number;
        mine: string | number;
        invalid: string | number;
      }> = await tx.query(
        `SELECT n.nodeId AS id, COALESCE(SUM(v.value = 1), 0) AS upvotes,
         COALESCE(SUM(v.value = -1), 0) AS downvotes,
         COALESCE(SUM(CASE WHEN v.actorIdentityId = ? THEN v.value ELSE 0 END), 0) AS mine,
         COALESCE(SUM(v.value NOT IN (-1, 1)), 0) AS invalid
         FROM discussion_write_nodes n LEFT JOIN discussion_votes v ON v.nodeId = n.nodeId
         WHERE n.discussionId = ? GROUP BY n.nodeId LIMIT ?`,
        [identityId, discussionId, DISCUSSION_MAX_NODES + 1]
      );
      if (
        !rows.length ||
        rows.length > DISCUSSION_MAX_NODES ||
        rows.some((row) => safeSqlInteger(row.invalid) !== 0)
      )
        throw new Error('Invalid canonical discussion votes');
      return new Map(
        rows.map((row) => [
          row.id,
          discussionVoteState({
            upvotes: safeSqlInteger(row.upvotes),
            downvotes: safeSqlInteger(row.downvotes),
            mine:
              row.mine === '-1' || row.mine === -1
                ? -1
                : safeSqlInteger(row.mine),
          }),
        ])
      );
    });
  }
}
