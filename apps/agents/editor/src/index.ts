import dotenv from 'dotenv';
import amqp from 'amqplib';
import { getConnectionString } from './rabbitmq';
import { createOrUpdateAppRecord, ScrapedApp } from './editorial-client';

dotenv.config();

const QUEUE_NAME = 'store.app-scrapper';
const EDITORIAL_SERVICE_HOST = process.env['EDITORIAL_SERVICE_HOST'];
const EDITORIAL_API_TOKEN = process.env['EDITORIAL_SERVICE_API_TOKEN'];

async function run() {
  console.log('🚀 Starting Editor Agent...');
  
  // Validate required environment variables
  if (!EDITORIAL_SERVICE_HOST) {
    console.error('❌ EDITORIAL_SERVICE_HOST environment variable is required');
    process.exit(1);
  }
  if (!EDITORIAL_API_TOKEN) {
    console.error('❌ EDITORIAL_SERVICE_API_TOKEN environment variable is required');
    process.exit(1);
  }

  console.log(`📡 Editorial Service: ${EDITORIAL_SERVICE_HOST}`);
  console.log(`🐰 RabbitMQ Queue: ${QUEUE_NAME}`);
  console.log(`🔐 API Token: ✓ Set`);

  const connection = await amqp.connect(getConnectionString());
  const channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  console.log('✅ Connected to RabbitMQ, waiting for messages...');

  await channel.prefetch(1);

  channel.consume(
    QUEUE_NAME,
    async (msg) => {
      if (!msg) return;

      try {
        const scrapedApp: ScrapedApp = JSON.parse(msg.content.toString());
        console.log(`📥 Received message for: ${scrapedApp.name}`);

        await createOrUpdateAppRecord(scrapedApp);

        channel.ack(msg);
        console.log(`✓ Message acknowledged for: ${scrapedApp.name}`);
      } catch (error) {
        console.error('❌ Error processing message:', error);
        // Negative acknowledgment - requeue the message
        channel.nack(msg, false, true);
      }
    },
    { noAck: false }
  );

  // Keep process running
  console.log('👂 Listening for messages...');
}

run().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
