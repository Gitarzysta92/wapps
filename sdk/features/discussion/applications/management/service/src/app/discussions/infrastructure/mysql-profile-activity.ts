import type { DataSource } from 'typeorm';
import {
  compareActivity,
  PROFILE_ACTIVITY_PAGE_SIZE,
  type ProfileActivityPosition,
} from '@domains/customer/profiles';
import { publicCommentId } from '@sdk/features/discussion/core';
import type {
  CommunityActivityCandidate,
  CommunityActivityIndex,
} from '../application/profile-activity';
import { safeSqlInteger } from './mysql-discussion-writes';

export class MysqlCommunityActivity implements CommunityActivityIndex {
  constructor(private readonly source: DataSource) {}
  read(
    owner: string,
    tenant: string,
    after: ProfileActivityPosition | null,
    discussions: boolean
  ) {
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const all: CommunityActivityCandidate[] = [];
      const key =
        "CONCAT(CASE WHEN a.subjectKind='article' THEN 'comment' WHEN m.nodeId=a.id THEN 'discussion' ELSE 'reply' END, ':', m.nodeId) COLLATE utf8mb4_bin";
      if (discussions) {
        const rows = await manager.query<Record<string, unknown>[]>(
          `SELECT /*+ MAX_EXECUTION_TIME(3000) */ m.nodeId AS id, a.id AS rootId, a.subjectKind AS targetKind, a.subjectId AS targetId,
           a.revision, contribution.createdAt AS at, CASE WHEN a.subjectKind='article' THEN 'comment' WHEN m.nodeId=a.id THEN 'discussion' ELSE 'reply' END AS kind
           FROM discussion_write_nodes m JOIN content_nodes contribution ON contribution.id=m.nodeId
           JOIN discussion_write_aggregates a ON a.id=m.discussionId JOIN content_nodes root ON root.id=a.id
           WHERE m.ownerIdentityId=? AND a.tenantId=? AND a.subjectKind IN ('application','article')
           AND contribution.deletedAt IS NULL AND contribution.state='published' AND contribution.visibility='public'
           AND root.kind='discussion' AND root.deletedAt IS NULL AND root.state='published' AND root.visibility='public'
           ${
             after
               ? `AND (contribution.createdAt < ? OR (contribution.createdAt = ? AND ${key} > ?))`
               : ''
           }
           ORDER BY contribution.createdAt DESC, ${key} LIMIT ?`,
          [
            owner,
            tenant,
            ...(after ? [after.at, after.at, after.key] : []),
            PROFILE_ACTIVITY_PAGE_SIZE + 1,
          ]
        );
        for (const row of rows) all.push(this.candidate(row));
      }
      const rows = await manager.query<Record<string, unknown>[]>(
        `SELECT /*+ MAX_EXECUTION_TIME(3000) */ r.id, r.id AS rootId, 'application' AS targetKind, r.applicationId AS targetId,
         r.revision, e.createdAt AS at, 'review' AS kind FROM member_reviews r
         JOIN review_events e ON e.reviewId=r.id AND e.revision=r.contentRevision AND e.type='publish'
         WHERE r.ownerId=? AND r.tenantId=? AND r.hidden=0 AND r.withdrawn=0
         AND e.tenantId=r.tenantId AND e.applicationId=r.applicationId AND e.actorId=r.ownerId
         ${
           after
             ? "AND (e.createdAt < ? OR (e.createdAt = ? AND CONCAT('review:', r.id) COLLATE utf8mb4_bin > ?))"
             : ''
         }
         ORDER BY e.createdAt DESC, r.id LIMIT ?`,
        [
          owner,
          tenant,
          ...(after ? [after.at, after.at, after.key] : []),
          PROFILE_ACTIVITY_PAGE_SIZE + 1,
        ]
      );
      for (const row of rows) all.push(this.candidate(row));
      return all
        .sort((a, b) =>
          compareActivity(
            { at: a.at, key: `${a.kind}:${a.id}` },
            { at: b.at, key: `${b.kind}:${b.id}` }
          )
        )
        .slice(0, PROFILE_ACTIVITY_PAGE_SIZE + 1);
    });
  }
  private candidate(row: Record<string, unknown>): CommunityActivityCandidate {
    const kind = row.kind,
      targetKind = row.targetKind;
    if (
      (kind !== 'discussion' &&
        kind !== 'reply' &&
        kind !== 'comment' &&
        kind !== 'review') ||
      (targetKind !== 'application' && targetKind !== 'article')
    )
      throw new Error('Invalid activity contribution');
    if ((typeof row.at !== 'number' && typeof row.at !== 'string') || (typeof row.revision !== 'number' && typeof row.revision !== 'string')) throw new Error('Missing activity revision');
    const at = safeSqlInteger(row.at),
      revision = safeSqlInteger(row.revision);
    if (
      at < 1 ||
      revision < 1 ||
      (kind === 'comment') !== (targetKind === 'article')
    )
      throw new Error('Invalid activity authority');
    return {
      kind,
      id: publicCommentId(row.id),
      rootId: publicCommentId(row.rootId),
      at,
      revision,
      target: { kind: targetKind, id: publicCommentId(row.targetId) },
    };
  }
}
