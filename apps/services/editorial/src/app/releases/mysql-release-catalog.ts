import type { DataSource } from 'typeorm';
import {
  releaseId,
  releaseRevision,
  releaseTimestamp,
  releaseVersion,
  ReleaseNotFoundError,
  ReleaseUnavailableError,
} from '@domains/catalog/versioning';
import type {
  ReleaseCatalogAuthority,
  ReleaseCatalogQuery,
  ReleaseCatalogSelection,
} from './release-catalog';

export class MysqlReleaseCatalog implements ReleaseCatalogAuthority {
  constructor(
    private readonly source: DataSource,
    private readonly publicTenant: string
  ) {}
  select(query: ReleaseCatalogQuery): Promise<ReleaseCatalogSelection> {
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const [application] = await manager.query<
        { id: string; slug: string; name: string; revision: string | number }[]
      >(
        `SELECT /*+ MAX_EXECUTION_TIME(3000) */ a.id, a.name, a.slug, s.revision FROM app_records a
         JOIN editorial_resource_states s ON s.resourceKind = 'app' AND s.resourceId = a.id
         WHERE a.slug = ? AND s.tenantId = ? AND s.deletedAt IS NULL AND a.isSuspended = 0`,
        [query.applicationSlug, this.publicTenant]
      );
      if (!application) throw new ReleaseNotFoundError('Application not found');
      const corrupt = await manager.query(
        `SELECT /*+ MAX_EXECUTION_TIME(3000) */ p.releaseId FROM release_publications p
        LEFT JOIN editorial_resource_states e ON e.resourceKind = 'release' AND e.resourceId = p.releaseId
        WHERE p.applicationId = ? AND p.tenantId = ? AND (e.resourceId IS NULL OR e.tenantId <> p.tenantId) LIMIT 1`,
        [application.id, this.publicTenant]
      );
      if (corrupt.length)
        throw new ReleaseUnavailableError('Release authority is incomplete');
      const where = `FROM release_publications p JOIN editorial_resource_states e ON e.resourceKind = 'release' AND e.resourceId = p.releaseId
        WHERE p.applicationId = ? AND p.tenantId = ? AND e.tenantId = p.tenantId AND e.deletedAt IS NULL${
          'version' in query ? ' AND p.version = ?' : ''
        }${
        'channel' in query
          ? " AND JSON_UNQUOTE(JSON_EXTRACT(p.fields, '$.channel')) = ?"
          : ''
      }${
        'before' in query
          ? " AND JSON_UNQUOTE(JSON_EXTRACT(p.fields, '$.releasedOn')) < ?"
          : ''
      }`;
      const parameters = [
        application.id,
        this.publicTenant,
        ...('version' in query ? [query.version] : []),
        ...('channel' in query ? [query.channel] : []),
        ...('before' in query ? [query.before] : []),
      ];
      const [count] = await manager.query<{ total: string | number }[]>(
        `SELECT /*+ MAX_EXECUTION_TIME(3000) */ COUNT(*) AS total ${where}`,
        parameters
      );
      const rows = await manager.query<
        {
          id: string;
          version: string;
          revision: string | number;
          publishedAt: string | number;
        }[]
      >(
        `SELECT /*+ MAX_EXECUTION_TIME(3000) */ p.releaseId AS id, p.version, e.revision, p.publishedAt ${where}
         ORDER BY JSON_UNQUOTE(JSON_EXTRACT(p.fields, '$.releasedOn')) DESC, p.publishedAt DESC, p.releaseId LIMIT 20 OFFSET ?`,
        [...parameters, 'page' in query ? (query.page - 1) * 20 : 0]
      );
      const total = Number(count.total);
      if (!Number.isSafeInteger(total) || total < 0)
        throw new ReleaseUnavailableError('Invalid release count');
      return {
        tenantId: this.publicTenant,
        application: {
          ...application,
          id: releaseId(application.id),
          revision: releaseRevision(Number(application.revision)),
        },
        total,
        items: rows.map((row) => ({
          id: releaseId(row.id),
          version: releaseVersion(row.version),
          revision: releaseRevision(Number(row.revision)),
          publishedAt: releaseTimestamp(Number(row.publishedAt)),
        })),
      };
    });
  }
}
