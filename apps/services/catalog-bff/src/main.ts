import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app/app.module';
import { configureGenericDiscussionBody } from './app/discussions/portal-generic-discussions.body';
import { configureHealthMonitorBody } from './app/health-monitors/portal-health-monitors.body';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureGenericDiscussionBody(app);
  configureHealthMonitorBody(app);
  app.enableShutdownHooks();
  const logger = new Logger('Bootstrap');

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    })
  );

  app.setGlobalPrefix('api');

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Catalog BFF API')
    .setDescription(
      'Backend for Frontend API for the catalog domain. Provides endpoints for apps, categories, and tags.'
    )
    .setVersion('1.0')
    .addTag('catalog', 'Catalog domain endpoints')
    .addTag('health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Catalog BFF API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, process.env.HOST || '0.0.0.0');
  const address = await app.getUrl();

  logger.log(`🚀 Catalog BFF is running on: ${address}/api`);
  logger.log(`📚 Swagger documentation available at: ${address}/api/docs`);
}

bootstrap();
