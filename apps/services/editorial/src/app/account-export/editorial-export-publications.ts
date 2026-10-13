import { parseArticleFields } from '@domains/publication/article';
import { parseReleaseFields } from '@domains/catalog/versioning';
import type { AccountExportEntry } from '@sdk/features/identity/core';
import { parseEditorialContent } from '../application/editorial-materialization';
import { suitePublicationFields } from '../suites/suite-publication-fields';
import {
  decodeExport,
  exportChoice,
  exportId,
  exportInteger,
  exportJson,
  exportKey,
  exportNullableInteger,
  exportOwner,
  exportRows,
  invalidExport,
  type EditorialExportContext,
} from './editorial-export-sql';

const catalogTables = {
  app: 'app_records',
  tag: 'tags',
  category: 'categories',
} as const;
const relations = [
  { field: 'tagIds', table: 'app_record_tags', column: 'tagsId' },
  {
    field: 'platformIds',
    table: 'app_record_platforms',
    column: 'platformsId',
  },
  { field: 'deviceIds', table: 'app_record_devices', column: 'devicesId' },
  {
    field: 'monetizationModelIds',
    table: 'app_record_monetization',
    column: 'monetizationModelsId',
  },
] as const;

export async function* captureEditorialPublications(
  context: EditorialExportContext
): AsyncIterable<AccountExportEntry> {
  const { reader, owner, entry } = context;
  for await (const row of exportRows(
    reader,
    `SELECT resourceKind, resourceId, tenantId, ownerIdentityId, revision, deletedAt
    FROM editorial_resource_states WHERE ownerIdentityId = ?`,
    [owner],
    [
      { column: 'resourceKind', field: 'resourceKind' },
      ...exportKey('resourceId'),
    ]
  )) {
    const kind = exportChoice(row.resourceKind, [
      'app',
      'tag',
      'category',
      'suite',
      'article',
      'release',
    ]);
    const resourceId = exportId(row.resourceId),
      tenantId = exportOwner(row, owner);
    const revision = exportInteger(row.revision, 1),
      deletedAt = exportNullableInteger(row.deletedAt);
    yield entry('resources', {
      kind,
      resourceId,
      tenantId,
      revision,
      deletedAt,
    });
    if (kind === 'app' || kind === 'tag' || kind === 'category') {
      const fields =
        kind === 'app'
          ? ', description, website, classification, isPwa, rating, estimatedNumberOfUsers, isSuspended, logoUrl, bannerUrl, categoryId'
          : kind === 'category'
          ? ', parentId'
          : '';
      const values = await reader.query(
        `SELECT name, slug, DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i:%s.%f') AS createdAtSql,
        DATE_FORMAT(updatedAt, '%Y-%m-%d %H:%i:%s.%f') AS updatedAtSql${fields} FROM ${catalogTables[kind]} WHERE id = ?`,
        [resourceId]
      );
      if (values.length !== 1) return invalidExport();
      const content = values[0];
      if (kind === 'app') {
        if (content.classification === null) delete content.classification;
        if (
          ![0, 1].includes(Number(content.isPwa)) ||
          ![0, 1].includes(Number(content.isSuspended)) ||
          content.isPwa === null ||
          content.isSuspended === null
        )
          return invalidExport();
        content.isPwa = exportInteger(content.isPwa) === 1;
        content.isSuspended = exportInteger(content.isSuspended) === 1;
        if (content.rating !== null) {
          if (
            typeof content.rating !== 'number' &&
            (typeof content.rating !== 'string' ||
              !/^\d(?:\.\d)?$/.test(content.rating))
          )
            return invalidExport();
          content.rating = Number(content.rating);
        }
        content.estimatedNumberOfUsers = exportNullableInteger(
          content.estimatedNumberOfUsers
        );
        for (const relation of relations) {
          const ids = await reader.query(
            `SELECT ${relation.column} AS id FROM ${relation.table} WHERE appRecordsId = ? ORDER BY ${relation.column} LIMIT 51`,
            [resourceId]
          );
          if (ids.length > 50) return invalidExport();
          content[relation.field] = ids.map((id) => exportId(id.id));
        }
      }
      // Validate retained canonical content without applying public tombstone filtering.
      yield entry('catalog', {
        kind,
        resourceId,
        tenantId,
        content: decodeExport(() =>
          parseEditorialContent(kind, content, deletedAt !== null)
        ),
      });
    } else if (kind === 'article') {
      const publications = await reader.query(
        `SELECT articleId, tenantId, ownerIdentityId, slug, title, category, fields, submittedRevision, publishedAt, updatedAt FROM article_publications WHERE articleId = ?`,
        [resourceId]
      );
      if (publications.length !== 1) return invalidExport();
      const publication = publications[0];
      if (exportOwner(publication, owner) !== tenantId) return invalidExport();
      const fields = decodeExport(() =>
        parseArticleFields(exportJson(publication.fields))
      );
      if (
        fields.slug !== publication.slug ||
        fields.title !== publication.title ||
        fields.category !== publication.category
      )
        return invalidExport();
      const content = decodeExport(() =>
        parseEditorialContent('article', {
          ...fields,
          submittedRevision: exportInteger(publication.submittedRevision, 1),
          publishedAt: exportInteger(publication.publishedAt),
          updatedAt: exportInteger(publication.updatedAt),
        })
      );
      yield entry('articles.publications', {
        articleId: resourceId,
        tenantId,
        content,
      });
    } else if (kind === 'release') {
      const publications = await reader.query(
        `SELECT p.releaseId, p.applicationId, p.tenantId, p.version, p.fields, p.publishedAt, p.draftId, p.submittedRevision,
        d.ownerIdentityId, d.tenantId AS draftTenantId FROM release_publications p LEFT JOIN release_drafts d ON d.id = p.draftId WHERE p.releaseId = ?`,
        [resourceId]
      );
      if (publications.length !== 1) return invalidExport();
      const publication = publications[0];
      if (
        exportOwner(publication, owner) !== tenantId ||
        publication.draftTenantId !== tenantId
      )
        return invalidExport();
      const fields = decodeExport(() =>
        parseReleaseFields(exportJson(publication.fields))
      );
      if (fields.version !== publication.version) return invalidExport();
      const content = decodeExport(() =>
        parseEditorialContent('release', {
          ...fields,
          applicationId: exportId(publication.applicationId),
          publishedAt: exportInteger(publication.publishedAt),
        })
      );
      yield entry('releases.publications', {
        releaseId: resourceId,
        tenantId,
        draftId: exportId(publication.draftId),
        submittedRevision: exportInteger(publication.submittedRevision, 1),
        content,
      });
    } else {
      const publications = await reader.query(
        'SELECT submittedRevision,publishedAt,title,description,applicationIds,classification FROM suite_publications WHERE suiteId=?',
        [resourceId]
      );
      if (publications.length === 0 && deletedAt !== null) {
        const drafts = await reader.query(
          'SELECT tenantId, ownerIdentityId, deletedAt FROM private_suites WHERE id = ?',
          [resourceId]
        );
        if (
          drafts.length !== 1 ||
          exportOwner(drafts[0], owner) !== tenantId ||
          drafts[0].deletedAt === null
        )
          return invalidExport();
        continue;
      }
      if (publications.length !== 1) return invalidExport();
      const publication = publications[0];
      const submittedRevision = exportInteger(publication.submittedRevision, 1),
        publishedAt = exportInteger(publication.publishedAt);
      const content = decodeExport(() =>
        parseEditorialContent('suite', {
          ...suitePublicationFields(publication),
          submittedRevision,
          publishedAt,
        })
      );
      yield entry('suites.publications', {
        suiteId: resourceId,
        tenantId,
        submittedRevision,
        publishedAt,
        content,
      });
    }
  }
}
