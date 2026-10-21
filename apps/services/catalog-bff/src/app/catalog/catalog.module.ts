import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { EditorialClient } from './clients/editorial.client';
import { ApplicationHealthClient } from './application-health.client';
import { ApplicationHealthController } from './application-health.controller';
import { PublicDiscoveryController } from './discovery.controller';
import { PublicDiscoveryService } from './discovery.service';
import { DiscoveryPublicationsClient } from './discovery-publications.client';
import { DiscoveryReviewsClient } from './discovery-reviews.client';

@Module({
  imports: [HttpModule],
  controllers: [
    CatalogController,
    ApplicationHealthController,
    PublicDiscoveryController,
  ],
  exports: [EditorialClient],
  providers: [
    EditorialClient,
    ApplicationHealthClient,
    DiscoveryPublicationsClient,
    DiscoveryReviewsClient,
    {
      provide: PublicDiscoveryService,
      inject: [EditorialClient, DiscoveryPublicationsClient, DiscoveryReviewsClient],
      useFactory: (
        applications: EditorialClient,
        publications: DiscoveryPublicationsClient,
        reviews: DiscoveryReviewsClient
      ) => new PublicDiscoveryService(applications, publications, reviews),
    },
    {
      provide: CatalogService,
      inject: [EditorialClient],
      useFactory: (catalog: EditorialClient) => new CatalogService(catalog),
    },
  ],
})
export class CatalogModule {}
