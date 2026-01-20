import { QueueChannel } from '../infrastructure/queue-client';
import { MinioClient } from '../infrastructure/minio-client';
import { downloadImageFromUrl } from '../infrastructure/image-downloader';
import { RawMediaDto } from '@domains/catalog/media';
import { createHash } from 'crypto';

const MEDIA_STORAGE_BUCKET_NAME = 'media-storage';

export class MediaIngestionService {
  constructor(
    private readonly queue: QueueChannel,
    private readonly minioClient: MinioClient,
    private readonly queueName: string
  ) {}

  async initialize(): Promise<void> {
    await this.queue.assertQueue(this.queueName);
    await this.queue.prefetch(1);
    await this.minioClient.ensureBucket(MEDIA_STORAGE_BUCKET_NAME);
    console.log(`✅ Media ingestion service initialized, listening on queue: ${this.queueName}`);
  }

  async startListening(): Promise<void> {
    await this.queue.consume(this.queueName, async (msg) => {
      if (!msg) {
        return;
      }

      try {
        const rawMedia: RawMediaDto = JSON.parse(msg.content.toString());
        await this.processMedia(rawMedia);
        this.queue.ack(msg);
      } catch (error) {
        console.error('❌ Error processing message:', error);
        this.queue.nack(msg, false, false);
      }
    });
  }

  private async processMedia(rawMedia: RawMediaDto): Promise<void> {
    const objectKey = this.generateObjectKey(rawMedia);
    
    const exists = await this.minioClient.objectExists(MEDIA_STORAGE_BUCKET_NAME, objectKey);
    
    if (exists) {
      console.log(`⏭️  Media already exists, skipping: ${objectKey}`);
      return;
    }

    console.log(`📥 Downloading media from: ${rawMedia.url}`);
    const buffer = await downloadImageFromUrl(rawMedia.url);
    
    console.log(`📤 Uploading to MinIO: ${objectKey}`);
    await this.minioClient.uploadImage(
      MEDIA_STORAGE_BUCKET_NAME,
      objectKey,
      buffer,
      {
        originalUrl: rawMedia.url,
        referenceIdentifier: rawMedia.referenceIdentifier as string ?? '',
        name: rawMedia.name,
        purpose: rawMedia.purpose,
        type: rawMedia.type,
        extension: rawMedia.extension,
      }
    );
    
    console.log(`✅ Media ingested successfully: ${objectKey}`);
  }

  private generateObjectKey(rawMedia: RawMediaDto): string {
    const hash = createHash('md5').update(rawMedia.url).digest('hex');
    return `${hash}.${rawMedia.extension}`;
  }
}
