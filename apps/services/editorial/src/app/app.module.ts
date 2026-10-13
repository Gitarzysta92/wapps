import { ContentClassification1791886000000 } from './content-classification/content-classification.migration';
import { HealthObservations1791840018000 } from './application-health/health-observations.migration';
import { EditorialContentUpdates1791840017000 } from './infrastructure/content-update-cursors.migration';
import {
  IdentityWriteBarrier1791840000000,
  AccountErasureRequests1791840001000,
} from '@sdk/extras/identity-mysql';
import { ArticleCoverCleanup1791676821000 } from './article-covers/article-cover-cleanup.migration';
import { ArticleCoverReferences1791676820000 } from './article-covers/article-cover-references.migration';
import { ArticleCovers1791676819000 } from './article-covers/article-covers.migration';
import { ArticleWorkspace1791676818000 } from './articles/article-workspace.migration';
import { ReleaseWorkspace1791676817000 } from './releases/release-workspace.migration';
import { ApplicationPublication1791676811000 } from './application-publication/application-publication.migration';
import { ApplicationOwnership1791676812000 } from './application-ownership/application-ownership.migration';
import { ApplicationEditing1791676813000 } from './application-drafts/application-editing.migration';
import { ApplicationImages1791676814000 } from './application-media/application-images.migration';
import { ApplicationImageBindings1791676815000 } from './application-media/application-image-bindings.migration';
import { ApplicationImageCleanup1791676816000 } from './application-media/application-image-cleanup.migration';
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
import { SeedService } from './seed/seed.service';
import { EditorialModule } from './editorial.module';
import { EditorialOwnership1791676802000 } from './infrastructure/editorial-schema.migration';
import { EditorialBackfill1791676803000 } from './infrastructure/editorial-backfill.migration';
import { SuiteWorkspace1791676808000 } from './suites/suite-workspace.migration';
import { SuitePublication1791676809000 } from './suites/suite-publication.migration';
import { SuitePublicationSnapshots1791840009000 } from './suites/suite-publication-snapshots.migration';
import { EditorialAuthorErasure1791840010000 } from './account-erasure/editorial-author-erasure.migration';
import { EditorialMediaAssets1791840011000 } from './application-media/editorial-media-assets.migration';
import { EditorialWorkspaceErasure1791840012000 } from './account-erasure/editorial-workspace-erasure.migration';
import { EditorialAuditErasure1791840013000 } from './account-erasure/editorial-audit-erasure.migration';
import { EditorialErasureCompletion1791840014000 } from './account-erasure/editorial-erasure-completion.migration';
import { ApplicationDrafts1791676810000 } from './application-drafts/application-drafts.migration';
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
        migrations: [
          EditorialOwnership1791676802000,
          EditorialBackfill1791676803000,
          SuiteWorkspace1791676808000,
          SuitePublication1791676809000,
          ApplicationDrafts1791676810000,
          ApplicationPublication1791676811000,
          ApplicationOwnership1791676812000,
          ApplicationEditing1791676813000,
          ApplicationImages1791676814000,
          ApplicationImageBindings1791676815000,
          ApplicationImageCleanup1791676816000,
          ReleaseWorkspace1791676817000,
          ArticleWorkspace1791676818000,
          ArticleCovers1791676819000,
          ArticleCoverReferences1791676820000,
          ArticleCoverCleanup1791676821000,
          IdentityWriteBarrier1791840000000,
          AccountErasureRequests1791840001000,
          SuitePublicationSnapshots1791840009000,
          EditorialAuthorErasure1791840010000,
          EditorialMediaAssets1791840011000,
          EditorialWorkspaceErasure1791840012000,
          EditorialAuditErasure1791840013000,
          EditorialErasureCompletion1791840014000,
          EditorialContentUpdates1791840017000,
          HealthObservations1791840018000,
          ContentClassification1791886000000,
        ],
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
