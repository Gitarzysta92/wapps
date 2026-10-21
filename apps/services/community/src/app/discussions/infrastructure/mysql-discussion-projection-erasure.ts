import type { DataSource, EntityManager } from 'typeorm';
import { publicCommentId } from '@domains/community';
import type { AccountErasureRequest } from '@sdk/features/identity/core';
import type {
  DiscussionProjectionErasureRepository,
  DiscussionProjectionErasureTarget,
} from '../application/erase-discussion-projections';
import { lockDiscussionErasure } from './mysql-discussion-contribution-erasure';

type Row = Record<string, unknown>;
function revision(value: unknown): number {
  const number =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 1)
    throw new Error('Invalid Discussion projection cleanup revision');
  return number;
}
function target(
  row: Row,
  request: AccountErasureRequest
): DiscussionProjectionErasureTarget {
  if (
    row.identityId !== request.identityId ||
    revision(row.erasureRevision) !== request.revision
  )
    throw new Error('Discussion projection cleanup request changed');
  return {
    nodeId: publicCommentId(row.nodeId),
    discussionId: publicCommentId(row.discussionId),
    revision: revision(row.projectionRevision),
  };
}

export class MysqlDiscussionProjectionErasure
  implements DiscussionProjectionErasureRepository
{
  constructor(private readonly source: DataSource) {}

  next(
    input: AccountErasureRequest
  ): Promise<DiscussionProjectionErasureTarget | null> {
    return this.source.transaction('READ COMMITTED', async (tx) => {
      const request = await lockDiscussionErasure(tx, input);
      const owned: unknown[] = await tx.query(
        'SELECT 1 FROM discussion_write_nodes WHERE ownerIdentityId=? LIMIT 1',
        [request.identityId]
      );
      if (owned.length)
        throw new Error(
          'Canonical Discussion anonymity must finish before projection cleanup'
        );
      const [row]: Row[] = await tx.query(
        'SELECT * FROM discussion_erasure_nodes WHERE identityId=? ORDER BY nodeId LIMIT 1',
        [request.identityId]
      );
      if (!row) return null;
      const value = target(row, request);
      await this.authority(tx, value);
      return value;
    });
  }

  complete(
    input: AccountErasureRequest,
    value: DiscussionProjectionErasureTarget
  ): Promise<void> {
    return this.source.transaction('READ COMMITTED', async (tx) => {
      const request = await lockDiscussionErasure(tx, input);
      await this.authority(tx, value);
      const [row]: Row[] = await tx.query(
        'SELECT * FROM discussion_erasure_nodes WHERE identityId=? AND nodeId=? FOR UPDATE',
        [request.identityId, value.nodeId]
      );
      if (!row) return;
      if (JSON.stringify(target(row, request)) !== JSON.stringify(value))
        throw new Error('Discussion projection cleanup target changed');
      await tx.query(
        'DELETE FROM discussion_erasure_nodes WHERE identityId=? AND nodeId=?',
        [request.identityId, value.nodeId]
      );
    });
  }

  private async authority(
    tx: EntityManager,
    value: DiscussionProjectionErasureTarget
  ): Promise<void> {
    publicCommentId(value.nodeId);
    publicCommentId(value.discussionId);
    revision(value.revision);
    const [aggregate]: Row[] = await tx.query(
      'SELECT revision FROM discussion_write_aggregates WHERE id=? FOR UPDATE',
      [value.discussionId]
    );
    const [node]: Row[] = await tx.query(
      'SELECT ownerIdentityId,discussionId FROM discussion_write_nodes WHERE nodeId=? FOR UPDATE',
      [value.nodeId]
    );
    if (
      !aggregate ||
      revision(aggregate.revision) < value.revision ||
      !node ||
      node.discussionId !== value.discussionId ||
      node.ownerIdentityId !== null
    )
      throw new Error(
        'Discussion projection cleanup lacks anonymous canonical authority'
      );
  }
}
