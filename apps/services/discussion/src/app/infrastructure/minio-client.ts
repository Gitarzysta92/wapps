import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
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
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: bucketName }));
      // eslint-disable-next-line no-console
      console.log(`✅ Created bucket "${bucketName}"`);
    }
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

      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);

    return keys;
  }

  async getJson<T = unknown>(bucketName: string, objectKey: string): Promise<T> {
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

async function streamToString(stream: Readable): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

