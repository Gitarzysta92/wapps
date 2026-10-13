import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  GetBucketVersioningCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

export class MinioClient {
  private client: S3Client;

  constructor(config: { host: string; accessKey: string; secretKey: string }) {
    // Trim to avoid SignatureDoesNotMatch when K8s secrets have trailing newlines
    const accessKey = config.accessKey?.trim() ?? '';
    const secretKey = config.secretKey?.trim() ?? '';

    this.client = new S3Client({
      region: 'us-east-1',
      endpoint: config.host,
      forcePathStyle: true,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });
  }

  async ensureBucket(bucketName: string): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch (error) {
      if (!isMissingObject(error)) throw error;
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: bucketName }));
      } catch (createError) {
        if (
          !(createError instanceof Error) ||
          createError.name !== 'BucketAlreadyOwnedByYou'
        )
          throw createError;
      }
    }
  }

  async objectExists(bucketName: string, objectKey: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: bucketName, Key: objectKey })
      );
      return true;
    } catch (error) {
      if (!isMissingObject(error)) throw error;
      return false;
    }
  }

  async putImmutableBytes(
    bucketName: string,
    objectKey: string,
    body: Buffer
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: body,
        ContentType: 'application/json; charset=utf-8',
        ContentLength: body.length,
        CacheControl: 'private, no-store',
        IfNoneMatch: '*',
      }),
      { abortSignal: AbortSignal.timeout(20_000) }
    );
  }

  /** Keep the marker permanently: deleting a key permits an already-started conditional PUT to recreate it. */
  async retireImmutableBytes(
    bucketName: string,
    objectKey: string,
    expectedEtag?: string
  ): Promise<void> {
    const options = { abortSignal: AbortSignal.timeout(20_000) };
    const versioning = await this.client.send(
      new GetBucketVersioningCommand({ Bucket: bucketName }),
      options
    );
    if (versioning.Status !== undefined)
      throw new Error(
        'Immutable retirement requires a dedicated unversioned bucket'
      );
    for (let attempt = 0; attempt < 3; attempt++) {
      let etag: string | undefined;
      try {
        const current = await this.client.send(
          new HeadObjectCommand({ Bucket: bucketName, Key: objectKey }),
          options
        );
        if (
          current.ContentLength === 0 &&
          current.ContentType === 'application/x-wapps-retired-object' &&
          current.Metadata?.['wapps-retired'] === '1'
        )
          return;
        if (!current.ETag)
          throw new Error('Missing immutable object generation');
        if (expectedEtag !== undefined && current.ETag !== expectedEtag)
          throw new Error('Object generation changed before retirement');
        etag = current.ETag;
      } catch (error) {
        // A missing bucket must not be treated as proof that an object's bytes are retired.
        if (
          !hasStorageStatus(error, 404) &&
          !(
            error instanceof Error &&
            ['NotFound', 'NoSuchKey'].includes(error.name)
          )
        )
          throw error;
      }
      try {
        await this.client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
            Body: new Uint8Array(0),
            ContentLength: 0,
            ContentType: 'application/x-wapps-retired-object',
            CacheControl: 'private, no-store',
            Metadata: { 'wapps-retired': '1' },
            ...(etag ? { IfMatch: etag } : { IfNoneMatch: '*' }),
          }),
          options
        );
        return;
      } catch (error) {
        if (
          !hasStorageStatus(error, 409) &&
          !hasStorageStatus(error, 412) &&
          !(error instanceof Error && error.name === 'PreconditionFailed')
        )
          throw error;
      }
    }
    throw new Error(
      'Immutable object retirement did not converge; retry its durable request'
    );
  }

  async getBytes(
    bucketName: string,
    objectKey: string,
    maxBytes: number,
    signal?: AbortSignal
  ): Promise<Buffer> {
    return (
      await this.getObjectSnapshot(bucketName, objectKey, maxBytes, signal)
    ).body;
  }

  async getObjectSnapshot(
    bucketName: string,
    objectKey: string,
    maxBytes: number,
    signal?: AbortSignal,
    expectedEtag?: string
  ): Promise<{
    body: Buffer;
    etag: string | undefined;
    contentType: string | undefined;
    metadata: Record<string, string>;
  }> {
    signal?.throwIfAborted();
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0)
      throw new Error('Invalid object size limit');
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ...(expectedEtag === undefined ? {} : { IfMatch: expectedEtag }),
      }),
      { abortSignal: signal }
    );
    const stream = result.Body;
    if (!(stream instanceof Readable)) throw new Error('Missing object stream');
    if (result.ContentLength !== undefined && result.ContentLength > maxBytes) {
      stream.destroy();
      throw new Error('Object exceeds size limit');
    }
    const chunks: Buffer[] = [];
    let bytes = 0;
    const cancel = () =>
      stream.destroy(
        signal?.reason instanceof Error
          ? signal.reason
          : new Error('Object read cancelled')
      );
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      signal?.throwIfAborted();
      for await (const value of stream) {
        signal?.throwIfAborted();
        const chunk: unknown = value;
        if (!(chunk instanceof Uint8Array) && typeof chunk !== 'string')
          throw new Error('Invalid object stream chunk');
        const buffer = Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > maxBytes) throw new Error('Object exceeds size limit');
        chunks.push(buffer);
      }
      return {
        body: Buffer.concat(chunks, bytes),
        etag: result.ETag,
        contentType: result.ContentType,
        metadata: result.Metadata ?? {},
      };
    } finally {
      signal?.removeEventListener('abort', cancel);
      stream.destroy();
    }
  }

  async listObjectPage(
    bucketName: string,
    after: string,
    limit: number,
    signal: AbortSignal
  ) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 32)
      throw new Error('Invalid object inventory page size');
    signal.throwIfAborted();
    const result = await this.client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        StartAfter: after || undefined,
        MaxKeys: limit,
      }),
      { abortSignal: signal }
    );
    signal.throwIfAborted();
    return { objects: result.Contents ?? [], truncated: result.IsTruncated };
  }

  async requireUnversionedBucket(
    bucketName: string,
    signal: AbortSignal
  ): Promise<void> {
    signal.throwIfAborted();
    const result = await this.client.send(
      new GetBucketVersioningCommand({ Bucket: bucketName }),
      { abortSignal: signal }
    );
    signal.throwIfAborted();
    if (result.Status !== undefined)
      throw new Error(
        'Payload inventory requires a dedicated unversioned bucket'
      );
  }

  async uploadImage(
    bucketName: string,
    objectKey: string,
    buffer: Buffer,
    metadata?: Record<string, string>,
    contentType = 'image/png'
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata,
    });

    await this.client.send(command);
  }

  async uploadJson(
    bucketName: string,
    objectKey: string,
    value: unknown,
    metadata?: Record<string, string>
  ): Promise<void> {
    const body = Buffer.from(JSON.stringify(value), 'utf8');

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: body,
      ContentType: 'application/json; charset=utf-8',
      Metadata: metadata,
    });

    await this.client.send(command);
  }

  async listObjectKeys(bucketName: string, prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const res = await this.client.send(
        new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );

      for (const item of res.Contents ?? []) {
        if (item.Key) keys.push(item.Key);
      }

      continuationToken = res.IsTruncated
        ? res.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return keys;
  }

  async getJson<T = unknown>(
    bucketName: string,
    objectKey: string
  ): Promise<T> {
    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      })
    );

    const body = res.Body;
    if (!body) {
      throw new Error(`MinIO object body is empty: ${bucketName}/${objectKey}`);
    }

    const text = await streamToString(body as Readable);
    return JSON.parse(text) as T;
  }

  async deleteObject(bucketName: string, objectKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      })
    );
  }
}

function hasStorageStatus(error: unknown, status: number): boolean {
  return (
    error instanceof Error &&
    '$metadata' in error &&
    typeof error.$metadata === 'object' &&
    error.$metadata !== null &&
    'httpStatusCode' in error.$metadata &&
    error.$metadata.httpStatusCode === status
  );
}

function isMissingObject(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (['NotFound', 'NoSuchKey', 'NoSuchBucket'].includes(error.name))
    return true;
  return (
    '$metadata' in error &&
    typeof error.$metadata === 'object' &&
    error.$metadata !== null &&
    'httpStatusCode' in error.$metadata &&
    error.$metadata.httpStatusCode === 404
  );
}

async function streamToString(stream: Readable): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    );
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}
