import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import {
  applicationImageId,
  applicationImageInteger,
  applicationImagePurpose,
  ApplicationImageNotFoundError,
  ApplicationImageUnavailableError,
  type ApplicationImageAsset,
  type ApplicationImagePurpose,
} from '@domains/catalog/media';
import { assertEditorialActor } from '../application/editorial-commands';
import type { EditorialActor } from '../application/editorial.ports';
import type { ApplicationImageObjects } from './application-image.ports';

export interface ApplicationImageReadStore {
  draft(
    actor: EditorialActor,
    id: string,
    purpose: ApplicationImagePurpose
  ): Promise<ApplicationImageAsset>;
  source(
    actor: EditorialActor,
    id: string,
    purpose: ApplicationImagePurpose
  ): Promise<ApplicationImageAsset>;
  submission(
    actor: EditorialActor,
    id: string,
    revision: number,
    purpose: ApplicationImagePurpose,
    review: boolean
  ): Promise<ApplicationImageAsset>;
  published(
    id: string,
    purpose: ApplicationImagePurpose,
    imageId: string
  ): Promise<ApplicationImageAsset>;
}
export class ApplicationImageReads {
  constructor(
    private readonly store: ApplicationImageReadStore,
    private readonly objects: ApplicationImageObjects,
    private readonly policy: IPolicyEvaluator
  ) {}
  draft(
    actor: EditorialActor,
    id: string,
    purpose: unknown,
    canonical = false
  ) {
    const target = applicationImageId(id);
    const slot = applicationImagePurpose(purpose);
    return this.bytes(async () => {
      await this.authorize(actor, target, false);
      return canonical
        ? this.store.source(actor, target, slot)
        : this.store.draft(actor, target, slot);
    });
  }
  submission(
    actor: EditorialActor,
    id: string,
    revision: number,
    purpose: unknown,
    review: boolean
  ) {
    const target = applicationImageId(id);
    const version = applicationImageInteger(revision);
    const slot = applicationImagePurpose(purpose);
    return this.bytes(async () => {
      await this.authorize(actor, target, review);
      return this.store.submission(actor, target, version, slot, review);
    });
  }
  published(id: string, purpose: unknown, imageId: string) {
    const target = applicationImageId(id);
    const slot = applicationImagePurpose(purpose);
    const image = applicationImageId(imageId);
    return this.bytes(() => this.store.published(target, slot, image));
  }
  private async bytes(authority: () => Promise<ApplicationImageAsset>) {
    const asset = await authority();
    const bytes = await this.objects.read(asset);
    const current = await authority();
    if (
      current.id !== asset.id ||
      current.sha256 !== asset.sha256 ||
      current.purpose !== asset.purpose
    )
      throw new ApplicationImageNotFoundError(
        'The image reference changed while loading'
      );
    return { asset, bytes };
  }
  private async authorize(actor: EditorialActor, id: string, review: boolean) {
    assertEditorialActor(actor);
    const actionName = review
      ? 'editorial.application.review'
      : 'editorial.application-draft.read';
    let result;
    try {
      result = await this.policy.evaluate({
        identityId: actor.identityId,
        tenantId: actor.tenantId,
        timestamp: Date.now(),
        actionName,
        subject: { roles: actor.roles },
        resource: {
          type: review ? 'application-review' : 'application-workspace',
          id: review ? id : actor.identityId,
          tenantId: actor.tenantId,
        },
      });
    } catch {
      throw new ApplicationImageUnavailableError(
        'Image access authorization is unavailable'
      );
    }
    if (!result.ok)
      throw new ApplicationImageUnavailableError(
        'Image access authorization is unavailable'
      );
    if (result.value !== true) throw new PermissionDeniedError(actionName);
  }
}
