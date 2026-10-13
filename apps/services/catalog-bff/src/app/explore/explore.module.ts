import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { CatalogModule } from '../catalog/catalog.module';
import { EditorialClient } from '../catalog/clients/editorial.client';
import { DigestArticlesClient } from './digest-articles.client';
import { DigestService } from './digest.service';
import { DigestController } from './digest.controller';
import { ExploreService } from './explore.service';
import { ExploreController } from './explore.controller';
import { EncryptedExploreCursors } from './explore-cursors';
import { HttpExploreSource } from './explore-source';
import { TimelineService } from './timeline.service';
import { TimelineController } from './timeline.controller';

@Module({
  imports: [HttpModule, CatalogModule],
  controllers: [ExploreController, DigestController, TimelineController],
  providers: [
    {
      provide: TimelineService,
      inject: [EditorialClient, ConfigService],
      useFactory: (applications: EditorialClient, config: ConfigService) => {
        const secret = config.get<string>('EXPLORE_SERVICE_SECRET');
        return new TimelineService(
          applications,
          new HttpExploreSource(config.get<string>('EDITORIAL_URL'), secret, [
            'application',
            'suite',
            'release',
          ]),
          new HttpExploreSource(config.get<string>('DISCUSSION_URL'), secret, [
            'discussion',
            'review',
          ]),
          (id) =>
            new EncryptedExploreCursors(
              secret,
              Date.now,
              '\0application-timeline:' + id
            )
        );
      },
    },
    DigestArticlesClient,
    {
      provide: DigestService,
      inject: [
        ExploreService,
        ConfigService,
        EditorialClient,
        DigestArticlesClient,
      ],
      useFactory: (
        activity: ExploreService,
        config: ConfigService,
        applications: EditorialClient,
        articles: DigestArticlesClient
      ) =>
        new DigestService(
          activity,
          new HttpExploreSource(
            config.get<string>('DISCUSSION_URL'),
            config.get<string>('EXPLORE_SERVICE_SECRET'),
            ['discussion', 'review']
          ),
          applications,
          articles
        ),
    },
    {
      provide: ExploreService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('EXPLORE_SERVICE_SECRET');
        return new ExploreService(
          new HttpExploreSource(config.get<string>('EDITORIAL_URL'), secret, [
            'application',
            'suite',
            'article',
            'release',
          ]),
          new HttpExploreSource(config.get<string>('DISCUSSION_URL'), secret, [
            'discussion',
            'review',
          ]),
          new EncryptedExploreCursors(secret)
        );
      },
    },
  ],
})
export class ExploreModule {}
