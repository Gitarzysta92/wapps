import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  GetObjectCommand,
  GetBucketVersioningCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  ApplicationImageConflictError,
  ApplicationImageUnavailableError,
  parseApplicationImageAsset,
  applicationImageId,
  type ApplicationImageAsset,
} from '@domains/catalog/media';
import type {
  ApplicationImageObjects,
  ApplicationImageRetirementObjects,
} from './application-image.ports';

export function applicationImageObjectKey(id: string) {
  return `application-images/v1/${id}.webp`;
}

/** The bucket is private. All readers must first resolve an authorized canonical asset. */
export class S3ApplicationImages
  implements ApplicationImageObjects, ApplicationImageRetirementObjects
{
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly objectKey: (
      id: string
    ) => string = applicationImageObjectKey
  ) {}
  async retire(id: string) {
    applicationImageId(id);
    const options = { abortSignal: AbortSignal.timeout(20_000) };
    const key = this.objectKey(id);
    try {
      const versioning = await this.client.send(
        new GetBucketVersioningCommand({ Bucket: this.bucket }),
        options
      );
      if (versioning.Status !== undefined)
        throw new ApplicationImageUnavailableError(
          'Image cleanup requires a dedicated unversioned bucket; retained versions require explicit operator recovery.'
        );
      for (let attempt = 0; attempt < 3; attempt++) {
        let etag: string | undefined;
        try {
          const object = await this.client.send(
            new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
            options
          );
          if (
            object.ContentLength === 0 &&
            object.ContentType === 'application/x-wapps-retired-image' &&
            object.Metadata?.['retired-image-id'] === id
          )
            return;
          if (!object.ETag) throw new Error('Missing object generation');
          etag = object.ETag;
        } catch (error) {
          if (!storageStatus(error, 404)) throw error;
        }
        try {
          // A permanent empty marker prevents even a paused, expired worker from recreating retired bytes.
          await this.client.send(
            new PutObjectCommand({
              Bucket: this.bucket,
              Key: key,
              Body: new Uint8Array(0),
              ContentLength: 0,
              ContentType: 'application/x-wapps-retired-image',
              CacheControl: 'private, no-store',
              Metadata: { 'retired-image-id': id },
              ...(etag ? { IfMatch: etag } : { IfNoneMatch: '*' }),
            }),
            options
          );
          return;
        } catch (error) {
          if (!preconditionFailed(error) && !storageStatus(error, 409))
            throw error;
        }
      }
      throw new Error('Object generation kept changing');
    } catch (error) {
      if (error instanceof ApplicationImageUnavailableError) throw error;
      throw new ApplicationImageUnavailableError(
        'Could not confirm image-byte retirement. The durable cleanup job will retry.'
      );
    }
  }
  async putImmutable(value: ApplicationImageAsset, bytes: Uint8Array) {
    const asset = parseApplicationImageAsset(value);
    this.verify(asset, bytes);
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: this.objectKey(asset.id),
          Body: bytes,
          ContentType: asset.contentType,
          ContentLength: asset.bytes,
          CacheControl: 'private, no-store',
          IfNoneMatch: '*',
          ChecksumSHA256: Buffer.from(asset.sha256, 'hex').toString('base64'),
        }),
        { abortSignal: AbortSignal.timeout(10_000) }
      );
    } catch (error) {
      if (!preconditionFailed(error))
        throw new ApplicationImageUnavailableError(
          'Image storage is unavailable. Retry the same upload.'
        );
      // A lost successful PUT is recoverable only if the entire immutable object matches.
      const existing = await this.read(asset);
      if (!Buffer.from(existing).equals(Buffer.from(bytes)))
        throw new ApplicationImageConflictError(
          'An immutable image with different content already exists'
        );
    }
  }
  async read(
    value: ApplicationImageAsset,
    signal?: AbortSignal
  ): Promise<Uint8Array> {
    signal?.throwIfAborted();
    const asset = parseApplicationImageAsset(value);
    let stream: Readable | undefined;
    const abort = new AbortController();
    const cancel = () => {
      abort.abort(signal?.reason);
      stream?.destroy();
    };
    signal?.addEventListener('abort', cancel, { once: true });
    const timeout = setTimeout(() => {
      abort.abort();
      stream?.destroy();
    }, 10_000);
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.objectKey(asset.id),
        }),
        { abortSignal: abort.signal }
      );
      if (!(result.Body instanceof Readable))
        throw new Error('Missing image body');
      stream = result.Body;
      abort.signal.throwIfAborted();
      if (
        result.ContentType !== asset.contentType ||
        result.ContentLength !== asset.bytes
      )
        throw new ApplicationImageConflictError(
          'Stored image metadata does not match its immutable descriptor'
        );
      const chunks: Buffer[] = [];
      let length = 0;
      for await (const value of stream) {
        const chunk: unknown = value;
        if (!(chunk instanceof Uint8Array))
          throw new Error('Invalid image body');
        length += chunk.byteLength;
        if (length > asset.bytes)
          throw new Error('Image body exceeds its immutable size');
        chunks.push(Buffer.from(chunk));
      }
      const bytes = Buffer.concat(chunks, length);
      abort.signal.throwIfAborted();
      this.verify(asset, bytes);
      return bytes;
    } catch (error) {
      if (error instanceof ApplicationImageConflictError) throw error;
      throw new ApplicationImageUnavailableError(
        'Image bytes are unavailable. Retry shortly.'
      );
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', cancel);
      stream?.destroy();
    }
  }
  private verify(asset: ApplicationImageAsset, bytes: Uint8Array) {
    if (
      bytes.byteLength !== asset.bytes ||
      createHash('sha256').update(bytes).digest('hex') !== asset.sha256
    )
      throw new ApplicationImageConflictError(
        'Image bytes do not match their immutable descriptor'
      );
  }
}
function preconditionFailed(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === 'PreconditionFailed' ||
      ('$metadata' in error &&
        typeof error.$metadata === 'object' &&
        error.$metadata !== null &&
        'httpStatusCode' in error.$metadata &&
        error.$metadata.httpStatusCode === 412))
  );
}
function storageStatus(error: unknown, status: number) {
  return (
    error instanceof Error &&
    '$metadata' in error &&
    typeof error.$metadata === 'object' &&
    error.$metadata !== null &&
    'httpStatusCode' in error.$metadata &&
    error.$metadata.httpStatusCode === status
  );
}
