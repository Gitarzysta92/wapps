import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app/app.module';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { runDiscussionMaintenance } from './discussion-maintenance';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: '300kb' });
  const logger = new Logger('Bootstrap');
  app.enableShutdownHooks();

  app.enableCors({
    origin: process.env.DISCUSSION_CORS_ORIGIN || '*',
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
    .setTitle('Discussion API')
    .setDescription(
      'Discussion service. Manages discussions, comments, and threads.'
    )
    .setVersion('1.0')
    .addTag('discussions', 'Discussions management')
    .addTag('comments', 'Comments management')
    .addTag('threads', 'Threads management')
    .addTag('health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Discussion API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  const port = Number(process.env.DISCUSSION_PORT || 1338);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535)
    throw new Error('Invalid discussion port');
  await app.listen(port, process.env.DISCUSSION_HOST || '0.0.0.0');
  const address = await app.getUrl();

  logger.log(`Discussion API is running on: ${address}/api`);
  logger.log(`Swagger documentation available at: ${address}/api/docs`);
}

void (
  process.argv.length > 2
    ? runDiscussionMaintenance(process.argv.slice(2))
    : bootstrap()
).catch((error: unknown) => {
  console.error(
    'Discussion service failed:',
    error instanceof Error ? error.message : 'Unknown error'
  );
  process.exitCode = 1;
});
