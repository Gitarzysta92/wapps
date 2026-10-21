import type { DataSource } from 'typeorm';
import {
  suiteId,
  suiteRevision,
  SuiteUnavailableError,
  PROFILE_SUITES_PAGE_SIZE,
} from '@domains/publication/suite';
import type { SuiteCatalogAuthority, SuiteCatalogQuery } from './suite-catalog';

export class MysqlSuiteCatalog implements SuiteCatalogAuthority {
  constructor(
    private readonly source: DataSource,
    private readonly publicTenant: string
  ) {}
  select(query: SuiteCatalogQuery) {
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const corrupt = await manager.query(
        `SELECT /*+ MAX_EXECUTION_TIME(3000) */ e.resourceId FROM editorial_resource_states e
        LEFT JOIN suite_publications p ON p.suiteId = e.resourceId
        WHERE e.resourceKind = 'suite' AND e.tenantId = ? AND e.deletedAt IS NULL
        AND p.suiteId IS NULL LIMIT 1`,
        [this.publicTenant]
      );
      if (corrupt.length)
        throw new SuiteUnavailableError(
          'Canonical suite publication is inconsistent'
        );
      const predicate =
        'ownerIdentityId' in query
          ? 'e.ownerIdentityId = ? AND (? IS NULL OR e.resourceId > ?)'
          : 'ids' in query
          ? `e.resourceId IN (${query.ids.map(() => '?').join(',')})`
          : 'id' in query
          ? 'e.resourceId = ?'
          : "LOWER(p.title) LIKE LOWER(?) ESCAPE '='";
      const filters =
        'ownerIdentityId' in query
          ? [query.ownerIdentityId, query.after, query.after]
          : 'ids' in query
          ? query.ids
          : [
              'id' in query
                ? query.id
                : `%${query.q.replace(/[=%_]/g, '=$&')}%`,
            ];
      const from = `FROM editorial_resource_states e
        JOIN suite_publications p ON p.suiteId = e.resourceId
        WHERE e.resourceKind = 'suite' AND e.tenantId = ? AND e.deletedAt IS NULL AND ${predicate}`;
      const args = [this.publicTenant, ...filters];
      const [count] = await manager.query<{ total: string | number }[]>(
        `SELECT /*+ MAX_EXECUTION_TIME(3000) */ COUNT(*) AS total ${from}`,
        args
      );
      const rows = await manager.query<
        {
          id: string;
          revision: string | number;
          submittedRevision: string | number;
          publishedAt: string | number;
        }[]
      >(
        `SELECT /*+ MAX_EXECUTION_TIME(3000) */ e.resourceId AS id, e.revision, p.submittedRevision, p.publishedAt ${from}
         ORDER BY ${
           'ownerIdentityId' in query
             ? 'e.resourceId'
             : 'sort' in query && query.sort === 'newest'
             ? 'p.publishedAt DESC, e.resourceId'
             : `p.title ${
                 'sort' in query && query.sort === 'name-desc' ? 'DESC' : 'ASC'
               }, e.resourceId`
         } LIMIT ? OFFSET ?`,
        [
          ...args,
          'ownerIdentityId' in query
            ? PROFILE_SUITES_PAGE_SIZE + 1
            : 'ids' in query
            ? query.ids.length
            : 'pageSize' in query
            ? query.pageSize ?? 20
            : 20,
          'page' in query ? (query.page - 1) * (query.pageSize ?? 20) : 0,
        ]
      );
      const total = Number(count.total);
      if (!Number.isSafeInteger(total) || total < 0)
        throw new SuiteUnavailableError('Invalid suite catalog size');
      return {
        tenantId: this.publicTenant,
        total,
        items: rows.map((row) => {
          const publishedAt = Number(row.publishedAt);
          if (!Number.isSafeInteger(publishedAt) || publishedAt < 0)
            throw new SuiteUnavailableError('Invalid suite publication time');
          return {
            id: suiteId(row.id),
            revision: suiteRevision(Number(row.revision)),
            submittedRevision: suiteRevision(Number(row.submittedRevision)),
            publishedAt,
          };
        }),
      };
    });
  }
}
