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
      host, port, username, password, name: APP_RECORD_QUEUE_NAME
    });
    const browser = await browserClient.launch({ headless });
    return {
      listScrapper: new ScrapAppListFromStoreApp(browser),
      detailsScrapper: new ScrapAppDetailsFromStoreApp(browser),
      recordProcessingService: new RawRecordProcessorService(queue),
      mediaIngestionService: new MediaIngestionService(queue),
    }
  })
  .run(({ listScrapper, detailsScrapper, recordProcessingService, mediaSynchronizationService }) => {
    const apps = await listScrapper.handle();
    for (const app of apps) {
      const details = await detailsScrapper.handle(app);
      const data = Object.assign(app, details);
      recordProcessingService.processRawAppRecord(data);
      mediaSynchronizationService.enqueueExternalMediaSynchronization(data.assets);
    }
  }).catch(async (err) => {
    console.error(err);
    process.exit(1);
    }).finally(() => {
      await queueClient.close();
      await browserClient.close();
    process.exit(0);
  });



  


// async function run() {
  
//   const scrapAppListFromStoreApp = new ScrapAppListFromStoreApp(browser)
//   const scrapAppDetailsFromStoreApp = new ScrapAppDetailsFromStoreApp(browser);
//   const rawRecordProcessorService = new RawRecordProcessorService(queue);
//   const externalMediaSynchronizer = new ExternalMediaSynchronizer(queue);

//   try {
//     const apps = await scrapAppListFromStoreApp.handle();
//     for (const app of apps) {
//       const details = await scrapAppDetailsFromStoreApp.handle(app);
//       const data = Object.assign(app, details);
//       rawRecordProcessorService.processRawAppRecord(data);
//       queue.enqueueExternalMediaSynchronization(data.assets);
//     }
//   } catch(err) {
//     console.log(err)
//   }

  
// }

// run()
//   .then(() => {
//     console.log('✅ Job completed successfully');
//     process.exit(0);
//   })
//   .catch((err) => {
//     console.error('❌ Job failed with error:');
//     console.error(err);
//     if (err instanceof Error) {
//       console.error('Error message:', err.message);
//       console.error('Error stack:', err.stack);
//     }
//     process.exit(1);
//   });






  // const data = Object.assign(app, details);
  //     const msg = JSON.stringify(data);
  //     channel.sendToQueue(queueName, Buffer.from(msg));
      
  //     for (const asset of data.assets) {
  //       const image = await downloadImage(asset.src);

  //       const strBuffer = Buffer.from(data.slug, "utf-8");
  //       const combined = Buffer.concat([image, strBuffer]);
  //       uploadImage(
  //         MEDIA_STORAGE_BUCKET_NAME,
  //         createHash("md5").update(combined).digest("hex"),
  //         image,
  //         mediaStorageClient,
  //         {
  //           timeStamp: Date.now().toString(),
  //           slug: data.slug,
  //           type: asset.type
  //         }
  //       );
  //       console.log(asset);
  //     }


  // Validate MinIO credentials
  // const mediaStorageData = getConnectionData();
  // if (!mediaStorageData.host || !mediaStorageData.accessKey || !mediaStorageData.secretKey) {
  //   console.error('ERROR: Missing required MinIO environment variables:');
  //   console.error(`  MEDIA_STORAGE_HOST: ${mediaStorageData.host ? '✓' : '✗ MISSING'}`);
  //   console.error(`  MEDIA_STORAGE_ACCESSKEY: ${mediaStorageData.accessKey ? '✓' : '✗ MISSING'}`);
  //   console.error(`  MEDIA_STORAGE_SECRETKEY: ${mediaStorageData.secretKey ? '✓' : '✗ MISSING'}`);
  //   process.exit(1);
  // }
