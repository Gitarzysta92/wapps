import dotenv from 'dotenv';
import { ScrapAppListFromStoreApp } from './application/tasks/scrap-app-list-from-store-app.task';
import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';

// Load local .env for dev only (optional)
dotenv.config();


async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1700, height: 800 },
  });
  console.log('✅ Browser launched');

  const scrapAppListFromStoreApp = new ScrapAppListFromStoreApp(browser);
  const apps = await scrapAppListFromStoreApp.handle();
  
  console.log(`Found ${apps.length} apps`);
  writeFileSync('tmp/apps-list.json', JSON.stringify(apps, null, 2));
  
  await browser.close();
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
