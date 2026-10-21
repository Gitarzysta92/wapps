import { Module } from '@nestjs/common';
import { PortalAuthModule } from './auth/portal-auth.module';
import { ExploreModule } from './explore/explore.module';
import { PortalPreferencesModule } from './preferences/portal-preferences.module';
import { PortalAccountModule } from './account/portal-account.module';
import { PortalMemberModule } from './member/portal-member.module';
import { PortalProfilesModule } from './profiles/portal-profiles.module';
import { PortalExportsModule } from './exports/portal-exports.module';
import { PortalSuitesModule } from './suites/portal-suites.module';
import { PortalApplicationsModule } from './applications/portal-applications.module';
import { PortalReleasesModule } from './releases/portal-releases.module';
import { PortalArticlesModule } from './articles/portal-articles.module';
import { PortalDiscussionsModule } from './discussions/portal-discussions.module';
import { PortalReviewsModule } from './reviews/portal-reviews.module';
import { PortalHealthMonitorsModule } from './health-monitors/portal-health-monitors.module';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { CatalogModule } from './catalog/catalog.module';
import { HealthController } from './health/health.controller';
import { CatalogReadiness } from './health/catalog-readiness';
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
    ExploreModule,
    PortalPreferencesModule,
    PortalAccountModule,
    PortalMemberModule,
    PortalProfilesModule,
    PortalExportsModule,
    PortalSuitesModule,
    PortalApplicationsModule,
    PortalReleasesModule,
    PortalArticlesModule,
    PortalDiscussionsModule,
    PortalReviewsModule,
    PortalHealthMonitorsModule,
    PortalAuthModule,
  ],
  controllers: [HealthController, PlatformController],
  providers: [CatalogReadiness],
})
export class AppModule {}
