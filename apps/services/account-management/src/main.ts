import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as admin from 'firebase-admin';
import { AppModule } from './app/app.module';

async function bootstrap() {
  // Firebase Admin (used for account admin operations)
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
  });

  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.enableCors({
    origin: process.env.ACCOUNT_MANAGEMENT_CORS_ORIGIN || '*',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    })
  );

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Account Management API')
    .setDescription('Internal admin service for identity account operations (Firebase Admin).')
    .setVersion('1.0')
    .addTag('admin', 'Admin account operations')
    .addTag('health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Account Management API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  const port = process.env.ACCOUNT_MANAGEMENT_PORT || 1340;
  await app.listen(port);

  logger.log(`🚀 Account Management API is running on: http://localhost:${port}/api`);
  logger.log(`📚 Swagger documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap();

