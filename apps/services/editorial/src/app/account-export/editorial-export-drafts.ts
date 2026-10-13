import { parseApplicationDraft } from '@domains/catalog/record';
import { parsePrivateSuite } from '@domains/publication/suite';
import {
  parseArticleFields,
  parseArticleDraft,
} from '@domains/publication/article';
import {
  parseReleaseFields,
  parseReleaseDraft,
  parseReleaseTarget,
} from '@domains/catalog/versioning';
import type { AccountExportEntry } from '@sdk/features/identity/core';
import { applicationSubmissionFromRow } from '../application-publication/mysql-application-publication';
import { suiteSubmissionFromRow } from '../suites/mysql-suite-publication';
import { articleSubmissionFromRow } from '../articles/mysql-article-state';
import { releaseSubmissionFromRow } from '../releases/mysql-release-state';
import {
  decodeExport,
  exportDraftMetadata,
  exportId,
  exportInteger,
  exportJson,
  exportKey,
  exportNullableInteger,
  exportOwner,
  exportRows,
  invalidExport,
  type EditorialExportContext,
  type ExportRow,
} from './editorial-export-sql';

const families = [
  {
    kind: 'applications',
    table: 'application_drafts',
    fields: 'name, slug, website, description, classification',
    submissions: 'application_submissions',
    parent: 'applicationId',
    submitted:
      'tenantId, ownerIdentityId, name, slug, website, description, classification, basePublicationRevision',
  },
  {
    kind: 'suites',
    table: 'private_suites',
    fields: 'title, description, applicationIds, classification',
    submissions: 'suite_submissions',
    parent: 'suiteId',
    submitted:
      'tenantId, ownerIdentityId, title, description, applicationIds, classification',
  },
  {
    kind: 'articles',
    table: 'article_drafts',
    fields: 'fields',
    submissions: 'article_submissions',
    parent: 'articleId',
    submitted: 'fields, sourcePublicationRevision',
  },
  {
    kind: 'releases',
    table: 'release_drafts',
    fields:
      'fields, applicationId, releaseId, claimId, sourcePublicationRevision',
    submissions: 'release_submissions',
    parent: 'draftId',
    submitted: 'fields, target',
  },
] as const;

function draftContent(
  kind: (typeof families)[number]['kind'],
  row: ExportRow,
  metadata: ReturnType<typeof exportDraftMetadata>
) {
  const { id, revision, createdAt, updatedAt } = metadata;
  const base = { id, revision, createdAt, updatedAt };
  if (metadata.deletedAt !== null) {
    if (
      (kind === 'applications' || kind === 'suites') &&
      row.classification !== null
    )
      return invalidExport();
    if (
      kind === 'applications' &&
      [row.name, row.slug, row.website, row.description].some(
        (value) => value !== ''
      )
    )
      return invalidExport();
    if (
      kind === 'suites' &&
      (row.title !== '' ||
        row.description !== '' ||
        JSON.stringify(exportJson(row.applicationIds)) !== '[]')
    )
      return invalidExport();
    if ((kind === 'articles' || kind === 'releases') && row.fields !== null)
      return invalidExport();
    return null;
  }
  return decodeExport(() => {
    if (kind === 'applications')
      return parseApplicationDraft({
        ...base,
        name: row.name,
        slug: row.slug,
        website: row.website,
        description: row.description,
        classification: row.classification ?? undefined,
      });
    if (kind === 'suites')
      return parsePrivateSuite({
        ...base,
        visibility: 'private',
        title: row.title,
        description: row.description,
        classification: row.classification ?? undefined,
        applicationIds: exportJson(row.applicationIds),
      });
    if (kind === 'articles')
      return parseArticleDraft({
        ...base,
        ...parseArticleFields(exportJson(row.fields)),
      });
    return parseReleaseDraft({
      ...base,
      ...parseReleaseFields(exportJson(row.fields)),
      target: releaseTarget(row),
    });
  });
}
function releaseTarget(row: ExportRow) {
  return decodeExport(() =>
    parseReleaseTarget({
      applicationId: row.applicationId,
      releaseId: row.releaseId,
      claimId: row.claimId,
      sourcePublicationRevision: exportNullableInteger(
        row.sourcePublicationRevision,
        1
      ),
    })
  );
}

