import dotenv from 'dotenv';
import amqp from 'amqplib';
import axios from 'axios';
import FormData from 'form-data';
import { getConnectionString } from './rabbitmq';

dotenv.config();

const QUEUE_NAME = 'store.app-scrapper';
const EDITORIAL_SERVICE_HOST = process.env['EDITORIAL_SERVICE_HOST'] || 'http://editorial-service.editorial:1337';
const EDITORIAL_API_TOKEN = process.env['EDITORIAL_SERVICE_API_TOKEN'];
const MEDIA_STORAGE_HOST = process.env['MEDIA_STORAGE_HOST'] || 'http://minio.minio:9000';

interface ScrapedApp {
  name: string;
  slug: string;
  detailsLink: string;
  tags: string[];
  description: string;
  links: Array<{ id: number; link: string }>;
  assets: Array<{ src: string; type: 'logo' | 'gallery' }>;
}

async function uploadImageToStrapi(imageUrl: string, name: string): Promise<number | null> {
  try {
    // Download image from URL
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data);

    const formData = new FormData();
    formData.append('files', imageBuffer, name);

    const response = await axios.post(
      `${EDITORIAL_SERVICE_HOST}/api/upload`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${EDITORIAL_API_TOKEN}`,
        },
      }
    );

    return response.data[0]?.id || null;
  } catch (error) {
    console.error(`Failed to upload image ${name} to Strapi:`, error);
    return null;
  }
}

async function findOrCreateTag(tagName: string): Promise<number | null> {
  try {
    // Search for existing tag
    const searchResponse = await axios.get(
      `${EDITORIAL_SERVICE_HOST}/api/tags`,
      {
        params: { 'filters[name][$eq]': tagName },
        headers: { Authorization: `Bearer ${EDITORIAL_API_TOKEN}` },
      }
    );

    if (searchResponse.data.data.length > 0) {
      return searchResponse.data.data[0].id;
    }

    // Create new tag
    const createResponse = await axios.post(
      `${EDITORIAL_SERVICE_HOST}/api/tags`,
      {
        data: {
          name: tagName,
          slug: tagName.toLowerCase().replace(/\s+/g, '-'),
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${EDITORIAL_API_TOKEN}`,
        },
      }
    );

    return createResponse.data.data.id;
  } catch (error) {
    console.error(`Failed to find/create tag ${tagName}:`, error);
    return null;
  }
}

async function createOrUpdateAppRecord(scrapedApp: ScrapedApp): Promise<void> {
  try {
    console.log(`📝 Processing app: ${scrapedApp.name}`);

    // Check if app already exists
    const existingResponse = await axios.get(
      `${EDITORIAL_SERVICE_HOST}/api/app-records`,
      {
        params: { 'filters[slug][$eq]': scrapedApp.slug },
        headers: { Authorization: `Bearer ${EDITORIAL_API_TOKEN}` },
      }
    );

    const existingApp = existingResponse.data.data[0];

    // Process tags
    const tagIds: number[] = [];
    for (const tagName of scrapedApp.tags) {
      const tagId = await findOrCreateTag(tagName);
      if (tagId) tagIds.push(tagId);
    }

    // Upload images
    let logoId: number | null = null;
    const screenshotIds: number[] = [];

    for (const asset of scrapedApp.assets) {
      const fileName = `${scrapedApp.slug}-${asset.type}-${Date.now()}.jpg`;
      const uploadedId = await uploadImageToStrapi(asset.src, fileName);
      
      if (uploadedId) {
        if (asset.type === 'logo' && !logoId) {
          logoId = uploadedId;
        } else if (asset.type === 'gallery') {
          screenshotIds.push(uploadedId);
        }
      }
    }

    const appData: any = {
      name: scrapedApp.name,
      slug: scrapedApp.slug,
      description: scrapedApp.description,
      website: scrapedApp.detailsLink,
      tags: tagIds,
      isSuspended: false,
    };

    if (logoId) {
      appData.logo = logoId;
    }

    if (screenshotIds.length > 0) {
      appData.screenshots = screenshotIds;
    }

    if (existingApp) {
      // Update existing
      await axios.put(
        `${EDITORIAL_SERVICE_HOST}/api/app-records/${existingApp.id}`,
        { data: appData },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${EDITORIAL_API_TOKEN}`,
          },
        }
      );
      console.log(`✅ Updated app: ${scrapedApp.name}`);
    } else {
      // Create new
      await axios.post(
        `${EDITORIAL_SERVICE_HOST}/api/app-records`,
        { data: appData },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${EDITORIAL_API_TOKEN}`,
          },
        }
      );
      console.log(`✅ Created app: ${scrapedApp.name}`);
    }
  } catch (error) {
    console.error(`Failed to process app ${scrapedApp.name}:`, error);
    if (axios.isAxiosError(error)) {
      console.error('Response data:', error.response?.data);
      console.error('Response status:', error.response?.status);
    }
    throw error;
  }
}

async function run() {
  console.log('🚀 Starting Editor Agent...');
  console.log(`📡 Editorial Service: ${EDITORIAL_SERVICE_HOST}`);
  console.log(`🐰 RabbitMQ Queue: ${QUEUE_NAME}`);
  console.log(`🔐 API Token: ${EDITORIAL_API_TOKEN ? '✓ Set' : '✗ Missing'}`);

  if (!EDITORIAL_API_TOKEN) {
    console.error('❌ EDITORIAL_SERVICE_API_TOKEN is required');
    process.exit(1);
  }

  const connection = await amqp.connect(getConnectionString());
  const channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  console.log('✅ Connected to RabbitMQ, waiting for messages...');

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
