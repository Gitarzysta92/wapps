import type { EntityManager } from 'typeorm';
import type { EditorialSnapshot } from '@apps/shared';
import { ReleaseUnavailableError } from '@domains/catalog/versioning';
import { canonicalRelease } from './mysql-release-state';

/** Parent visibility and labels are checked at read time, never duplicated behind a release revision. */
export async function readReleasePublicationSnapshot(
  manager: EntityManager,
  id: string
): Promise<EditorialSnapshot> {
  const publication = await canonicalRelease(manager, id);
  if (!publication)
    throw new ReleaseUnavailableError(
      'Versioned release publication is missing'
    );
  return {
    kind: 'release',
    resourceId: id,
    tenantId: publication.tenantId,
    revision: publication.revision,
    deletedAt: publication.deletedAt,
    content:
      publication.deletedAt === null
        ? {
            ...publication.fields,
            applicationId: publication.applicationId,
            publishedAt: publication.publishedAt,
          }
        : null,
  };
}
