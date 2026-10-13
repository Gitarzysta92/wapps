import {
  DeliverMentionNotifications,
  MentionInboxService,
} from '@sdk/features/identity/libs/management';
import { MysqlMentionInbox } from '@sdk/extras/identity-mysql';
import { RemoteMentionNotifications } from './infrastructure/remote-mention-notifications';
import { MentionNotificationWorker } from './infrastructure/mention-notification-worker';
import { MentionInboxController } from './controllers/mention-inbox.controller';
import {
  DiscussionMentionRecipients,
  DeliverFavoriteUpdates,
  FavoriteUpdatesService,
} from '@sdk/features/identity/libs/management';
import { MysqlFavoriteUpdates } from '@sdk/extras/identity-mysql';
import { RemoteFavoriteUpdates } from './infrastructure/remote-favorite-updates';
import { FavoriteUpdateWorker } from './infrastructure/favorite-update-worker';
import { FavoriteUpdatesController } from './controllers/favorite-updates.controller';
import { DiscussionMentionRecipientsController } from './controllers/discussion-mention-recipients.controller';
import { AccountFavoriteUpdates1791840019000 } from '@sdk/extras/identity-mysql';
import {
  DeliverReplyNotifications,
  ReplyInboxService,
} from '@sdk/features/identity/libs/management';
import {
  AccountNotifications1791840016000,
  MysqlReplyInbox,
} from '@sdk/extras/identity-mysql';
import { RemoteReplyNotifications } from './infrastructure/remote-reply-notifications';
import { ReplyNotificationWorker } from './infrastructure/reply-notification-worker';
import { ReplyInboxController } from './controllers/reply-inbox.controller';
import { PublicProfileArticlesService } from '@sdk/features/identity/libs/management';
import { randomUUID } from 'node:crypto';
import {
  AccountExportService,
  CompleteAccountExport,
} from '@sdk/features/identity/libs/management';
import {
  MysqlAccountExports,
  MysqlAccountExportSource,
} from '@sdk/extras/identity-mysql';
import { FirebaseAccountExportSource } from '@sdk/extras/identity-firebase';
import { AccountExportController } from './controllers/account-export.controller';
import { AccountExportWorker } from './infrastructure/account-export-worker';
import { GzipAccountExportArchive } from './infrastructure/account-export-archive';
import { RemoteAccountExportSource } from './infrastructure/remote-account-export-source';
import { EditorialProfileArticles } from './infrastructure/public-profile-articles';
import { ProfileTotalsService } from '@sdk/features/identity/libs/management';
import { RemoteProfileTotals } from './infrastructure/profile-totals';
import {
  MyProfileTotalsController,
  PublicProfileTotalsController,
} from './controllers/profile-totals.controller';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HttpModule, HttpService } from '@nestjs/axios';
import { AccountFavoritesService } from '@sdk/features/identity/libs/management';
import { MysqlAccountFavorites } from '@sdk/extras/identity-mysql';
import { PublicFavoriteTargets } from './infrastructure/public-favorite-targets';
import { PublicProfileFavoriteSelections } from './infrastructure/public-profile-favorite-selections';
import { PublicProfileFavoritesService } from '@sdk/features/identity/libs/management';
import { PublicProfileSuitesService } from '@sdk/features/identity/libs/management';
import { EditorialProfileSuites } from './infrastructure/public-profile-suites';
import { PublicProfileDiscussionsService } from '@sdk/features/identity/libs/management';
import { DiscussionProfileDiscussions } from './infrastructure/public-profile-discussions';
import { PublicProfileActivityService } from '@sdk/features/identity/libs/management';
import { RemoteProfileActivity } from './infrastructure/public-profile-activity';
import { EncryptedProfileActivityCursors } from './infrastructure/profile-activity-cursors';
import { AccountFavoritesController } from './controllers/account-favorites.controller';
import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import {
  IdentityManagementService,
  PrivateProfileService,
  PublicProfileService,
  ProfileAvatarService,
  AccountPreferencesService,
  type AccountPreferencesStore,
  type PrivateProfileStore,
} from '@sdk/features/identity/libs/management';
import { CanonicalIdentityStore } from '@sdk/features/identity/core';
import {
  FirebaseAdminUserAdminPort,
  FirebasePasswordRecovery,
} from '@sdk/extras/identity-firebase';
import {
  CanonicalIdentity1791676804000,
  PrivateProfile1791676805000,
  AccountPreferences1791676806000,
  AccountFavorites1791676807000,
  ProfileAvatars1791676828000,
  ProfileFollows1791676829000,
  ProfileContactEmail1791676830000,
  CreateIdentities1788566400000,
  IdentityEntity,
  MysqlCanonicalIdentities,
  MysqlProfileAvatars,
  MysqlPublicProfiles,
} from '@sdk/extras/identity-mysql';
import { HealthController } from './health/health.controller';
import { AuthValidationMiddleware } from './middleware/auth-validation.middleware';
import { AccountManagementController } from './controllers/account-management.controller';
import { PlatformController } from './controllers/platform.controller';
import { MeController } from './controllers/me.controller';
import { AccountPreferencesController } from './controllers/account-preferences.controller';
import { PrivateProfileController } from './controllers/private-profile.controller';
import { ProfileAvatarController } from './controllers/profile-avatar.controller';
import {
  ProfileFollowsController,
  PublicProfileController,
} from './controllers/public-profile.controller';
import { OpaProfileAudience } from './infrastructure/opa-profile-audience';
import { SharpProfileAvatars } from './infrastructure/sharp-profile-avatars';
import { RegistrationController } from './controllers/registration.controller';
import { PasswordRecoveryController } from './controllers/password-recovery.controller';
import { AccountManagementAppService } from './services/account-management-app.service';
import { PublicAccountAppService } from './services/public-account-app.service';
import {
  ACCOUNT_STATE,
  CANONICAL_IDENTITIES,
  PASSWORD_RECOVERY,
} from './services/identity-state.tokens';
import { OpaPolicyEvaluator } from './infrastructure/opa-policy-evaluator';
import { IdentityWorkers } from './infrastructure/identity-workers';
import { validateManagementEnv } from './config/env.validation';
import { ProfileBadgesService } from '@sdk/features/identity/libs/management';
import {
  MysqlProfileBadges,
  ProfileBadges1791676831000,
  AccountExports1791676832000,
  IdentityWriteBarrier1791840000000,
  AccountErasureRequests1791840001000,
  AccountErasureCoordination1791840002000,
  ProfileBadgeErasure1791840003000,
} from '@sdk/extras/identity-mysql';
import {
  ProfileBadgeAdministrationController,
  MyProfileBadgesController,
  PublicProfileBadgesController,
} from './controllers/profile-badges.controller';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({ isGlobal: true, validate: validateManagementEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.getOrThrow<string>('MYSQL_HOST'),
        port: Number(config.getOrThrow<string>('MYSQL_PORT')),
        username: config.getOrThrow<string>('MYSQL_USERNAME'),
        password: config.getOrThrow<string>('MYSQL_PASSWORD'),
        database: config.getOrThrow<string>('MYSQL_DATABASE'),
        entities: [IdentityEntity],
        synchronize: false,
        migrationsRun: false,
        migrationsTransactionMode: 'none',
        migrations: [
          CreateIdentities1788566400000,
          CanonicalIdentity1791676804000,
          PrivateProfile1791676805000,
          AccountPreferences1791676806000,
          AccountFavorites1791676807000,
          ProfileAvatars1791676828000,
          ProfileFollows1791676829000,
          ProfileContactEmail1791676830000,
          ProfileBadges1791676831000,
          AccountExports1791676832000,
          IdentityWriteBarrier1791840000000,
          AccountErasureRequests1791840001000,
          AccountErasureCoordination1791840002000,
          ProfileBadgeErasure1791840003000,
          AccountNotifications1791840016000,
          AccountFavoriteUpdates1791840019000,
        ],
        logging: false,
      }),
    }),
  ],
  controllers: [
    DiscussionMentionRecipientsController,
    FavoriteUpdatesController,
    ReplyInboxController,
    MentionInboxController,
    AccountExportController,
    MyProfileTotalsController,
    PublicProfileTotalsController,
    ProfileBadgeAdministrationController,
    MyProfileBadgesController,
    PublicProfileBadgesController,
    HealthController,
    AccountManagementController,
    PlatformController,
    MeController,
    PrivateProfileController,
    ProfileAvatarController,
    PublicProfileController,
    ProfileFollowsController,
    AccountPreferencesController,
    AccountFavoritesController,
    RegistrationController,
    PasswordRecoveryController,
  ],
  providers: [
    {
      provide: DiscussionMentionRecipients,
      inject: [
        AuthorityValidationService,
        DataSource,
        ConfigService,
        CANONICAL_IDENTITIES,
      ],
      useFactory: (
        authority: AuthorityValidationService,
        source: DataSource,
        config: ConfigService
      ) =>
        new DiscussionMentionRecipients(
          authority,
          new OpaProfileAudience(config.getOrThrow<string>('OPA_URL')),
          new MysqlPublicProfiles(source)
        ),
    },
    {
      provide: MysqlFavoriteUpdates,
      inject: [DataSource],
      useFactory: (source: DataSource) => new MysqlFavoriteUpdates(source),
    },
    {
      provide: RemoteFavoriteUpdates,
      inject: [HttpService, ConfigService],
      useFactory: (http: HttpService, config: ConfigService) =>
        new RemoteFavoriteUpdates(
          http,
          config.getOrThrow<string>('EDITORIAL_URL'),
          config.getOrThrow<string>('DISCUSSION_URL'),
          config.getOrThrow<string>('NOTIFICATION_SERVICE_SECRET')
        ),
    },
    {
      provide: DeliverFavoriteUpdates,
      inject: [MysqlFavoriteUpdates, RemoteFavoriteUpdates],
      useFactory: (
        store: MysqlFavoriteUpdates,
        source: RemoteFavoriteUpdates
      ) => new DeliverFavoriteUpdates(store, source),
    },
    {
      provide: FavoriteUpdatesService,
      inject: [
        AuthorityValidationService,
        MysqlFavoriteUpdates,
        RemoteFavoriteUpdates,
        ConfigService,
      ],
      useFactory: (
        authority: AuthorityValidationService,
        store: MysqlFavoriteUpdates,
        source: RemoteFavoriteUpdates,
        config: ConfigService
      ) =>
        new FavoriteUpdatesService(
          authority,
          store,
          source,
          () => config.get<string>('FAVORITE_UPDATE_WORKER_ENABLED') === 'true'
        ),
    },
    FavoriteUpdateWorker,
    {
      provide: MysqlReplyInbox,
      inject: [DataSource, CANONICAL_IDENTITIES],
      useFactory: (source: DataSource) => new MysqlReplyInbox(source),
    },
    {
      provide: RemoteReplyNotifications,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new RemoteReplyNotifications(
          config.getOrThrow<string>('DISCUSSION_URL'),
          config.getOrThrow<string>('NOTIFICATION_SERVICE_SECRET'),
          config.get<string>('REPLY_NOTIFICATION_WORKER_ENABLED') === 'true'
        ),
    },
    {
      provide: DeliverReplyNotifications,
      inject: [RemoteReplyNotifications, MysqlReplyInbox],
      useFactory: (source: RemoteReplyNotifications, store: MysqlReplyInbox) =>
        new DeliverReplyNotifications(source, store),
    },
    {
      provide: ReplyInboxService,
      inject: [
        AuthorityValidationService,
        MysqlReplyInbox,
        RemoteReplyNotifications,
      ],
      useFactory: (
        authority: AuthorityValidationService,
        store: MysqlReplyInbox,
        source: RemoteReplyNotifications
      ) => new ReplyInboxService(authority, store, source),
    },
    ReplyNotificationWorker,
    {
      provide: MysqlMentionInbox,
      inject: [DataSource, CANONICAL_IDENTITIES],
      useFactory: (source: DataSource) => new MysqlMentionInbox(source),
    },
    {
      provide: RemoteMentionNotifications,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new RemoteMentionNotifications(
          config.getOrThrow<string>('DISCUSSION_URL'),
          config.getOrThrow<string>('NOTIFICATION_SERVICE_SECRET'),
          config.get<string>('MENTION_NOTIFICATION_WORKER_ENABLED') === 'true'
        ),
    },
    {
      provide: DeliverMentionNotifications,
      inject: [RemoteMentionNotifications, MysqlMentionInbox],
      useFactory: (
        source: RemoteMentionNotifications,
        store: MysqlMentionInbox
      ) => new DeliverMentionNotifications(source, store),
    },
    {
      provide: MentionInboxService,
      inject: [
        AuthorityValidationService,
        MysqlMentionInbox,
        RemoteMentionNotifications,
      ],
      useFactory: (
        authority: AuthorityValidationService,
        store: MysqlMentionInbox,
        source: RemoteMentionNotifications
      ) => new MentionInboxService(authority, store, source),
    },
    MentionNotificationWorker,
    {
      provide: MysqlAccountExports,
      inject: [DataSource, CANONICAL_IDENTITIES],
      useFactory: (source: DataSource) => new MysqlAccountExports(source),
    },
    {
      provide: AccountExportService,
      inject: [AuthorityValidationService, MysqlAccountExports],
      useFactory: (
        authority: AuthorityValidationService,
        store: MysqlAccountExports
      ) => new AccountExportService(authority, store),
    },
    {
      provide: CompleteAccountExport,
      inject: [MysqlAccountExports, DataSource, ConfigService],
      useFactory: (
        jobs: MysqlAccountExports,
        source: DataSource,
        config: ConfigService
      ) => {
        const credential = config.getOrThrow<string>(
          'ACCOUNT_EXPORT_SOURCE_SECRET'
        );
        return new CompleteAccountExport(
          jobs,
          [
            new MysqlAccountExportSource(source),
            new FirebaseAccountExportSource(),
            new RemoteAccountExportSource(
              'editorial',
              config.getOrThrow<string>('EDITORIAL_URL'),
              credential
            ),
            new RemoteAccountExportSource(
              'discussion',
              config.getOrThrow<string>('DISCUSSION_URL'),
              credential
            ),
          ],
          new GzipAccountExportArchive(),
          randomUUID
        );
      },
    },
    AccountExportWorker,
    {
      provide: ProfileTotalsService,
      inject: [
        DataSource,
        ConfigService,
        HttpService,
        AuthorityValidationService,
        CANONICAL_IDENTITIES,
      ],
      useFactory: (
        source: DataSource,
        config: ConfigService,
        http: HttpService,
        authority: AuthorityValidationService,
        identities: MysqlCanonicalIdentities
      ) => {
        const editorial = config.getOrThrow<string>('EDITORIAL_URL'),
          discussion = config.getOrThrow<string>('DISCUSSION_URL'),
          secret = config.getOrThrow<string>('INGRESS_AUTH_SECRET');
        return new ProfileTotalsService(
          authority,
          new OpaProfileAudience(config.getOrThrow<string>('OPA_URL')),
          new MysqlPublicProfiles(source),
          identities,
          new MysqlAccountFavorites(source),
          new PublicProfileFavoriteSelections(http, editorial, discussion),
          new RemoteProfileTotals(http, editorial, secret),
          new RemoteProfileTotals(http, discussion, secret)
        );
      },
    },
    {
      provide: ProfileBadgesService,
      inject: [DataSource, ConfigService, AuthorityValidationService],
      useFactory: (
        source: DataSource,
        config: ConfigService,
        authority: AuthorityValidationService
      ) =>
        new ProfileBadgesService(
          authority,
          new OpaProfileAudience(config.getOrThrow<string>('OPA_URL')),
          new MysqlPublicProfiles(source),
          new MysqlProfileBadges(source)
        ),
    },
    {
      provide: PublicProfileActivityService,
      inject: [DataSource, ConfigService, HttpService, CANONICAL_IDENTITIES],
      useFactory: (
        source: DataSource,
        config: ConfigService,
        http: HttpService
      ) => {
        const profiles = new MysqlPublicProfiles(source);
        const editorial = config.getOrThrow<string>('EDITORIAL_URL');
        const discussion = config.getOrThrow<string>('DISCUSSION_URL');
        const secret = config.getOrThrow<string>('INGRESS_AUTH_SECRET');
        return new PublicProfileActivityService(
          new OpaProfileAudience(config.getOrThrow<string>('OPA_URL')),
          profiles,
          profiles,
          [
            new RemoteProfileActivity(http, editorial, secret),
            new RemoteProfileActivity(http, discussion, secret),
          ],
          new PublicProfileFavoriteSelections(http, editorial, discussion),
          new EncryptedProfileActivityCursors(secret)
        );
      },
    },
    {
      provide: PublicProfileDiscussionsService,
      inject: [DataSource, ConfigService, HttpService, CANONICAL_IDENTITIES],
      useFactory: (
        source: DataSource,
        config: ConfigService,
        http: HttpService
      ) => {
        const profiles = new MysqlPublicProfiles(source);
        return new PublicProfileDiscussionsService(
          new OpaProfileAudience(config.getOrThrow<string>('OPA_URL')),
          profiles,
          profiles,
          new DiscussionProfileDiscussions(
            http,
            config.getOrThrow<string>('DISCUSSION_URL'),
            config.getOrThrow<string>('INGRESS_AUTH_SECRET')
          )
        );
      },
    },
    {
      provide: PublicProfileArticlesService,
      inject: [DataSource, ConfigService, HttpService, CANONICAL_IDENTITIES],
      useFactory: (
        source: DataSource,
        config: ConfigService,
        http: HttpService
      ) => {
        const profiles = new MysqlPublicProfiles(source);
        return new PublicProfileArticlesService(
          new OpaProfileAudience(config.getOrThrow<string>('OPA_URL')),
          profiles,
          profiles,
          new EditorialProfileArticles(
            http,
            config.getOrThrow<string>('EDITORIAL_URL'),
            config.getOrThrow<string>('INGRESS_AUTH_SECRET')
          )
        );
      },
    },
    {
      provide: PublicProfileSuitesService,
      inject: [DataSource, ConfigService, HttpService, CANONICAL_IDENTITIES],
      useFactory: (
        source: DataSource,
        config: ConfigService,
        http: HttpService
      ) => {
        const profiles = new MysqlPublicProfiles(source);
        return new PublicProfileSuitesService(
          new OpaProfileAudience(config.getOrThrow<string>('OPA_URL')),
          profiles,
          profiles,
          new EditorialProfileSuites(
            http,
            config.getOrThrow<string>('EDITORIAL_URL'),
            config.getOrThrow<string>('INGRESS_AUTH_SECRET')
          )
        );
      },
    },
    {
      provide: PublicProfileFavoritesService,
      inject: [DataSource, ConfigService, HttpService, CANONICAL_IDENTITIES],
      useFactory: (
        source: DataSource,
        config: ConfigService,
        http: HttpService
      ) => {
        const profiles = new MysqlPublicProfiles(source);
        return new PublicProfileFavoritesService(
          new OpaProfileAudience(config.getOrThrow<string>('OPA_URL')),
          profiles,
          profiles,
          new PublicProfileFavoriteSelections(
            http,
            config.getOrThrow<string>('EDITORIAL_URL'),
            config.getOrThrow<string>('DISCUSSION_URL')
          )
        );
      },
    },
    {
      provide: PublicProfileService,
      inject: [
        AuthorityValidationService,
        DataSource,
        ConfigService,
        CANONICAL_IDENTITIES,
      ],
      useFactory: (
        authority: AuthorityValidationService,
        source: DataSource,
        config: ConfigService
      ) =>
        new PublicProfileService(
          authority,
          new OpaProfileAudience(config.getOrThrow<string>('OPA_URL')),
          new MysqlPublicProfiles(source)
        ),
    },
    {
      provide: ProfileAvatarService,
      inject: [AuthorityValidationService, DataSource, CANONICAL_IDENTITIES],
      useFactory: (authority: AuthorityValidationService, source: DataSource) =>
        new ProfileAvatarService(
          authority,
          new MysqlProfileAvatars(source),
          new SharpProfileAvatars()
        ),
    },
    {
      provide: MysqlAccountFavorites,
      inject: [DataSource, CANONICAL_IDENTITIES],
      useFactory: (source: DataSource) => new MysqlAccountFavorites(source),
    },
    {
      provide: PublicFavoriteTargets,
      inject: [HttpService, ConfigService],
      useFactory: (http: HttpService, config: ConfigService) =>
        new PublicFavoriteTargets(
          http,
          config.getOrThrow<string>('EDITORIAL_URL'),
          config.getOrThrow<string>('DISCUSSION_URL')
        ),
    },
    {
      provide: AccountFavoritesService,
      inject: [
        AuthorityValidationService,
        MysqlAccountFavorites,
        PublicFavoriteTargets,
        RemoteFavoriteUpdates,
      ],
      useFactory: (
        authority: AuthorityValidationService,
        favorites: MysqlAccountFavorites,
        targets: PublicFavoriteTargets,
        updates: RemoteFavoriteUpdates
      ) => new AccountFavoritesService(authority, favorites, targets, updates),
    },
    {
      provide: AccountPreferencesService,
      inject: [AuthorityValidationService, CANONICAL_IDENTITIES],
      useFactory: (
        authority: AuthorityValidationService,
        preferences: AccountPreferencesStore
      ) => new AccountPreferencesService(authority, preferences),
    },
    {
      provide: PrivateProfileService,
      inject: [AuthorityValidationService, CANONICAL_IDENTITIES],
      useFactory: (
        authority: AuthorityValidationService,
        profiles: PrivateProfileStore
      ) => new PrivateProfileService(authority, profiles),
    },
    AccountManagementAppService,
    PublicAccountAppService,
    AuthValidationMiddleware,
    IdentityWorkers,
    {
      provide: CANONICAL_IDENTITIES,
      inject: [DataSource],
      useFactory: async (source: DataSource) => {
        if (await source.showMigrations())
          throw new Error('Run identity --migrate before starting services');
        return new MysqlCanonicalIdentities(source);
      },
    },
    { provide: ACCOUNT_STATE, useExisting: CANONICAL_IDENTITIES },
    {
      provide: FirebaseAdminUserAdminPort,
      useFactory: () => new FirebaseAdminUserAdminPort(),
    },
    {
      provide: PASSWORD_RECOVERY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new FirebasePasswordRecovery(
          config.getOrThrow<string>('FIREBASE_WEB_API_KEY')
        ),
    },
    {
      provide: AuthorityValidationService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new (class extends AuthorityValidationService {})(
          new OpaPolicyEvaluator({
            baseUrl: config.getOrThrow<string>('OPA_URL'),
          })
        ),
    },
    {
      provide: IdentityManagementService,
      inject: [
        AuthorityValidationService,
        FirebaseAdminUserAdminPort,
        CANONICAL_IDENTITIES,
      ],
      useFactory: (
        authority: AuthorityValidationService,
        credentials: FirebaseAdminUserAdminPort,
        identities: CanonicalIdentityStore
      ) => new IdentityManagementService(authority, credentials, identities),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthValidationMiddleware).forRoutes('*');
  }
}
