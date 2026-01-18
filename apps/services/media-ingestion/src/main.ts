import amqp from 'amqplib';
import dotenv from 'dotenv';
import { QueueClient } from './infrastructure/queue-client';
import { MinioClient } from './infrastructure/minio-client';
import { MediaIngestionService } from './application/media-ingestion.service';
import { ApplicationShell } from '@standard';
import { RAW_MEDIA_INGESTION_SLUG } from '@domains/catalog/media';

dotenv.config();

const username = process.env['QUEUE_USERNAME'] as string;
const password = process.env['QUEUE_PASSWORD'] as string;
const host = process.env['QUEUE_HOST'] as string;
const port = process.env['QUEUE_PORT'] as string;
const minioHost = process.env['MEDIA_STORAGE_HOST'] as string;
const minioAccessKey = process.env['MEDIA_STORAGE_ACCESSKEY'] as string;
const minioSecretKey = process.env['MEDIA_STORAGE_SECRETKEY'] as string;

const mediaIngestionApp = new ApplicationShell({
  username: { value: username },
  password: { value: password },
  host: { value: host },
  port: { value: port },
  minioHost: { value: minioHost },
  minioAccessKey: { value: minioAccessKey },
  minioSecretKey: { value: minioSecretKey },
});

mediaIngestionApp
  .initialize(async (params) => {
    const queueClient = new QueueClient(amqp);
    const queue = await queueClient.connect({
      host: params.host,
      port: params.port,
      username: params.username,
      password: params.password,
    });

    const minioClient = new MinioClient({
      host: params.minioHost,
      accessKey: params.minioAccessKey,
      secretKey: params.minioSecretKey,
    });

    const mediaIngestionService = new MediaIngestionService(
      queue,
      minioClient,
      RAW_MEDIA_INGESTION_SLUG
    );

    await mediaIngestionService.initialize();


    return { queueClient, mediaIngestionService };
  })
  .run(async ({ mediaIngestionService }) => {
    console.log('🚀 Media Ingestion Service is running...');
    await mediaIngestionService.startListening();
  })
  .catch(async (err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  })
  .finally(async ({ queueClient }) => {
    try {
      // await queueClient.close();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  });
