import type { DataSource } from 'typeorm';
import {
  compareActivity,
  isPublicProfileId,
  PROFILE_ACTIVITY_PAGE_SIZE,
  type ProfileActivityPosition,
} from '@domains/customer/profiles';
import { SuiteUnavailableError } from '@domains/publication/suite';
import type {
  PublicationActivityCandidate,
  PublicationActivityIndex,
} from '../application/profile-activity';
import { editorialSqlInteger } from './mysql-editorial-snapshot';

export class MysqlPublicationActivity implements PublicationActivityIndex {
  constructor(
    private readonly source: DataSource,
    private readonly tenant: string
  ) {}
  read(owner: string, after: ProfileActivityPosition | null, suites: boolean) {
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const erased = await manager.query(
        'SELECT identityId FROM identity_erasure_barriers WHERE identityId=? AND erasureRevision IS NOT NULL',
        [owner]
      );
      if (erased.length) return [];
      const definitions = [
        {
          kind: 'application',
          at: 'p.publishedAt',
          id: 'e.resourceId',
          slug: 'a.slug',
          parent: 'NULL',
          version: 'NULL',
          from: `application_publications p JOIN application_submissions s ON s.applicationId=p.applicationId AND s.submittedRevision=p.submittedRevision
          LEFT JOIN application_editing_targets t ON t.draftId=p.applicationId
          JOIN editorial_resource_states e ON e.resourceKind='app' AND e.resourceId=COALESCE(t.applicationId,p.applicationId)
          JOIN app_records a ON a.id=e.resourceId`,
          where: `s.ownerIdentityId=? AND s.tenantId=e.tenantId AND s.status='approved' AND a.isSuspended=0
             AND NOT EXISTS (SELECT 1 FROM application_publications newer LEFT JOIN application_editing_targets nt ON nt.draftId=newer.applicationId
               WHERE COALESCE(nt.applicationId,newer.applicationId)=e.resourceId AND newer.publicationRevision>p.publicationRevision)
             AND NOT EXISTS (SELECT 1 FROM editorial_commands c WHERE c.tenantId=e.tenantId AND c.resourceKind='app' AND c.resourceId=e.resourceId AND c.revision>p.publicationRevision)`,
        },
        {
          kind: 'application',
          at: 'c.createdAt',
          id: 'c.resourceId',
          slug: 'a.slug',
          parent: 'NULL',
          version: 'NULL',
          from: `editorial_commands c JOIN editorial_resource_states e ON e.resourceKind='app' AND e.resourceId=c.resourceId
           JOIN app_records a ON a.id=c.resourceId`,
          where: `c.actorIdentityId=? AND c.tenantId=e.tenantId AND c.resourceKind='app' AND c.deleted=0 AND a.isSuspended=0
           AND NOT EXISTS (SELECT 1 FROM application_publications p LEFT JOIN application_editing_targets t ON t.draftId=p.applicationId
             WHERE COALESCE(t.applicationId,p.applicationId)=c.resourceId AND p.publicationRevision>=c.revision)
           AND NOT EXISTS (SELECT 1 FROM editorial_commands newer WHERE newer.tenantId=c.tenantId AND newer.resourceKind='app' AND newer.resourceId=c.resourceId AND newer.revision>c.revision)`,
        },
        {
          kind: 'article',
          at: 'p.updatedAt',
          id: 'p.articleId',
          slug: 'p.slug',
          parent: 'NULL',
          version: 'NULL',
          from: "article_publications p JOIN editorial_resource_states e ON e.resourceKind='article' AND e.resourceId=p.articleId",
          where:
            'p.ownerIdentityId=? AND p.ownerIdentityId=e.ownerIdentityId AND p.tenantId=e.tenantId',
        },
        {
          kind: 'release',
          at: 'p.publishedAt',
          id: 'p.releaseId',
          slug: 'NULL',
          parent: 'a.slug',
          version: 'p.version',
          from: `release_publications p JOIN release_drafts d ON d.id=p.draftId
          JOIN editorial_resource_states e ON e.resourceKind='release' AND e.resourceId=p.releaseId
          JOIN app_records a ON a.id=p.applicationId
          JOIN editorial_resource_states parent ON parent.resourceKind='app' AND parent.resourceId=a.id`,
          where:
            'd.ownerIdentityId=? AND d.ownerIdentityId=e.ownerIdentityId AND d.tenantId=e.tenantId AND p.tenantId=e.tenantId AND parent.tenantId=e.tenantId AND parent.deletedAt IS NULL AND a.isSuspended=0',
        },
        ...(suites
          ? [
              {
                kind: 'suite' as const,
                at: 'p.publishedAt',
                id: 'p.suiteId',
                slug: 'NULL',
                parent: 'NULL',
                version: 'NULL',
                from: "suite_publications p JOIN editorial_resource_states e ON e.resourceKind='suite' AND e.resourceId=p.suiteId",
                where: 'e.ownerIdentityId=?',
              },
            ]
          : []),
      ] as const;
      const all: PublicationActivityCandidate[] = [];
      for (const definition of definitions) {
        const key = `CONCAT('${definition.kind}:', ${definition.id}) COLLATE utf8mb4_bin`;
        const cursor = after
          ? `AND (${definition.at} < ? OR (${definition.at} = ? AND ${key} > ?))`
          : '';
        const rows = await manager.query<Record<string, unknown>[]>(
          `SELECT /*+ MAX_EXECUTION_TIME(3000) */ ${definition.id} AS id, ${definition.at} AS at, e.revision,
           ${definition.slug} AS slug, ${definition.parent} AS applicationSlug, ${definition.version} AS version
           FROM ${definition.from} WHERE ${definition.where} AND e.tenantId=? AND e.deletedAt IS NULL ${cursor}
           ORDER BY ${definition.at} DESC, ${definition.id} LIMIT ?`,
          [
            owner,
            this.tenant,
            ...(after ? [after.at, after.at, after.key] : []),
            PROFILE_ACTIVITY_PAGE_SIZE + 1,
          ]
        );
        for (const row of rows) {
          if (
            !isPublicProfileId(row.id) ||
            [row.slug, row.applicationSlug, row.version].some(
              (value) => value !== null && typeof value !== 'string'
            )
          )
            throw new SuiteUnavailableError('Invalid activity authority');
          all.push({
            kind: definition.kind,
            id: row.id,
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
          compareActivity(
            { at: a.at, key: `${a.kind}:${a.id}` },
            { at: b.at, key: `${b.kind}:${b.id}` }
          )
        )
        .slice(0, PROFILE_ACTIVITY_PAGE_SIZE + 1);
    });
  }
}
