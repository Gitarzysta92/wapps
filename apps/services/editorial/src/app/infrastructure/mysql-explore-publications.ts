import type { DataSource } from 'typeorm';
import {
  compareExplore,
  exploreId,
  EXPLORE_PAGE_SIZE,
  type ExplorePosition,
  type ExploreKind,
} from '@domains/feed';
import { SuiteUnavailableError } from '@domains/publication/suite';
import type {
  ExplorePublicationCandidate,
  ExplorePublicationIndex,
} from '../application/explore-publications';
import { editorialSqlInteger } from './mysql-editorial-snapshot';

export class MysqlExplorePublications implements ExplorePublicationIndex {
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
      const definitions = [
        {
          kind: 'application',
          at: 'CAST(UNIX_TIMESTAMP(a.updatedAt) * 1000 AS UNSIGNED)',
          id: 'a.id',
          slug: 'a.slug',
          parent: 'NULL',
          version: 'NULL',
          from: "app_records a LEFT JOIN editorial_resource_states e ON e.resourceKind='app' AND e.resourceId=a.id",
          where: 'a.isSuspended=0',
        },
        {
          kind: 'article',
          at: 'p.updatedAt',
          id: 'p.articleId',
          slug: 'p.slug',
          parent: 'NULL',
          version: 'NULL',
          from: "article_publications p JOIN editorial_resource_states e ON e.resourceKind='article' AND e.resourceId=p.articleId",
          where: 'p.tenantId=e.tenantId',
        },
        {
          kind: 'release',
          at: 'p.publishedAt',
          id: 'p.releaseId',
          slug: 'NULL',
          parent: 'a.slug',
          version: 'p.version',
          from: `release_publications p
          JOIN editorial_resource_states e ON e.resourceKind='release' AND e.resourceId=p.releaseId
          JOIN app_records a ON a.id=p.applicationId
          JOIN editorial_resource_states parent ON parent.resourceKind='app' AND parent.resourceId=a.id`,
          where:
            'p.tenantId=e.tenantId AND parent.tenantId=e.tenantId AND parent.deletedAt IS NULL AND a.isSuspended=0',
        },
        {
          kind: 'suite' as const,
          at: 'p.publishedAt',
          id: 'p.suiteId',
          slug: 'NULL',
          parent: 'NULL',
          version: 'NULL',
          from: "suite_publications p JOIN editorial_resource_states e ON e.resourceKind='suite' AND e.resourceId=p.suiteId",
          where: 'TRUE',
        },
      ] as const;
      const all: ExplorePublicationCandidate[] = [];
      for (const definition of definitions) {
        if (selectedKind && selectedKind !== definition.kind) continue;
        if (applicationId && definition.kind === 'article') continue;
        const application = !applicationId
          ? ''
          : definition.kind === 'suite'
          ? 'AND JSON_CONTAINS(p.applicationIds, JSON_QUOTE(?))'
          : definition.kind === 'release'
          ? 'AND p.applicationId=?'
          : 'AND a.id=?';
        const key = `CONCAT('${definition.kind}:', ${definition.id}) COLLATE utf8mb4_bin`;
        const cursor = after
          ? `AND (${definition.at} < ? OR (${definition.at} = ? AND ${key} > ?))`
          : '';
        const scope =
          definition.kind === 'application'
            ? '(e.tenantId=? OR e.resourceId IS NULL)'
            : 'e.tenantId=?';
        const rows = await manager.query<Record<string, unknown>[]>(
          `SELECT /*+ MAX_EXECUTION_TIME(3000) */ ${definition.id} AS id, ${definition.at} AS at, e.revision,
           ${definition.slug} AS slug, ${definition.parent} AS applicationSlug, ${definition.version} AS version
           FROM ${definition.from} WHERE ${definition.where} AND ${scope} AND e.deletedAt IS NULL ${application} ${cursor}
           ORDER BY ${definition.at} DESC, ${definition.id} LIMIT ?`,
          [
            this.tenant,
            ...(applicationId ? [applicationId] : []),
            ...(after ? [after.at, after.at, after.key] : []),
            EXPLORE_PAGE_SIZE + 1,
          ]
        );
        for (const row of rows) {
          if (
            !exploreId(row.id) ||
            [row.slug, row.applicationSlug, row.version].some(
              (value) => value !== null && typeof value !== 'string'
            )
          )
            throw new SuiteUnavailableError('Invalid activity authority');
          all.push({
            kind: definition.kind,
            id: exploreId(row.id),
            at: editorialSqlInteger(row.at, 1),
            revision: editorialSqlInteger(row.revision, 1),
            slug: row.slug as string | null,
            applicationSlug: row.applicationSlug as string | null,
            version: row.version as string | null,
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
