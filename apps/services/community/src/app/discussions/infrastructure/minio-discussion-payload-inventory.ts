import { createHash } from 'node:crypto';
import {
  DISCUSSION_MAX_PAYLOAD_BYTES,
  type DiscussionPayloadReference,
} from '@apps/shared';
import { MinioClient } from '@sdk/extras/minio';
import type {
  DiscussionInventoryObject,
  DiscussionPayloadInventoryObjects,
} from '../application/discussion-payload-inventory';

const bucket = 'discussion-content';
export class MinioDiscussionPayloadInventory
  implements DiscussionPayloadInventoryObjects
{
  constructor(private readonly minio: MinioClient) {}
  requireUnversioned(): Promise<void> {
    return this.minio.requireUnversionedBucket(
      bucket,
      AbortSignal.timeout(20_000)
    );
  }
  async page(after: string) {
    const page = await this.minio.listObjectPage(
      bucket,
      after,
      32,
      AbortSignal.timeout(20_000)
    );
    if (
      typeof page.truncated !== 'boolean' ||
      page.objects.length > 32 ||
      (page.truncated && !page.objects.length)
    )
      throw new Error('Invalid object inventory page');
    let previous = after;
    const objects: DiscussionInventoryObject[] = [];
    for (const object of page.objects) {
      if (
        typeof object.Key !== 'string' ||
        !object.Key ||
        Buffer.byteLength(object.Key) > 1024 ||
        Buffer.compare(Buffer.from(object.Key), Buffer.from(previous)) <= 0 ||
        typeof object.ETag !== 'string' ||
        !object.ETag ||
        object.ETag.length > 256 ||
        typeof object.Size !== 'number' ||
        !Number.isSafeInteger(object.Size) ||
        object.Size < 0
      )
        throw new Error('Invalid object inventory entry or ordering');
      objects.push({ key: object.Key, bytes: object.Size, etag: object.ETag });
      previous = object.Key;
    }
    return { objects, more: page.truncated };
  }
  async read(object: DiscussionInventoryObject) {
    const result = await this.minio.getObjectSnapshot(
      bucket,
      object.key,
      DISCUSSION_MAX_PAYLOAD_BYTES,
      AbortSignal.timeout(20_000),
      object.etag
    );
    if (result.etag !== object.etag || result.body.length !== object.bytes)
      throw new Error('Object generation changed during inventory');
    const retired =
      result.body.length === 0 &&
      result.contentType === 'application/x-wapps-retired-object' &&
      result.metadata['wapps-retired'] === '1';
    if (!retired && result.body.length === 0)
      throw new Error('Empty historical payload without a retirement marker');
    return { body: result.body, retired };
  }
  async copy(
    reference: DiscussionPayloadReference,
    body: Buffer
  ): Promise<void> {
    try {
      await this.minio.putImmutableBytes(bucket, reference.key, body);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !(
          error.name === 'PreconditionFailed' ||
          ('$metadata' in error &&
            typeof error.$metadata === 'object' &&
            error.$metadata !== null &&
            'httpStatusCode' in error.$metadata &&
            error.$metadata.httpStatusCode === 412)
        )
      )
        throw error;
    }
    const stored = await this.minio.getBytes(
      bucket,
      reference.key,
      reference.bytes,
      AbortSignal.timeout(20_000)
    );
    if (
      stored.length !== reference.bytes ||
      createHash('sha256').update(stored).digest('hex') !== reference.sha256
    )
      throw new Error('Historical copy differs from its durable reservation');
  }
  retire(object: DiscussionInventoryObject): Promise<void> {
    return this.minio.retireImmutableBytes(bucket, object.key, object.etag);
  }
}
