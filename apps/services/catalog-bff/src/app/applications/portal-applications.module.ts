import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TrustedPortalIdentityReader } from '../identity/trusted-portal-identity';
import { PortalApplicationRequest } from './portal-application.request';
import { PortalApplicationTransport } from './portal-application.transport';
import { PortalApplicationDraftsClient } from './portal-application-drafts.client';
import { PortalApplicationDraftsController } from './portal-application-drafts.controller';
import { PortalApplicationImagesClient } from './portal-application-images.client';
import { PortalApplicationImagesController } from './portal-application-images.controller';
import { PortalApplicationPublicationClient } from './portal-application-publication.client';
import { PortalApplicationPublicationController } from './portal-application-publication.controller';
import { PortalApplicationOwnershipClient } from './portal-application-ownership.client';
import { PortalApplicationOwnershipController } from './portal-application-ownership.controller';

@Module({
  imports: [HttpModule],
  controllers: [
    PortalApplicationDraftsController,
    PortalApplicationImagesController,
    PortalApplicationPublicationController,
    PortalApplicationOwnershipController,
  ],
  providers: [
    TrustedPortalIdentityReader,
    PortalApplicationRequest,
    PortalApplicationTransport,
    PortalApplicationDraftsClient,
    PortalApplicationImagesClient,
    PortalApplicationPublicationClient,
    PortalApplicationOwnershipClient,
  ],
})
export class PortalApplicationsModule {}
