import type { DataSource, EntityManager } from 'typeorm';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import { ApplicationDraftUnavailableError } from '@domains/catalog/record';
import {
  ApplicationImageNotFoundError,
  ApplicationImageUnavailableError,
  type ApplicationImagePurpose,
  type ApplicationImageSet,
} from '@domains/catalog/media';
import type { EditorialActor } from '../application/editorial.ports';
import { assertApplicationPublicationAccess } from '../application-publication/application-publication';
import {
  applicationPublicState,
  hasApplicationAuthoringAuthority,
} from '../application-publication/application-public-state';
import {
  canonicalApplicationImages,
  draftApplicationImages,
  submittedApplicationImages,
} from './application-image-bindings';
import { applicationMediaAsset } from './editorial-media-assets';
import type { ApplicationImageReadStore } from './application-image-reads';

export class MysqlApplicationImageReads implements ApplicationImageReadStore {
  constructor(
    private readonly sourceStore: DataSource,
    private readonly publicTenant: string
  ) {}
  draft(actor: EditorialActor, id: string, purpose: ApplicationImagePurpose) {
    return this.read(async (manager) => {
      await this.owner(manager, actor, id, false);
      return this.asset(await draftApplicationImages(manager, id), purpose);
    });
  }
  source(actor: EditorialActor, id: string, purpose: ApplicationImagePurpose) {
    return this.read(async (manager) => {
      const state = await applicationPublicState(manager, id);
      const [grant] = await manager.query<{ claimId: string }[]>(
        'SELECT claimId FROM application_ownership_grants WHERE applicationId = ? AND tenantId = ? AND claimantIdentityId = ? AND revokedAt IS NULL',
        [id, actor.tenantId, actor.identityId]
      );
      if (
        !state ||
        state.isSuspended ||
        !grant ||
        !(await hasApplicationAuthoringAuthority(
          manager,
          id,
          state,
          { tenantId: actor.tenantId, ownerIdentityId: actor.identityId },
          grant.claimId
        ))
      )
        throw new ApplicationImageNotFoundError(
          'No active ownership grant for this application image'
        );
      return this.asset(await canonicalApplicationImages(manager, id), purpose);
    });
  }
  submission(
    actor: EditorialActor,
    id: string,
    revision: number,
    purpose: ApplicationImagePurpose,
    review: boolean
  ) {
    return this.read(async (manager) => {
      await this.owner(manager, actor, id, review);
      const images = await submittedApplicationImages(manager, id, revision);
      if (!images)
        throw new ApplicationImageNotFoundError(
          'This submission has no recorded image snapshot'
        );
      return this.asset(images, purpose);
    });
  }
  published(id: string, purpose: ApplicationImagePurpose, imageId: string) {
    return this.read(async (manager) => {
      const [row] = await manager.query<{ imageId: string }[]>(
        `SELECT p.imageId FROM application_published_images p
        JOIN app_records a ON a.id = p.applicationId
        JOIN editorial_resource_states s ON s.resourceKind = 'app' AND s.resourceId = a.id
        WHERE p.applicationId = ? AND p.purpose = ? AND p.imageId = ? AND s.tenantId = ?
        AND s.deletedAt IS NULL AND a.isSuspended = 0 AND p.publicationRevision <= s.revision
        AND p.url = ${purpose === 'logo' ? 'a.logoUrl' : 'a.bannerUrl'}`,
        [id, purpose, imageId, this.publicTenant]
      );
      if (!row)
        throw new ApplicationImageNotFoundError('Published image not found');
      const asset = await applicationMediaAsset(
        manager,
        row.imageId,
        this.publicTenant
      );
      if (!asset || asset.purpose !== purpose)
        throw new ApplicationImageUnavailableError(
          'Published image metadata is unavailable'
        );
      return asset;
    });
  }
  private asset(images: ApplicationImageSet, purpose: ApplicationImagePurpose) {
    const image = images[purpose];
    if (image?.kind !== 'upload')
      throw new ApplicationImageNotFoundError('No uploaded image in this slot');
    return image.asset;
  }
  private async owner(
    manager: EntityManager,
    actor: EditorialActor,
    id: string,
    review: boolean
  ) {
    const [draft] = await manager.query<
      { tenantId: string; ownerIdentityId: string }[]
    >(
      `SELECT tenantId, ownerIdentityId FROM application_drafts WHERE id = ? AND tenantId = ? AND deletedAt IS NULL${
        review ? '' : ' AND ownerIdentityId = ?'
      }`,
      [id, actor.tenantId, ...(review ? [] : [actor.identityId])]
    );
    if (!draft)
      throw new ApplicationImageNotFoundError('Application draft not found');
    assertApplicationPublicationAccess(actor, draft, review);
  }
  private async read<T>(query: (manager: EntityManager) => Promise<T>) {
    try {
      return await this.sourceStore.transaction('REPEATABLE READ', query);
    } catch (error) {
      if (
        error instanceof PermissionDeniedError ||
        error instanceof ApplicationImageNotFoundError ||
        error instanceof ApplicationImageUnavailableError ||
        error instanceof ApplicationDraftUnavailableError
      )
        throw error;
      throw new ApplicationImageUnavailableError(
        'Application image authority is unavailable'
      );
    }
  }
}
