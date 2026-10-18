import { EDITORIAL_MIGRATIONS } from './editorial-migrations';
import { DataSource } from 'typeorm';
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  OnModuleInit,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { EditorialReadiness } from './health/editorial-readiness';
import { EditorialReadinessProbes } from './health/editorial-readiness.probes';
import { SeedService } from './seed/seed.service';
import { EditorialModule } from './editorial.module';
import {
  EditorialAuthMiddleware,
  EditorialMutationGuard,
} from './http/editorial-auth';
import { EditorialErrorFilter } from './http/editorial-error.filter';
import { ReferenceModule } from './reference/reference.module';
import { PlatformController } from './platform/platform.controller';

// Import entities
import { Category } from './categories/entities/category.entity';
import { Tag } from './tags/entities/tag.entity';
import { AppRecord } from './apps/entities/app-record.entity';
import { Platform } from './reference/entities/platform.entity';
import { Device } from './reference/entities/device.entity';
import { Social } from './reference/entities/social.entity';
import { Store } from './reference/entities/store.entity';
import { MonetizationModel } from './reference/entities/monetization-model.entity';
import { UserSpan } from './reference/entities/user-span.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      dataSourceFactory: async (options) => {
        if (!options)
          throw new Error('Editorial database configuration is missing');
        const source = await new DataSource(options).initialize();
        try {
          if (await source.showMigrations())
            throw new Error(
              'Editorial schema migrations are pending. Run --migrate before API startup.'
            );
          return source;
        } catch (error) {
          await source.destroy();
          throw error;
        }
      },
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        timezone: 'Z',
        host: configService.get('EDITORIAL_DATABASE_HOST') || 'localhost',
        port: parseInt(
          configService.get('EDITORIAL_DATABASE_PORT') || '3306',
          10
        ),
        username: configService.get('EDITORIAL_DATABASE_USERNAME') || 'root',
        password:
          configService.get('EDITORIAL_DATABASE_PASSWORD') || 'password',
        database: configService.get('EDITORIAL_DATABASE_NAME') || 'editorial',
        entities: [
          Category,
          Tag,
          AppRecord,
          Platform,
          Device,
          Social,
          Store,
          MonetizationModel,
          UserSpan,
        ],
        synchronize: false,
        migrations: EDITORIAL_MIGRATIONS,
        migrationsRun: false,
        migrationsTransactionMode: 'none',
        migrationsTableName: 'editorial_migrations',
        logging: false,
      }),
    }),
    TypeOrmModule.forFeature([Category, Tag]),
    EditorialModule,
    ReferenceModule,
  ],
  controllers: [HealthController, PlatformController],
  providers: [
    EditorialReadiness,
    EditorialReadinessProbes,
    SeedService,
    EditorialAuthMiddleware,
    { provide: APP_GUARD, useClass: EditorialMutationGuard },
    { provide: APP_FILTER, useClass: EditorialErrorFilter },
  ],
})
export class AppModule implements OnModuleInit, NestModule {
  constructor(
    private readonly seedService: SeedService,
    private readonly config: ConfigService
  ) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(EditorialAuthMiddleware).forRoutes('*');
  }

  async onModuleInit() {
    if (this.config.get('EDITORIAL_SEED_DEMO_DATA') === 'true')
      await this.seedService.seed();
  }
}
