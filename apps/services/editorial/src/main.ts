import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app/app.module';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.enableCors({
    origin: process.env.EDITORIAL_CORS_ORIGIN || '*',
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
    .setTitle('Editorial API')
    .setDescription('Editorial content management service. Manages app records, categories, tags, and reference data.')
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
  await app.listen(port);

  logger.log(`🚀 Editorial API is running on: http://localhost:${port}/api`);
  logger.log(`📚 Swagger documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap();
