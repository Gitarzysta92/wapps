import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app/app.module';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.enableCors({
    origin: process.env.DISCUSSION_CORS_ORIGIN || '*',
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
    .setTitle('Discussion API')
    .setDescription('Discussion service. Manages discussions, comments, and threads.')
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

  const port = process.env.DISCUSSION_PORT || 1338;
  await app.listen(port);

  logger.log(`🚀 Discussion API is running on: http://localhost:${port}/api`);
  logger.log(`📚 Swagger documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap();
