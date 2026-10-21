import type { EntityManager } from 'typeorm';
import {
  applicationImageExternalUrl,
  parseApplicationImageSet,
  type ApplicationImagePurpose,
  type ApplicationImageSet,
} from '@domains/catalog/media';
import {
  ApplicationDraftConflictError,
  ApplicationDraftInputError,
  ApplicationDraftNotFoundError,
  ApplicationDraftUnavailableError,
} from '@domains/catalog/record';
import type { EditorialActor } from '../application/editorial.ports';
import {
  applicationImageFromRow,
  type ApplicationImageRow,
} from './mysql-application-images';
import { applicationMediaAsset } from './editorial-media-assets';

export interface ApplicationImageBindingRow {
  purpose: ApplicationImagePurpose;
  imageId: string | null;
  url: string | null;
}
export const APPLICATION_IMAGE_PURPOSES = ['logo', 'banner'] as const;

async function imagesFromBindings(
  manager: EntityManager,
  rows: ApplicationImageBindingRow[],
  tenantId: string
): Promise<ApplicationImageSet> {
  if (rows.length !== 2 || new Set(rows.map((row) => row.purpose)).size !== 2)
    throw new ApplicationDraftUnavailableError(
      'Application image bindings are incomplete'
    );
  const result: ApplicationImageSet = { logo: null, banner: null };
  for (const row of rows) {
    if (
      !APPLICATION_IMAGE_PURPOSES.includes(row.purpose) ||
      (row.imageId !== null && row.url !== null)
    )
      throw new ApplicationDraftUnavailableError(
        'Stored application image binding is invalid'
      );
    if (row.imageId !== null) {
      const asset = await applicationMediaAsset(manager, row.imageId, tenantId);
      if (!asset || asset.purpose !== row.purpose)
        throw new ApplicationDraftUnavailableError(
          'A bound application image is not ready'
        );
      result[row.purpose] = { kind: 'upload', asset };
    } else if (row.url !== null) {
      result[row.purpose] = { kind: 'external', url: row.url };
    }
  }
  try {
    return parseApplicationImageSet(result);
  } catch {
    throw new ApplicationDraftUnavailableError(
      'Stored application image references are invalid'
    );
  }
}
export async function draftApplicationImages(
  manager: EntityManager,
  draftId: string
) {
  const [draft] = await manager.query<{ tenantId: string }[]>(
    'SELECT tenantId FROM application_drafts WHERE id = ?',
    [draftId]
  );
  if (!draft)
    throw new ApplicationDraftNotFoundError('Application draft not found');
  return imagesFromBindings(
    manager,
    await manager.query<ApplicationImageBindingRow[]>(
      'SELECT purpose, imageId, url FROM application_draft_images WHERE draftId = ? ORDER BY purpose',
      [draftId]
    ),
    draft.tenantId
  );
}
export async function submittedApplicationImages(
  manager: EntityManager,
  draftId: string,
  revision: number
): Promise<ApplicationImageSet | null> {
  const rows = await manager.query<ApplicationImageBindingRow[]>(
    'SELECT purpose, imageId, url FROM application_submission_images WHERE draftId = ? AND submittedRevision = ? ORDER BY purpose',
    [draftId, revision]
  );
  // Older immutable submissions did not record media. Do not invent their historical image content.
  if (!rows.length) return null;
  const [submission] = await manager.query<{ tenantId: string }[]>(
    'SELECT tenantId FROM application_submissions WHERE applicationId = ? AND submittedRevision = ?',
    [draftId, revision]
  );
  if (!submission)
    throw new ApplicationDraftNotFoundError('Application submission not found');
  return imagesFromBindings(manager, rows, submission.tenantId);
}
export async function canonicalApplicationImages(
  manager: EntityManager,
  applicationId: string
): Promise<ApplicationImageSet> {
  const [record] = await manager.query<
    { tenantId: string; logoUrl: string | null; bannerUrl: string | null }[]
  >(
    "SELECT a.logoUrl, a.bannerUrl, s.tenantId FROM app_records a JOIN editorial_resource_states s ON s.resourceKind = 'app' AND s.resourceId = a.id WHERE a.id = ?",
    [applicationId]
  );
  if (!record) return { logo: null, banner: null };
  const published = await manager.query<ApplicationImageBindingRow[]>(
    'SELECT purpose, imageId, url FROM application_published_images WHERE applicationId = ?',
    [applicationId]
  );
  const bindings = APPLICATION_IMAGE_PURPOSES.map((purpose) => {
    const url = record[purpose === 'logo' ? 'logoUrl' : 'bannerUrl'];
    const upload = published.find(
      (row) => row.purpose === purpose && row.url === url
    );
    return {
      purpose,
      imageId: upload?.imageId ?? null,
      url: upload ? null : url,
    };
  });
  return imagesFromBindings(manager, bindings, record.tenantId);
}

