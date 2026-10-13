import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app/app.module';
import { json } from 'express';
import {
  EditorialMaintenanceInputError,
  runEditorialMaintenance,
} from './maintenance';
import { EditorialSchemaCompatibilityError } from './app/infrastructure/editorial-schema-compatibility';
import { EditorialBackfillError } from './app/application/editorial-backfill';
import { InvalidEditorialSnapshot } from './app/application/editorial-materialization';
import {
  runEditorialMaterializer,
  runEditorialReconciliation,
} from './projection-runtime';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '128kb' }));
  app.enableShutdownHooks();
  const logger = new Logger('Bootstrap');

  app.enableCors({
    origin:
      process.env.EDITORIAL_CORS_ORIGIN?.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean) ?? false,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );

  app.setGlobalPrefix('api');

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Editorial API')
    .setDescription(
      'Editorial content management service. Manages app records, categories, tags, and reference data.'
    )
    .setVersion('1.0')
    .addTag('apps', 'App records management')
    .addTag('categories', 'Categories management')
    .addTag('tags', 'Tags management')
    .addTag('reference', 'Reference data (platforms, devices, etc.)')
    .addTag('health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Editorial API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  const port = process.env.EDITORIAL_PORT || 1337;
  await app.listen(port, process.env.EDITORIAL_HOST || '0.0.0.0');
  const address = await app.getUrl();

  logger.log(`🚀 Editorial API is running on: ${address}/api`);
  logger.log(`📚 Swagger documentation available at: ${address}/api/docs`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--materialize')
    return runEditorialMaterializer();
  if (
    args[0] === '--reconcile' &&
    (args.length === 1 || (args.length === 2 && args[1] === '--apply'))
  )
    return runEditorialReconciliation(args.length === 2);
  if (args.length) await runEditorialMaintenance(args);
  else await bootstrap();
}

void main().catch((error) => {
  console.error(
    'Editorial failed:',
    error instanceof EditorialMaintenanceInputError ||
      error instanceof EditorialSchemaCompatibilityError ||
      error instanceof EditorialBackfillError ||
      error instanceof InvalidEditorialSnapshot
      ? error.message
      : error instanceof Error
      ? error.name
      : 'Unknown error'
  );
  process.exitCode = 1;
});
