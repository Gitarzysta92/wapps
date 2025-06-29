import fetch from "node-fetch";
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";


export function getConnectionData(): {
  host: string | undefined,
  accessKey: string | undefined,
  secretKey: string | undefined
} {
  return {
    host: process.env['MEDIA_STORAGE_HOST'] ,
    accessKey: process.env['MEDIA_STORAGE_ACCESSKEY'],
    secretKey: process.env['MEDIA_STORAGE_SECRETKEY']
  }
}

export function createMediaStorageClient(d: {
  host: string | undefined,
  accessKey: string | undefined,
  secretKey: string | undefined
}) {
  const s3Client = new S3Client({
    region: "us-east-1",
    endpoint: d.host,
    forcePathStyle: true,
    credentials: {
      accessKeyId: d.accessKey as string,
      secretAccessKey: d.secretKey as string,
    },
  });
  return s3Client;
}

export async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function uploadImage(
  bucketName: string,
  objectKey: string,
  buffer: Buffer,
  client: S3Client,
  metadata?: Record<string, string>
) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucketName }))
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucketName }));
  }

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: buffer,
      ContentType: "image/png",
      Metadata: metadata,
    });

    await client.send(command);
    console.log(`✅ Image uploaded to MinIO bucket "${bucketName}" as "${objectKey}"`);
  } catch (error) {
    console.error("❌ Error:", error);
  }
}