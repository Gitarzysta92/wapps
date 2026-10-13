import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as admin from 'firebase-admin';
import { runIdentityMaintenance } from '@sdk/extras/identity-mysql';
import { AccountErrorFilter } from './app/controllers/account-error.filter';

async function bootstrap() {
  const maintenance = await runIdentityMaintenance(
    process.argv.slice(2),
    process.env,
    (value) => console.log(JSON.stringify(value))
  );
  if (maintenance !== null) {
    process.exitCode = maintenance;
    return;
  }
  const { AppModule } = await import('./app/app.module');
  // Firebase Admin (used for account admin operations)
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
  });

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.useGlobalFilters(new AccountErrorFilter());
  const logger = new Logger('Bootstrap');

  app.enableCors({
    origin: process.env.ACCOUNT_MANAGEMENT_CORS_ORIGIN || '*',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    })
  );

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Account Management API')
    .setDescription(
      'Internal admin service for identity account operations (Firebase Admin).'
    )
    .setVersion('1.0')
    .addTag('admin', 'Admin account operations')
    .addTag('health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Account Management API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  const port = Number(process.env.ACCOUNT_MANAGEMENT_PORT ?? 1340);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error('Invalid account service port');
  await app.listen(port, process.env.ACCOUNT_MANAGEMENT_HOST ?? '0.0.0.0');
  const origin = await app.getUrl();

  logger.log(`🚀 Account Management API is running on: ${origin}/api`);
  logger.log(`📚 Swagger documentation available at: ${origin}/api/docs`);
}

void bootstrap().catch(() => {
  console.error(
    'Account startup/maintenance failed; check configuration, migrations and service dependencies'
  );
  process.exitCode = 1;
});