/** References and cleanup serialize on immutable asset rows; consistent lock order handles shared logo/banner copies. */
export async function lockApplicationImages(
  manager: EntityManager,
  images: ApplicationImageSet,
  tenantId: string
) {
  const assets = APPLICATION_IMAGE_PURPOSES.flatMap((purpose) => {
    const image = images[purpose];
    return image?.kind === 'upload' ? [image.asset] : [];
  }).sort((left, right) => left.id.localeCompare(right.id));
  for (const asset of assets) {
    const current = await applicationMediaAsset(
      manager,
      asset.id,
      tenantId,
      true
    );
    if (!current || JSON.stringify(current) !== JSON.stringify(asset))
      throw new ApplicationDraftConflictError(
        'A selected image is no longer available. Reload before continuing.'
      );
  }
}
export async function draftImageSelection(
  manager: EntityManager,
  actor: EditorialActor,
  draftId: string,
  purpose: ApplicationImagePurpose,
  imageId: string | null
) {
  if (imageId === null) return null;
  const [row] = await manager.query<ApplicationImageRow[]>(
    'SELECT * FROM application_image_uploads WHERE id = ? AND tenantId = ? AND ownerIdentityId = ? AND draftId = ?',
    [imageId, actor.tenantId, actor.identityId, draftId]
  );
  if (!row)
    throw new ApplicationDraftNotFoundError('Image not found in this draft');
  const upload = applicationImageFromRow(row);
  if (upload.purpose !== purpose)
    throw new ApplicationDraftInputError(
      'Choose an image uploaded for this purpose'
    );
  if (!upload.asset)
    throw new ApplicationDraftConflictError(
      'Finish uploading the image before selecting it'
    );
  return { kind: 'upload' as const, asset: upload.asset };
}
export async function saveDraftApplicationImages(
  manager: EntityManager,
  draftId: string,
  images: ApplicationImageSet,
  tenantId: string
) {
  await lockApplicationImages(manager, images, tenantId);
  for (const purpose of APPLICATION_IMAGE_PURPOSES) {
    const reference = images[purpose];
    await manager.query(
      `INSERT INTO application_draft_images (draftId, purpose, imageId, url) VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE imageId = VALUES(imageId), url = VALUES(url)`,
      [
        draftId,
        purpose,
        reference?.kind === 'upload' ? reference.asset.id : null,
        reference?.kind === 'external' ? reference.url : null,
      ]
    );
  }
}
export async function freezeApplicationImages(
  manager: EntityManager,
  draftId: string,
  revision: number,
  images: ApplicationImageSet,
  tenantId: string
) {
  await lockApplicationImages(manager, images, tenantId);
  for (const purpose of APPLICATION_IMAGE_PURPOSES) {
    const reference = images[purpose];
    await manager.query(
      'INSERT INTO application_submission_images (draftId, submittedRevision, purpose, imageId, url) VALUES (?, ?, ?, ?, ?)',
      [
        draftId,
        revision,
        purpose,
        reference?.kind === 'upload' ? reference.asset.id : null,
        reference?.kind === 'external' ? reference.url : null,
      ]
    );
  }
}
export function applicationPublishedImagePath(
  applicationId: string,
  purpose: ApplicationImagePurpose,
  imageId: string
) {
  return `/api/media/applications/${applicationId}/${purpose}/${imageId}`;
}
export function applicationPublishedImageUrl(
  origin: string | undefined,
  applicationId: string,
  purpose: ApplicationImagePurpose,
  imageId: string
) {
  try {
    const url = new URL(origin ?? '');
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error();
    return applicationImageExternalUrl(
      url.origin +
        applicationPublishedImagePath(applicationId, purpose, imageId)
    );
  } catch {
    throw new ApplicationDraftUnavailableError(
      'A public application media origin must be configured before publishing uploaded images'
    );
  }
}
export async function publishApplicationImages(
  manager: EntityManager,
  applicationId: string,
  images: ApplicationImageSet,
  revision: number,
  tenantId: string,
  publicOrigin: string | undefined
) {
  await lockApplicationImages(manager, images, tenantId);
  for (const purpose of APPLICATION_IMAGE_PURPOSES) {
    const reference = images[purpose];
    const url =
      reference?.kind === 'external'
        ? reference.url
        : reference?.kind === 'upload'
        ? applicationPublishedImageUrl(
            publicOrigin,
            applicationId,
            purpose,
            reference.asset.id
          )
        : null;
    if (reference?.kind === 'upload')
      await manager.query(
        `INSERT INTO application_published_images (applicationId, purpose, imageId, url, publicationRevision) VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE imageId = VALUES(imageId), url = VALUES(url), publicationRevision = VALUES(publicationRevision)`,
        [applicationId, purpose, reference.asset.id, url, revision]
      );
    else
      await manager.query(
        'DELETE FROM application_published_images WHERE applicationId = ? AND purpose = ?',
        [applicationId, purpose]
      );
    await manager.query(
      `UPDATE app_records SET ${
        purpose === 'logo' ? 'logoUrl' : 'bannerUrl'
      } = ? WHERE id = ?`,
      [url, applicationId]
    );
  }
}
