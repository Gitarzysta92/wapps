import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

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
}

