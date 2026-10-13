import type { DataSource } from 'typeorm';
import {
  APPLICATION_IMAGE_UNUSED_LIFETIME,
  applicationImageInteger,
} from '@domains/catalog/media';
import {
  APPLICATION_IMAGE_REFERENCE_TABLES,
  applicationImageReferenced,
} from './application-image-retirement';
import {
  ARTICLE_COVER_REFERENCE_TABLES,
  articleCoverReferenced,
} from '../article-covers/article-cover-retirement';
import {
  editorialMediaAsset,
  lockEditorialMediaAsset,
  type EditorialMediaAsset,
  type EditorialMediaKind,
} from './editorial-media-assets';

const families = {
  application: {
    prefix: 'application_image',
    references: APPLICATION_IMAGE_REFERENCE_TABLES,
    referenced: applicationImageReferenced,
  },
  article: {
    prefix: 'article_cover',
    references: ARTICLE_COVER_REFERENCE_TABLES,
    referenced: articleCoverReferenced,
  },
} as const;

/** Referenced assets outlive private upload history; a later release of their last reference must still reclaim bytes. */
export async function retireUnreferencedEditorialAssets(
  source: DataSource,
  kind: EditorialMediaKind,
  at: number,
  limit: number
) {
  applicationImageInteger(at, 8_640_000_000_000_000);
  applicationImageInteger(limit, 50);
  const family = families[kind];
  const candidates: { imageId: string }[] = await source.query(
    `SELECT a.imageId FROM editorial_media_assets a
    WHERE a.kind=? AND a.retiredAt IS NULL AND a.createdAt<=?
    AND NOT EXISTS (SELECT 1 FROM ${
      family.prefix
    }_uploads i WHERE i.id=a.imageId)
    AND ${family.references
      .map(
        (table) =>
          `NOT EXISTS (SELECT 1 FROM ${table} r WHERE r.imageId=a.imageId)`
      )
      .join(' AND ')}
    ORDER BY a.createdAt,a.imageId LIMIT ?`,
    [kind, Math.max(0, at - APPLICATION_IMAGE_UNUSED_LIFETIME), limit]
  );
  let retired = 0;
  for (const candidate of candidates) {
    if (
      await source.transaction('READ COMMITTED', async (manager) => {
        // Keep the same upload -> asset -> cleanup order as normal cancellation and cleanup claims.
        const uploads = await manager.query(
          `SELECT id FROM ${family.prefix}_uploads WHERE id=? FOR UPDATE`,
          [candidate.imageId]
        );
        if (uploads.length) return false;
        const asset = await lockEditorialMediaAsset(
          manager,
          kind,
          candidate.imageId
        );
        if (!asset)
          throw new Error('Missing Editorial media retirement authority');
        if (
          asset.retiredAt !== null ||
          asset.createdAt > at - APPLICATION_IMAGE_UNUSED_LIFETIME ||
          (await family.referenced(manager, asset.imageId))
        )
          return false;
        const retiredAsset = editorialMediaAsset({
          ...asset,
          asset: null,
          retiredAt: at,
        });
        await manager.query(
          'UPDATE editorial_media_assets SET asset=NULL,retiredAt=? WHERE kind=? AND imageId=?',
          [retiredAsset.retiredAt, kind, asset.imageId]
        );
        await manager.query(
          `INSERT INTO ${family.prefix}_cleanup (imageId,reason,createdAt,availableAt,attempts,leaseToken,leaseUntil,completedAt,failedAt,lastError) VALUES (?,'unreferenced',?,?,0,NULL,NULL,NULL,NULL,NULL)`,
          [asset.imageId, at, at]
        );
        return true;
      })
    )
      retired++;
  }
  return retired;
}

/** A cleanup job remains authorized after its cancelled private upload is erased. */
export function editorialRetirementConflict(
  asset: EditorialMediaAsset | null,
  retiredAt: number,
  upload: Record<string, unknown> | undefined
) {
  return (
    !asset ||
    asset.asset !== null ||
    asset.retiredAt !== retiredAt ||
    !!(
      upload &&
      (upload.status !== 'cancelled' ||
        upload.asset !== null ||
        upload.tenantId !== asset.tenantId ||
        Number(upload.createdAt) !== asset.createdAt ||
        ![2, 3].includes(Number(upload.revision)) ||
        upload.leaseToken !== null ||
        upload.leaseUntil !== null ||
        upload.commandKey !== null ||
        (asset.kind === 'article' && upload.articleId !== asset.articleId))
    )
  );
}
