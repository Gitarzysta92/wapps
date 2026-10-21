import type { EntityManager } from 'typeorm';
import {
  ArticleCoverConflictError,
  type ArticleCoverRetirementReason,
} from '@domains/catalog/media';
import {
  lockEditorialMediaAsset,
  retireEditorialMediaAsset,
} from '../application-media/editorial-media-assets';

export const ARTICLE_COVER_REFERENCE_TABLES = [
  'article_cover_references',
] as const;

/** Call while holding the asset row lock; every reference insertion takes the same lock. */
export async function articleCoverReferenced(
  manager: EntityManager,
  id: string
) {
  await lockEditorialMediaAsset(manager, 'article', id);
  for (const table of ARTICLE_COVER_REFERENCE_TABLES)
    if (
      (
        await manager.query(
          `SELECT imageId FROM ${table} WHERE imageId = ? LIMIT 1`,
          [id]
        )
      ).length
    )
      return true;
  return false;
}

export async function retireArticleCover(
  manager: EntityManager,
  id: string,
  revision: number,
  at: number,
  reason: ArticleCoverRetirementReason
) {
  await retireEditorialMediaAsset(manager, 'article', id, at);
  const result: { affectedRows: number } = await manager.query(
    "UPDATE article_cover_uploads SET status = 'cancelled', revision = ?, asset = NULL, leaseToken = NULL, leaseUntil = NULL, commandKey = NULL WHERE id = ? AND revision = ? AND status IN ('pending', 'ready')",
    [revision + 1, id, revision]
  );
  if (result.affectedRows !== 1)
    throw new ArticleCoverConflictError(
      'Image retirement changed. Reload before continuing.'
    );
  await manager.query(
    'INSERT INTO article_cover_cleanup (imageId, reason, createdAt, availableAt, attempts, leaseToken, leaseUntil, completedAt, failedAt, lastError) VALUES (?, ?, ?, ?, 0, NULL, NULL, NULL, NULL, NULL)',
    [id, reason, at, at]
  );
  return { id, revision: revision + 1, status: 'cancelled' as const };
}
