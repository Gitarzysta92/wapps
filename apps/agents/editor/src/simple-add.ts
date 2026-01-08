import dotenv from 'dotenv';
import { createOrUpdateAppRecord, ScrapedApp } from './editorial-client';

// Load environment variables from .env file
dotenv.config();

async function run() {
  console.log('🚀 Starting Simple Add Application...');
  
  // Validate required environment variables
  const EDITORIAL_SERVICE_HOST = process.env['EDITORIAL_SERVICE_HOST'];
  const EDITORIAL_API_TOKEN = process.env['EDITORIAL_SERVICE_API_TOKEN'];

  if (!EDITORIAL_SERVICE_HOST) {
    console.error('❌ EDITORIAL_SERVICE_HOST environment variable is required');
    console.error('   Please set it in your .env file');
    process.exit(1);
  }
  if (!EDITORIAL_API_TOKEN) {
    console.error('❌ EDITORIAL_SERVICE_API_TOKEN environment variable is required');
    console.error('   Please set it in your .env file');
    process.exit(1);
  }

  console.log(`📡 Editorial Service: ${EDITORIAL_SERVICE_HOST}`);
  console.log(`🔐 API Token: ✓ Set`);

  // Hardcoded app entry
  const hardcodedApp: ScrapedApp = {
    name: 'Example App',
    slug: 'example-app',
    detailsLink: 'https://example.com',
    tags: ['productivity', 'tools'],
    description: 'This is a hardcoded example app entry created by the simple-add application.',
    links: [
      { id: 1, link: 'https://example.com' },
    ],
    assets: [
      {
        src: 'https://via.placeholder.com/512x512.png?text=Logo',
        type: 'logo',
      },
      {
        src: 'https://via.placeholder.com/1024x768.png?text=Screenshot+1',
        type: 'gallery',
      },
      {
        src: 'https://via.placeholder.com/1024x768.png?text=Screenshot+2',
        type: 'gallery',
      },
    ],
  };

  try {
    console.log(`\n📦 Attempting to add hardcoded entry: ${hardcodedApp.name}`);
    await createOrUpdateAppRecord(hardcodedApp);
    console.log(`\n✅ Successfully processed hardcoded entry!`);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to add hardcoded entry:', error);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

