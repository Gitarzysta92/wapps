import 'reflect-metadata';
import * as admin from 'firebase-admin';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import swaggerUi from 'swagger-ui-express';
import { AppModule } from './app.module';
import { swaggerDocument } from './swagger.document';

async function bootstrap() {
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID });
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Swagger UI (same URL as before)
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      customSiteTitle: 'Authenticator API',
      customCss: '.swagger-ui .topbar { display: none }',
    })
  );

  const port = parseInt(String(process.env.PORT ?? 8080), 10);
  await app.listen(port);

  const ingressSecret = process.env.INGRESS_AUTH_SECRET;
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
  const firebaseWebApiKey = process.env.FIREBASE_WEB_API_KEY;

  if (!ingressSecret) {
    console.warn('⚠️  WARNING: INGRESS_AUTH_SECRET not set - backend services cannot validate auth headers!');
  }

  if (!firebaseWebApiKey) {
    console.warn('⚠️  WARNING: FIREBASE_WEB_API_KEY not set - email/password authentication will not work!');
  }

  const enableEmailPassword = process.env.ENABLE_EMAIL_PASSWORD !== 'false';
  const enableGoogle = process.env.ENABLE_GOOGLE === 'true';
  const enableGithub = process.env.ENABLE_GITHUB === 'true';
  const enableAnonymous = process.env.ENABLE_ANONYMOUS === 'true';

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const githubClientId = process.env.GITHUB_CLIENT_ID;

  console.log(`🔐 Authenticator running on port ${port}`);
  console.log(`📋 Firebase Project ID: ${firebaseProjectId || 'NOT SET'}`);
  console.log(`📋 Firebase Web API Key: ${firebaseWebApiKey ? '✓ SET' : '✗ NOT SET'}`);
  console.log(`📋 Enabled providers:`);
  console.log(`   - Email/Password: ${enableEmailPassword ? '✓' : '✗'}`);
  console.log(`   - Google: ${enableGoogle && googleClientId ? '✓' : '✗'}`);
  console.log(`   - GitHub: ${enableGithub && githubClientId ? '✓' : '✗'}`);
  console.log(`   - Anonymous: ${enableAnonymous ? '✓' : '✗'}`);
}

void bootstrap();