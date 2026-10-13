import {
  ApplicationHealth,
  ObserveApplicationHealth,
} from './application-health/application-health';
import { MysqlApplicationHealth } from './application-health/mysql-application-health';
import { HttpHealthProbe } from './application-health/http-health-probe';
import { PublicApplicationHealth } from './application-health/public-application-health';
import {
  ApplicationHealthManagementController,
  PublicApplicationHealthController,
} from './application-health/application-health.controller';
import { HealthMonitorLifecycle } from './application-health/health-monitor.lifecycle';
import { ExplorePublications } from './application/explore-publications';
import { MysqlExplorePublications } from './infrastructure/mysql-explore-publications';
import { CatalogExplorePublicationReader } from './infrastructure/explore-publication-reader';
import { ExploreController } from './http/explore.controller';
import { FavoriteUpdateSourceAccess } from '@sdk/features/identity/libs/management';
import { MysqlEditorialFavoriteUpdates } from './infrastructure/mysql-favorite-updates';
import { FavoriteUpdateSourceController } from './http/favorite-updates.controller';
import { ProfileArticles } from './articles/profile-articles';
import {
  AccountErasureAccess,
  CleanAccountErasureParticipant,
  AccountExportSourceAccess,
} from '@sdk/features/identity/libs/management';
import { MysqlAccountErasureParticipant } from '@sdk/extras/identity-mysql';
import { AccountErasureController } from './account-erasure/account-erasure.controller';
import { CleanEditorialAccount } from './account-erasure/clean-editorial-account';
import { MysqlEditorialContributionErasure } from './account-erasure/mysql-editorial-contribution-erasure';
import { MysqlEditorialWorkspaceErasure } from './account-erasure/mysql-editorial-workspace-erasure';
import { MysqlEditorialAuditErasure } from './account-erasure/mysql-editorial-audit-erasure';
import { EraseEditorialProjections } from './account-erasure/erase-editorial-projections';
import { MysqlEditorialProjectionErasure } from './account-erasure/mysql-editorial-projection-erasure';
import { MysqlEditorialErasureCompletion } from './account-erasure/mysql-editorial-erasure-completion';
import { MysqlEditorialSnapshotReader } from './infrastructure/mysql-editorial-snapshot';
import { AccountExportController } from './account-export/account-export.controller';
import { MysqlEditorialAccountExportSource } from './account-export/mysql-editorial-account-export-source';
import { ProfileArticlesController } from './articles/profile-articles.controller';
import { ProfilePublicationTotals } from './application/profile-totals';
import { MysqlPublicationTotals } from './infrastructure/mysql-profile-totals';
import { ProfileTotalsController } from './http/profile-totals.controller';
import { ArticleCovers } from './article-covers/article-covers';
import { ArticleCoversController } from './article-covers/article-covers.controller';
import { MysqlArticleCovers } from './article-covers/mysql-article-covers';
import {
  ArticleCoverNormalizerAdapter,
  ConfiguredArticleCoverObjects,
} from './article-covers/article-cover-storage';
import { ArticleCoverReads } from './article-covers/article-cover-reads';
import { MysqlArticleCoverReads } from './article-covers/mysql-article-cover-reads';
import {
  ArticleDraftCoverReadsController,
  ArticleReviewCoverReadsController,
  ArticlePublicCoverReadsController,
} from './article-covers/article-cover-reads.controller';
import { ArticleCoverCleanup } from './article-covers/article-cover-cleanup';
import { MysqlArticleCoverCleanup } from './article-covers/mysql-article-cover-cleanup';
import { ArticleCoverCleanupLifecycle } from './article-covers/article-cover-cleanup.lifecycle';
import { Module } from '@nestjs/common';
import { ArticleWorkspace } from './articles/article-workspace';
import { MysqlArticleWorkspace } from './articles/mysql-article-workspace';
import { ArticleCatalog } from './articles/article-catalog';
import { MysqlArticleCatalog } from './articles/mysql-article-catalog';
import {
  ArticlesController,
  ArticleReviewsController,
  ArticleCatalogController,
} from './articles/articles.controller';
import { ReleaseWorkspace } from './releases/release-workspace';
import { MysqlReleaseWorkspace } from './releases/mysql-release-workspace';
import { ReleaseCatalog } from './releases/release-catalog';
import { MysqlReleaseCatalog } from './releases/mysql-release-catalog';
import {
  ReleasesController,
  ReleaseReviewsController,
  ReleaseCatalogController,
} from './releases/releases.controller';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { randomBytes } from 'node:crypto';
import { ApplicationImages } from './application-media/application-images';
import { ApplicationImageCleanup } from './application-media/application-image-cleanup';
import { MysqlApplicationImageCleanup } from './application-media/mysql-application-image-cleanup';
import { ApplicationImageCleanupLifecycle } from './application-media/application-image-cleanup.lifecycle';
import { ApplicationImageReads } from './application-media/application-image-reads';
import { MysqlApplicationImageReads } from './application-media/mysql-application-image-reads';
import {
  ApplicationDraftImageReadsController,
  ApplicationReviewImageReadsController,
  ApplicationPublicImageReadsController,
} from './application-media/application-image-reads.controller';
import { ApplicationImagesController } from './application-media/application-images.controller';
import { MysqlApplicationImages } from './application-media/mysql-application-images';
import { SharpApplicationImages } from './application-media/sharp-application-images';
import { ConfiguredApplicationImageObjects } from './application-media/configured-application-image-objects';
import { ApplicationOwnership } from './application-ownership/application-ownership';
import { MysqlApplicationOwnership } from './application-ownership/mysql-application-ownership';
import { DnsOwnershipProof } from './application-ownership/dns-ownership-proof';
import {
  ApplicationOwnershipController,
  ApplicationOwnershipReviewController,
} from './application-ownership/application-ownership.controller';
import { AppsController } from './apps/apps.controller';
import { CategoriesController } from './categories/categories.controller';
import { TagsController } from './tags/tags.controller';
import { EditorialCommands } from './application/editorial-commands';
import { EditorialQueries } from './application/editorial-queries';
import { MysqlEditorialWrites } from './infrastructure/mysql-editorial-writes';
import { MysqlEditorialReads } from './infrastructure/mysql-editorial-reads';
import { OpaEditorialPolicy } from './infrastructure/opa-editorial-policy';
import { EditorialOutboxDispatcher } from './infrastructure/editorial-outbox.dispatcher';
import { EditorialCatalog } from './application/editorial-catalog';
import { MysqlCatalogAuthority } from './infrastructure/mysql-catalog-authority';
import { EditorialCatalogProjections } from './infrastructure/editorial-catalog-projections';
import { EditorialCatalogController } from './http/editorial-catalog.controller';
import { SuiteWorkspaceController } from './suites/suite-workspace.controller';
import { SuiteWorkspace } from './suites/suite-workspace';
import { MysqlSuiteWorkspace } from './suites/mysql-suite-workspace';
import {
  SuitePublicationController,
  SuiteReviewController,
} from './suites/suite-publication.controller';
import { SuitePublication } from './suites/suite-publication';
import { MysqlSuitePublication } from './suites/mysql-suite-publication';
import { SuiteCatalog } from './suites/suite-catalog';
import { MysqlSuiteCatalog } from './suites/mysql-suite-catalog';
import { SuiteCatalogController } from './suites/suite-catalog.controller';
import { ProfileSuites } from './suites/profile-suites';
import { ProfileSuitesController } from './suites/profile-suites.controller';
import { ProfilePublicationActivity } from './application/profile-activity';
import { MysqlPublicationActivity } from './infrastructure/mysql-profile-activity';
import { CatalogPublicationActivityReader } from './infrastructure/publication-activity-reader';
import { ProfileActivityController } from './http/profile-activity.controller';
import { ApplicationDrafts } from './application-drafts/application-drafts';
import { ApplicationDraftsController } from './application-drafts/application-drafts.controller';
import { MysqlApplicationDrafts } from './application-drafts/mysql-application-drafts';
import { ApplicationPublication } from './application-publication/application-publication';
import { MysqlApplicationPublication } from './application-publication/mysql-application-publication';
import {
  ApplicationPublicationController,
  ApplicationReviewController,
} from './application-publication/application-publication.controller';

