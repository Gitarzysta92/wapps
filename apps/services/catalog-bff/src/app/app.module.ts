import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { CatalogModule } from './catalog/catalog.module';
import { HealthController } from './health/health.controller';
import { PlatformController } from './platform/platform.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    CatalogModule,
  ],
  controllers: [HealthController, PlatformController],
})
export class AppModule {}

