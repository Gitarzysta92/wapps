import amqp from 'amqplib';
import dotenv from 'dotenv';
import { ScrapAppListFromStoreApp } from './application/tasks/scrap-app-list-from-store-app.task';
import puppeteer from 'puppeteer';
import { ScrapAppDetailsFromStoreApp } from './application/tasks/scrap-app-details-from-store-app.task';
import { QueueClient } from './infrastructure/queue-client';
import { BrowserClient } from './infrastructure/browser-client';
import { RawRecordProcessorService } from './application/services/raw-record-processor.service';
import { MediaIngestionService } from './application/services/media-ingestion.service';
import { ApplicationShell } from '@standard';
import { APP_RECORD_QUEUE_NAME } from '@domains/catalog/record';

dotenv.config();

const headless = process.env['HEADLESS'] as string;
const username = process.env['QUEUE_USERNAME'] as string;
const password = process.env['QUEUE_PASSWORD'] as string;
const host = process.env['QUEUE_HOST'] as string;
const port = process.env['QUEUE_PORT'] as string;


const storeAppScrapper = new ApplicationShell({
  headless: { value: headless, optional: true },
  username: { value: username },
  password: { value: password },
  host: { value: host },
  port: { value: port },
});


storeAppScrapper
  .initialize(async (params) => {
    const queueClient = new QueueClient(amqp);
    const browserClient = new BrowserClient(puppeteer);
    const queue = await queueClient.connect({
      host: params.host,
      port: params.port,
      username: params.username,
      password: params.password,
      name: APP_RECORD_QUEUE_NAME
    });
    const browser = await browserClient.launch({ headless: params.headless });
    return {
      listScrapper: new ScrapAppListFromStoreApp(browser),
      detailsScrapper: new ScrapAppDetailsFromStoreApp(browser),
      recordProcessingService: new RawRecordProcessorService(queue),
      mediaIngestionService: new MediaIngestionService(queue),
      browserClient: browserClient,
      queueClient: queueClient,
    }
  })
  .run(async ({ listScrapper, detailsScrapper, recordProcessingService, mediaIngestionService }) => {
    //TODO: add proper logging
    // based on opensearch
    const apps = await listScrapper.handle();
    if (!apps || apps.length === 0) {
      console.log('ℹ️  No apps found to process');
      return;
    } 

    let processedCount = 0;
    let failedCount = 0;
    for (const app of apps) {
      try {
        const details = await detailsScrapper.handle(app);
        const data = { ...app, ...details };
        recordProcessingService.processRawAppRecord(data);
        
        if (data.assets && data.assets.length > 0) {
          mediaIngestionService.ingestMedia(mediaIngestionService.mapAssetsToRawMedia(data.assets));
        }
        
        processedCount++;
        console.log(`✅ Processed (${processedCount}/${apps.length}): ${data.name}`);
      } catch (error) {
        failedCount++;
        console.error(`❌ Failed to process ${app.name || app.slug || 'unknown'}:`, error);
      }
    }
    
    console.log(`\n📊 Summary: ${processedCount} processed, ${failedCount} failed out of ${apps.length} total`);
  })
  .catch(async (err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  })
  .finally(async ({ queueClient, browserClient }) => {
    try {
      await queueClient.close();
      await browserClient.close();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  });