import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TrustedPortalIdentityReader } from '../identity/trusted-portal-identity';
import { PortalReleaseRequest } from './portal-releases.request';
import { PortalReleasesTransport } from './portal-releases.transport';
import { PortalReleasesClient } from './portal-releases.client';
import { PortalReleasesController } from './portal-releases.controller';

@Module({
  imports: [HttpModule],
  controllers: [PortalReleasesController],
  providers: [
    TrustedPortalIdentityReader,
    PortalReleaseRequest,
    PortalReleasesTransport,
    PortalReleasesClient,
  ],
})
export class PortalReleasesModule {}
