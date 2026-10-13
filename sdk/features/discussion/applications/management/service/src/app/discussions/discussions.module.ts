import { ExploreCommunity } from './application/explore-community';
import { MysqlExploreCommunity } from './infrastructure/mysql-explore-community';
import { PublicExploreCommunityReader } from './infrastructure/explore-community-reader';
import { ExploreController } from './explore.controller';
import { AccountDiscussionMentions } from './infrastructure/account-discussion-mentions';
import { DiscussionMentionNotifications } from './application/mention-notifications';
import { MysqlMentionNotifications } from './infrastructure/mysql-mention-notifications';
import { MentionNotificationsController } from './mention-notifications.controller';
import { FavoriteUpdateSourceAccess } from '@sdk/features/identity/libs/management';
import { MysqlDiscussionFavoriteUpdates } from './infrastructure/mysql-favorite-updates';
import { FavoriteUpdateSourceController } from './favorite-updates.controller';
import { ProfileDiscussionTotals } from './application/profile-totals';
import { DiscussionReplyNotifications } from './application/reply-notifications';
import { MysqlReplyNotifications } from './infrastructure/mysql-reply-notifications';
import { ReplyNotificationsController } from './reply-notifications.controller';
import { MysqlProfileDiscussionTotals } from './infrastructure/mysql-profile-totals';
import { ProfileTotalsController } from './profile-totals.controller';
import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscussionsController } from './discussions.controller';
import { DiscussionsService } from './discussions.service';
import { MinioClient } from '../infrastructure/minio-client';
import { IConfirmedQueueChannel } from '@sdk/platform/queue';
import { RabbitMqQueueClient } from '@sdk/extras/queue-rabbitmq';
import { PlatformMongoClient } from '@sdk/extras/mongo';
import { DurableDiscussionCommands } from './application/durable-discussion-commands';
import { DiscussionQueries } from './application/discussion-queries';
import { MysqlDiscussionWrites } from './infrastructure/mysql-discussion-writes';
import { MinioDiscussionPayloadObjects } from './infrastructure/immutable-discussion-payloads';
import { RegisteredDiscussionPayloads } from './application/registered-discussion-payloads';
import { MysqlDiscussionPayloads } from './infrastructure/mysql-discussion-payloads';
import { MongoDiscussionProjections } from './infrastructure/mongo-discussion-projections';
import { OpaPolicyEvaluator } from './infrastructure/opa-policy-evaluator';
import { DiscussionOutboxDispatcher } from './infrastructure/discussion-outbox.dispatcher';
import { CryptoDiscussionIdentificatorGenerator } from './infrastructure/discussion-identificator.generator';
import { EditorialDiscussionTargets } from './infrastructure/editorial-discussion-targets';
import { MysqlArticleCommentThreads } from './infrastructure/mysql-article-comment-threads';
import { ArticleComments } from './application/article-comments';
import { ArticleCommentsController } from './article-comments.controller';
import { ApplicationDiscussions } from './application/application-discussions';
import { ApplicationDiscussionsController } from './application-discussions.controller';
import { MysqlPublicDiscussionThreads } from './infrastructure/mysql-public-discussion-threads';
import { DataSource } from 'typeorm';
import { MyDiscussions } from './application/my-discussions';
import { MysqlMyDiscussions } from './infrastructure/mysql-my-discussions';
import { MyDiscussionsController } from './my-discussions.controller';
import { PublicDiscussionSelection } from './application/discussion-selection';
import { DiscussionSelectionController } from './discussion-selection.controller';
import { MysqlDiscussionVotes } from './infrastructure/mysql-discussion-votes';
import { ProfileDiscussions } from './application/profile-discussions';
import { ProfileDiscussionsController } from './profile-discussions.controller';
import { MysqlProfileDiscussions } from './infrastructure/mysql-profile-discussions';
import { EditorialProfileDiscussionParents } from './infrastructure/editorial-profile-discussion-parents';
import { EncryptedProfileDiscussionCursors } from './infrastructure/profile-discussion-cursors';
import { ProfileCommunityActivity } from './application/profile-activity';
import { ProfileActivityController } from './profile-activity.controller';
import { MysqlCommunityActivity } from './infrastructure/mysql-profile-activity';
import { ReviewsModule } from '../reviews/reviews.module';
import { ApplicationReviews } from '../reviews/application/application-reviews';
import { PublicCommunityActivityReader } from './infrastructure/public-community-activity-reader';
import {
  AccountErasureAccess,
  AccountExportSourceAccess,
  CleanAccountErasureParticipant,
} from '@sdk/features/identity/libs/management';
import { MysqlAccountErasureParticipant } from '@sdk/extras/identity-mysql';
import { AccountErasureController } from './account-erasure.controller';
import { MysqlDiscussionAccountExportSource } from './infrastructure/mysql-discussion-account-export-source';
import { MinioDiscussionExportPayloads } from './infrastructure/discussion-export-payloads';
import { AccountExportController } from './account-export.controller';
import { CleanDiscussionAccount } from './application/clean-discussion-account';
import { AnonymizeDiscussionContributions } from './application/anonymize-discussion-contributions';
import { RetireDiscussionPayloads } from './application/registered-discussion-payloads';
import { EraseDiscussionProjections } from './application/erase-discussion-projections';
import { MysqlDiscussionContributionErasure } from './infrastructure/mysql-discussion-contribution-erasure';
import { MinioDiscussionErasurePayloads } from './infrastructure/minio-discussion-erasure-payloads';
import { MysqlDiscussionPrivateErasure } from './infrastructure/mysql-discussion-private-erasure';
import { MysqlReviewErasure } from '../reviews/infrastructure/mysql-review-erasure';
import { MysqlDiscussionProjectionErasure } from './infrastructure/mysql-discussion-projection-erasure';
import { MongoDiscussionProjectionErasure } from './infrastructure/mongo-discussion-projection-erasure';
import { MysqlDiscussionErasureCompletion } from './infrastructure/mysql-discussion-erasure-completion';

