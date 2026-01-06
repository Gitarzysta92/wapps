import amqp from 'amqplib';
import dotenv from 'dotenv';
import { ScrapAppListFromStoreApp } from './scrap-app-list-from-store-app.task';
import puppeteer from 'puppeteer';
import { ScrapAppDetailsFromStoreApp } from './scrap-app-details-from-store-app.task';
import { createHash } from "crypto";
import { createMediaStorageClient, downloadImage, getConnectionData, uploadImage } from './media-scrapper';
import { MEDIA_STORAGE_BUCKET_NAME } from './constants';

// Load local .env for dev only (optional)
dotenv.config();

const headless = process.env['HEADLESS'] === 'true' || true;
const user = process.env['QUEUE_USERNAME'];
const pass = process.env['QUEUE_PASSWORD'];
const host = process.env['QUEUE_HOST'] || 'localhost';
const port = process.env['QUEUE_PORT'] || '5672';

// Validate required environment variables
if (!user || !pass) {
  console.error('ERROR: Missing required environment variables:');
  console.error(`  QUEUE_USERNAME: ${user ? '✓' : '✗ MISSING'}`);
  console.error(`  QUEUE_PASSWORD: ${pass ? '✓' : '✗ MISSING'}`);
  process.exit(1);
}
console.log(`  AMQP URL: amqp://${user}:***@${host}:${port}`);
const url = `amqp://${user}:${pass}@${host}:${port}/`;
const queueName = "store.app-scrapper";

// const mediaStorageHost = process.env['MEDIA_STORAGE_HOST'];
// const mediaStorageAccessKey = process.env['MEDIA_STORAGE_ACCESSKEY'];
// const mediaStorageSecretKey = process.env['MEDIA_STORAGE_SECRETKEY'];

console.log('Configuration:');
console.log(`  MEDIA_STORAGE_HOST: ${process.env['MEDIA_STORAGE_HOST'] || 'NOT SET'}`);
console.log(`  QUEUE_HOST: ${host}`);
console.log(`  QUEUE_PORT: ${port}`);
console.log(`  AMQP URL: amqp://${user}:***@${host}:${port}`);



async function run() {
  // Validate MinIO credentials
  const mediaStorageData = getConnectionData();
  if (!mediaStorageData.host || !mediaStorageData.accessKey || !mediaStorageData.secretKey) {
    console.error('ERROR: Missing required MinIO environment variables:');
    console.error(`  MEDIA_STORAGE_HOST: ${mediaStorageData.host ? '✓' : '✗ MISSING'}`);
    console.error(`  MEDIA_STORAGE_ACCESSKEY: ${mediaStorageData.accessKey ? '✓' : '✗ MISSING'}`);
    console.error(`  MEDIA_STORAGE_SECRETKEY: ${mediaStorageData.secretKey ? '✓' : '✗ MISSING'}`);
    process.exit(1);
  }

  console.log('Connecting to RabbitMQ...');
  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();
  await channel.assertQueue(queueName);
  console.log('✅ Connected to RabbitMQ');

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: headless,
    args: headless ? ['--no-sandbox','--disable-setuid-sandbox'] : ['--start-maximized'],
    defaultViewport: { width: 1700, height: 800 },
  });
  console.log('✅ Browser launched');

  const scrapAppListFromStoreApp = new ScrapAppListFromStoreApp(browser);
  const scrapAppDetailsFromStoreApp = new ScrapAppDetailsFromStoreApp(browser);

  console.log('Starting scraping process...');
  const apps = await scrapAppListFromStoreApp.handle();
  console.log(`Found ${apps.length} apps to process`);

  const mediaStorageClient = createMediaStorageClient(mediaStorageData);
  for (const app of apps) {
    try {
      const details = await scrapAppDetailsFromStoreApp.handle(app);
      const data = Object.assign(app, details);
      const msg = JSON.stringify(data);
      channel.sendToQueue(queueName, Buffer.from(msg));
      
      for (const asset of data.assets) {
        const image = await downloadImage(asset.src);

        const strBuffer = Buffer.from(data.slug, "utf-8");
        const combined = Buffer.concat([image, strBuffer]);
        uploadImage(
          MEDIA_STORAGE_BUCKET_NAME,
          createHash("md5").update(combined).digest("hex"),
          image,
          mediaStorageClient,
          {
            timeStamp: Date.now().toString(),
            slug: data.slug,
            type: asset.type
          }
        );
        console.log(asset);
      }
      console.log(`Queued: ${data.name}`);
    } catch(err) {
      console.log(err)
    }
  }
  await channel.close();
  await connection.close();
  await browser.close();
  console.log('✅ Scraping completed successfully');
}

run()
  .then(() => {
    console.log('✅ Job completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Job failed with error:');
    console.error(err);
    if (err instanceof Error) {
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);
    }
    process.exit(1);
  });
