import { createHash } from 'node:crypto';
import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import {
  APPLICATION_IMAGE_SOURCE_LIMIT,
  ApplicationImageInputError,
  ApplicationImageUnavailableError,
  applicationImageId,
  applicationImageInteger,
  applicationImageObject,
  parseApplicationImageAsset,
  parseApplicationImageUploadInput,
  assertApplicationImageUploadWritable,
} from '@domains/catalog/media';
import { assertEditorialActor } from '../application/editorial-commands';
import type { EditorialActor } from '../application/editorial.ports';
import type {
  ApplicationImageContentCommand,
  ApplicationImageStore,
  ApplicationImageNormalizer,
  ApplicationImageObjects,
} from './application-image.ports';

export class ApplicationImages {
  constructor(
    private readonly store: ApplicationImageStore,
    private readonly normalizer: ApplicationImageNormalizer,
    private readonly objects: ApplicationImageObjects,
    private readonly policy: IPolicyEvaluator,
    private readonly ids: { generate(): string },
    private readonly now: () => number = Date.now
  ) {}
  async create(actor: EditorialActor, input: unknown, key: string) {
    await this.authorize(actor, 'create');
    this.key(key);
    const parsed = parseApplicationImageUploadInput(input);
    return this.store.create({
      actor,
      id: applicationImageId(this.ids.generate()),
      key,
      fingerprint: this.digest(
        JSON.stringify({ action: 'create', input: parsed })
      ),
      at: this.now(),
      input: parsed,
    });
  }
  async read(actor: EditorialActor, id: string) {
    await this.authorize(actor, 'read');
    return this.store.read(actor, applicationImageId(id));
  }
  async list(actor: EditorialActor, draftId: string) {
    await this.authorize(actor, 'read');
    return this.store.list(actor, applicationImageId(draftId), this.now());
  }
  async cancel(actor: EditorialActor, id: string, input: unknown, key: string) {
    await this.authorize(actor, 'cancel');
    this.key(key);
    const target = applicationImageId(id);
    const value = applicationImageObject(input, ['expectedRevision']);
    const expectedRevision = applicationImageInteger(value['expectedRevision']);
    return this.store.cancel({
      actor,
      id: target,
      expectedRevision,
      key,
      at: this.now(),
      fingerprint: this.digest(
        JSON.stringify({ action: 'cancel', id: target, expectedRevision })
      ),
    });
  }
  async content(actor: EditorialActor, id: string) {
    const upload = await this.read(actor, id);
    if (!upload.asset)
      throw new ApplicationImageInputError('This upload has no ready image');
    const bytes = await this.objects.read(upload.asset);
    // Deletion may commit during object I/O; authority must still permit the preview afterwards.
    const current = await this.read(actor, id);
    if (!current.asset || current.asset.sha256 !== upload.asset.sha256)
      throw new ApplicationImageUnavailableError(
        'The image changed while loading. Reload before continuing.'
      );
    return { asset: current.asset, bytes };
  }
  async upload(
    actor: EditorialActor,
    id: string,
    input: unknown,
    bytes: Uint8Array,
    key: string
  ) {
    await this.authorize(actor, 'upload');
    applicationImageId(id);
    this.key(key);
    const value = applicationImageObject(input, ['expectedRevision']);
    const expectedRevision = applicationImageInteger(value['expectedRevision']);
    if (
      !(bytes instanceof Uint8Array) ||
      bytes.byteLength < 1 ||
      bytes.byteLength > APPLICATION_IMAGE_SOURCE_LIMIT
    )
      throw new ApplicationImageInputError(
        'Image body exceeds the upload limit'
      );
    const sourceSha256 = this.digest(bytes);
    const command: ApplicationImageContentCommand = {
      actor,
      id,
      key,
      expectedRevision,
      sourceSha256,
      sourceBytes: bytes.byteLength,
      at: this.now(),
      fingerprint: this.digest(
        JSON.stringify({
          action: 'upload',
          id,
          expectedRevision,
          sourceSha256,
          sourceBytes: bytes.byteLength,
        })
      ),
    };
    const reservation = await this.store.reserve(command);
    if ('receipt' in reservation) return reservation.receipt;
    const { upload, lease } = reservation;
    try {
      assertApplicationImageUploadWritable(
        upload,
        expectedRevision,
        command.at
      );
      if (
        upload.id !== id ||
        upload.source.sha256 !== sourceSha256 ||
        upload.source.bytes !== bytes.byteLength
      )
        throw new ApplicationImageInputError(
          'Select the exact file reserved for this upload'
        );
      const image = await this.normalizer.normalize(
        bytes,
        upload.purpose,
        upload.source.contentType
      );
      const asset = parseApplicationImageAsset({
        id,
        purpose: upload.purpose,
        contentType: 'image/webp',
        bytes: image.bytes.byteLength,
        sha256: this.digest(image.bytes),
        width: image.width,
        height: image.height,
      });
      // Immutable object I/O stays outside SQL locks. Only the fenced completion can make it ready.
      await this.objects.putImmutable(asset, image.bytes);
      return await this.store.complete(command, lease, asset, this.now());
    } catch (error) {
      try {
        await this.store.fail(command, lease, this.now());
      } catch {
        // SQL may be unavailable; the persisted lease still expires and fences late completion.
      }
      throw error;
    }
  }
  private key(key: string) {
    if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new ApplicationImageInputError(
        'A valid Idempotency-Key is required'
      );
  }
  private digest(value: string | Uint8Array) {
    return createHash('sha256').update(value).digest('hex');
  }
  private async authorize(
    actor: EditorialActor,
    operation: 'create' | 'read' | 'upload' | 'cancel'
  ) {
    assertEditorialActor(actor);
    const actionName = `editorial.application-image.${operation}`;
    let result;
    try {
      result = await this.policy.evaluate({
        identityId: actor.identityId,
        tenantId: actor.tenantId,
        timestamp: this.now(),
        actionName,
        subject: { roles: actor.roles },
        resource: {
          type: 'application-image-workspace',
          id: actor.identityId,
          tenantId: actor.tenantId,
        },
      });
    } catch {
      throw new ApplicationImageUnavailableError(
        'Application image authorization unavailable'
      );
    }
    if (!result.ok)
      throw new ApplicationImageUnavailableError(
        'Application image authorization unavailable'
      );
    if (result.value !== true) throw new PermissionDeniedError(actionName);
  }
}
