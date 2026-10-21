import { DiscussionBindingIndex1792150000000 } from './discussions/infrastructure/discussion-binding-index.migration';
import { CommunityDiscussionBindingKeys1792080000000 } from './discussions/infrastructure/discussion-binding-keys.migration';
import { DiscussionContentUpdates1791840018000 } from './discussions/infrastructure/content-update-cursors.migration';
import {
  IdentityWriteBarrier1791840000000,
  AccountErasureRequests1791840001000,
} from '@wapps/account-mysql';
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  OnModuleInit,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { DiscussionsModule } from './discussions/discussions.module';
import { AuthValidationMiddleware } from './middleware/auth-validation.middleware';
import { ContentNodeEntity } from './discussions/infrastructure/content-node.entity';
import { ContentNodeRelationEntity } from './discussions/infrastructure/content-node-relation.entity';
import { CommentLikeEntity } from './discussions/infrastructure/comment-like.entity';
import { SeedService } from './seed/seed.service';
import { PlatformController } from './platform/platform.controller';
import { DiscussionWriteModel1791676800000 } from './discussions/infrastructure/discussion-write-model.migration';
import { DiscussionBackfill1791676801000 } from './discussions/infrastructure/discussion-backfill.migration';
import { DiscussionArticleTargets1791676822000 } from './discussions/infrastructure/discussion-article-targets.migration';
import { DiscussionApplicationTargets1791676823000 } from './discussions/infrastructure/discussion-application-targets.migration';
import { DiscussionParticipation1791676824000 } from './discussions/infrastructure/discussion-participation.migration';
import { DiscussionVotes1791676825000 } from './discussions/infrastructure/discussion-votes.migration';
import { DiscussionPins1791676826000 } from './discussions/infrastructure/discussion-pins.migration';
import { DataSource } from 'typeorm';
import { ReviewsModule } from './reviews/reviews.module';
import { MemberReviews1791676827000 } from './reviews/infrastructure/member-reviews.migration';
import { DiscussionPayloads1791840004000 } from './discussions/infrastructure/discussion-payloads.migration';
import { DiscussionPayloadInventory1791840005000 } from './discussions/infrastructure/discussion-payload-inventory.migration';
import { DiscussionAuthorErasure1791840006000 } from './discussions/infrastructure/discussion-author-erasure.migration';
import { DiscussionPrivateErasure1791840007000 } from './discussions/infrastructure/discussion-private-erasure.migration';
import { ReviewErasure1791840008000 } from './reviews/infrastructure/review-erasure.migration';
import { ReplyNotifications1791840015000 } from './discussions/infrastructure/reply-notifications.migration';
import { MentionNotifications1791864016000 } from './discussions/infrastructure/mention-notifications.migration';

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
          throw new Error('Discussion database configuration is missing');
        const source = new DataSource(options);
        await source.initialize();
        try {
          if (await source.showMigrations())
            throw new Error('Run Discussion --migrate before starting the API');
          return source;
        } catch (error) {
          await source.destroy();
          throw error;
        }
      },
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DISCUSSION_DATABASE_HOST') || 'localhost',
        port: parseInt(
          configService.get('DISCUSSION_DATABASE_PORT') || '3306',
          10
        ),
        username: configService.get('DISCUSSION_DATABASE_USERNAME') || 'root',
        password:
          configService.get('DISCUSSION_DATABASE_PASSWORD') || 'password',
        database: configService.get('DISCUSSION_DATABASE_NAME') || 'discussion',
        entities: [
          ContentNodeEntity,
          ContentNodeRelationEntity,
          CommentLikeEntity,
        ],
        synchronize: false,
        migrations: [
          DiscussionWriteModel1791676800000,
          DiscussionBackfill1791676801000,
          DiscussionArticleTargets1791676822000,
          DiscussionApplicationTargets1791676823000,
          DiscussionParticipation1791676824000,
          DiscussionVotes1791676825000,
          DiscussionPins1791676826000,
          MemberReviews1791676827000,
          IdentityWriteBarrier1791840000000,
          AccountErasureRequests1791840001000,
          DiscussionPayloads1791840004000,
          DiscussionPayloadInventory1791840005000,
          DiscussionAuthorErasure1791840006000,
          DiscussionPrivateErasure1791840007000,
          ReviewErasure1791840008000,
          ReplyNotifications1791840015000,
          MentionNotifications1791864016000,
          DiscussionContentUpdates1791840018000,
          CommunityDiscussionBindingKeys1792080000000,
          DiscussionBindingIndex1792150000000,
        ],
        migrationsRun: false,
        migrationsTransactionMode: 'each',
        logging: false,
      }),
    }),
    TypeOrmModule.forFeature([ContentNodeEntity]),
    DiscussionsModule,
    ReviewsModule,
  ],
  controllers: [HealthController, PlatformController],
  providers: [SeedService],
})
export class AppModule implements NestModule, OnModuleInit {
  constructor(
    private seedService: SeedService,
    private config: ConfigService
  ) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthValidationMiddleware).forRoutes('*');
  }

  async onModuleInit() {
    if (this.config.get('DISCUSSION_SEED_DEMO_DATA') === 'true')
      await this.seedService.seed();
  }
}