export async function* captureEditorialDrafts(
  context: EditorialExportContext
): AsyncIterable<AccountExportEntry> {
  const { reader, owner, entry } = context;
  for (const family of families) {
    for await (const row of exportRows(
      reader,
      `SELECT id, tenantId, ownerIdentityId, revision, createdAt, updatedAt, deletedAt, ${family.fields} FROM ${family.table} WHERE ownerIdentityId = ?`,
      [owner],
      exportKey('id')
    )) {
      const metadata = exportDraftMetadata(row, owner),
        content = draftContent(family.kind, row, metadata);
      yield entry(`${family.kind}.drafts`, {
        ...metadata,
        content,
        ...(family.kind === 'releases' ? { target: releaseTarget(row) } : {}),
      });
      if (family.kind === 'applications') {
        const targets = await reader.query(
          'SELECT draftId, applicationId, claimId, sourcePublicationRevision FROM application_editing_targets WHERE draftId = ?',
          [metadata.id]
        );
        if (targets.length > 1) return invalidExport();
        for (const target of targets)
          yield entry('applications.editing-targets', {
            draftId: metadata.id,
            applicationId: exportId(target.applicationId),
            claimId: exportId(target.claimId),
            sourcePublicationRevision: exportInteger(
              target.sourcePublicationRevision,
              1
            ),
          });
      }
      let approvedPublication: {
        submittedRevision: number;
        publishedAt: number;
        publicationRevision?: number;
      } | null = null;
      if (family.kind === 'applications' || family.kind === 'suites') {
        const publications = await reader.query(
          `SELECT submittedRevision, publishedAt${
            family.kind === 'applications' ? ', publicationRevision' : ''
          } FROM ${
            family.kind === 'applications'
              ? 'application_publications'
              : 'suite_publications'
          } WHERE ${family.parent} = ?`,
          [metadata.id]
        );
        if (publications.length > 1) return invalidExport();
        for (const publication of publications)
          approvedPublication = {
            submittedRevision: exportInteger(publication.submittedRevision, 1),
            publishedAt: exportInteger(publication.publishedAt),
            ...(family.kind === 'applications'
              ? {
                  publicationRevision: exportInteger(
                    publication.publicationRevision,
                    1
                  ),
                }
              : {}),
          };
      }
      let foundPublication = false;
      for await (const submitted of exportRows(
        reader,
        `SELECT submittedRevision, status, reason, submittedAt, reviewedAt, ${family.submitted} FROM ${family.submissions} WHERE ${family.parent} = ?`,
        [metadata.id],
        exportKey('submittedRevision')
      )) {
        if (metadata.deletedAt !== null) return invalidExport();
        if (
          (family.kind === 'applications' || family.kind === 'suites') &&
          exportOwner(submitted, owner) !== metadata.tenantId
        )
          return invalidExport();
        const value = decodeExport(() =>
          family.kind === 'applications'
            ? applicationSubmissionFromRow(submitted)
            : family.kind === 'suites'
            ? suiteSubmissionFromRow(submitted)
            : family.kind === 'articles'
            ? articleSubmissionFromRow(submitted)
            : releaseSubmissionFromRow(submitted)
        );
        if (
          value.submittedRevision >= metadata.revision ||
          value.submittedAt < metadata.createdAt ||
          value.submittedAt > metadata.updatedAt ||
          (value.reviewedAt !== null && value.reviewedAt > metadata.updatedAt)
        )
          return invalidExport();
        if (
          approvedPublication?.submittedRevision === value.submittedRevision
        ) {
          if (
            value.status !== 'approved' ||
            value.reviewedAt !== approvedPublication.publishedAt
          )
            return invalidExport();
          foundPublication = true;
        }
        yield entry(`${family.kind}.submissions`, {
          draftId: metadata.id,
          tenantId: metadata.tenantId,
          ...value,
        });
      }
      if (approvedPublication) {
        // A deleted draft can retain its publication marker after submission text has been scrubbed.
        if (metadata.deletedAt === null && !foundPublication)
          return invalidExport();
        yield entry(`${family.kind}.publication-links`, {
          draftId: metadata.id,
          tenantId: metadata.tenantId,
          ...approvedPublication,
        });
      }
    }
  }
}
