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
  editorialApiToken: { value: editorialApiToken },
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

    // Start consuming messages
    await queue.consume(
      RAW_RECORD_PROCESSING_SLUG,
      async (msg) => {
        if (!msg) return;

        try {
          const rawRecord: RawRecordDto = JSON.parse(msg.content.toString());
          console.log(`📥 Received message for: ${rawRecord.name}`);

          await dataEnrichmentService.processRawRecord(rawRecord);

          queue.ack(msg);
          console.log(`✅ Message acknowledged for: ${rawRecord.name}`);
        } catch (error) {
          console.error('❌ Error processing message:', error);
          // Negative acknowledgment - requeue the message
          queue.nack(msg, false, true);
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
