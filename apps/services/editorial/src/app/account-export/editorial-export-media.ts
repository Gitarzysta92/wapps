import { createHash } from 'node:crypto';
import {
  applicationImageExternalUrl,
  parseApplicationImageUpload,
  parseArticleCoverUpload,
  type ApplicationImageAsset,
  type ArticleCoverAsset,
} from '@domains/catalog/media';
import type { AccountExportEntry } from '@sdk/features/identity/core';
import type { ApplicationImageObjects } from '../application-media/application-image.ports';
import type { ArticleCoverObjects } from '../article-covers/article-cover.ports';
import { applicationPublishedImagePath } from '../application-media/application-image-bindings';
import {
  decodeExport,
  exportChoice,
  exportId,
  exportInteger,
  exportJson,
  exportKey,
  exportOwner,
  exportRows,
  invalidExport,
  type EditorialExportContext,
} from './editorial-export-sql';

export interface EditorialExportImages {
  applications: Pick<ApplicationImageObjects, 'read'>;
  articles: Pick<ArticleCoverObjects, 'read'>;
}

async function* imageBytes(
  context: EditorialExportContext,
  collection: string,
  asset: ApplicationImageAsset | ArticleCoverAsset,
  bytes: Uint8Array
): AsyncIterable<AccountExportEntry> {
  if (
    bytes.byteLength !== asset.bytes ||
    createHash('sha256').update(bytes).digest('hex') !== asset.sha256
  )
    return invalidExport();
  for (let offset = 0; offset < bytes.byteLength; offset += 256 * 1024) {
    context.signal.throwIfAborted();
    yield context.entry(collection, {
      imageId: asset.id,
      offset,
      encoding: 'base64',
      bytes: Buffer.from(bytes.subarray(offset, offset + 256 * 1024)).toString(
        'base64'
      ),
    });
  }
}