@Module({
  controllers: [
    ApplicationHealthManagementController,
    PublicApplicationHealthController,
    ExploreController,
    FavoriteUpdateSourceController,
    AccountErasureController,
    AccountExportController,
    ProfileTotalsController,
    ArticleCoversController,
    ArticleDraftCoverReadsController,
    ArticleReviewCoverReadsController,
    ArticlePublicCoverReadsController,
    ArticlesController,
    ArticleReviewsController,
    ArticleCatalogController,
    ReleasesController,
    ReleaseReviewsController,
    ReleaseCatalogController,
    ApplicationDraftImageReadsController,
    ApplicationReviewImageReadsController,
    ApplicationPublicImageReadsController,
    ApplicationImagesController,
    AppsController,
    CategoriesController,
    TagsController,
    EditorialCatalogController,
    SuiteWorkspaceController,
    SuitePublicationController,
    SuiteReviewController,
    SuiteCatalogController,
    ProfileSuitesController,
    ProfileArticlesController,
    ProfileActivityController,
    ApplicationDraftsController,
    ApplicationPublicationController,
    ApplicationReviewController,
    ApplicationOwnershipController,
    ApplicationOwnershipReviewController,
  ],
  providers: [
    {
      provide: MysqlApplicationHealth,
      inject: [DataSource, ConfigService],
      useFactory: (source: DataSource, config: ConfigService) =>
        new MysqlApplicationHealth(
          source,
          config.get('EDITORIAL_PUBLIC_TENANT') ?? 'default'
        ),
    },
    {
      provide: ApplicationHealth,
      inject: [MysqlApplicationHealth, OpaEditorialPolicy, ConfigService],
      useFactory: (
        store: MysqlApplicationHealth,
        policy: OpaEditorialPolicy,
        config: ConfigService
      ) =>
        new ApplicationHealth(
          store,
          policy,
          config.get('EDITORIAL_PUBLIC_TENANT') ?? 'default'
        ),
    },
    {
      provide: PublicApplicationHealth,
      inject: [EditorialCatalog, ApplicationHealth],
      useFactory: (catalog: EditorialCatalog, health: ApplicationHealth) =>
        new PublicApplicationHealth(catalog, health),
    },
    {
      provide: ObserveApplicationHealth,
      inject: [ApplicationHealth, MysqlApplicationHealth],
      useFactory: (health: ApplicationHealth, store: MysqlApplicationHealth) =>
        new ObserveApplicationHealth(
          health,
          store,
          new HttpHealthProbe(),
          uuidv7
        ),
    },
    HealthMonitorLifecycle,
    {
      provide: ExplorePublications,
      inject: [
        DataSource,
        EditorialCatalog,
        SuiteCatalog,
        ArticleCatalog,
        ReleaseCatalog,
        OpaEditorialPolicy,
        ConfigService,
      ],
      useFactory: (
        source: DataSource,
        apps: EditorialCatalog,
        suites: SuiteCatalog,
        articles: ArticleCatalog,
        releases: ReleaseCatalog,
        policy: OpaEditorialPolicy,
        config: ConfigService
      ) =>
        new ExplorePublications(
          new MysqlExplorePublications(
            source,
            config.get<string>('EDITORIAL_PUBLIC_TENANT') ?? 'default'
          ),
          new CatalogExplorePublicationReader(apps, suites, articles, releases),
          policy
        ),
    },
    {
      provide: FavoriteUpdateSourceAccess,
      inject: [DataSource, ConfigService, OpaEditorialPolicy],
      useFactory: (
        source: DataSource,
        config: ConfigService,
        policy: OpaEditorialPolicy
      ) =>
        new FavoriteUpdateSourceAccess(
          new MysqlEditorialFavoriteUpdates(
            source,
            config.get<string>('EDITORIAL_PUBLIC_TENANT') ?? 'default'
          ),
          policy,
          'editorial'
        ),
    },
    {
      provide: AccountErasureAccess,
      inject: [
        DataSource,
        OpaEditorialPolicy,
        ConfigService,
        EditorialCatalogProjections,
      ],
      useFactory: (
        source: DataSource,
        policy: OpaEditorialPolicy,
        config: ConfigService,
        projections: EditorialCatalogProjections
      ) => {
        const activation = config.get<string>(
          'EDITORIAL_ERASURE_WORKERS_FENCED'
        );
        if (activation !== undefined && !['true', 'false'].includes(activation))
          throw new Error('Invalid EDITORIAL_ERASURE_WORKERS_FENCED setting');
        return new AccountErasureAccess(
          new CleanAccountErasureParticipant(
            new MysqlAccountErasureParticipant('editorial', source),
            new CleanEditorialAccount(
              new MysqlEditorialContributionErasure(source),
              new MysqlEditorialWorkspaceErasure(source),
              new MysqlEditorialAuditErasure(source),
              new EraseEditorialProjections(
                new MysqlEditorialProjectionErasure(source),
                new MysqlEditorialSnapshotReader(
                  source,
                  config.get<string>('EDITORIAL_PUBLIC_TENANT') ?? 'default'
                ),
                projections
              ),
              new MysqlEditorialErasureCompletion(source),
              activation === 'true'
            )
          ),
          policy
        );
      },
    },
    {
      provide: AccountExportSourceAccess,
      inject: [
        DataSource,
        OpaEditorialPolicy,
        ConfiguredApplicationImageObjects,
        ConfiguredArticleCoverObjects,
      ],
      useFactory: (
        source: DataSource,
        policy: OpaEditorialPolicy,
        applications: ConfiguredApplicationImageObjects,
        articles: ConfiguredArticleCoverObjects
      ) =>
        new AccountExportSourceAccess(
          new MysqlEditorialAccountExportSource(source, {
            applications,
            articles,
          }),
          policy
        ),
    },
    {
      provide: ProfilePublicationTotals,
      inject: [DataSource, OpaEditorialPolicy, ConfigService],
      useFactory: (
        source: DataSource,
        policy: OpaEditorialPolicy,
        config: ConfigService
      ) => {
        const tenant =
          config.get<string>('EDITORIAL_PUBLIC_TENANT') ?? 'default';
        return new ProfilePublicationTotals(
          new MysqlPublicationTotals(source, tenant),
          policy,
          tenant
        );
      },
    },
    {
      provide: ProfilePublicationActivity,
      inject: [
        DataSource,
        EditorialCatalog,
        SuiteCatalog,
        ArticleCatalog,
        ReleaseCatalog,
        OpaEditorialPolicy,
        ConfigService,
      ],
      useFactory: (
        source: DataSource,
        applications: EditorialCatalog,
        suites: SuiteCatalog,
        articles: ArticleCatalog,
        releases: ReleaseCatalog,
        policy: OpaEditorialPolicy,
        config: ConfigService
      ) => {
        const tenant =
          config.get<string>('EDITORIAL_PUBLIC_TENANT') ?? 'default';
        return new ProfilePublicationActivity(
          new MysqlPublicationActivity(source, tenant),
          new CatalogPublicationActivityReader(
            applications,
            suites,
            articles,
            releases
          ),
          policy,
          tenant
        );
      },
    },
    {
      provide: ProfileArticles,
      inject: [ArticleCatalog, OpaEditorialPolicy, ConfigService],
      useFactory: (
        catalog: ArticleCatalog,
        policy: OpaEditorialPolicy,
        config: ConfigService
      ) =>
        new ProfileArticles(
          catalog,
          policy,
          config.get<string>('EDITORIAL_PUBLIC_TENANT') ?? 'default'
        ),
    },
    {
      provide: ProfileSuites,
      inject: [SuiteCatalog, OpaEditorialPolicy, ConfigService],
      useFactory: (
        catalog: SuiteCatalog,
        policy: OpaEditorialPolicy,
        config: ConfigService
      ) =>
        new ProfileSuites(
          catalog,
          policy,
          config.get<string>('EDITORIAL_PUBLIC_TENANT') ?? 'default'
        ),
    },
    {
      provide: SharpApplicationImages,
      useFactory: () => new SharpApplicationImages(),
    },
    ConfiguredArticleCoverObjects,
    ArticleCoverCleanupLifecycle,
    {
      provide: ArticleCovers,
      inject: [
        DataSource,
        OpaEditorialPolicy,
        ConfiguredArticleCoverObjects,
        SharpApplicationImages,
      ],
      useFactory: (
        source: DataSource,
        policy: OpaEditorialPolicy,
        objects: ConfiguredArticleCoverObjects,
        normalizer: SharpApplicationImages
      ) =>
        new ArticleCovers(
          new MysqlArticleCovers(source),
          new ArticleCoverNormalizerAdapter(normalizer),
          objects,
          policy,
          { generate: uuidv7 }
        ),
    },
    {
      provide: ArticleCoverCleanup,
      inject: [DataSource, ConfiguredArticleCoverObjects],
      useFactory: (
        source: DataSource,
        objects: ConfiguredArticleCoverObjects
      ) =>
        new ArticleCoverCleanup(new MysqlArticleCoverCleanup(source), objects),
    },
    {
      provide: ArticleCoverReads,
      inject: [
        DataSource,
        OpaEditorialPolicy,
        ConfiguredArticleCoverObjects,
        ConfigService,
      ],
      useFactory: (
        source: DataSource,
        policy: OpaEditorialPolicy,
        objects: ConfiguredArticleCoverObjects,
        config: ConfigService
      ) =>
        new ArticleCoverReads(
          new MysqlArticleCoverReads(
            source,
            config.get<string>('EDITORIAL_PUBLIC_TENANT') ?? 'default'
          ),
          objects,
          policy
        ),
    },
    {
      provide: ArticleWorkspace,
      inject: [DataSource, OpaEditorialPolicy],
      useFactory: (source: DataSource, policy: OpaEditorialPolicy) =>
        new ArticleWorkspace(new MysqlArticleWorkspace(source), policy, {
          generate: uuidv7,
        }),
    },
    {
      provide: ArticleCatalog,
      inject: [DataSource, ConfigService, EditorialCatalogProjections],
      useFactory: (
        source: DataSource,
        config: ConfigService,
        projections: EditorialCatalogProjections
      ) =>
        new ArticleCatalog(
          new MysqlArticleCatalog(
            source,
            config.get<string>('EDITORIAL_PUBLIC_TENANT') ?? 'default'
          ),
          projections
        ),
    },
    {
      provide: ReleaseWorkspace,
      inject: [DataSource, OpaEditorialPolicy],
      useFactory: (source: DataSource, policy: OpaEditorialPolicy) =>
        new ReleaseWorkspace(new MysqlReleaseWorkspace(source), policy, {
          generate: uuidv7,
        }),
    },
    {
      provide: ReleaseCatalog,
      inject: [DataSource, ConfigService, EditorialCatalogProjections],
      useFactory: (
        source: DataSource,
        config: ConfigService,
        projections: EditorialCatalogProjections
      ) =>
        new ReleaseCatalog(
          new MysqlReleaseCatalog(
            source,
            config.get<string>('EDITORIAL_PUBLIC_TENANT') ?? 'default'
          ),
          projections
        ),
    },
    ApplicationImageCleanupLifecycle,
    {
      provide: ApplicationImageCleanup,
      inject: [DataSource, ConfiguredApplicationImageObjects],
      useFactory: (
        source: DataSource,
        objects: ConfiguredApplicationImageObjects
      ) =>
        new ApplicationImageCleanup(
          new MysqlApplicationImageCleanup(source),
          objects
        ),
    },
    {
      provide: ApplicationImageReads,
      inject: [
        DataSource,
        OpaEditorialPolicy,
        ConfiguredApplicationImageObjects,
        ConfigService,
      ],
      useFactory: (
        source: DataSource,
        policy: OpaEditorialPolicy,
        objects: ConfiguredApplicationImageObjects,
        config: ConfigService
      ) =>
        new ApplicationImageReads(
          new MysqlApplicationImageReads(
            source,
            config.get<string>('EDITORIAL_PUBLIC_TENANT') ?? 'default'
          ),
          objects,
          policy
        ),
    },
    ConfiguredApplicationImageObjects,
    {
      provide: ApplicationImages,
      inject: [
        DataSource,
        OpaEditorialPolicy,
        ConfiguredApplicationImageObjects,
        SharpApplicationImages,
      ],
      useFactory: (
        source: DataSource,
        policy: OpaEditorialPolicy,
        objects: ConfiguredApplicationImageObjects,
        normalizer: SharpApplicationImages
      ) =>
        new ApplicationImages(
          new MysqlApplicationImages(source),
          normalizer,
          objects,
          policy,
          { generate: uuidv7 }
        ),
    },
    {
      provide: ApplicationOwnership,
      inject: [DataSource, OpaEditorialPolicy, ConfigService],
      useFactory: (
        source: DataSource,
        policy: OpaEditorialPolicy,
        config: ConfigService
      ) =>
        new ApplicationOwnership(
          new MysqlApplicationOwnership(source),
          DnsOwnershipProof.configured(
            config.get<string>('EDITORIAL_OWNERSHIP_DNS_SERVERS')
          ),
          policy,
          { id: uuidv7, token: () => randomBytes(32).toString('hex') }
        ),
    },
    {
      provide: ApplicationPublication,
      inject: [DataSource, OpaEditorialPolicy, ConfigService],
      useFactory: (
        source: DataSource,
        policy: OpaEditorialPolicy,
        config: ConfigService
      ) =>
        new ApplicationPublication(
          new MysqlApplicationPublication(
            source,
            config.get<string>('EDITORIAL_MEDIA_PUBLIC_ORIGIN')
          ),
          policy
        ),
    },
    {
      provide: ApplicationDrafts,
      inject: [DataSource, OpaEditorialPolicy],
      useFactory: (source: DataSource, policy: OpaEditorialPolicy) =>
        new ApplicationDrafts(new MysqlApplicationDrafts(source), policy, {
          generate: uuidv7,
        }),
    },
    {
      provide: SuiteCatalog,
      inject: [DataSource, ConfigService, EditorialCatalogProjections],
      useFactory: (
        source: DataSource,
        config: ConfigService,
        projections: EditorialCatalogProjections
      ) =>
        new SuiteCatalog(
          new MysqlSuiteCatalog(
            source,
            config.get('EDITORIAL_PUBLIC_TENANT') ?? 'default'
          ),
          projections
        ),
    },
    {
      provide: SuitePublication,
      inject: [DataSource, ConfigService, OpaEditorialPolicy],
      useFactory: (
        source: DataSource,
        config: ConfigService,
        policy: OpaEditorialPolicy
      ) =>
        new SuitePublication(
          new MysqlSuitePublication(
            source,
            config.get('EDITORIAL_PUBLIC_TENANT') ?? 'default'
          ),
          policy
        ),
    },
    {
      provide: SuiteWorkspace,
      inject: [DataSource, ConfigService, OpaEditorialPolicy],
      useFactory: (
        source: DataSource,
        config: ConfigService,
        policy: OpaEditorialPolicy
      ) =>
        new SuiteWorkspace(
          new MysqlSuiteWorkspace(
            source,
            config.get('EDITORIAL_PUBLIC_TENANT') ?? 'default'
          ),
          policy,
          { generate: uuidv7 }
        ),
    },
    EditorialOutboxDispatcher,
    EditorialCatalogProjections,
    {
      provide: MysqlCatalogAuthority,
      inject: [DataSource, ConfigService],
      useFactory: (source: DataSource, config: ConfigService) =>
        new MysqlCatalogAuthority(
          source,
          config.get('EDITORIAL_PUBLIC_TENANT') ?? 'default'
        ),
    },
    {
      provide: EditorialCatalog,
      inject: [MysqlCatalogAuthority, EditorialCatalogProjections],
      useFactory: (
        authority: MysqlCatalogAuthority,
        projections: EditorialCatalogProjections
      ) => new EditorialCatalog(authority, projections),
    },
    {
      provide: MysqlEditorialWrites,
      inject: [DataSource, ConfigService],
      useFactory: (source: DataSource, config: ConfigService) =>
        new MysqlEditorialWrites(
          source,
          config.get('EDITORIAL_PUBLIC_TENANT') ?? 'default'
        ),
    },
    {
      provide: MysqlEditorialReads,
      inject: [DataSource, ConfigService],
      useFactory: (source: DataSource, config: ConfigService) =>
        new MysqlEditorialReads(
          source,
          config.get('EDITORIAL_PUBLIC_TENANT') ?? 'default'
        ),
    },
    {
      provide: OpaEditorialPolicy,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new OpaEditorialPolicy(
          config.get('OPA_URL') ?? 'http://localhost:8181'
        ),
    },
    {
      provide: EditorialCommands,
      inject: [MysqlEditorialWrites, OpaEditorialPolicy],
      useFactory: (writes: MysqlEditorialWrites, policy: OpaEditorialPolicy) =>
        new EditorialCommands(writes, policy, { generate: uuidv7 }),
    },
    {
      provide: EditorialQueries,
      inject: [MysqlEditorialReads, ConfigService],
      useFactory: (reads: MysqlEditorialReads, config: ConfigService) =>
        new EditorialQueries(
          reads,
          config.get('EDITORIAL_PUBLIC_TENANT') ?? 'default'
        ),
    },
  ],
})
export class EditorialModule {}
