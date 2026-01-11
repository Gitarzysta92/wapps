import { CreateBucketCommand, HeadBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import fetch from 'node-fetch';

export class MinioClient {
  private client: S3Client;

  constructor(config: {
    host: string;
    accessKey: string;
    secretKey: string;
  }) {
    this.client = new S3Client({
      region: 'us-east-1',
      endpoint: config.host,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    });
  }

  async ensureBucket(bucketName: string): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: bucketName }));
      console.log(`✅ Created bucket "${bucketName}"`);
    }
  }

  async objectExists(bucketName: string, objectKey: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: bucketName, Key: objectKey }));
      return true;
    } catch {
      return false;
    }
  }

  async downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async uploadImage(
    bucketName: string,
    objectKey: string,
    buffer: Buffer,
    metadata?: Record<string, string>
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: buffer,
      ContentType: 'image/png',
      Metadata: metadata,
    });

    await this.client.send(command);
  }
}