export async function* captureEditorialMedia(
  context: EditorialExportContext,
  images: EditorialExportImages
): AsyncIterable<AccountExportEntry> {
  const { reader, owner, entry, signal } = context;
  for (const kind of ['applications', 'articles'] as const) {
    const table =
      kind === 'applications'
        ? 'application_image_uploads'
        : 'article_cover_uploads';
    const drafts =
      kind === 'applications' ? 'application_drafts' : 'article_drafts';
    const parent = kind === 'applications' ? 'draftId' : 'articleId';
    for await (const row of exportRows(
      reader,
      `SELECT u.id, u.tenantId, u.ownerIdentityId, u.${parent}, ${
        kind === 'applications' ? 'u.purpose,' : ''
      }
      u.sourceType, u.sourceBytes, u.sourceSha256, u.status, u.revision, u.createdAt, u.expiresAt, u.asset,
      d.ownerIdentityId AS draftOwner, d.tenantId AS draftTenant FROM ${table} u LEFT JOIN ${drafts} d ON d.id = u.${parent}
      WHERE u.ownerIdentityId = ?`,
      [owner],
      exportKey('u.id')
    )) {
      const tenantId = exportOwner(row, owner);
      if (row.draftOwner !== owner || row.draftTenant !== tenantId)
        return invalidExport();
      const base = {
        id: exportId(row.id),
        source: {
          contentType: row.sourceType,
          bytes: exportInteger(row.sourceBytes, 1),
          sha256: row.sourceSha256,
        },
        status: row.status,
        revision: exportInteger(row.revision, 1),
        createdAt: exportInteger(row.createdAt),
        expiresAt: exportInteger(row.expiresAt),
        asset: exportJson(row.asset),
      };
      signal.throwIfAborted();
      if (kind === 'applications') {
        const upload = decodeExport(() =>
          parseApplicationImageUpload({
            ...base,
            draftId: row.draftId,
            purpose: row.purpose,
          })
        );
        yield entry('applications.image-uploads', { tenantId, ...upload });
        if (upload.asset)
          yield* imageBytes(
            context,
            'applications.image-bytes',
            upload.asset,
            await images.applications.read(upload.asset, signal)
          );
      } else {
        const upload = decodeExport(() =>
          parseArticleCoverUpload({ ...base, articleId: row.articleId })
        );
        yield entry('articles.cover-uploads', { tenantId, ...upload });
        if (upload.asset)
          yield* imageBytes(
            context,
            'articles.cover-bytes',
            upload.asset,
            await images.articles.read(upload.asset, signal)
          );
      }
    }
  }
  for (const kind of ['draft', 'submission', 'publication'] as const) {
    const published = kind === 'publication',
      submitted = kind === 'submission';
    const table = published
      ? 'application_published_images'
      : submitted
      ? 'application_submission_images'
      : 'application_draft_images';
    const parent = published ? 'applicationId' : 'draftId';
    const authority = published
      ? "editorial_resource_states d ON d.resourceKind = 'app' AND d.resourceId = b.applicationId"
      : 'application_drafts d ON d.id = b.draftId';
    for await (const row of exportRows(
      reader,
      `SELECT b.${parent}, b.purpose, b.imageId, b.url${
        published
          ? ', b.publicationRevision'
          : submitted
          ? ', b.submittedRevision'
          : ''
      },
      d.tenantId, d.ownerIdentityId, u.tenantId AS imageTenant, u.status AS imageStatus, u.purpose AS imagePurpose
      FROM ${table} b JOIN ${authority} LEFT JOIN (
        SELECT imageId AS id,tenantId,IF(retiredAt IS NULL,'ready','cancelled') AS status,
          JSON_UNQUOTE(JSON_EXTRACT(asset,'$.purpose')) AS purpose
        FROM editorial_media_assets WHERE kind='application'
      ) u ON u.id = b.imageId WHERE d.ownerIdentityId = ?`,
      [owner],
      [
        ...exportKey(`b.${parent}`),
        ...(submitted ? exportKey('b.submittedRevision') : []),
        ...exportKey('b.purpose'),
      ]
    )) {
      const tenantId = exportOwner(row, owner);
      const imageId = row.imageId === null ? null : exportId(row.imageId);
      const purpose = exportChoice(row.purpose, ['logo', 'banner']);
      if (
        imageId !== null &&
        (row.imageTenant !== tenantId ||
          row.imageStatus !== 'ready' ||
          row.imagePurpose !== purpose)
      )
        return invalidExport();
      const url =
        row.url === null
          ? null
          : decodeExport(() => applicationImageExternalUrl(row.url));
      if (published) {
        if (
          imageId === null ||
          url === null ||
          new URL(url).pathname !==
            applicationPublishedImagePath(
              exportId(row[parent]),
              purpose,
              imageId
            )
        )
          return invalidExport();
      } else if (imageId !== null && url !== null) return invalidExport();
      yield entry('applications.image-bindings', {
        kind,
        tenantId,
        [parent]: exportId(row[parent]),
        purpose,
        imageId,
        url,
        ...(published
          ? { publicationRevision: exportInteger(row.publicationRevision, 1) }
          : submitted
          ? { submittedRevision: exportInteger(row.submittedRevision, 1) }
          : {}),
      });
    }
  }
  for await (const row of exportRows(
    reader,
    `SELECT b.articleId, b.kind, b.imageId, d.tenantId, d.ownerIdentityId, u.tenantId AS imageTenant, u.status AS imageStatus, u.articleId AS imageArticleId
    FROM article_cover_references b JOIN article_drafts d ON d.id = b.articleId
    LEFT JOIN (SELECT imageId AS id,tenantId,articleId,IF(retiredAt IS NULL,'ready','cancelled') AS status FROM editorial_media_assets WHERE kind='article') u ON u.id = b.imageId WHERE d.ownerIdentityId = ?`,
    [owner],
    [...exportKey('b.articleId'), ...exportKey('b.kind')]
  )) {
    if (
      row.imageTenant !== row.tenantId ||
      row.imageStatus !== 'ready' ||
      row.imageArticleId !== row.articleId
    )
      return invalidExport();
    yield entry('articles.cover-bindings', {
      articleId: exportId(row.articleId),
      tenantId: exportOwner(row, owner),
      kind: exportChoice(row.kind, ['draft', 'submission', 'publication']),
      imageId: exportId(row.imageId),
    });
  }
}
