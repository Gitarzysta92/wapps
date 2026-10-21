import type { EntityManager } from 'typeorm';
import {
  ApplicationImageConflictError,
  type ApplicationImageRetirementReason,
} from '@domains/catalog/media';
import {
  lockEditorialMediaAsset,
  retireEditorialMediaAsset,
} from './editorial-media-assets';

export const APPLICATION_IMAGE_REFERENCE_TABLES = [
  'application_draft_images',
  'application_submission_images',
  'application_published_images',
] as const;

/** Call while holding the asset row lock; every reference insertion takes the same lock. */
export async function applicationImageReferenced(
  manager: EntityManager,
  id: string
) {
  await lockEditorialMediaAsset(manager, 'application', id);
  for (const table of APPLICATION_IMAGE_REFERENCE_TABLES)
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

export async function retireApplicationImage(
  manager: EntityManager,
  id: string,
  revision: number,
  at: number,
  reason: ApplicationImageRetirementReason
) {
  await retireEditorialMediaAsset(manager, 'application', id, at);
  const result: { affectedRows: number } = await manager.query(
    "UPDATE application_image_uploads SET status = 'cancelled', revision = ?, asset = NULL, leaseToken = NULL, leaseUntil = NULL, commandKey = NULL WHERE id = ? AND revision = ? AND status IN ('pending', 'ready')",
    [revision + 1, id, revision]
  );
  if (result.affectedRows !== 1)
    throw new ApplicationImageConflictError(
      'Image retirement changed. Reload before continuing.'
    );
  await manager.query(
    'INSERT INTO application_image_cleanup (imageId, reason, createdAt, availableAt, attempts, leaseToken, leaseUntil, completedAt, failedAt, lastError) VALUES (?, ?, ?, ?, 0, NULL, NULL, NULL, NULL, NULL)',
    [id, reason, at, at]
  );
  return { id, revision: revision + 1, status: 'cancelled' as const };
}