@Module({
  imports: [ReviewsModule],
  controllers: [
    ExploreController,
    FavoriteUpdateSourceController,
    ReplyNotificationsController,
    MentionNotificationsController,
    AccountErasureController,
    AccountExportController,
    ProfileTotalsController,
    DiscussionsController,
    ArticleCommentsController,
    ApplicationDiscussionsController,
    MyDiscussionsController,
    DiscussionSelectionController,
    ProfileDiscussionsController,
    ProfileActivityController,
  ],
  providers: [
    {
      provide: ExploreCommunity,
      inject: [DataSource, ApplicationDiscussions, ApplicationReviews, ConfigService],
      useFactory: (source: DataSource, discussions: ApplicationDiscussions, reviews: ApplicationReviews, config: ConfigService) =>
        new ExploreCommunity(new MysqlExploreCommunity(source, config.get<string>('DISCUSSION_PUBLIC_TENANT') ?? 'default'), new PublicExploreCommunityReader(discussions, reviews, new EditorialProfileDiscussionParents(config.getOrThrow<string>('EDITORIAL_URL'))), new OpaPolicyEvaluator()),
    },
    {
      provide: AccountDiscussionMentions,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new AccountDiscussionMentions(
          config.get<string>('ACCOUNT_MANAGEMENT_URL'),
          config.get<string>('NOTIFICATION_SERVICE_SECRET')
        ),
    },
    {
      provide: DiscussionMentionNotifications,
      inject: [DataSource, ConfigService, AccountDiscussionMentions],
      useFactory: (
        source: DataSource,
        config: ConfigService,
        directory: AccountDiscussionMentions
      ) =>
        new DiscussionMentionNotifications(
          new MysqlMentionNotifications(source),
          new EditorialProfileDiscussionParents(
            config.getOrThrow<string>('EDITORIAL_URL')
          ),
          new OpaPolicyEvaluator(),
          config.get<string>('DISCUSSION_PUBLIC_TENANT') ?? 'default',
          directory
        ),
    },
    {
      provide: FavoriteUpdateSourceAccess,
      inject: [DataSource, ConfigService],
      useFactory: (source: DataSource, config: ConfigService) =>
        new FavoriteUpdateSourceAccess(
          new MysqlDiscussionFavoriteUpdates(
            source,
            new EditorialProfileDiscussionParents(
              config.getOrThrow<string>('EDITORIAL_URL')
            ),
            config.get<string>('DISCUSSION_PUBLIC_TENANT') ?? 'default'
          ),
          new OpaPolicyEvaluator(),
          'discussion'
        ),
    },
    {
      provide: DiscussionReplyNotifications,
      inject: [DataSource, ConfigService],
      useFactory: (source: DataSource, config: ConfigService) =>
        new DiscussionReplyNotifications(
          new MysqlReplyNotifications(source),
          new EditorialProfileDiscussionParents(
            config.getOrThrow<string>('EDITORIAL_URL')
          ),
          new OpaPolicyEvaluator(),
          config.get<string>('DISCUSSION_PUBLIC_TENANT') ?? 'default'
        ),
    },
    {
      provide: AccountErasureAccess,
      inject: [DataSource, MinioClient, PlatformMongoClient, ConfigService],
      useFactory: async (
        source: DataSource,
        minio: MinioClient,
        mongo: PlatformMongoClient,
        config: ConfigService
      ) => {
        const activation = config.get<string>(
          'DISCUSSION_ERASURE_WORKERS_FENCED'
        );
        if (activation !== undefined && !['true', 'false'].includes(activation))
          throw new Error('Invalid DISCUSSION_ERASURE_WORKERS_FENCED setting');
        const enabled = activation === 'true';
        const projections = new MongoDiscussionProjectionErasure(
          mongo.collection('discussion_generation_nodes'),
          mongo.collection('discussion_nodes')
        );
        await projections.ensureIndexes();
        return new AccountErasureAccess(
          new CleanAccountErasureParticipant(
            new MysqlAccountErasureParticipant('discussion', source),
            new CleanDiscussionAccount(
              new AnonymizeDiscussionContributions(
                new MysqlDiscussionContributionErasure(source),
                new MinioDiscussionErasurePayloads(minio)
              ),
              new RetireDiscussionPayloads(
                new MysqlDiscussionPayloads(source),
                new MinioDiscussionPayloadObjects(minio)
              ),
              new MysqlDiscussionPrivateErasure(source),
              new MysqlReviewErasure(source),
              new EraseDiscussionProjections(
                new MysqlDiscussionProjectionErasure(source),
                projections,
                enabled
              ),
              new MysqlDiscussionErasureCompletion(source),
              enabled
            )
          ),
          new OpaPolicyEvaluator()
        );
      },
    },
    {
      provide: AccountExportSourceAccess,
      inject: [DataSource, MinioClient],
      useFactory: (source: DataSource, minio: MinioClient) =>
        new AccountExportSourceAccess(
          new MysqlDiscussionAccountExportSource(
            source,
            new MinioDiscussionExportPayloads(minio)
          ),
          new OpaPolicyEvaluator()
        ),
    },
    {
      provide: ProfileDiscussionTotals,
      inject: [DataSource, ConfigService],
      useFactory: (source: DataSource, config: ConfigService) =>
        new ProfileDiscussionTotals(
          new MysqlProfileDiscussionTotals(source),
          new EditorialProfileDiscussionParents(
            config.getOrThrow<string>('EDITORIAL_URL')
          ),
          new OpaPolicyEvaluator(),
          config.get<string>('DISCUSSION_PUBLIC_TENANT') ?? 'default'
        ),
    },
    {
      provide: ProfileCommunityActivity,
      inject: [
        DataSource,
        ApplicationDiscussions,
        ArticleComments,
        ApplicationReviews,
        ConfigService,
      ],
      useFactory: (
        source: DataSource,
        applications: ApplicationDiscussions,
        articles: ArticleComments,
        reviews: ApplicationReviews,
        config: ConfigService
      ) =>
        new ProfileCommunityActivity(
          new MysqlCommunityActivity(source),
          new PublicCommunityActivityReader(applications, articles, reviews),
          new EditorialProfileDiscussionParents(
            config.getOrThrow<string>('EDITORIAL_URL')
          ),
          new OpaPolicyEvaluator(),
          config.get<string>('DISCUSSION_PUBLIC_TENANT') ?? 'default'
        ),
    },
    DiscussionsService,
    MysqlDiscussionWrites,
    DiscussionOutboxDispatcher,
    {
      provide: ProfileDiscussions,
      inject: [
        DataSource,
        ApplicationDiscussions,
        ArticleComments,
        ConfigService,
      ],
      useFactory: (
        source: DataSource,
        applications: ApplicationDiscussions,
        articles: ArticleComments,
        config: ConfigService
      ) =>
        new ProfileDiscussions(
          new MysqlProfileDiscussions(source),
          {
            read: (target, id) =>
              target.kind === 'application'
                ? applications.read(target.id, id, null, true)
                : articles.read(target.id, id, null, true),
          },
          new EditorialProfileDiscussionParents(
            config.getOrThrow<string>('EDITORIAL_URL')
          ),
          new EncryptedProfileDiscussionCursors(
            config.getOrThrow<string>('INGRESS_AUTH_SECRET')
          ),
          new OpaPolicyEvaluator(),
          config.get<string>('DISCUSSION_PUBLIC_TENANT') ?? 'default'
        ),
    },
    {
      provide: PublicDiscussionSelection,
      inject: [
        MysqlDiscussionWrites,
        ApplicationDiscussions,
        EditorialDiscussionTargets,
        ConfigService,
      ],
      useFactory: (
        writes: MysqlDiscussionWrites,
        discussions: ApplicationDiscussions,
        targets: EditorialDiscussionTargets,
        config: ConfigService
      ) =>
        new PublicDiscussionSelection(
          writes,
          discussions,
          targets,
          config.get<string>('DISCUSSION_PUBLIC_TENANT') ?? 'default'
        ),
    },
    {
      provide: MyDiscussions,
      inject: [DataSource, ApplicationDiscussions],
      useFactory: (source: DataSource, discussions: ApplicationDiscussions) =>
        new MyDiscussions(
          new MysqlMyDiscussions(source),
          discussions,
          new OpaPolicyEvaluator()
        ),
    },
    {
      provide: EditorialDiscussionTargets,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new EditorialDiscussionTargets(
          config.get<string>('EDITORIAL_URL'),
          config.get<string>('DISCUSSION_PUBLIC_TENANT') ?? 'default'
        ),
    },
    {
      provide: ArticleComments,
      inject: [
        DurableDiscussionCommands,
        DiscussionQueries,
        MysqlDiscussionWrites,
        DataSource,
        EditorialDiscussionTargets,
        ConfigService,
      ],
      useFactory: (
        commands: DurableDiscussionCommands,
        queries: DiscussionQueries,
        writes: MysqlDiscussionWrites,
        source: DataSource,
        targets: EditorialDiscussionTargets,
        config: ConfigService
      ) =>
        new ArticleComments(
          commands,
          queries,
          writes,
          new MysqlArticleCommentThreads(source),
          targets,
          config.get<string>('DISCUSSION_PUBLIC_TENANT') ?? 'default'
        ),
    },
    {
      provide: ApplicationDiscussions,
      inject: [
        DurableDiscussionCommands,
        DiscussionQueries,
        MysqlDiscussionWrites,
        DataSource,
        EditorialDiscussionTargets,
        ConfigService,
      ],
      useFactory: (
        commands: DurableDiscussionCommands,
        queries: DiscussionQueries,
        writes: MysqlDiscussionWrites,
        source: DataSource,
        targets: EditorialDiscussionTargets,
        config: ConfigService
      ) =>
        new ApplicationDiscussions(
          commands,
          queries,
          writes,
          new MysqlPublicDiscussionThreads(source, 'application'),
          targets,
          config.get<string>('DISCUSSION_PUBLIC_TENANT') ?? 'default',
          new MysqlDiscussionVotes(source)
        ),
    },
    {
      provide: DurableDiscussionCommands,
      inject: [
        MysqlDiscussionWrites,
        MinioClient,
        EditorialDiscussionTargets,
        DataSource,
        AccountDiscussionMentions,
      ],
      useFactory: (
        writes: MysqlDiscussionWrites,
        minio: MinioClient,
        targets: EditorialDiscussionTargets,
        source: DataSource,
        mentions: AccountDiscussionMentions
      ) =>
        new DurableDiscussionCommands(
          writes,
          new RegisteredDiscussionPayloads(
            new MysqlDiscussionPayloads(source),
            new MinioDiscussionPayloadObjects(minio)
          ),
          new OpaPolicyEvaluator(),
          new CryptoDiscussionIdentificatorGenerator(),
          targets,
          mentions
        ),
    },
    {
      provide: DiscussionQueries,
      inject: [
        MysqlDiscussionWrites,
        PlatformMongoClient,
        ConfigService,
        EditorialDiscussionTargets,
      ],
      useFactory: (
        writes: MysqlDiscussionWrites,
        mongo: PlatformMongoClient,
        config: ConfigService,
        targets: EditorialDiscussionTargets
      ) =>
        new DiscussionQueries(
          writes,
          new MongoDiscussionProjections(mongo),
          config.get('DISCUSSION_PUBLIC_TENANT') ?? 'default',
          targets
        ),
    },
    {
      provide: MinioClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new MinioClient({
          host: config.get('DISCUSSION_STORAGE_HOST') as string,
          accessKey: config.get('DISCUSSION_STORAGE_ACCESSKEY') as string,
          secretKey: config.get('DISCUSSION_STORAGE_SECRETKEY') as string,
        }),
    },
    {
      provide: RabbitMqQueueClient,
      useFactory: () => new RabbitMqQueueClient(),
    },
    {
      provide: PlatformMongoClient,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const client = new PlatformMongoClient();
        await client.connect({
          host: config.get('MONGO_HOST') as string,
          port: config.get('MONGO_PORT') as string,
          username: config.get('MONGO_USERNAME') as string,
          password: config.get('MONGO_PASSWORD') as string,
          database: config.get('MONGO_DATABASE') as string,
        });
        return client;
      },
    },
    {
      provide: 'DISCUSSION_QUEUE',
      inject: [RabbitMqQueueClient, ConfigService],
      useFactory: async (
        client: RabbitMqQueueClient,
        config: ConfigService
      ): Promise<IConfirmedQueueChannel> =>
        client.connect({
          host: config.get('QUEUE_HOST') as string,
          port: config.get('QUEUE_PORT') as string,
          username: config.get('QUEUE_USERNAME') as string,
          password: config.get('QUEUE_PASSWORD') as string,
        }),
    },
  ],
  exports: [DiscussionsService],
})
export class DiscussionsModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly minioClient: MinioClient,
    private readonly queueClient: RabbitMqQueueClient,
    private readonly mongoClient: PlatformMongoClient
  ) {}

  async onModuleInit() {
    await this.minioClient.ensureBucket('discussion-content');
  }

  async onModuleDestroy() {
    await Promise.all([this.queueClient.close(), this.mongoClient.close()]);
  }
}
