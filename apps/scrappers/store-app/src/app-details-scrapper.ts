import dotenv from 'dotenv';
import { ScrapAppDetailsFromStoreAppV2 } from './application/tasks/scrap-app-details-from-store-app-v2-task';
import { writeFileSync } from 'fs';

// Load local .env for dev only (optional)
dotenv.config();

const APPLICATION_ID = process.env['APPLICATION_ID'];

async function run() {
  const scrapAppDetailsFromStoreApp = new ScrapAppDetailsFromStoreAppV2();
  const app = await scrapAppDetailsFromStoreApp.handle({
    url: `https://store.app/${APPLICATION_ID}`,
    name: '',
    tags: []
  });
  writeFileSync('tmp/app.json', JSON.stringify(app, null, 2));
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