import type { EntityManager } from 'typeorm';
import {
  APPLICATION_IMAGE_ATTEMPT_LIMIT,
  ARTICLE_COVER_ATTEMPT_LIMIT,
} from '@domains/catalog/media';
import {
  applicationImageFromRow,
  type ApplicationImageRow,
} from '../application-media/mysql-application-images';
import {
  articleCoverFromRow,
  type ArticleCoverRow,
} from '../article-covers/mysql-article-covers';
import {
  applicationImageReferenced,
  retireApplicationImage,
} from '../application-media/application-image-retirement';
import {
  articleCoverReferenced,
  retireArticleCover,
} from '../article-covers/article-cover-retirement';
import {
  editorialMediaAsset,
  lockEditorialMediaAsset,
} from '../application-media/editorial-media-assets';
import { editorialRetirementConflict } from '../application-media/editorial-media-retirement';
import {
  validateApplicationImageCleanup,
  type ApplicationImageCleanupRow,
} from '../application-media/mysql-application-image-cleanup';
import { validateArticleCoverCleanup } from '../article-covers/mysql-article-cover-cleanup';
import type { EditorialWorkspaceErasureState } from './editorial-workspace-erasure.port';

const families = {
  application: {
    prefix: 'application_image',
    parent: 'draftId',
    attempts: APPLICATION_IMAGE_ATTEMPT_LIMIT,
    referenced: applicationImageReferenced,
    retire: retireApplicationImage,
    cleanup: validateApplicationImageCleanup,
  },
  article: {
    prefix: 'article_cover',
    parent: 'articleId',
    attempts: ARTICLE_COVER_ATTEMPT_LIMIT,
    referenced: articleCoverReferenced,
    retire: retireArticleCover,
    cleanup: validateArticleCoverCleanup,
  },
} as const;

/** Called after the owned draft is tombstoned. Object I/O remains outside the SQL transaction. */
export async function eraseEditorialWorkspaceMedia(
  manager: EntityManager,
  kind: keyof typeof families,
  draft: { id: string; tenantId: string; ownerIdentityId: string },
  at: number
): Promise<EditorialWorkspaceErasureState> {
  const family = families[kind];
  const [row] = await manager.query<(ApplicationImageRow & ArticleCoverRow)[]>(
    `SELECT * FROM ${family.prefix}_uploads WHERE ${family.parent}=? ORDER BY id LIMIT 1 FOR UPDATE`,
    [draft.id]
  );
  if (!row) return 'drained';
  if (
    row.tenantId !== draft.tenantId ||
    row.ownerIdentityId !== draft.ownerIdentityId
  )
    throw new Error(
      'Editorial erasure upload ownership differs from its draft'
    );
  const upload =
    kind === 'application'
      ? applicationImageFromRow(row)
      : articleCoverFromRow(row);
  // One reservation, at most one command per processing attempt, and one cancellation.
  const commands: Record<string, unknown>[] = await manager.query(
    `SELECT tenantId,ownerIdentityId,commandKey FROM ${family.prefix}_commands WHERE imageId=? LIMIT ? FOR UPDATE`,
    [upload.id, family.attempts + 3]
  );
  if (
    commands.length > family.attempts + 2 ||
    commands.some(
      (command) =>
        command.tenantId !== draft.tenantId ||
        command.ownerIdentityId !== draft.ownerIdentityId
    )
  )
    throw new Error('Invalid bounded Editorial upload history');
  const asset = await lockEditorialMediaAsset(manager, kind, upload.id);
  const referenced = await family.referenced(manager, upload.id);
  if (upload.status === 'ready') {
    const expected = editorialMediaAsset({
      kind,
      imageId: upload.id,
      tenantId: draft.tenantId,
      articleId: kind === 'article' ? draft.id : null,
      asset: upload.asset,
      createdAt: upload.createdAt,
      retiredAt: null,
    });
    if (JSON.stringify(asset) !== JSON.stringify(expected))
      throw new Error(
        'Editorial erasure requires the exact immutable media descriptor'
      );
  } else if (referenced) {
    throw new Error(
      'Editorial erasure cannot remove referenced non-ready media'
    );
  }
  if (upload.status === 'cancelled') {
    const [job] = await manager.query<ApplicationImageCleanupRow[]>(
      `SELECT * FROM ${family.prefix}_cleanup WHERE imageId=? FOR UPDATE`,
      [upload.id]
    );
    if (!job)
      throw new Error('Editorial erasure requires durable media cleanup');
    family.cleanup(job);
    if (editorialRetirementConflict(asset, Number(job.createdAt), row))
      throw new Error(
        'Editorial erasure requires the exact media retirement guard'
      );
    if (job.completedAt === null) return 'media-pending';
  } else if (!referenced) {
    await family.retire(
      manager,
      upload.id,
      upload.revision,
      Math.max(at, upload.createdAt),
      'draft-deleted'
    );
    return 'media-pending';
  }
  await manager.query(`DELETE FROM ${family.prefix}_commands WHERE imageId=?`, [
    upload.id,
  ]);
  await manager.query(`DELETE FROM ${family.prefix}_uploads WHERE id=?`, [
    upload.id,
  ]);
  return 'pending';
}
