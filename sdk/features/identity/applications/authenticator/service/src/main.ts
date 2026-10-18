import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';
import {
  credentialDataSource,
  assertCredentialDatabase,
} from './credential-data-source';
import { provisionLocalUser } from './local-user';

async function bootstrap() {
  if (process.argv.length === 3 && process.argv[2] === '--local-user') {
    console.log(JSON.stringify(await provisionLocalUser(process.env)));
    return;
  }
  if (process.argv.length === 3 && process.argv[2] === '--migrate') {
    const source = credentialDataSource(process.env);
    await source.initialize();
    try {
      await assertCredentialDatabase(source);
      await source.runMigrations();
    } finally {
      await source.destroy();
    }
    console.log('Authentication migrations completed');
    return;
  }
  if (process.argv.length !== 2)
    throw new Error('Unknown authentication maintenance command');
  const { AppModule } = await import('./app.module');
  if (process.env.AUTH_PROVIDER === 'firebase') {
    const admin = await import('firebase-admin');
    if (!admin.apps.length)
      admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.enableShutdownHooks();
  app.use(json({ limit: '32kb', strict: true }));
  await app.listen(Number(process.env.PORT ?? 8080));
}
void bootstrap().catch(() => {
  console.error(
    'Authentication startup/maintenance failed; check configuration and credential database migrations'
  );
  process.exitCode = 1;
});
