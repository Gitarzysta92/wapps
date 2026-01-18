import dotenv from 'dotenv';
import amqp from 'amqplib';
import { ApplicationShell } from '@standard';
import { RAW_RECORD_PROCESSING_SLUG } from '@domains/catalog/record';
import { RawRecordDto } from '@domains/catalog/record';
import { QueueClient } from './infrastructure/queue-client';
import { OpenAIClient } from './infrastructure/openai-client';
import { EditorialClient } from './infrastructure/editorial-client';
import { DataEnrichmentService } from './application/services/data-enrichment.service';

dotenv.config();

const username = process.env['QUEUE_USERNAME'] as string;
const password = process.env['QUEUE_PASSWORD'] as string;
const host = process.env['QUEUE_HOST'] as string;
const port = process.env['QUEUE_PORT'] as string;
const openaiApiKey = process.env['OPENAI_API_KEY'] as string;
const editorialHost = process.env['EDITORIAL_SERVICE_HOST'] as string;
const editorialApiToken = process.env['EDITORIAL_SERVICE_API_TOKEN'] as string;

const editorAgent = new ApplicationShell({
  username: { value: username },
  password: { value: password },
  host: { value: host },
  port: { value: port },
  openaiApiKey: { value: openaiApiKey },
  editorialHost: { value: editorialHost },
  // Optional: API token is not required for current implementation
  // of the editorial service
  editorialApiToken: { value: editorialApiToken, optional: true },
});

editorAgent
  .initialize(async (params) => {
    console.log('🚀 Starting Editor Agent...');
    console.log(`📡 Editorial Service: ${params.editorialHost}`);
    console.log(`🐰 RabbitMQ Queue: ${RAW_RECORD_PROCESSING_SLUG}`);
    console.log(`🤖 OpenAI: ✓ Configured`);

    // Initialize clients
    const queueClient = new QueueClient(amqp);
    const queue = await queueClient.connect({
      host: params.host,
      port: params.port,
      username: params.username,
      password: params.password,
    });

    const openaiClient = new OpenAIClient(params.openaiApiKey);
    const editorialClient = new EditorialClient(
      params.editorialHost,
      params.editorialApiToken
    );

    const dataEnrichmentService = new DataEnrichmentService(
      openaiClient,
      editorialClient
    );

    // Assert queue exists
    await queue.assertQueue(RAW_RECORD_PROCESSING_SLUG);

    return {
      queueClient,
      queue,
      dataEnrichmentService,
    };
  })
  .run(async ({ queue, dataEnrichmentService }) => {
    console.log('✅ Editor Agent initialized, listening for messages...');

    // Set prefetch to process one message at a time
    queue.prefetch(1);

    // Rate limit: at most 1 message consumed per 30 seconds
    const CONSUMPTION_INTERVAL_MS = 30_000;
    let lastProcessedAt = 0;

    // Track consecutive errors for exponential backoff
    const MAX_RETRIES = 5;
    const BASE_DELAY_MS = 1000; // 1 second
    const MAX_DELAY_MS = 60000; // 60 seconds

    // Start consuming messages
    await queue.consume(
      RAW_RECORD_PROCESSING_SLUG,
      async (msg) => {
        if (!msg) return;

        // Enforce 30s between processing
        const elapsed = Date.now() - lastProcessedAt;
        const toWait = Math.max(0, CONSUMPTION_INTERVAL_MS - elapsed);
        if (toWait > 0) {
          console.log(`⏳ Rate limit: waiting ${toWait}ms before next message...`);
          await new Promise((resolve) => setTimeout(resolve, toWait));
        }
        lastProcessedAt = Date.now();

        try {
          const rawRecord: RawRecordDto = JSON.parse(msg.content.toString());
          console.log(`📥 Received message for: ${rawRecord.name}`);

          // Get current retry count from message headers
          const retryCount = (msg.properties.headers?.['x-retry-count'] as number) || 0;

          // Check if max retries exceeded
          if (retryCount >= MAX_RETRIES) {
            console.error(`❌ Max retries (${MAX_RETRIES}) exceeded for: ${rawRecord.name}`);
            console.error('Message will be discarded. Consider implementing a dead-letter queue.');
            queue.nack(msg, false, false); // Discard the message
            return;
          }

          await dataEnrichmentService.processRawRecord(rawRecord);

          queue.ack(msg);
          console.log(`✅ Message acknowledged for: ${rawRecord.name}`);
        } catch (error) {
          console.error('❌ Error processing message:', error);

          // Get current retry count
          const retryCount = (msg.properties.headers?.['x-retry-count'] as number) || 0;
          const nextRetryCount = retryCount + 1;

          // Calculate exponential backoff delay: 1s, 2s, 4s, 8s, 16s, ...
          const delayMs = Math.min(
            BASE_DELAY_MS * Math.pow(2, retryCount),
            MAX_DELAY_MS
          );

          console.log(
            `⏳ Retry ${nextRetryCount}/${MAX_RETRIES} - waiting ${delayMs}ms before requeuing...`
          );

          // Wait before requeuing to implement backoff
          await new Promise((resolve) => setTimeout(resolve, delayMs));

          // Update retry count in message headers
          const headers = msg.properties.headers || {};
          headers['x-retry-count'] = nextRetryCount;

          // Requeue with updated headers
          queue.nack(msg, false, false); // Don't requeue automatically
          queue.sendToQueue(
            RAW_RECORD_PROCESSING_SLUG,
            msg.content,
            {
              ...msg.properties,
              headers,
            }
          );

          console.log(`🔄 Message requeued with retry count: ${nextRetryCount}`);
        }
      },
      { noAck: false }
    );

    // Keep the process running
    await new Promise(() => {
      // Run indefinitely
    });
  })
  .catch(async (err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  })
  .finally(async ({ queueClient }) => {
    try {
      console.log('🛑 Shutting down...');
      await queueClient.close();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  });
