import amqp from 'amqplib';
import dotenv from 'dotenv';
import { ScrapAppListFromStoreApp } from './scrap-app-list-from-store-app.task';
import puppeteer from 'puppeteer';
import { ScrapAppDetailsFromStoreApp } from './scrap-app-details-from-store-app.task';

// Load local .env for dev only (optional)
dotenv.config();

const headless = process.env['HEADLESS'] === 'true' || true;
const user = process.env['RABBITMQ_USER'];
const pass = process.env['RABBITMQ_PASSWORD'];
const host = process.env['RABBITMQ_HOST'] || 'localhost';
const port = process.env['RABBITMQ_PORT'] || '5672';
const url = `amqp://${user}:${pass}@${host}:${port}`;
const queueName = "store.app-scrapper";

console.log(user, pass, host, port, url)

async function run() {
  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();
  await channel.assertQueue(queueName);

  const browser = await puppeteer.launch({
    headless: headless,
    args: headless ? ['--no-sandbox','--disable-setuid-sandbox'] : ['--start-maximized'],
    defaultViewport: { width: 1700, height: 800 },
  });

  const scrapAppListFromStoreApp = new ScrapAppListFromStoreApp(browser);
  const scrapAppDetailsFromStoreApp = new ScrapAppDetailsFromStoreApp(browser);

  const apps = await scrapAppListFromStoreApp.handle();

  for (const app of apps) {
    try {
      const details = await scrapAppDetailsFromStoreApp.handle(app);
      const data = Object.assign(app, details)
      const msg = JSON.stringify(data);
      channel.sendToQueue(queueName, Buffer.from(msg));
      console.log(`Queued: ${data.name}`);
    } catch(err) {
      console.log(err)
    }
  }
  await channel.close();
  await connection.close();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
