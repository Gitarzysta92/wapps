import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TrustedPortalIdentityReader } from '../identity/trusted-portal-identity';
import { PortalReviewRequest } from './portal-reviews.request';
import { PortalReviewsTransport } from './portal-reviews.transport';
import { PortalReviewsClient } from './portal-reviews.client';
import { PortalReviewsController } from './portal-reviews.controller';

@Module({
  imports: [HttpModule],
  controllers: [PortalReviewsController],
  providers: [
    TrustedPortalIdentityReader,
    PortalReviewRequest,
    PortalReviewsTransport,
    PortalReviewsClient,
  ],
})
export class PortalReviewsModule {}
