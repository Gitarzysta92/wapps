import type { DataSource } from 'typeorm';
import {
  compareExplore,
  exploreId,
  EXPLORE_PAGE_SIZE,
  type ExplorePosition,
  type ExploreKind,
} from '@domains/feed';
import type {
  ExploreCommunityCandidate,
  ExploreCommunityIndex,
} from '../application/explore-community';
import { safeSqlInteger } from './mysql-discussion-writes';

export class MysqlExploreCommunity implements ExploreCommunityIndex {
  constructor(
    private readonly source: DataSource,
    private readonly tenant: string
  ) {}
  read(
    after: ExplorePosition | null,
    selectedKind?: ExploreKind,
    applicationId?: string
  ) {
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const all: ExploreCommunityCandidate[] = [];
      for (const definition of [
        {
          kind: 'discussion',
          id: 'a.id',
          application: 'a.subjectId',
          at: 'root.createdAt',
          revision: 'a.revision',
          from: 'discussion_write_aggregates a JOIN content_nodes root ON root.id=a.id',
          where:
            "a.tenantId=? AND a.subjectKind='application' AND root.kind='discussion' AND root.deletedAt IS NULL AND root.state='published' AND root.visibility='public'",
        },
        {
          kind: 'review',
          id: 'r.id',
          application: 'r.applicationId',
          at: 'r.createdAt',
          revision: 'r.revision',
          from: 'member_reviews r',
          where: 'r.tenantId=? AND r.hidden=0 AND r.withdrawn=0',
        },
      ] as const) {
        if (selectedKind && selectedKind !== definition.kind) continue;
        const key = `CONCAT('${definition.kind}:', ${definition.id}) COLLATE utf8mb4_bin`;
        const rows = await manager.query<Record<string, unknown>[]>(
          `SELECT /*+ MAX_EXECUTION_TIME(3000) */ ${definition.id} AS id, ${
            definition.application
          } AS applicationId, ${definition.at} AS at, ${
            definition.revision
          } AS revision
           FROM ${definition.from} WHERE ${definition.where}
           ${applicationId ? `AND ${definition.application}=?` : ''}
           ${
             after
               ? `AND (${definition.at}<? OR (${definition.at}=? AND ${key}>?))`
               : ''
           }
           ORDER BY ${definition.at} DESC, ${key} LIMIT ?`,
          [
            this.tenant,
            ...(applicationId ? [applicationId] : []),
            ...(after ? [after.at, after.at, after.key] : []),
            EXPLORE_PAGE_SIZE + 1,
          ]
        );
        for (const row of rows) {
          if (
            (typeof row.at !== 'number' && typeof row.at !== 'string') ||
            (typeof row.revision !== 'number' &&
              typeof row.revision !== 'string')
          )
            throw new Error('Missing Explore revision');
          const at = safeSqlInteger(row.at),
            revision = safeSqlInteger(row.revision);
          if (at < 1 || revision < 1)
            throw new Error('Invalid Explore authority');
          all.push({
            kind: definition.kind,
            id: exploreId(row.id),
            applicationId: exploreId(row.applicationId),
            at,
            revision,
          });
        }
      }
      return all
        .sort((a, b) =>
          compareExplore(
            { at: a.at, key: `${a.kind}:${a.id}` },
            { at: b.at, key: `${b.kind}:${b.id}` }
          )
        )
        .slice(0, EXPLORE_PAGE_SIZE + 1);
    });
  }
}
